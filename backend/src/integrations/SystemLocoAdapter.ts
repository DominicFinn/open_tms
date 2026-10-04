import { PrismaClient } from '@prisma/client';
import { ColdChainService } from '../services/ColdChainService.js';
import { IEventBus } from '../events/IEventBus.js';
import { createEvent } from '../events/createEvent.js';
import { EVENT_TYPES } from '../events/eventTypes.js';
import { ConsolidationRepository } from '../repositories/ConsolidationRepository.js';

/**
 * System Loco IoT Data Feed Adapter
 *
 * Handles two feed types:
 * 1. Device Events — device-level telemetry (temperature, impact, zone changes, etc.)
 * 2. Shipment Events — shipment-level reports, alerts, status changes
 *
 * For each incoming message:
 * - Auto-registers unknown devices
 * - Resolves device → shipment/order via DeviceAssignment or name matching
 * - Stores sensor data as SensorReading time-series
 * - Stores lifecycle events as DeviceEvent
 * - Creates ShipmentEvent for location updates
 * - Cold chain monitoring: writes to ImmutableTemperatureLog and detects excursions
 */

// Event types that carry sensor data worth storing as SensorReading
const SENSOR_EVENT_TYPES = new Set([
  'temperature', 'light', 'impact', 'drop', 'tip', 'battery',
]);

// Event types that are device lifecycle (stored as DeviceEvent only)
const LIFECYCLE_EVENT_TYPES = new Set([
  'globalLocation', 'siteLocation', 'onSite', 'firmware', 'securitySwitch',
  'charging', 'zoneChange', 'sterilisation', 'missing', 'tamper',
  'dataDownload', 'coldChain',
]);

// Shipment event types that are alerts with sensor-relevant data
const SHIPMENT_ALERT_SENSOR_TYPES = new Set([
  'temperature', 'temperatureNormal', 'shocked', 'tilted', 'batteryLow', 'lightInTransit',
]);

export interface ProcessingResult {
  deviceId: string;
  /** The first tracked shipment; see shipmentIds. */
  shipmentId: string | null;
  /** Every shipment the ping applies to: one, or each shipment on the device's consolidation (#329). */
  shipmentIds: string[];
  orderId: string | null;
  trackableUnitId: string | null;
  shipmentEventId: string | null;
  sensorReadingId: string | null;
  deviceEventId: string | null;
  matched: boolean;
  coldChain?: {
    logId: string;
    isExcursion: boolean;
    isAlert: boolean;
    excursionId?: string;
  };
}

/**
 * The device in a feed is registered to a different Organization than the credential that sent
 * the feed. Device external ids are globally unique, so this is either a misconfigured feed or an
 * attempt to write into another tenant.
 */
export class DeviceTenantMismatchError extends Error {
  constructor(readonly deviceId: string) {
    super('Device is registered to another organization');
    this.name = 'DeviceTenantMismatchError';
  }
}

/** Every shipment a reading belongs to, or one unlinked reading when the device tracks none. */
const linkTargets = (shipmentIds: string[]): Array<string | null> => (shipmentIds.length > 0 ? shipmentIds : [null]);

/**
 * sourceReportId is unique. When one reading is stored for each shipment on a consolidation, the
 * first keeps the feed's id (so a redelivery still dedupes) and each further copy is suffixed with
 * its shipment.
 */
export function fanOutKey(base: string, shipmentId: string | null, index: number): string;
export function fanOutKey(base: string | null | undefined, shipmentId: string | null, index: number): string | null;
export function fanOutKey(base: string | null | undefined, shipmentId: string | null, index: number): string | null {
  if (!base) return null;
  return index === 0 || !shipmentId ? base : `${base}:${shipmentId}`;
}

export class SystemLocoAdapter {
  private coldChainService: ColdChainService | null = null;
  private eventBus: IEventBus | null = null;

  private consolidations: ConsolidationRepository;

  constructor(private prisma: PrismaClient) {
    this.consolidations = new ConsolidationRepository(prisma);
  }

  /**
   * Set the cold chain service for temperature monitoring integration.
   * Called post-construction to avoid circular dependency issues.
   */
  setColdChainService(service: ColdChainService): void {
    this.coldChainService = service;
  }

  /**
   * Set the event bus so IoT alerts can raise domain events (e.g. a light-in-
   * transit reading emits shipment.tamper_light for the Issue Engine).
   */
  setEventBus(bus: IEventBus): void {
    this.eventBus = bus;
  }

  /**
   * A light-in-transit reading before the shipment arrives is a possible
   * door-open / tamper event. Emits shipment.tamper_light so the deterministic
   * Issue Engine can raise the `shipment_tamper_light` issue (latched).
   */
  private async emitTamperLightIfBeforeArrival(orgId: string, shipmentId: string, sensorReadingId: string | null): Promise<void> {
    if (!this.eventBus) return;
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId, orgId },
      select: { id: true, orgId: true, reference: true, status: true },
    });
    if (!shipment) return;
    // "Before arrival": not yet delivered/completed.
    if (shipment.status === 'complete' || shipment.status === 'delivered') return;

    await this.eventBus.publish(createEvent({
      type: EVENT_TYPES.SHIPMENT_TAMPER_LIGHT,
      entityType: 'shipment',
      entityId: shipment.id,
      orgId: shipment.orgId,
      actorId: 'system',
      source: 'system-loco',
      payload: {
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        severity: 'critical',
        sensorReadingId,
      },
    }));
  }

  /**
   * Detect if a payload is a System Loco message and which type.
   */
  static detect(payload: any): 'device_event' | 'shipment_event' | null {
    if (payload?.source === 'shipment' && payload?.shipment) return 'shipment_event';
    if (payload?.device && payload?.type && payload?.owner) return 'device_event';
    return null;
  }

  /**
   * Process a System Loco Device Event for the tenant whose credential sent it.
   */
  async processDeviceEvent(payload: any, orgId: string): Promise<ProcessingResult> {
    const deviceInfo = payload.device || {};
    const location = payload.location?.global || payload.location || {};
    const eventType: string = payload.type || 'unknown';
    const eventTime = new Date(payload.startTime || Date.now());

    // 1. Upsert device
    const device = await this.upsertDevice(orgId, deviceInfo, location, payload);

    // 2. Resolve what the device tracks. On a consolidation that is every shipment on it (#329).
    const { shipmentIds, orderId, trackableUnitId } = await this.resolveAssignment(orgId, device.id, deviceInfo.name);
    const shipmentId = shipmentIds[0] ?? null;

    let sensorReadingId: string | null = null;
    let shipmentEventId: string | null = null;

    // 3. Store sensor reading for sensor event types, one per tracked shipment
    if (SENSOR_EVENT_TYPES.has(eventType)) {
      for (const [i, sid] of linkTargets(shipmentIds).entries()) {
        const reading = await this.createSensorReading(device.id, sid, orderId, trackableUnitId, eventTime, eventType, payload, location, fanOutKey(payload.id, sid, i));
        sensorReadingId ??= reading.id;
      }
    }

    // 4. Store device event once; it belongs to the device
    const devEvent = await this.createDeviceEvent(device.id, shipmentId, orderId, trackableUnitId, payload);

    // 5. Create ShipmentEvent for location-bearing events
    if (location?.lat) {
      for (const sid of shipmentIds) {
        const se = await this.createShipmentEvent(sid, deviceInfo, eventType, eventTime, location, payload);
        shipmentEventId ??= se.id;
      }
    }

    // 6. Cold chain monitoring — process temperature for immutable log + excursion detection
    const p = payload.payload || {};
    const temperature = eventType === 'temperature' && p.temperature != null ? Number(p.temperature) : null;
    const coldChain = await this.processColdChain(orgId, shipmentIds, device.id, orderId, trackableUnitId, temperature, location, eventTime, payload);

    return {
      deviceId: device.id,
      shipmentId,
      shipmentIds,
      orderId,
      trackableUnitId,
      shipmentEventId,
      sensorReadingId,
      deviceEventId: devEvent.id,
      matched: !!(shipmentId || orderId || trackableUnitId),
      coldChain,
    };
  }

  /**
   * Process a System Loco Shipment Event for the tenant whose credential sent it.
   */
  async processShipmentEvent(payload: any, orgId: string): Promise<ProcessingResult> {
    const eventType: string = payload.type || 'unknown';
    const eventTime = new Date(payload.time || Date.now());
    const location = payload.location || {};
    const reportPayload = payload.payload || {};
    const deviceInfo = reportPayload.device || {};

    // 1. Upsert device if present
    let device: { id: string } | null = null;
    if (deviceInfo.id) {
      device = await this.upsertDevice(orgId, deviceInfo, location, payload);
    }

    // 2. Resolve shipment(s)/order/trackable unit
    const deviceId = device?.id || null;
    const { shipmentIds, orderId, trackableUnitId } = deviceId
      ? await this.resolveAssignment(orgId, deviceId, deviceInfo.name)
      : { shipmentIds: [] as string[], orderId: null, trackableUnitId: null };
    const shipmentId = shipmentIds[0] ?? null;

    let sensorReadingId: string | null = null;
    let deviceEventId: string | null = null;
    let shipmentEventId: string | null = null;

    // 3. Handle by event type
    if (eventType === 'report' && deviceId) {
      // Sensor report — store reading from sensors object, one per tracked shipment
      const sensors = reportPayload.sensors || {};
      for (const [i, sid] of linkTargets(shipmentIds).entries()) {
        const reading = await this.prisma.sensorReading.create({
          data: {
            deviceId,
            shipmentId: sid,
            orderId,
            trackableUnitId,
            eventTime,
            temperature: sensors.temperature != null ? Number(sensors.temperature) : null,
            batteryLevel: sensors.batteryLevel != null ? Number(sensors.batteryLevel) : null,
            lightLevel: sensors.lightLevel != null ? Number(sensors.lightLevel) : null,
            movement: sensors.movement || null,
            lat: location.lat ? Number(location.lat) : null,
            lng: location.lon ? Number(location.lon) : null,
            address: location.address || null,
            sourceReportId: fanOutKey(payload.id, sid, i),
            rawPayload: payload,
          },
        });
        sensorReadingId ??= reading.id;
      }
    }

    if (SHIPMENT_ALERT_SENSOR_TYPES.has(eventType) && deviceId) {
      // Alert with sensor data
      for (const [i, sid] of linkTargets(shipmentIds).entries()) {
        const reading = await this.prisma.sensorReading.create({
          data: {
            deviceId,
            shipmentId: sid,
            orderId,
            trackableUnitId,
            eventTime,
            temperature: reportPayload.temperature != null ? Number(reportPayload.temperature) : null,
            impactG: reportPayload.g != null ? Number(reportPayload.g) : null,
            tiltAngle: reportPayload.angle != null ? Number(reportPayload.angle) : null,
            batteryLevel: reportPayload.batteryLevel != null ? Number(reportPayload.batteryLevel) : null,
            lightLevel: reportPayload.lightLevel != null ? Number(reportPayload.lightLevel) : null,
            lat: location.lat ? Number(location.lat) : null,
            lng: location.lon ? Number(location.lon) : null,
            address: location.address || null,
            isAlert: true,
            alertType: eventType,
            sourceReportId: fanOutKey(payload.id, sid, i),
            rawPayload: payload,
          },
        });
        sensorReadingId ??= reading.id;

        // Light detected in transit → possible tamper/door-open before arrival.
        if (eventType === 'lightInTransit' && sid) {
          await this.emitTamperLightIfBeforeArrival(orgId, sid, reading.id);
        }
      }

      // Also store as DeviceEvent, once
      const de = await this.prisma.deviceEvent.create({
        data: {
          deviceId,
          shipmentId,
          orderId,
          trackableUnitId,
          externalEventId: payload.id || null,
          eventType,
          category: 'event',
          startTime: eventTime,
          lat: location.lat ? Number(location.lat) : null,
          lng: location.lon ? Number(location.lon) : null,
          address: location.address || null,
          message: reportPayload.message || null,
          payload: reportPayload,
        },
      });
      deviceEventId = de.id;
    }

    // 4. Create ShipmentEvent for all types that have location or are status changes
    for (const sid of shipmentIds) {
      const se = await this.createShipmentEvent(sid, deviceInfo, eventType, eventTime, location, payload);
      shipmentEventId ??= se.id;
    }

    // 5. Cold chain monitoring — process temperature from shipment events
    const temperature = reportPayload.temperature != null ? Number(reportPayload.temperature)
      : reportPayload.sensors?.temperature != null ? Number(reportPayload.sensors.temperature)
      : null;
    const coldChain = deviceId
      ? await this.processColdChain(orgId, shipmentIds, deviceId, orderId, trackableUnitId, temperature, location, eventTime, payload)
      : undefined;

    return {
      deviceId: deviceId || '',
      shipmentId,
      shipmentIds,
      orderId,
      trackableUnitId,
      shipmentEventId,
      sensorReadingId,
      deviceEventId,
      matched: !!(shipmentId || orderId || trackableUnitId),
      coldChain,
    };
  }

  /** Runs cold chain monitoring for each tracked shipment; returns the first shipment's result. */
  private async processColdChain(
    orgId: string, shipmentIds: string[], deviceId: string, orderId: string | null, trackableUnitId: string | null,
    temperature: number | null, location: any, recordedAt: Date, rawPayload: any,
  ): Promise<ProcessingResult['coldChain']> {
    if (!this.coldChainService || temperature === null) return undefined;
    let first: ProcessingResult['coldChain'];
    for (const shipmentId of shipmentIds) {
      try {
        const result = await this.coldChainService.processTemperatureReading({
          orgId,
          shipmentId,
          deviceId,
          orderId: orderId ?? undefined,
          trackableUnitId: trackableUnitId ?? undefined,
          temperature,
          lat: location?.lat ? Number(location.lat) : undefined,
          lng: (location?.lon || location?.lng) ? Number(location.lon || location.lng) : undefined,
          recordedAt,
          rawPayload,
        });
        first ??= result;
      } catch (err) {
        console.error('[SystemLocoAdapter] Cold chain processing failed', { shipmentId, orgId, err: (err as Error).message });
      }
    }
    return first;
  }

  // ── Helpers ───────────────────────────────────────────────

  private async upsertDevice(orgId: string, deviceInfo: any, location: any, payload: any) {
    const externalId = String(deviceInfo.id || deviceInfo.displayId || '');
    // tenancy-exempt: device external ids are unique across every org, and the lookup is deliberately unscoped so a device owned by another org is refused below instead of being attributed here.
    const existing = await this.prisma.device.findUnique({ where: { externalId } });
    if (existing && existing.orgId !== orgId) throw new DeviceTenantMismatchError(existing.id);

    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id, orgId },
        data: {
          lastSeenAt: new Date(),
          firmware: deviceInfo.firmware || existing.firmware,
          lastLat: location?.lat ? Number(location.lat) : existing.lastLat,
          lastLng: (location?.lon || location?.lng) ? Number(location.lon || location.lng) : existing.lastLng,
          batteryLevel: payload.payload?.level ?? payload.payload?.sensors?.batteryLevel ?? existing.batteryLevel,
        },
      });
    }

    // A new device belongs to the tenant whose credential sent the feed.
    return this.prisma.device.create({
      data: {
        orgId,
        externalId,
        displayId: deviceInfo.displayId || null,
        name: deviceInfo.name || externalId,
        provider: 'system_loco',
        model: deviceInfo.model?.name || null,
        firmware: deviceInfo.firmware || null,
        labels: deviceInfo.labels || [],
        lastSeenAt: new Date(),
        lastLat: location?.lat ? Number(location.lat) : null,
        lastLng: (location?.lon || location?.lng) ? Number(location.lon || location.lng) : null,
      },
    });
  }

  private async resolveAssignment(orgId: string, deviceId: string, deviceName?: string): Promise<{ shipmentIds: string[]; orderId: string | null; trackableUnitId: string | null }> {
    // 1. Check active DeviceAssignment
    const assignment = await this.prisma.deviceAssignment.findFirst({
      where: { deviceId, device: { orgId }, active: true },
    });
    if (assignment?.consolidationId) {
      const shipmentIds = await this.consolidations.memberShipmentIds(orgId, assignment.consolidationId);
      return { shipmentIds, orderId: null, trackableUnitId: null };
    }
    if (assignment) {
      return { shipmentIds: assignment.shipmentId ? [assignment.shipmentId] : [], orderId: assignment.orderId, trackableUnitId: assignment.trackableUnitId };
    }

    // 2. Fallback: match device name against shipment reference
    if (deviceName) {
      const shipment = await this.prisma.shipment.findFirst({
        where: { orgId, reference: deviceName, archived: false },
      });
      if (shipment) return { shipmentIds: [shipment.id], orderId: null, trackableUnitId: null };

      // 3. Fallback: match against order number
      const order = await this.prisma.order.findFirst({
        where: { orgId, orderNumber: deviceName, archived: false },
      });
      if (order) return { shipmentIds: [], orderId: order.id, trackableUnitId: null };
    }

    return { shipmentIds: [], orderId: null, trackableUnitId: null };
  }

  private async createSensorReading(
    deviceId: string, shipmentId: string | null, orderId: string | null, trackableUnitId: string | null,
    eventTime: Date, eventType: string, payload: any, location: any, sourceReportId: string | null,
  ) {
    const p = payload.payload || {};
    const isAlert = eventType === 'temperature'
      ? (p.temperature != null && p.maxTemperature != null && p.temperature > p.maxTemperature)
      : eventType === 'impact' || eventType === 'drop' || eventType === 'tip';

    return this.prisma.sensorReading.create({
      data: {
        deviceId,
        shipmentId,
        orderId,
        trackableUnitId,
        eventTime,
        temperature: p.temperature != null ? Number(p.temperature) : null,
        atmosphericPressure: p.atmosphericPressure != null ? Number(p.atmosphericPressure) : null,
        lightLevel: p.lightLevel != null ? Number(p.lightLevel) : null,
        impactG: p.g != null ? Number(p.g) : null,
        tiltAngle: p.angle != null ? Number(p.angle) : null,
        batteryLevel: p.level != null ? Number(p.level) : null,
        batteryVoltage: p.voltage != null ? Number(p.voltage) : null,
        lat: location?.lat ? Number(location.lat) : null,
        lng: (location?.lon || location?.lng) ? Number(location.lon || location.lng) : null,
        address: location?.address || location?.summary || null,
        locationType: payload.location?.type || null,
        locationAccuracy: location?.cep != null ? Number(location.cep) : null,
        tempMin: p.minTemperature != null ? Number(p.minTemperature) : null,
        tempMax: p.maxTemperature != null ? Number(p.maxTemperature) : null,
        lightMin: p.minLightLevel != null ? Number(p.minLightLevel) : null,
        lightMax: p.maxLightLevel != null ? Number(p.maxLightLevel) : null,
        isAlert,
        alertType: isAlert ? eventType : null,
        sourceReportId,
        rawPayload: payload,
      },
    });
  }

  private async createDeviceEvent(deviceId: string, shipmentId: string | null, orderId: string | null, trackableUnitId: string | null, payload: any) {
    return this.prisma.deviceEvent.create({
      data: {
        deviceId,
        shipmentId,
        orderId,
        trackableUnitId,
        externalEventId: payload.id || null,
        eventType: payload.type || 'unknown',
        category: payload.category || 'event',
        startTime: new Date(payload.startTime || Date.now()),
        endTime: payload.endTime ? new Date(payload.endTime) : null,
        lat: payload.location?.global?.lat ? Number(payload.location.global.lat) : null,
        lng: payload.location?.global?.lon ? Number(payload.location.global.lon) : null,
        address: payload.location?.global?.address || payload.location?.summary || null,
        zoneName: payload.payload?.movedInside?.[0]?.name || payload.payload?.remainedInside?.[0]?.name || null,
        message: payload.payload?.message || null,
        payload: payload.payload || null,
      },
    });
  }

  private async createShipmentEvent(
    shipmentId: string, deviceInfo: any, eventType: string,
    eventTime: Date, location: any, rawPayload: any,
  ) {
    return this.prisma.shipmentEvent.create({
      data: {
        shipmentId,
        eventType,
        deviceId: deviceInfo.id || null,
        deviceName: deviceInfo.name || null,
        lat: location?.lat ? Number(location.lat) : null,
        lng: (location?.lon || location?.lng) ? Number(location.lon || location.lng) : null,
        address: location?.address || null,
        locationSummary: location?.summary || location?.address || null,
        rawPayload,
        eventTime,
      },
    });
  }
}
