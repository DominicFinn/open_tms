/**
 * IRoutingProvider — provider-agnostic interface for route calculation and ETA.
 *
 * Implementations: HereRoutingProvider, TomTomRoutingProvider, ValhallaRoutingProvider
 * Consumers never depend on a specific provider — swap via env config.
 */

/** A geographic coordinate */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Vehicle dimensions for truck routing (optional — providers that support it will use these) */
export interface VehicleProfile {
  /** Vehicle height in meters */
  height?: number;
  /** Vehicle width in meters */
  width?: number;
  /** Vehicle length in meters */
  length?: number;
  /** Gross vehicle weight in kg */
  weight?: number;
  /** Weight per axle in kg */
  axleWeight?: number;
  /** Number of axles */
  axleCount?: number;
  /** Hazardous materials classes (e.g., ['1', '3'] for explosives + flammable liquids) */
  hazmatClasses?: string[];
  /** Tunnel restriction code (e.g., 'B', 'C', 'D', 'E') */
  tunnelCategory?: string;
}

/** Input for a route calculation */
export interface RouteRequest {
  /** Starting point (current truck position for in-transit checks) */
  origin: LatLng;
  /** Final destination */
  destination: LatLng;
  /** Intermediate waypoints in order */
  waypoints?: LatLng[];
  /** Whether to include real-time traffic in ETA calculation */
  trafficAware?: boolean;
  /** Vehicle profile for truck routing */
  vehicle?: VehicleProfile;
  /** Departure time (ISO-8601). Defaults to now. */
  departureTime?: string;
}

/** Result of a route calculation */
export interface RouteResult {
  /** Estimated travel duration in seconds (traffic-aware if requested) */
  durationSeconds: number;
  /** Distance in meters */
  distanceMeters: number;
  /** Estimated time of arrival (ISO-8601) */
  estimatedArrival: string;
  /** Encoded polyline of the route (for deviation detection) */
  polyline?: string;
  /** Whether real-time traffic was factored in */
  trafficUsed: boolean;
  /** Traffic delay vs free-flow in seconds (0 if no traffic data) */
  trafficDelaySeconds?: number;
  /** Provider name for logging */
  provider: string;
}

/** Input for a distance matrix calculation (batch ETA for multiple shipments) */
export interface MatrixRequest {
  /** Origin points (current truck positions) */
  origins: LatLng[];
  /** Destination points (next stop locations) */
  destinations: LatLng[];
  /** Whether to include real-time traffic */
  trafficAware?: boolean;
  /** Vehicle profile for truck routing */
  vehicle?: VehicleProfile;
}

/** Single element in a matrix result */
export interface MatrixElement {
  /** Index into the origins array */
  originIndex: number;
  /** Index into the destinations array */
  destinationIndex: number;
  /** Travel duration in seconds */
  durationSeconds: number;
  /** Distance in meters */
  distanceMeters: number;
}

/** Result of a matrix calculation */
export interface MatrixResult {
  elements: MatrixElement[];
  provider: string;
  trafficUsed: boolean;
}

/**
 * The routing provider interface.
 * All implementations must handle errors gracefully and throw RoutingError on failure.
 */
export interface IRoutingProvider {
  /** Human-readable provider name */
  readonly name: string;

  /** Whether this provider supports truck-specific routing */
  readonly supportsTruckRouting: boolean;

  /** Whether this provider supports real-time traffic data */
  readonly supportsTraffic: boolean;

  /** Calculate a route with ETA between origin and destination */
  computeRoute(request: RouteRequest): Promise<RouteResult>;

  /** Calculate a distance/duration matrix for batch ETA checks */
  computeMatrix(request: MatrixRequest): Promise<MatrixResult>;
}

/** Error thrown by routing providers */
export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}
