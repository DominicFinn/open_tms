/**
 * TrackingPing — the internal shape every IoT vendor payload is normalised into (#323).
 *
 * Vendor adapters parse their own wire format into a TrackingPing; everything downstream
 * (location events, geofence arrival/departure, journey checkpoints, sensor readings) reads the
 * ping, never the raw payload. Times are always the device's own timestamp, so queue delay never
 * shifts a recorded arrival or checkpoint.
 */

export interface TrackingPosition {
  lat: number;
  lng: number;
  address?: string;
  /** Accuracy radius in metres, when the device reports one. */
  accuracyMeters?: number;
}

export interface TrackingReading {
  recordedAt: Date;
  temperature?: number;
  batteryLevel?: number;
  batteryVoltage?: number;
  lightLevel?: number;
  atmosphericPressure?: number;
}

export interface TrackingPing {
  deviceExternalId?: string;
  deviceName?: string;
  eventType: string;
  /** Device timestamp of the ping. Falls back to receipt time only when the payload has none. */
  eventTime: Date;
  position?: TrackingPosition;
  readings: TrackingReading[];
  /**
   * How many readings the device says it took for this ping. Can exceed `readings.length` when a
   * device summarises rather than sending every buffered reading.
   */
  readingsCount: number;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parsePosition(location: any): TrackingPosition | undefined {
  const source = location?.global ?? location;
  const lat = toNumber(source?.lat);
  const lng = toNumber(source?.lon ?? source?.lng);
  if (lat === undefined || lng === undefined) return undefined;
  return {
    lat,
    lng,
    address: source?.address ?? location?.summary ?? undefined,
    accuracyMeters: toNumber(source?.cep ?? source?.accuracy),
  };
}

/** A reading with no sensor values carries nothing worth storing. */
function parseReading(raw: any, fallbackTime: Date): TrackingReading | null {
  if (!raw || typeof raw !== 'object') return null;
  const reading: TrackingReading = {
    recordedAt: toDate(raw.time ?? raw.recordedAt ?? raw.timestamp) ?? fallbackTime,
    temperature: toNumber(raw.temperature),
    batteryLevel: toNumber(raw.batteryLevel ?? raw.battery),
    batteryVoltage: toNumber(raw.batteryVoltage ?? raw.voltage),
    lightLevel: toNumber(raw.lightLevel ?? raw.light),
    atmosphericPressure: toNumber(raw.atmosphericPressure ?? raw.pressure),
  };
  const hasValue = [
    reading.temperature, reading.batteryLevel, reading.batteryVoltage,
    reading.lightLevel, reading.atmosphericPressure,
  ].some((v) => v !== undefined);
  return hasValue ? reading : null;
}

function parseReadings(event: any, eventTime: Date): TrackingReading[] {
  if (Array.isArray(event?.readings)) {
    return event.readings
      .map((r: any) => parseReading(r, eventTime))
      .filter((r: TrackingReading | null): r is TrackingReading => r !== null);
  }
  // Single-reading pings put the values in a `sensors` block or straight on the event.
  const single = parseReading(event?.sensors ?? event, eventTime);
  return single ? [single] : [];
}

/**
 * Generic (non-vendor) ping, as documented for API-key integrations:
 * `{ event: { device: { id, name }, type, startTime, location: { global: { lat, lon } },
 *   readings?: [{ time, temperature, batteryLevel, ... }], sensors?: {...}, readingsCount? } }`.
 * The `event` wrapper is optional.
 */
export function parseGenericPing(rawPayload: any, receivedAt: Date = new Date()): TrackingPing {
  const event = rawPayload?.event ?? rawPayload ?? {};
  const eventTime = toDate(event.startTime ?? event.time ?? event.latestTime) ?? receivedAt;
  const readings = parseReadings(event, eventTime);
  return {
    deviceExternalId: event.device?.id ? String(event.device.id) : undefined,
    deviceName: event.device?.name ?? undefined,
    eventType: event.type || 'location',
    eventTime,
    position: parsePosition(event.location),
    readings,
    readingsCount: Math.max(toNumber(event.readingsCount) ?? 0, readings.length),
  };
}

/**
 * System Loco device or shipment event. Readings are persisted by SystemLocoAdapter itself (it
 * feeds cold chain and alerting), so the ping carries them for downstream consumers only.
 */
export function parseSystemLocoPing(rawPayload: any, receivedAt: Date = new Date()): TrackingPing {
  const device = rawPayload?.device ?? rawPayload?.payload?.device ?? {};
  const eventTime = toDate(rawPayload?.startTime ?? rawPayload?.time) ?? receivedAt;
  const sensorSource = rawPayload?.payload?.sensors ?? rawPayload?.payload;
  const reading = parseReading(sensorSource, eventTime);
  const readings = reading ? [reading] : [];
  return {
    deviceExternalId: device.id ? String(device.id) : undefined,
    deviceName: device.name ?? undefined,
    eventType: rawPayload?.type || 'unknown',
    eventTime,
    position: parsePosition(rawPayload?.location),
    readings,
    readingsCount: readings.length,
  };
}
