/**
 * UPSTrackingProvider -- UPS Track API v1 implementation.
 *
 * Docs: https://developer.ups.com/api/reference?loc=en_US#tag/Tracking_openapi
 *
 * UPS Track API is single-tracking per request. Batch tracking is available
 * via Track Alert (different endpoint) but not implemented here.
 * Uses OAuth 2.0 client_credentials flow.
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
import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';

const UPS_PRODUCTION_URL = 'https://onlinetools.ups.com';
const UPS_SANDBOX_URL = 'https://wwwcie.ups.com';

/** Buffer (ms) before token expiry to trigger re-auth */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface UPSCredentials {
  clientId: string;
  clientSecret: string;
  sandbox?: boolean;
}

interface UPSActivity {
  status?: {
    type?: string;
    description?: string;
    code?: string;
    statusCode?: string;
  };
  location?: {
    address?: {
      city?: string;
      stateProvince?: string;
      countryCode?: string;
      postalCode?: string;
    };
  };
  date?: string; // YYYYMMDD
  time?: string; // HHmmss
}

interface UPSPackage {
  trackingNumber?: string;
  activity?: UPSActivity[];
  deliveryDate?: Array<{
    type?: string;
    date?: string;
  }>;
  currentStatus?: {
    type?: string;
    description?: string;
    code?: string;
  };
}

export class UPSTrackingProvider implements ICarrierTrackingProvider {
  readonly name = 'UPS';
  readonly supportsWebhooks = true;
  readonly supportsPolling = true;
  readonly maxBatchSize = 1;
  readonly rateLimitPerSecond = 5;
  readonly rateLimitPerDay = 5_000;

  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private baseUrl: string = UPS_PRODUCTION_URL;
  private credentials: UPSCredentials | null = null;

  async authenticate(credentials: Record<string, unknown>): Promise<void> {
    const creds = credentials as unknown as UPSCredentials;

    if (!creds.clientId || !creds.clientSecret) {
      throw new CarrierTrackingError(
        'UPS credentials require clientId and clientSecret',
        this.name,
        undefined,
        false,
      );
    }

    this.credentials = creds;
    this.baseUrl = creds.sandbox ? UPS_SANDBOX_URL : UPS_PRODUCTION_URL;

    await this.refreshToken();
  }

  async pollTracking(request: TrackingPollRequest): Promise<TrackingPollResult[]> {
    await this.ensureAuthenticated();

    const results: TrackingPollResult[] = [];

    // UPS Track API is single-tracking per request
    for (const trackingNumber of request.trackingNumbers) {
      try {
        const result = await this.pollSingle(trackingNumber);
        results.push(result);
      } catch (err) {
        if (err instanceof CarrierTrackingError && !err.retryable) {
          results.push({
            trackingNumber,
            success: false,
            errorMessage: err.message,
            events: [],
          });
        } else {
          throw err;
        }
      }
    }

    return results;
  }

  async parseWebhook(
    payload: unknown,
    _headers: Record<string, string>,
  ): Promise<WebhookParseResult[]> {
    const body = payload as Record<string, unknown>;
    const results: WebhookParseResult[] = [];

    // UPS Quantum View / webhooks send package-level updates
    const trackingNumber = body.trackingNumber as string | undefined;
    if (!trackingNumber) {
      return results;
    }

    const events: NormalizedTrackingStatus[] = [];
    const statusType = body.statusType as string | undefined;
    const statusDescription = body.statusDescription as string | undefined;
    const timestamp = body.dateTime as string | undefined;
    const location = body.location as Record<string, string> | undefined;

    if (statusType) {
      events.push({
        status: this.mapUPSStatus(statusType),
        statusDetail: statusDescription,
        statusCode: statusType,
        city: location?.city,
        state: location?.stateProvince,
        country: location?.countryCode,
        occurredAt: timestamp ? new Date(timestamp) : new Date(),
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
    const signature = headers['x-ups-signature'] || headers['X-UPS-Signature'] || '';
    if (!signature) {
      return false;
    }

    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const computed = createHmac('sha256', secret).update(bodyStr).digest('hex');

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

  private async pollSingle(trackingNumber: string): Promise<TrackingPollResult> {
    const transId = randomUUID();

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/track/v1/details/${encodeURIComponent(trackingNumber)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'transId': transId,
            'transactionSrc': 'OpenTMS',
          },
        },
      );
    } catch (err) {
      throw new CarrierTrackingError(
        `UPS API request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }

    if (response.status === 429) {
      throw new CarrierTrackingError(
        'UPS rate limit exceeded',
        this.name,
        429,
        true,
      );
    }

    if (!response.ok) {
      throw new CarrierTrackingError(
        `UPS API returned HTTP ${response.status}`,
        this.name,
        response.status,
        response.status >= 500,
      );
    }

    const json = (await response.json()) as {
      trackResponse?: {
        shipment?: Array<{
          package?: UPSPackage[];
        }>;
      };
    };

    const pkg = json.trackResponse?.shipment?.[0]?.package?.[0];
    if (!pkg) {
      return {
        trackingNumber,
        success: false,
        errorMessage: 'No package data in UPS response',
        events: [],
      };
    }

    const events = this.parseActivities(pkg);
    const latestStatus = events.length > 0 ? events[0] : undefined;

    return {
      trackingNumber,
      success: true,
      events,
      latestStatus,
    };
  }

  private parseActivities(pkg: UPSPackage): NormalizedTrackingStatus[] {
    const events: NormalizedTrackingStatus[] = [];

    // Parse estimated delivery
    let estimatedDelivery: Date | undefined;
    if (pkg.deliveryDate) {
      for (const dd of pkg.deliveryDate) {
        if (dd.type === 'SDD' || dd.type === 'DEL') {
          if (dd.date) {
            estimatedDelivery = this.parseUPSDate(dd.date);
            break;
          }
        }
      }
    }

    for (const activity of pkg.activity ?? []) {
      const statusType = activity.status?.type ?? '';
      const occurredAt = this.parseUPSDateTime(activity.date, activity.time);

      events.push({
        status: this.mapUPSStatus(statusType),
        statusDetail: activity.status?.description,
        statusCode: activity.status?.code ?? statusType,
        city: activity.location?.address?.city,
        state: activity.location?.address?.stateProvince,
        country: activity.location?.address?.countryCode,
        postalCode: activity.location?.address?.postalCode,
        occurredAt,
        estimatedDelivery,
      });
    }

    return events;
  }

  private mapUPSStatus(statusType: string): NormalizedTrackingStatusCode {
    const code = statusType.toUpperCase();

    switch (code) {
      case 'M': // Manifest / label created
      case 'MV': // Billing info voided
      case 'MP': // Billing info received
        return 'info_received';

      case 'I': // In transit
      case 'P': // Pickup
        return 'in_transit';

      case 'O': // Out for delivery
        return 'out_for_delivery';

      case 'D': // Delivered
        return 'delivered';

      case 'X': // Exception
        return 'exception';

      case 'RS': // Returned to shipper
        return 'return_to_sender';

      default:
        return 'unknown';
    }
  }

  private parseUPSDate(dateStr: string): Date {
    // UPS date format: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    return new Date(year, month, day);
  }

  private parseUPSDateTime(dateStr?: string, timeStr?: string): Date {
    if (!dateStr) return new Date();
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);

    if (timeStr && timeStr.length >= 6) {
      const hours = parseInt(timeStr.substring(0, 2), 10);
      const minutes = parseInt(timeStr.substring(2, 4), 10);
      const seconds = parseInt(timeStr.substring(4, 6), 10);
      return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    }

    return new Date(year, month, day);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.credentials) {
      throw new CarrierTrackingError(
        'UPS provider not authenticated. Call authenticate() first.',
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

    const basicAuth = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`,
    ).toString('base64');

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/security/v1/oauth/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (err) {
      throw new CarrierTrackingError(
        `UPS OAuth request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }

    if (!response.ok) {
      throw new CarrierTrackingError(
        `UPS OAuth returned HTTP ${response.status}`,
        this.name,
        response.status,
        response.status >= 500,
      );
    }

    const json = (await response.json()) as {
      access_token: string;
      expires_in: string;
      token_type: string;
    };

    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + parseInt(json.expires_in, 10) * 1000;
  }
}
