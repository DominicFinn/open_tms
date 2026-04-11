/**
 * HERE Routing API provider.
 *
 * Best-in-class truck routing with vehicle dimensions, hazmat, tunnel restrictions.
 * Pricing: $2.50/1K requests for Advanced Routing (truck + traffic).
 * Free tier: 5,000 requests/month.
 *
 * Docs: https://www.here.com/docs/bundle/routing-api-developer-guide-v8/
 */

import {
  IRoutingProvider,
  RouteRequest,
  RouteResult,
  MatrixRequest,
  MatrixResult,
  RoutingError,
  LatLng,
  VehicleProfile,
} from './IRoutingProvider.js';

export interface HereRoutingConfig {
  apiKey: string;
  /** Base URL override for testing */
  baseUrl?: string;
  /** Matrix API base URL override */
  matrixBaseUrl?: string;
}

export class HereRoutingProvider implements IRoutingProvider {
  readonly name = 'here';
  readonly supportsTruckRouting = true;
  readonly supportsTraffic = true;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly matrixBaseUrl: string;

  constructor(config: HereRoutingConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://router.hereapi.com/v8';
    this.matrixBaseUrl = config.matrixBaseUrl || 'https://matrix.router.hereapi.com/v8';
  }

  async computeRoute(request: RouteRequest): Promise<RouteResult> {
    const params = new URLSearchParams();
    params.set('apiKey', this.apiKey);
    params.set('origin', `${request.origin.lat},${request.origin.lng}`);
    params.set('destination', `${request.destination.lat},${request.destination.lng}`);
    params.set('return', 'summary,polyline');

    // Use truck transport mode if vehicle profile provided
    if (request.vehicle) {
      params.set('transportMode', 'truck');
      this.applyVehicleParams(params, request.vehicle);
    } else {
      params.set('transportMode', 'car');
    }

    // Traffic-aware routing
    if (request.trafficAware !== false) {
      params.set('routingMode', 'fast');
      // HERE uses traffic by default for the /routes endpoint
    }

    if (request.departureTime) {
      params.set('departAt', request.departureTime);
    } else {
      params.set('departAt', new Date().toISOString());
    }

    // Add waypoints
    if (request.waypoints?.length) {
      request.waypoints.forEach((wp, i) => {
        params.set(`via`, `${wp.lat},${wp.lng}`);
      });
    }

    const url = `${this.baseUrl}/routes?${params.toString()}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const body = await response.text();
        throw new RoutingError(
          `HERE API error: ${response.status} ${body}`,
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

      const section = route.sections?.[0];
      const summary = section?.summary;
      if (!summary) {
        throw new RoutingError('No route summary returned', this.name);
      }

      const durationSeconds = summary.duration; // seconds
      const distanceMeters = summary.length; // meters
      const baseDuration = summary.baseDuration || durationSeconds; // free-flow duration
      const trafficDelay = durationSeconds - baseDuration;
      const departureTime = request.departureTime ? new Date(request.departureTime) : new Date();
      const arrivalTime = new Date(departureTime.getTime() + durationSeconds * 1000);

      return {
        durationSeconds,
        distanceMeters,
        estimatedArrival: arrivalTime.toISOString(),
        polyline: section.polyline,
        trafficUsed: request.trafficAware !== false,
        trafficDelaySeconds: trafficDelay > 0 ? trafficDelay : 0,
        provider: this.name,
      };
    } catch (err) {
      if (err instanceof RoutingError) throw err;
      throw new RoutingError(
        `HERE request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }
  }

  async computeMatrix(request: MatrixRequest): Promise<MatrixResult> {
    const body: any = {
      origins: request.origins.map((o) => ({ lat: o.lat, lng: o.lng })),
      destinations: request.destinations.map((d) => ({ lat: d.lat, lng: d.lng })),
      regionDefinition: { type: 'autoCircle' },
      matrixAttributes: ['travelTimes', 'distances'],
    };

    if (request.vehicle) {
      body.profile = 'truckFast';
    } else {
      body.profile = 'carFast';
    }

    if (request.trafficAware !== false) {
      body.departureTime = new Date().toISOString();
    }

    const url = `${this.matrixBaseUrl}/matrix?apiKey=${this.apiKey}&async=false`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new RoutingError(
          `HERE Matrix API error: ${response.status} ${text}`,
          this.name,
          response.status,
          response.status >= 500 || response.status === 429,
        );
      }

      const data = await response.json() as any;
      const matrix = data.matrix;
      const elements: MatrixResult['elements'] = [];

      if (matrix?.travelTimes && matrix?.distances) {
        for (let oi = 0; oi < request.origins.length; oi++) {
          for (let di = 0; di < request.destinations.length; di++) {
            const idx = oi * request.destinations.length + di;
            elements.push({
              originIndex: oi,
              destinationIndex: di,
              durationSeconds: matrix.travelTimes[idx],
              distanceMeters: matrix.distances[idx],
            });
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
        `HERE Matrix request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }
  }

  private applyVehicleParams(params: URLSearchParams, vehicle: VehicleProfile): void {
    if (vehicle.height) params.set('truck[grossWeight]', String(Math.round(vehicle.weight || 0)));
    if (vehicle.height) params.set('truck[height]', String(Math.round(vehicle.height * 100))); // cm
    if (vehicle.width) params.set('truck[width]', String(Math.round(vehicle.width * 100)));
    if (vehicle.length) params.set('truck[length]', String(Math.round(vehicle.length * 100)));
    if (vehicle.weight) params.set('truck[grossWeight]', String(vehicle.weight));
    if (vehicle.axleCount) params.set('truck[axleCount]', String(vehicle.axleCount));
    if (vehicle.hazmatClasses?.length) {
      params.set('truck[shippedHazardousGoods]', vehicle.hazmatClasses.join(','));
    }
    if (vehicle.tunnelCategory) {
      params.set('truck[tunnelCategory]', vehicle.tunnelCategory);
    }
  }
}
