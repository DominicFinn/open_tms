import { PrismaClient } from '@prisma/client';
import { ColdChainService } from '../services/ColdChainService.js';

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
  shipmentId: string | null;
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

export class SystemLocoAdapter {
  private coldChainService: ColdChainService | null = null;

  constructor(private prisma: PrismaClient) {}

  /**
   * Set the cold chain service for temperature monitoring integration.
   * Called post-construction to avoid circular dependency issues.
   */
  setColdChainService(service: ColdChainService): void {
    this.coldChainService = service;
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
   * Process a System Loco Device Event
   */
  async processDeviceEvent(payload: any): Promise<ProcessingResult> {
    const deviceInfo = payload.device || {};
    const location = payload.location?.global || payload.location || {};
    const eventType: string = payload.type || 'unknown';
    const eventTime = new Date(payload.startTime || Date.now());

    // 1. Upsert device
    const device = await this.upsertDevice(deviceInfo, location, payload);

    // 2. Resolve shipment/order/trackable unit assignment
    const { shipmentId, orderId, trackableUnitId } = await this.resolveAssignment(device.id, deviceInfo.name);

    let sensorReadingId: string | null = null;
    let deviceEventId: string | null = null;
    let shipmentEventId: string | null = null;

    // 3. Store sensor reading for sensor event types
    if (SENSOR_EVENT_TYPES.has(eventType)) {
      const reading = await this.createSensorReading(device.id, shipmentId, orderId, trackableUnitId, eventTime, eventType, payload, location);
      sensorReadingId = reading.id;
    }

    // 4. Store device event for all types
    const devEvent = await this.createDeviceEvent(device.id, shipmentId, orderId, trackableUnitId, payload);
    deviceEventId = devEvent.id;

    // 5. Create ShipmentEvent for location-bearing events
    if (shipmentId && location?.lat) {
      const se = await this.createShipmentEvent(shipmentId, deviceInfo, eventType, eventTime, location, payload);
      shipmentEventId = se.id;
    }

    // 6. Cold chain monitoring — process temperature for immutable log + excursion detection
    let coldChain: ProcessingResult['coldChain'];
    if (this.coldChainService && shipmentId && eventType === 'temperature') {
      const p = payload.payload || {};
      const temperature = p.temperature != null ? Number(p.temperature) : null;
      if (temperature !== null) {
        try {
          const org = await this.prisma.organization.findFirst({ select: { id: true } });
          coldChain = await this.coldChainService.processTemperatureReading({
            orgId: org?.id || '',
            shipmentId,
            deviceId: device.id,
            orderId: orderId ?? undefined,
            trackableUnitId: trackableUnitId ?? undefined,
            temperature,
            humidity: p.humidity != null ? Number(p.humidity) : undefined,
            lat: location?.lat ? Number(location.lat) : undefined,
            lng: (location?.lon || location?.lng) ? Number(location.lon || location.lng) : undefined,
            recordedAt: eventTime,
            rawPayload: payload,
          });
        } catch (err) {
          console.error(`[SystemLocoAdapter] Cold chain processing failed for shipment ${shipmentId}:`, err);
        }
      }
    }

    return {
      deviceId: device.id,
      shipmentId,
      orderId,
      trackableUnitId,
      shipmentEventId,
      sensorReadingId,
      deviceEventId,
      matched: !!(shipmentId || orderId || trackableUnitId),
      coldChain,
    };
  }

  /**
   * Process a System Loco Shipment Event
   */
  async processShipmentEvent(payload: any): Promise<ProcessingResult> {
    const eventType: string = payload.type || 'unknown';
    const eventTime = new Date(payload.time || Date.now());
    const location = payload.location || {};
    const reportPayload = payload.payload || {};
    const deviceInfo = reportPayload.device || {};

    // 1. Upsert device if present
    let device: { id: string } | null = null;
    if (deviceInfo.id) {
      device = await this.upsertDevice(deviceInfo, location, payload);
    }

    // 2. Resolve shipment/order/trackable unit
    const deviceId = device?.id || null;
    const { shipmentId, orderId, trackableUnitId } = deviceId
      ? await this.resolveAssignment(deviceId, deviceInfo.name)
      : { shipmentId: null, orderId: null, trackableUnitId: null };

    let sensorReadingId: string | null = null;
    let deviceEventId: string | null = null;
    let shipmentEventId: string | null = null;

    // 3. Handle by event type
    if (eventType === 'report' && deviceId) {
      // Sensor report — store reading from sensors object
      const sensors = reportPayload.sensors || {};
      const reading = await this.prisma.sensorReading.create({
        data: {
          deviceId,
          shipmentId,
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
          sourceReportId: payload.id || null,
          rawPayload: payload,
        },
      });
      sensorReadingId = reading.id;
    }

    if (SHIPMENT_ALERT_SENSOR_TYPES.has(eventType) && deviceId) {
      // Alert with sensor data
      const reading = await this.prisma.sensorReading.create({
        data: {
          deviceId,
          shipmentId,
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
          sourceReportId: payload.id || null,
          rawPayload: payload,
        },
      });
      sensorReadingId = reading.id;

      // Also store as DeviceEvent
      if (deviceId) {
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
    }

    // 4. Create ShipmentEvent for all types that have location or are status changes
    if (shipmentId) {
      const se = await this.createShipmentEvent(
        shipmentId,
        deviceInfo,
        eventType,
        eventTime,
        location,
        payload,
      );
      shipmentEventId = se.id;
    }

    // 5. Cold chain monitoring — process temperature from shipment events
    let coldChain: ProcessingResult['coldChain'];
    if (this.coldChainService && shipmentId && deviceId) {
      const temperature = reportPayload.temperature != null ? Number(reportPayload.temperature)
        : reportPayload.sensors?.temperature != null ? Number(reportPayload.sensors.temperature)
        : null;
      if (temperature !== null) {
        try {
          const org = await this.prisma.organization.findFirst({ select: { id: true } });
          coldChain = await this.coldChainService.processTemperatureReading({
            orgId: org?.id || '',
            shipmentId,
            deviceId,
            orderId: orderId ?? undefined,
            trackableUnitId: trackableUnitId ?? undefined,
            temperature,
            humidity: reportPayload.humidity != null ? Number(reportPayload.humidity)
              : reportPayload.sensors?.humidity != null ? Number(reportPayload.sensors.humidity)
              : undefined,
            lat: location.lat ? Number(location.lat) : undefined,
            lng: (location.lon || location.lng) ? Number(location.lon || location.lng) : undefined,
            recordedAt: eventTime,
            rawPayload: payload,
          });
        } catch (err) {
          console.error(`[SystemLocoAdapter] Cold chain processing failed for shipment ${shipmentId}:`, err);
        }
      }
    }

    return {
      deviceId: deviceId || '',
      shipmentId,
      orderId,
      trackableUnitId,
      shipmentEventId,
      sensorReadingId,
      deviceEventId,
      matched: !!(shipmentId || orderId || trackableUnitId),
      coldChain,
    };
  }

  // ── Helpers ───────────────────────────────────────────────

  private async upsertDevice(deviceInfo: any, location: any, payload: any) {
    const externalId = String(deviceInfo.id || deviceInfo.displayId || '');
    const existing = await this.prisma.device.findUnique({ where: { externalId } });

    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          firmware: deviceInfo.firmware || existing.firmware,
          lastLat: location?.lat ? Number(location.lat) : existing.lastLat,
          lastLng: (location?.lon || location?.lng) ? Number(location.lon || location.lng) : existing.lastLng,
          batteryLevel: payload.payload?.level ?? payload.payload?.sensors?.batteryLevel ?? existing.batteryLevel,
        },
      });
    }

    // Multi-tenancy: external IoT webhooks have no JWT context, so we
    // attribute the new Device to the first Organization. Multi-tenant
    // deployments should attach an explicit orgId hint to the webhook
    // payload (future work) so the adapter can pick the right tenant.
    const fallbackOrg = await this.prisma.organization.findFirst({ select: { id: true } });
    if (!fallbackOrg) {
      throw new Error('SystemLocoAdapter: no Organization in DB; cannot attribute new Device');
    }

    return this.prisma.device.create({
      data: {
        orgId: fallbackOrg.id,
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

  private async resolveAssignment(deviceId: string, deviceName?: string): Promise<{ shipmentId: string | null; orderId: string | null; trackableUnitId: string | null }> {
    // 1. Check active DeviceAssignment
    const assignment = await this.prisma.deviceAssignment.findFirst({
      where: { deviceId, active: true },
    });
    if (assignment) {
      return { shipmentId: assignment.shipmentId, orderId: assignment.orderId, trackableUnitId: assignment.trackableUnitId };
    }

    // 2. Fallback: match device name against shipment reference
    if (deviceName) {
      const shipment = await this.prisma.shipment.findFirst({
        where: { reference: deviceName, archived: false },
      });
      if (shipment) return { shipmentId: shipment.id, orderId: null, trackableUnitId: null };

      // 3. Fallback: match against order number
      const order = await this.prisma.order.findFirst({
        where: { orderNumber: deviceName, archived: false },
      });
      if (order) return { shipmentId: null, orderId: order.id, trackableUnitId: null };
    }

    return { shipmentId: null, orderId: null, trackableUnitId: null };
  }

  private async createSensorReading(
    deviceId: string, shipmentId: string | null, orderId: string | null, trackableUnitId: string | null,
    eventTime: Date, eventType: string, payload: any, location: any,
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
        humidity: p.humidity != null ? Number(p.humidity) : null,
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
        sourceReportId: payload.id || null,
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
