/**
 * Valhalla (self-hosted) routing provider.
 *
 * Free, open-source routing engine with truck costing model.
 * No real-time traffic data — uses static speed profiles from OSM.
 * Best for: baseline route calculations, bulk ETA estimates, route deviation detection.
 *
 * Deploy: docker run -p 8002:8002 ghcr.io/valhalla/valhalla:latest
 * Docs: https://valhalla.github.io/valhalla/
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

export interface ValhallaRoutingConfig {
  /** Valhalla server base URL (e.g., http://localhost:8002) */
  baseUrl: string;
}

export class ValhallaRoutingProvider implements IRoutingProvider {
  readonly name = 'valhalla';
  readonly supportsTruckRouting = true;
  readonly supportsTraffic = false; // No real-time traffic in self-hosted Valhalla

  private readonly baseUrl: string;

  constructor(config: ValhallaRoutingConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async computeRoute(request: RouteRequest): Promise<RouteResult> {
    const locations: any[] = [
      { lat: request.origin.lat, lon: request.origin.lng, type: 'break' },
    ];

    if (request.waypoints?.length) {
      for (const wp of request.waypoints) {
        locations.push({ lat: wp.lat, lon: wp.lng, type: 'through' });
      }
    }

    locations.push({ lat: request.destination.lat, lon: request.destination.lng, type: 'break' });

    const costing = request.vehicle ? 'truck' : 'auto';
    const costingOptions: any = {};

    if (request.vehicle) {
      costingOptions.truck = this.buildTruckCostingOptions(request.vehicle);
    }

    const body = {
      locations,
      costing,
      costing_options: Object.keys(costingOptions).length > 0 ? costingOptions : undefined,
      directions_options: { units: 'kilometers' },
      date_time: request.departureTime
        ? { type: 1, value: this.toValhallaDateTime(request.departureTime) }
        : { type: 0 }, // 0 = current time
    };

    const url = `${this.baseUrl}/route`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new RoutingError(
          `Valhalla API error: ${response.status} ${text}`,
          this.name,
          response.status,
          response.status >= 500,
        );
      }

      const data = await response.json() as any;
      const trip = data.trip;
      if (!trip) {
        throw new RoutingError('No trip returned from Valhalla', this.name);
      }

      const summary = trip.summary;
      const durationSeconds = Math.round(summary.time); // seconds
      const distanceMeters = Math.round(summary.length * 1000); // km -> meters
      const departureTime = request.departureTime ? new Date(request.departureTime) : new Date();
      const arrivalTime = new Date(departureTime.getTime() + durationSeconds * 1000);

      // Extract encoded polyline from legs
      let polyline: string | undefined;
      if (trip.legs?.length) {
        polyline = trip.legs[0].shape;
      }

      return {
        durationSeconds,
        distanceMeters,
        estimatedArrival: arrivalTime.toISOString(),
        polyline,
        trafficUsed: false,
        trafficDelaySeconds: 0,
        provider: this.name,
      };
    } catch (err) {
      if (err instanceof RoutingError) throw err;
      throw new RoutingError(
        `Valhalla request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }
  }

  async computeMatrix(request: MatrixRequest): Promise<MatrixResult> {
    const sources = request.origins.map((o) => ({ lat: o.lat, lon: o.lng }));
    const targets = request.destinations.map((d) => ({ lat: d.lat, lon: d.lng }));

    const costing = request.vehicle ? 'truck' : 'auto';
    const costingOptions: any = {};
    if (request.vehicle) {
      costingOptions.truck = this.buildTruckCostingOptions(request.vehicle);
    }

    const body = {
      sources,
      targets,
      costing,
      costing_options: Object.keys(costingOptions).length > 0 ? costingOptions : undefined,
    };

    const url = `${this.baseUrl}/sources_to_targets`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new RoutingError(
          `Valhalla Matrix API error: ${response.status} ${text}`,
          this.name,
          response.status,
          response.status >= 500,
        );
      }

      const data = await response.json() as any;
      const elements: MatrixResult['elements'] = [];

      if (data.sources_to_targets) {
        for (let oi = 0; oi < data.sources_to_targets.length; oi++) {
          for (let di = 0; di < data.sources_to_targets[oi].length; di++) {
            const cell = data.sources_to_targets[oi][di];
            elements.push({
              originIndex: oi,
              destinationIndex: di,
              durationSeconds: Math.round(cell.time),
              distanceMeters: Math.round(cell.distance * 1000), // km -> meters
            });
          }
        }
      }

      return {
        elements,
        provider: this.name,
        trafficUsed: false,
      };
    } catch (err) {
      if (err instanceof RoutingError) throw err;
      throw new RoutingError(
        `Valhalla Matrix request failed: ${(err as Error).message}`,
        this.name,
        undefined,
        true,
      );
    }
  }

  private buildTruckCostingOptions(vehicle: VehicleProfile): any {
    const opts: any = {};
    if (vehicle.height) opts.height = vehicle.height;
    if (vehicle.width) opts.width = vehicle.width;
    if (vehicle.length) opts.length = vehicle.length;
    if (vehicle.weight) opts.weight = vehicle.weight / 1000; // kg -> metric tons for Valhalla
    if (vehicle.axleWeight) opts.axle_load = vehicle.axleWeight / 1000;
    if (vehicle.axleCount) opts.axle_count = vehicle.axleCount;
    if (vehicle.hazmatClasses?.length) {
      opts.hazmat = true;
    }
    return opts;
  }

  private toValhallaDateTime(isoString: string): string {
    // Valhalla expects "YYYY-MM-DDTHH:MM" format
    return isoString.substring(0, 16);
  }
}
