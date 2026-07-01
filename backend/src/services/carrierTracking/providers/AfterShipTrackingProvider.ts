/**
 * AfterShipTrackingProvider — AfterShip is a tracking-only aggregator covering
 * 900+ carriers behind one API key.
 *
 * Docs: https://www.aftership.com/docs/tracking/quickstart/api-quick-start
 *
 * Auth: `aftership-api-key` header. Webhooks: base64 HMAC-SHA256 in the
 * `aftership-hmac-sha256` header.
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
import { createHmac, timingSafeEqual } from 'crypto';

const AFTERSHIP_BASE_URL = 'https://api.aftership.com/v4';

interface AfterShipCredentials {
  apiKey: string;
}

interface AfterShipCheckpoint {
  checkpoint_time?: string;
  message?: string;
  tag?: string;
  subtag_message?: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country_iso3?: string | null;
  coordinates?: number[]; // [lng, lat]
}

interface AfterShipTracking {
  tracking_number?: string;
  tag?: string;
  subtag_message?: string;
  expected_delivery?: string | null;
  signed_by?: string | null;
  checkpoints?: AfterShipCheckpoint[];
}

export class AfterShipTrackingProvider implements ICarrierTrackingProvider {
  readonly name = 'AfterShip';
  readonly supportsWebhooks = true;
  readonly supportsPolling = true;
  readonly maxBatchSize = 1;
  readonly rateLimitPerSecond = 10;
  readonly rateLimitPerDay = 100000;

  private apiKey: string | null = null;

  async authenticate(credentials: Record<string, unknown>): Promise<void> {
    const creds = credentials as unknown as AfterShipCredentials;
    if (!creds.apiKey) {
      throw new CarrierTrackingError('AfterShip credentials require apiKey', this.name, undefined, false);
    }
    this.apiKey = creds.apiKey;
  }

  async pollTracking(request: TrackingPollRequest): Promise<TrackingPollResult[]> {
    this.ensureAuthenticated();
    const results: TrackingPollResult[] = [];
    for (const trackingNumber of request.trackingNumbers) {
      try {
        results.push(await this.pollSingle(trackingNumber));
      } catch (err) {
        if (err instanceof CarrierTrackingError && !err.retryable) {
          results.push({ trackingNumber, success: false, errorMessage: err.message, events: [] });
        } else {
          throw err;
        }
      }
    }
    return results;
  }

  async parseWebhook(payload: unknown, _headers: Record<string, string>): Promise<WebhookParseResult[]> {
    // AfterShip webhook body: { event, msg: <tracking>, ts }.
    const body = payload as Record<string, unknown>;
    const tracking = (body.msg ?? body) as AfterShipTracking;
    const trackingNumber = tracking.tracking_number;
    if (!trackingNumber) return [];
    const events = this.parseTracking(tracking);
    return events.length > 0 ? [{ trackingNumber, events }] : [];
  }

  verifyWebhookSignature(payload: unknown, headers: Record<string, string>, secret: string): boolean {
    const provided = headers['aftership-hmac-sha256'] || headers['Aftership-Hmac-Sha256'] || '';
    if (!provided) return false;
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const computed = createHmac('sha256', secret).update(bodyStr).digest('base64');
    try {
      const a = Buffer.from(computed);
      const b = Buffer.from(provided);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /* ---------- private ---------- */

  private async pollSingle(trackingNumber: string): Promise<TrackingPollResult> {
    let tracking = await this.findTracking(trackingNumber);
    if (!tracking) tracking = await this.createTracking(trackingNumber);

    if (!tracking) {
      return { trackingNumber, success: false, errorMessage: 'No tracking data from AfterShip', events: [] };
    }
    const events = this.parseTracking(tracking);
    return { trackingNumber, success: true, events, latestStatus: events[0] };
  }

  private async findTracking(trackingNumber: string): Promise<AfterShipTracking | null> {
    const res = await this.request('GET', `/trackings?keyword=${encodeURIComponent(trackingNumber)}`);
    const json = (await res.json()) as { data?: { trackings?: AfterShipTracking[] } };
    return json.data?.trackings?.find((t) => t.tracking_number === trackingNumber) ?? json.data?.trackings?.[0] ?? null;
  }

  private async createTracking(trackingNumber: string): Promise<AfterShipTracking | null> {
    // 201 on create; 4003 if it already exists — either way fetch it back.
    const res = await this.request('POST', '/trackings', { tracking: { tracking_number: trackingNumber } }, [201, 200, 409]);
    const json = (await res.json()) as { data?: { tracking?: AfterShipTracking } };
    if (json.data?.tracking) return json.data.tracking;
    return this.findTracking(trackingNumber);
  }

  private async request(method: string, path: string, body?: unknown, okStatuses?: number[]): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${AFTERSHIP_BASE_URL}${path}`, {
        method,
        headers: {
          'aftership-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new CarrierTrackingError(`AfterShip request failed: ${(err as Error).message}`, this.name, undefined, true);
    }
    if (res.status === 429) throw new CarrierTrackingError('AfterShip rate limit exceeded', this.name, 429, true);
    if (res.status === 401) throw new CarrierTrackingError('AfterShip authentication failed', this.name, 401, false);
    const acceptable = okStatuses ? [...okStatuses, 200] : [200];
    if (!res.ok && !acceptable.includes(res.status)) {
      throw new CarrierTrackingError(`AfterShip API returned HTTP ${res.status}`, this.name, res.status, res.status >= 500);
    }
    return res;
  }

  private parseTracking(tracking: AfterShipTracking): NormalizedTrackingStatus[] {
    const estimatedDelivery = tracking.expected_delivery ? new Date(tracking.expected_delivery) : undefined;
    const checkpoints = tracking.checkpoints ?? [];
    const events: NormalizedTrackingStatus[] = checkpoints
      .map((c) => {
        const status = this.mapStatus(c.tag ?? '');
        const coords = c.coordinates;
        return {
          status,
          statusDetail: c.message ?? c.subtag_message,
          statusCode: c.tag,
          city: c.city ?? undefined,
          state: c.state ?? undefined,
          country: c.country_iso3 ?? undefined,
          postalCode: c.zip ?? undefined,
          lng: coords && coords.length === 2 ? coords[0] : undefined,
          lat: coords && coords.length === 2 ? coords[1] : undefined,
          occurredAt: c.checkpoint_time ? new Date(c.checkpoint_time) : new Date(),
          estimatedDelivery,
          signedBy: status === 'delivered' ? (tracking.signed_by ?? undefined) : undefined,
        } as NormalizedTrackingStatus;
      })
      .reverse();

    if (events.length === 0 && tracking.tag) {
      events.push({ status: this.mapStatus(tracking.tag), statusCode: tracking.tag, occurredAt: new Date(), estimatedDelivery });
    }
    return events;
  }

  private mapStatus(tag: string): NormalizedTrackingStatusCode {
    switch (tag) {
      case 'Pending':
      case 'InfoReceived': return 'info_received';
      case 'InTransit': return 'in_transit';
      case 'OutForDelivery': return 'out_for_delivery';
      case 'AvailableForPickup': return 'out_for_delivery';
      case 'Delivered': return 'delivered';
      case 'AttemptFail':
      case 'Exception': return 'exception';
      default: return 'unknown';
    }
  }

  private ensureAuthenticated(): void {
    if (!this.apiKey) {
      throw new CarrierTrackingError('AfterShip provider not authenticated. Call authenticate() first.', this.name, undefined, false);
    }
  }
}
