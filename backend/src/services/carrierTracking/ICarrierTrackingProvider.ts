/**
 * ICarrierTrackingProvider -- provider-agnostic interface for carrier tracking APIs.
 *
 * Implementations: FedExTrackingProvider, UPSTrackingProvider, etc.
 * Consumers never depend on a specific provider -- swap via config.
 */

/** Normalized tracking status across all carrier providers */
export type NormalizedTrackingStatusCode =
  | 'info_received'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'return_to_sender'
  | 'unknown';

/** A normalized tracking status update from any carrier */
export interface NormalizedTrackingStatus {
  /** Normalized status code */
  status: NormalizedTrackingStatusCode;
  /** Provider-specific status detail text */
  statusDetail?: string;
  /** Provider-specific raw status code */
  statusCode?: string;

  /** Location where the event occurred */
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;

  /** When the tracking event actually occurred at the carrier */
  occurredAt: Date;
  /** Carrier-estimated delivery date/time */
  estimatedDelivery?: Date;

  /** Name of signer on delivery */
  signedBy?: string;
}

/** Request to poll tracking status for one or more shipments */
export interface TrackingPollRequest {
  /** Tracking numbers to check */
  trackingNumbers: string[];
}

/** Result for a single tracking number from a poll */
export interface TrackingPollResult {
  /** The tracking number that was polled */
  trackingNumber: string;
  /** Whether the poll was successful */
  success: boolean;
  /** Error message if success is false */
  errorMessage?: string;
  /** All tracking events returned (newest first) */
  events: NormalizedTrackingStatus[];
  /** The most recent / current status */
  latestStatus?: NormalizedTrackingStatus;
}

/** Parsed webhook payload from a carrier */
export interface WebhookParseResult {
  /** Tracking number the webhook is about */
  trackingNumber: string;
  /** Tracking events from the webhook */
  events: NormalizedTrackingStatus[];
}

/**
 * The carrier tracking provider interface.
 * All implementations must handle errors gracefully and throw CarrierTrackingError on failure.
 */
export interface ICarrierTrackingProvider {
  /** Human-readable provider name (e.g. "FedEx", "UPS") */
  readonly name: string;

  /** Whether this provider supports webhook (push) updates */
  readonly supportsWebhooks: boolean;

  /** Whether this provider supports polling (pull) updates */
  readonly supportsPolling: boolean;

  /** Maximum number of tracking numbers per poll request */
  readonly maxBatchSize: number;

  /** Authenticate with the carrier API (e.g. obtain OAuth token) */
  authenticate(credentials: Record<string, unknown>): Promise<void>;

  /** Poll tracking status for a batch of tracking numbers */
  pollTracking(request: TrackingPollRequest): Promise<TrackingPollResult[]>;

  /** Parse an incoming webhook payload into normalized tracking events */
  parseWebhook?(payload: unknown, headers: Record<string, string>): Promise<WebhookParseResult[]>;

  /** Verify the signature of an incoming webhook request */
  verifyWebhookSignature?(payload: unknown, headers: Record<string, string>, secret: string): boolean;
}

/** Error thrown by carrier tracking providers */
export class CarrierTrackingError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'CarrierTrackingError';
  }
}
