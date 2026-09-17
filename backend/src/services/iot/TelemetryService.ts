/**
 * Telemetry reads for the shipment and order detail pages (#291).
 *
 * Returns null when the shipment or order isn't in the caller's org, so the route can answer 404.
 */

import {
  ISensorReadingRepository,
  ReadingWindow,
  SensorReadingWithDevice,
} from '../../repositories/SensorReadingRepository.js';

export interface TemperatureSummary {
  min: number;
  max: number;
  avg: number;
  latest: number;
}

export interface TelemetrySummary {
  readingCount: number;
  alertCount: number;
  temperature: TemperatureSummary | null;
  latestBattery: number | null;
  latestPressure: number | null;
  devices: number;
}

export interface Telemetry<TSummary> {
  readings: SensorReadingWithDevice[];
  summary: TSummary;
}

export interface ITelemetryService {
  forShipment(orgId: string, shipmentId: string, window: ReadingWindow): Promise<Telemetry<TelemetrySummary> | null>;
  forOrder(orgId: string, orderId: string, window: ReadingWindow): Promise<Telemetry<{ readingCount: number }> | null>;
}

export class TelemetryService implements ITelemetryService {
  constructor(private readings: ISensorReadingRepository) {}

  async forShipment(orgId: string, shipmentId: string, window: ReadingWindow) {
    const readings = await this.readings.listForShipment(orgId, shipmentId, window);
    if (!readings) return null;
    return { readings, summary: summariseReadings(readings) };
  }

  async forOrder(orgId: string, orderId: string, window: ReadingWindow) {
    const readings = await this.readings.listForOrder(orgId, orderId, window);
    if (!readings) return null;
    return { readings, summary: { readingCount: readings.length } };
  }
}

type SummarisableReading = Pick<
  SensorReadingWithDevice,
  'temperature' | 'batteryLevel' | 'atmosphericPressure' | 'isAlert' | 'deviceId'
>;

/** Readings arrive oldest first, so "latest" is the last non-null value. */
export function summariseReadings(readings: SummarisableReading[]): TelemetrySummary {
  const temps = readings.map(r => r.temperature).filter((t): t is number => t != null);
  return {
    readingCount: readings.length,
    alertCount: readings.filter(r => r.isAlert).length,
    temperature: temps.length > 0 ? {
      min: Math.min(...temps),
      max: Math.max(...temps),
      avg: Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)),
      latest: temps[temps.length - 1],
    } : null,
    latestBattery: lastValue(readings.map(r => r.batteryLevel)),
    latestPressure: lastValue(readings.map(r => r.atmosphericPressure)),
    devices: new Set(readings.map(r => r.deviceId)).size,
  };
}

function lastValue<T>(values: (T | null)[]): T | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i];
  }
  return null;
}
