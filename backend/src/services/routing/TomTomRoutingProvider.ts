/**
 * TomTom Routing API provider.
 *
 * Full truck routing with height/weight/length/hazmat at ~$0.50/1K requests.
 * Free tier: 2,500 non-tile requests/day (~75K/month).
 *
 * Docs: https://developer.tomtom.com/routing-api/documentation/
 */

import {
  IRoutingProvider,
  RouteRequest,
  RouteResult,
  MatrixRequest,
  MatrixResult,
  RoutingError,
  VehicleProfile,
} from './IRoutingProvider.js';

export interface TomTomRoutingConfig {
  apiKey: string;
  /** Base URL override for testing */
  baseUrl?: string;
}

export class TomTomRoutingProvider implements IRoutingProvider {
  readonly name = 'tomtom';
  readonly supportsTruckRouting = true;
  readonly supportsTraffic = true;

  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: TomTomRoutingConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.tomtom.com/routing/1';
  }

  async computeRoute(request: RouteRequest): Promise<RouteResult> {
    // Build locations string: origin:waypoints:destination
    const locations: string[] = [
      `${request.origin.lat},${request.origin.lng}`,
    ];
    if (request.waypoints?.length) {
      for (const wp of request.waypoints) {
        locations.push(`${wp.lat},${wp.lng}`);
      }
    }
    locations.push(`${request.destination.lat},${request.destination.lng}`);

    const params = new URLSearchParams();
    params.set('key', this.apiKey);
    params.set('routeRepresentation', 'polyline');
    params.set('computeTravelTimeFor', 'all'); // returns noTrafficTravelTime + historicTrafficTravelTime

    if (request.trafficAware !== false) {
      params.set('traffic', 'true');
    }

    if (request.departureTime) {
      params.set('departAt', request.departureTime);
    }

    // Truck-specific parameters
    if (request.vehicle) {
      params.set('travelMode', 'truck');
      this.applyVehicleParams(params, request.vehicle);
    } else {
      params.set('travelMode', 'car');
    }

    const locString = locations.join(':');
    const url = `${this.baseUrl}/calculateRoute/${locString}/json?${params.toString()}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const body = await response.text();
        throw new RoutingError(
          `TomTom API error: ${response.status} ${body}`,
          this.name,
          response.status,
          response.status >= 500 || response.status === 429,
        );
      }

      const data = await response.json() as any;
      const route = data.routes?.[0];
      if (!route) {
        throw new RoutingError('No route found', this.name);
      }

      const summary = route.summary;
      const durationSeconds = summary.travelTimeInSeconds;
      const distanceMeters = summary.lengthInMeters;
      const noTrafficDuration = summary.noTrafficTravelTimeInSeconds || durationSeconds;
      const trafficDelay = durationSeconds - noTrafficDuration;
      const arrivalTime = new Date(summary.arrivalTime);

      return {
        durationSeconds,
        distanceMeters,
        estimatedArrival: arrivalTime.toISOString(),
        polyline: this.extractPolyline(route),
        trafficUsed: request.trafficAware !== false,
        trafficDelaySeconds: trafficDelay > 0 ? trafficDelay : 0,
        provider: this.name,
      };
    } catch (err) {
      if (err instanceof RoutingError) throw err;
      throw new RoutingError(
        `TomTom request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }
  }

  async computeMatrix(request: MatrixRequest): Promise<MatrixResult> {
    const body: any = {
      origins: request.origins.map((o) => ({ point: { latitude: o.lat, longitude: o.lng } })),
      destinations: request.destinations.map((d) => ({ point: { latitude: d.lat, longitude: d.lng } })),
    };

    if (request.trafficAware !== false) {
      body.options = { traffic: 'live' };
    }

    if (request.vehicle) {
      body.options = { ...body.options, travelMode: 'truck' };
    }

    const url = `${this.baseUrl}/matrix/sync/json?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new RoutingError(
          `TomTom Matrix API error: ${response.status} ${text}`,
          this.name,
          response.status,
          response.status >= 500 || response.status === 429,
        );
      }

      const data = await response.json() as any;
      const elements: MatrixResult['elements'] = [];

      if (data.matrix) {
        for (let oi = 0; oi < data.matrix.length; oi++) {
          for (let di = 0; di < data.matrix[oi].length; di++) {
            const cell = data.matrix[oi][di];
            if (cell.statusCode === 200 && cell.response) {
              elements.push({
                originIndex: oi,
                destinationIndex: di,
                durationSeconds: cell.response.routeSummary.travelTimeInSeconds,
                distanceMeters: cell.response.routeSummary.lengthInMeters,
              });
            }
          }
        }
      }

      return {
        elements,
        provider: this.name,
        trafficUsed: request.trafficAware !== false,
      };
    } catch (err) {
      if (err instanceof RoutingError) throw err;
      throw new RoutingError(
        `TomTom Matrix request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }
  }

  private applyVehicleParams(params: URLSearchParams, vehicle: VehicleProfile): void {
    if (vehicle.height) params.set('vehicleHeightInMeters', String(vehicle.height));
    if (vehicle.width) params.set('vehicleWidthInMeters', String(vehicle.width));
    if (vehicle.length) params.set('vehicleLengthInMeters', String(vehicle.length));
    if (vehicle.weight) params.set('vehicleWeightInKg', String(vehicle.weight));
    if (vehicle.axleWeight) params.set('vehicleAxleWeightInKg', String(vehicle.axleWeight));
    if (vehicle.axleCount) params.set('vehicleNumberOfAxles', String(vehicle.axleCount));
    if (vehicle.hazmatClasses?.length) {
      params.set('vehicleLoadType', vehicle.hazmatClasses.join(','));
    }
  }

  private extractPolyline(route: any): string | undefined {
    // TomTom returns legs[].points[] — we flatten to an encoded polyline for storage
    try {
      const points: Array<{ latitude: number; longitude: number }> = [];
      for (const leg of route.legs || []) {
        for (const point of leg.points || []) {
          points.push(point);
        }
      }
      // Return as JSON-encoded point array (lightweight encoding)
      return points.length > 0 ? JSON.stringify(points) : undefined;
    } catch {
      return undefined;
    }
  }
}
