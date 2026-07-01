/**
 * EasyPostTrackingProvider — EasyPost is a multi-carrier aggregator; one API
 * key tracks parcels across dozens of carriers (USPS, UPS, FedEx, DHL, ...).
 *
 * Docs: https://docs.easypost.com/docs/trackers
 *
 * Auth: API key via HTTP Basic (key as username, empty password). Test mode is
 * selected by using a TEST API key (EZTK...) — the base URL is unchanged.
 * Webhooks: HMAC-SHA256 in the X-Hmac-Signature header.
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

const EASYPOST_BASE_URL = 'https://api.easypost.com/v2';

interface EasyPostCredentials {
  apiKey: string;
}

interface EasyPostTrackingLocation {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
}

interface EasyPostTrackingDetail {
  status?: string;
  message?: string;
  datetime?: string;
  tracking_location?: EasyPostTrackingLocation;
}

interface EasyPostTracker {
  tracking_code?: string;
  status?: string;
  est_delivery_date?: string | null;
  signed_by?: string | null;
  tracking_details?: EasyPostTrackingDetail[];
}

export class EasyPostTrackingProvider implements ICarrierTrackingProvider {
  readonly name = 'EasyPost';
  readonly supportsWebhooks = true;
  readonly supportsPolling = true;
  readonly maxBatchSize = 1;
  readonly rateLimitPerSecond = 10;
  readonly rateLimitPerDay = 100000;

  private apiKey: string | null = null;

  async authenticate(credentials: Record<string, unknown>): Promise<void> {
    const creds = credentials as unknown as EasyPostCredentials;
    if (!creds.apiKey) {
      throw new CarrierTrackingError('EasyPost credentials require apiKey', this.name, undefined, false);
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
    // EasyPost webhook body is an Event; the tracker is on `result`.
    const body = payload as Record<string, unknown>;
    const tracker = (body.result ?? body) as EasyPostTracker;
    const trackingNumber = tracker.tracking_code;
    if (!trackingNumber) return [];
    const events = this.parseTracker(tracker);
    return events.length > 0 ? [{ trackingNumber, events }] : [];
  }

  verifyWebhookSignature(payload: unknown, headers: Record<string, string>, secret: string): boolean {
    const header = headers['x-hmac-signature'] || headers['X-Hmac-Signature'] || '';
    if (!header) return false;
    // EasyPost sends "hmac-sha256-hex=<digest>".
    const provided = header.includes('=') ? header.split('=').pop()!.trim() : header.trim();
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const computed = createHmac('sha256', secret).update(bodyStr).digest('hex');
    try {
      const a = Buffer.from(computed, 'hex');
      const b = Buffer.from(provided, 'hex');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /* ---------- private ---------- */

  private authHeader(): string {
    return 'Basic ' + Buffer.from(`${this.apiKey}:`).toString('base64');
  }

  private async pollSingle(trackingCode: string): Promise<TrackingPollResult> {
    // Find an existing tracker for this code, else create one so EasyPost
    // starts tracking it and returns current details.
    let tracker = await this.findTracker(trackingCode);
    if (!tracker) tracker = await this.createTracker(trackingCode);

    if (!tracker) {
      return { trackingNumber: trackingCode, success: false, errorMessage: 'No tracker data from EasyPost', events: [] };
    }
    const events = this.parseTracker(tracker);
    return { trackingNumber: trackingCode, success: true, events, latestStatus: events[0] };
  }

  private async findTracker(trackingCode: string): Promise<EasyPostTracker | null> {
    const res = await this.request('GET', `/trackers?tracking_code=${encodeURIComponent(trackingCode)}`);
    const json = (await res.json()) as { trackers?: EasyPostTracker[] };
    return json.trackers?.[0] ?? null;
  }

  private async createTracker(trackingCode: string): Promise<EasyPostTracker | null> {
    const res = await this.request('POST', '/trackers', { tracker: { tracking_code: trackingCode } });
    return (await res.json()) as EasyPostTracker;
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${EASYPOST_BASE_URL}${path}`, {
        method,
        headers: {
          'Authorization': this.authHeader(),
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new CarrierTrackingError(`EasyPost request failed: ${(err as Error).message}`, this.name, undefined, true);
    }
    if (res.status === 429) throw new CarrierTrackingError('EasyPost rate limit exceeded', this.name, 429, true);
    if (res.status === 401 || res.status === 403) {
      throw new CarrierTrackingError('EasyPost authentication failed', this.name, res.status, false);
    }
    if (!res.ok) {
      throw new CarrierTrackingError(`EasyPost API returned HTTP ${res.status}`, this.name, res.status, res.status >= 500);
    }
    return res;
  }

  private parseTracker(tracker: EasyPostTracker): NormalizedTrackingStatus[] {
    const estimatedDelivery = tracker.est_delivery_date ? new Date(tracker.est_delivery_date) : undefined;
    const details = tracker.tracking_details ?? [];
    // EasyPost lists details oldest-first; normalise to newest-first.
    const events: NormalizedTrackingStatus[] = details
      .map((d) => {
        const status = this.mapStatus(d.status ?? '');
        return {
          status,
          statusDetail: d.message,
          statusCode: d.status,
          city: d.tracking_location?.city ?? undefined,
          state: d.tracking_location?.state ?? undefined,
          country: d.tracking_location?.country ?? undefined,
          postalCode: d.tracking_location?.zip ?? undefined,
          occurredAt: d.datetime ? new Date(d.datetime) : new Date(),
          estimatedDelivery,
          signedBy: status === 'delivered' ? (tracker.signed_by ?? undefined) : undefined,
        } as NormalizedTrackingStatus;
      })
      .reverse();

    // Fall back to the tracker-level status if there are no detail rows.
    if (events.length === 0 && tracker.status) {
      events.push({ status: this.mapStatus(tracker.status), statusCode: tracker.status, occurredAt: new Date(), estimatedDelivery });
    }
    return events;
  }

  private mapStatus(status: string): NormalizedTrackingStatusCode {
    switch (status.toLowerCase()) {
      case 'pre_transit': return 'info_received';
      case 'in_transit': return 'in_transit';
      case 'out_for_delivery': return 'out_for_delivery';
      case 'available_for_pickup': return 'out_for_delivery';
      case 'delivered': return 'delivered';
      case 'return_to_sender': return 'return_to_sender';
      case 'failure':
      case 'cancelled':
      case 'error': return 'exception';
      default: return 'unknown';
    }
  }

  private ensureAuthenticated(): void {
    if (!this.apiKey) {
      throw new CarrierTrackingError('EasyPost provider not authenticated. Call authenticate() first.', this.name, undefined, false);
    }
  }
}
