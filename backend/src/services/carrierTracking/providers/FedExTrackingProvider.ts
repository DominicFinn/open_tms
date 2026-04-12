/**
 * FedExTrackingProvider -- FedEx Track API v1 implementation.
 *
 * Docs: https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
 *
 * Supports both polling (batch up to 30) and webhook push notifications.
 * Uses OAuth 2.0 client_credentials flow for authentication.
 */

import {
  ICarrierTrackingProvider,
  NormalizedTrackingStatus,
  NormalizedTrackingStatusCode,
  TrackingPollRequest,
  TrackingPollResult,
  WebhookParseResult,
  CarrierTrackingError,
} from '../ICarrierTrackingProvider.js';
import { createHmac } from 'crypto';

const FEDEX_PRODUCTION_URL = 'https://apis.fedex.com';
const FEDEX_SANDBOX_URL = 'https://apis-sandbox.fedex.com';

/** Buffer (ms) before token expiry to trigger re-auth */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface FedExCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber?: string;
  sandbox?: boolean;
}

interface FedExScanEvent {
  date?: string;
  eventType?: string;
  eventDescription?: string;
  scanLocation?: {
    city?: string;
    stateOrProvinceCode?: string;
    countryCode?: string;
    postalCode?: string;
  };
  derivedStatusCode?: string;
  derivedStatus?: string;
}

interface FedExTrackResult {
  trackingNumber?: string;
  latestStatusDetail?: {
    code?: string;
    derivedCode?: string;
    description?: string;
    statusByLocale?: string;
  };
  dateAndTimes?: Array<{
    type?: string;
    dateTime?: string;
  }>;
  scanEvents?: FedExScanEvent[];
  estimatedDeliveryTimeWindow?: {
    window?: {
      begins?: string;
      ends?: string;
    };
  };
  deliveryDetails?: {
    receivedByName?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

export class FedExTrackingProvider implements ICarrierTrackingProvider {
  readonly name = 'FedEx';
  readonly supportsWebhooks = true;
  readonly supportsPolling = true;
  readonly maxBatchSize = 30;
  readonly rateLimitPerSecond = 10;
  readonly rateLimitPerDay = 10_000;

  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private baseUrl: string = FEDEX_PRODUCTION_URL;
  private credentials: FedExCredentials | null = null;

  async authenticate(credentials: Record<string, unknown>): Promise<void> {
    const creds = credentials as unknown as FedExCredentials;

    if (!creds.clientId || !creds.clientSecret) {
      throw new CarrierTrackingError(
        'FedEx credentials require clientId and clientSecret',
        this.name,
        undefined,
        false,
      );
    }

    this.credentials = creds;
    this.baseUrl = creds.sandbox ? FEDEX_SANDBOX_URL : FEDEX_PRODUCTION_URL;

    await this.refreshToken();
  }

  async pollTracking(request: TrackingPollRequest): Promise<TrackingPollResult[]> {
    await this.ensureAuthenticated();

    const results: TrackingPollResult[] = [];

    // FedEx Track API supports up to 30 tracking numbers per request
    for (let i = 0; i < request.trackingNumbers.length; i += this.maxBatchSize) {
      const batch = request.trackingNumbers.slice(i, i + this.maxBatchSize);
      const batchResults = await this.pollBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  async parseWebhook(
    payload: unknown,
    _headers: Record<string, string>,
  ): Promise<WebhookParseResult[]> {
    const body = payload as Record<string, unknown>;
    const results: WebhookParseResult[] = [];

    // FedEx webhooks send tracking updates in the body
    const trackingData = body.trackingData as Record<string, unknown> | undefined;
    if (!trackingData) {
      return results;
    }

    const trackingNumber = trackingData.trackingNumber as string | undefined;
    if (!trackingNumber) {
      return results;
    }

    const events: NormalizedTrackingStatus[] = [];

    const eventType = trackingData.eventType as string | undefined;
    const eventDescription = trackingData.eventDescription as string | undefined;
    const eventTimestamp = trackingData.eventTimestamp as string | undefined;
    const location = trackingData.scanLocation as Record<string, string> | undefined;

    if (eventType) {
      events.push({
        status: this.mapFedExStatus(eventType),
        statusDetail: eventDescription,
        statusCode: eventType,
        city: location?.city,
        state: location?.stateOrProvinceCode,
        country: location?.countryCode,
        occurredAt: eventTimestamp ? new Date(eventTimestamp) : new Date(),
      });
    }

    if (events.length > 0) {
      results.push({ trackingNumber, events });
    }

    return results;
  }

  verifyWebhookSignature(
    payload: unknown,
    headers: Record<string, string>,
    secret: string,
  ): boolean {
    const signature = headers['x-fedex-signature'] || headers['X-FedEx-Signature'] || '';
    if (!signature) {
      return false;
    }

    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const computed = createHmac('sha256', secret).update(bodyStr).digest('hex');

    // Constant-time comparison
    if (computed.length !== signature.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < computed.length; i++) {
      mismatch |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  }

  /* ---------- private helpers ---------- */

  private async pollBatch(trackingNumbers: string[]): Promise<TrackingPollResult[]> {
    const trackingInfo = trackingNumbers.map((tn) => ({
      trackingNumberInfo: { trackingNumber: tn },
    }));

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/track/v1/trackingnumbers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
        body: JSON.stringify({
          trackingInfo,
          includeDetailedScans: true,
        }),
      });
    } catch (err) {
      throw new CarrierTrackingError(
        `FedEx API request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }

    if (response.status === 429) {
      throw new CarrierTrackingError(
        'FedEx rate limit exceeded',
        this.name,
        429,
        true,
      );
    }

    if (!response.ok) {
      throw new CarrierTrackingError(
        `FedEx API returned HTTP ${response.status}`,
        this.name,
        response.status,
        response.status >= 500,
      );
    }

    const json = (await response.json()) as {
      output?: {
        completeTrackResults?: Array<{
          trackingNumber?: string;
          trackResults?: FedExTrackResult[];
        }>;
      };
    };

    const results: TrackingPollResult[] = [];
    const completeResults = json.output?.completeTrackResults ?? [];

    for (const ctr of completeResults) {
      const tn = ctr.trackingNumber ?? '';
      const trackResult = ctr.trackResults?.[0];

      if (!trackResult || trackResult.error) {
        results.push({
          trackingNumber: tn,
          success: false,
          errorMessage: trackResult?.error?.message ?? 'No tracking data returned',
          events: [],
        });
        continue;
      }

      const events = this.parseScanEvents(trackResult);
      const latestStatus = events.length > 0 ? events[0] : undefined;

      results.push({
        trackingNumber: tn,
        success: true,
        events,
        latestStatus,
      });
    }

    return results;
  }

  private parseScanEvents(trackResult: FedExTrackResult): NormalizedTrackingStatus[] {
    const events: NormalizedTrackingStatus[] = [];
    const scanEvents = trackResult.scanEvents ?? [];

    // Parse estimated delivery window
    let estimatedDelivery: Date | undefined;
    const edtw = trackResult.estimatedDeliveryTimeWindow?.window;
    if (edtw?.ends) {
      estimatedDelivery = new Date(edtw.ends);
    } else if (edtw?.begins) {
      estimatedDelivery = new Date(edtw.begins);
    }

    // Also check dateAndTimes for estimated delivery
    if (!estimatedDelivery && trackResult.dateAndTimes) {
      for (const dt of trackResult.dateAndTimes) {
        if (dt.type === 'ESTIMATED_DELIVERY' && dt.dateTime) {
          estimatedDelivery = new Date(dt.dateTime);
          break;
        }
      }
    }

    const signedBy = trackResult.deliveryDetails?.receivedByName;

    for (const scan of scanEvents) {
      const statusCode = scan.derivedStatusCode ?? scan.eventType ?? '';
      const occurredAt = scan.date ? new Date(scan.date) : new Date();

      events.push({
        status: this.mapFedExStatus(statusCode),
        statusDetail: scan.eventDescription ?? scan.derivedStatus,
        statusCode,
        city: scan.scanLocation?.city,
        state: scan.scanLocation?.stateOrProvinceCode,
        country: scan.scanLocation?.countryCode,
        postalCode: scan.scanLocation?.postalCode,
        occurredAt,
        estimatedDelivery,
        signedBy: statusCode === 'DL' ? signedBy : undefined,
      });
    }

    return events;
  }

  private mapFedExStatus(eventType: string): NormalizedTrackingStatusCode {
    const code = eventType.toUpperCase();

    switch (code) {
      case 'PU': // Picked up
      case 'IT': // In transit
      case 'AR': // At FedEx facility
      case 'DP': // Departed FedEx facility
      case 'CC': // Customs cleared
        return 'in_transit';

      case 'OD': // Out for delivery
        return 'out_for_delivery';

      case 'DL': // Delivered
        return 'delivered';

      case 'DE': // Delivery exception
      case 'SE': // Shipment exception
      case 'CA': // Cancelled / Shipment cancelled
      case 'CD': // Clearance delay
      case 'HP': // Hold at location - problem
        return 'exception';

      case 'RS': // Return to shipper
        return 'return_to_sender';

      case 'OC': // Order created
      case 'IN': // Initiated
        return 'info_received';

      default:
        return 'unknown';
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.credentials) {
      throw new CarrierTrackingError(
        'FedEx provider not authenticated. Call authenticate() first.',
        this.name,
        undefined,
        false,
      );
    }

    const now = Date.now();
    if (!this.accessToken || now >= this.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
      await this.refreshToken();
    }
  }

  private async refreshToken(): Promise<void> {
    if (!this.credentials) {
      throw new CarrierTrackingError(
        'Cannot refresh token without credentials',
        this.name,
        undefined,
        false,
      );
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', this.credentials.clientId);
    params.set('client_secret', this.credentials.clientSecret);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
    } catch (err) {
      throw new CarrierTrackingError(
        `FedEx OAuth request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }

    if (!response.ok) {
      throw new CarrierTrackingError(
        `FedEx OAuth returned HTTP ${response.status}`,
        this.name,
        response.status,
        response.status >= 500,
      );
    }

    const json = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    this.accessToken = json.access_token;
    // expires_in is in seconds; convert to absolute ms timestamp
    this.tokenExpiresAt = Date.now() + json.expires_in * 1000;
  }
}
