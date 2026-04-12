/**
 * DHLTrackingProvider -- DHL Shipment Tracking Unified API implementation.
 *
 * Docs: https://developer.dhl.com/api-reference/shipment-tracking
 *
 * DHL uses API key authentication (no OAuth). Single-tracking per request.
 * Initial rate limit is 250 requests/day (upgradeable).
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

const DHL_PRODUCTION_URL = 'https://api-eu.dhl.com';
const DHL_SANDBOX_URL = 'https://api-test.dhl.com';

interface DHLCredentials {
  apiKey: string;
  sandbox?: boolean;
}

interface DHLEvent {
  timestamp?: string;
  statusCode?: string;
  status?: string;
  description?: string;
  location?: {
    address?: {
      addressLocality?: string;
      postalCode?: string;
      countryCode?: string;
    };
  };
}

interface DHLShipment {
  id?: string;
  status?: {
    timestamp?: string;
    statusCode?: string;
    status?: string;
    description?: string;
    location?: {
      address?: {
        addressLocality?: string;
        postalCode?: string;
        countryCode?: string;
      };
    };
  };
  estimatedTimeOfDelivery?: string;
  events?: DHLEvent[];
  details?: {
    proofOfDelivery?: {
      signedBy?: string;
    };
  };
}

export class DHLTrackingProvider implements ICarrierTrackingProvider {
  readonly name = 'DHL';
  readonly supportsWebhooks = true;
  readonly supportsPolling = true;
  readonly maxBatchSize = 1;
  readonly rateLimitPerSecond = 1;
  readonly rateLimitPerDay = 250;

  private apiKey: string | null = null;
  private baseUrl: string = DHL_PRODUCTION_URL;

  async authenticate(credentials: Record<string, unknown>): Promise<void> {
    const creds = credentials as unknown as DHLCredentials;

    if (!creds.apiKey) {
      throw new CarrierTrackingError(
        'DHL credentials require apiKey',
        this.name,
        undefined,
        false,
      );
    }

    this.apiKey = creds.apiKey;
    this.baseUrl = creds.sandbox ? DHL_SANDBOX_URL : DHL_PRODUCTION_URL;
  }

  async pollTracking(request: TrackingPollRequest): Promise<TrackingPollResult[]> {
    this.ensureAuthenticated();

    const results: TrackingPollResult[] = [];

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

    const trackingNumber = body.trackingNumber as string | undefined;
    if (!trackingNumber) {
      return results;
    }

    const events: NormalizedTrackingStatus[] = [];
    const statusCode = body.statusCode as string | undefined;
    const description = body.description as string | undefined;
    const timestamp = body.timestamp as string | undefined;
    const location = body.location as Record<string, unknown> | undefined;
    const address = location?.address as Record<string, string> | undefined;

    if (statusCode) {
      events.push({
        status: this.mapDHLStatus(statusCode),
        statusDetail: description,
        statusCode,
        city: address?.addressLocality,
        country: address?.countryCode,
        postalCode: address?.postalCode,
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
    const signature = headers['x-dhl-signature'] || headers['X-DHL-Signature'] || '';
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
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`,
        {
          method: 'GET',
          headers: {
            'DHL-API-Key': this.apiKey!,
            'Accept': 'application/json',
          },
        },
      );
    } catch (err) {
      throw new CarrierTrackingError(
        `DHL API request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }

    if (response.status === 429) {
      throw new CarrierTrackingError(
        'DHL rate limit exceeded',
        this.name,
        429,
        true,
      );
    }

    if (response.status === 404) {
      return {
        trackingNumber,
        success: false,
        errorMessage: 'Tracking number not found',
        events: [],
      };
    }

    if (!response.ok) {
      throw new CarrierTrackingError(
        `DHL API returned HTTP ${response.status}`,
        this.name,
        response.status,
        response.status >= 500,
      );
    }

    const json = (await response.json()) as {
      shipments?: DHLShipment[];
    };

    const shipment = json.shipments?.[0];
    if (!shipment) {
      return {
        trackingNumber,
        success: false,
        errorMessage: 'No shipment data in DHL response',
        events: [],
      };
    }

    const events = this.parseEvents(shipment);
    const latestStatus = events.length > 0 ? events[0] : undefined;

    return {
      trackingNumber,
      success: true,
      events,
      latestStatus,
    };
  }

  private parseEvents(shipment: DHLShipment): NormalizedTrackingStatus[] {
    const events: NormalizedTrackingStatus[] = [];

    let estimatedDelivery: Date | undefined;
    if (shipment.estimatedTimeOfDelivery) {
      estimatedDelivery = new Date(shipment.estimatedTimeOfDelivery);
    }

    const signedBy = shipment.details?.proofOfDelivery?.signedBy;

    for (const evt of shipment.events ?? []) {
      const statusCode = evt.statusCode ?? '';
      const isDelivered = statusCode === 'delivered';

      events.push({
        status: this.mapDHLStatus(statusCode),
        statusDetail: evt.description ?? evt.status,
        statusCode,
        city: evt.location?.address?.addressLocality,
        country: evt.location?.address?.countryCode,
        postalCode: evt.location?.address?.postalCode,
        occurredAt: evt.timestamp ? new Date(evt.timestamp) : new Date(),
        estimatedDelivery,
        signedBy: isDelivered ? signedBy : undefined,
      });
    }

    return events;
  }

  private mapDHLStatus(statusCode: string): NormalizedTrackingStatusCode {
    const code = statusCode.toLowerCase();

    switch (code) {
      case 'pre-transit':
      case 'informationreceived':
        return 'info_received';

      case 'transit':
      case 'in-transit':
        return 'in_transit';

      case 'out-for-delivery':
        return 'out_for_delivery';

      case 'delivered':
        return 'delivered';

      case 'failure':
      case 'exception':
      case 'customs':
        return 'exception';

      case 'return':
      case 'returned':
        return 'return_to_sender';

      default:
        return 'unknown';
    }
  }

  private ensureAuthenticated(): void {
    if (!this.apiKey) {
      throw new CarrierTrackingError(
        'DHL provider not authenticated. Call authenticate() first.',
        this.name,
        undefined,
        false,
      );
    }
  }
}
