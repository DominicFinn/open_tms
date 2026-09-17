import { PrismaClient } from '@prisma/client';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { WebhookEvent } from '../queue/events.js';
import { IOrderDeliveryService } from '../services/OrderDeliveryService.js';
import { IArrivalCriteriaEvaluationService } from '../services/ArrivalCriteriaEvaluationService.js';
import { SystemLocoAdapter, DeviceTenantMismatchError } from '../integrations/SystemLocoAdapter.js';
import { ColdChainService } from '../services/ColdChainService.js';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IEventBus } from '../events/IEventBus.js';
import { createEvent } from '../events/createEvent.js';
import { EVENT_TYPES } from '../events/eventTypes.js';

/** A queued webhook whose tenant cannot be established. Retrying won't help; it dead-letters. */
export class WebhookTenantUnresolvedError extends Error {
  constructor(webhookLogId: string) {
    super(`Webhook ${webhookLogId} has no orgId and no API key to derive one from`);
    this.name = 'WebhookTenantUnresolvedError';
  }
}

type Deps = {
  prisma: PrismaClient;
  deliveryService: IOrderDeliveryService;
  arrivalCriteriaService?: IArrivalCriteriaEvaluationService;
  systemLoco: SystemLocoAdapter;
  eventBus: IEventBus | null;
};

/**
 * The tenant for a queued webhook. The route resolves it from the credential and puts it on the
 * message. Messages queued before #303 lack it: an API-key message can still be attributed through
 * its key, but a signed one cannot, because the signature was checked at the edge and not kept.
 */
async function resolveMessageOrgId(prisma: PrismaClient, payload: WebhookEvent): Promise<string | null> {
  if (payload.orgId) return payload.orgId;
  if (!payload.apiKeyId) return null;
  // tenancy-exempt: apiKeyId was written onto the message by our own route after it verified the key
  const apiKey = await prisma.apiKey.findUnique({ where: { id: payload.apiKeyId }, select: { orgId: true } });
  return apiKey?.orgId ?? null;
}

async function publishLocation(
  deps: Deps,
  orgId: string,
  shipmentId: string,
  lat: number,
  lng: number,
  eventTime: string,
  source: string,
): Promise<void> {
  if (!deps.eventBus) return;
  try {
    await deps.eventBus.publish(createEvent({
      type: EVENT_TYPES.TRACKING_LOCATION_RECEIVED,
      orgId,
      actorId: 'system',
      entityType: 'shipment',
      entityId: shipmentId,
      payload: { shipmentId, lat, lng, eventTime },
      source,
    }));
  } catch (err) {
    console.error('[WebhookWorker] Failed to publish location event', { shipmentId, orgId, err: (err as Error).message });
  }
}

async function markLog(
  prisma: PrismaClient,
  orgId: string,
  webhookLogId: string,
  status: string,
  reason: string,
): Promise<void> {
  await prisma.webhookLog.update({
    where: { id: webhookLogId, orgId },
    data: {
      status,
      processedAt: new Date(),
      responseCode: 200,
      responseBody: { skipped: true, reason },
    },
  });
}

async function processSystemLoco(
  deps: Deps,
  orgId: string,
  webhookLogId: string,
  rawPayload: any,
  feedType: 'device_event' | 'shipment_event',
): Promise<void> {
  const { prisma } = deps;

  // Vendor gate: if this org's admin has switched System Loco off, log and skip.
  const vendor = await prisma.iotVendor.findUnique({
    where: { orgId_vendorKey: { orgId, vendorKey: 'system_loco' } },
    select: { enabled: true },
  });
  if (vendor && !vendor.enabled) {
    await markLog(prisma, orgId, webhookLogId, 'disabled', 'System Loco vendor disabled');
    return;
  }

  // Idempotency: System Loco may redeliver an event (3 attempts, 14-day DLQ). If we've already
  // processed this event id, no-op so we don't double-write readings or re-move the position.
  if (rawPayload.id) {
    const already = await prisma.deviceEvent.findUnique({
      where: { externalEventId: rawPayload.id },
      select: { id: true },
    });
    if (already) {
      await markLog(prisma, orgId, webhookLogId, 'duplicate', 'Duplicate event id (already processed)');
      return;
    }
  }

  const result = feedType === 'device_event'
    ? await deps.systemLoco.processDeviceEvent(rawPayload, orgId)
    : await deps.systemLoco.processShipmentEvent(rawPayload, orgId);

  const deviceInfo = rawPayload.device || rawPayload.payload?.device || {};
  const location = rawPayload.location?.global || rawPayload.location || {};
  const lat = location.lat ? Number(location.lat) : null;
  const lng = (location.lon || location.lng) ? Number(location.lon || location.lng) : null;

  await prisma.webhookLog.update({
    where: { id: webhookLogId, orgId },
    data: {
      status: result.matched ? 'success' : 'not_found',
      deviceName: deviceInfo.name || null,
      deviceId: deviceInfo.id || null,
      eventType: rawPayload.type || null,
      hasLocation: !!location.lat,
      lat,
      lng,
      shipmentFound: !!result.shipmentId,
      shipmentUpdated: !!result.shipmentEventId,
      shipmentId: result.shipmentId,
      shipmentReference: null,
      shipmentEventId: result.shipmentEventId,
      processedAt: new Date(),
      responseCode: 200,
      responseBody: { processed: true, ...result },
    },
  });

  if (!result.shipmentId) return;

  if (lat !== null && lng !== null) {
    const eventTime = rawPayload.startTime || rawPayload.time || new Date().toISOString();
    await publishLocation(deps, orgId, result.shipmentId, lat, lng, eventTime, 'system_loco_webhook');
  }

  // Evaluate arrival criteria (WiFi, BLE, enhanced geofence) from IoT payload FIRST.
  // This is the event-publishing path (full-journey departure/checkpoint/arrival, #283) and
  // it must win the race to flip ShipmentStop.status before the legacy
  // checkGeofenceAndUpdateOrders below, which does a silent direct write with no event.
  if (deps.arrivalCriteriaService) {
    try {
      await deps.arrivalCriteriaService.evaluateAndUpdateOrders({
        orgId,
        shipmentId: result.shipmentId,
        deviceId: deviceInfo.id || undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        rawPayload,
      });
    } catch {
      // Arrival criteria evaluation is non-critical
    }
  }

  // Legacy geofence check runs second, so it becomes a no-op once arrival criteria above have
  // already transitioned the stop for orgs configured via ArrivalCriteria.
  if (lat !== null && lng !== null) {
    try {
      await deps.deliveryService.checkGeofenceAndUpdateOrders(orgId, result.shipmentId, lat, lng);
    } catch {
      // Geofence check is non-critical
    }
  }
}

/** Resolve the shipment a legacy device feed refers to, within the tenant. */
async function resolveLegacyShipment(
  prisma: PrismaClient,
  orgId: string,
  device: { id?: string },
  deviceName: string,
): Promise<{ id: string; reference: string } | null> {
  const registeredDevice = await prisma.device.findFirst({
    where: { orgId, OR: [{ externalId: device?.id || '' }, { name: deviceName }] },
    include: { assignments: { where: { active: true }, take: 1 } },
  });
  const assignedId = registeredDevice?.assignments[0]?.shipmentId;
  if (assignedId) {
    return prisma.shipment.findFirst({ where: { id: assignedId, orgId }, select: { id: true, reference: true } });
  }

  const byReference = await prisma.shipment.findFirst({
    where: { orgId, reference: deviceName, archived: false },
    select: { id: true, reference: true },
  });
  if (byReference) return byReference;

  const order = await prisma.order.findFirst({
    where: { orgId, orderNumber: deviceName, archived: false },
    select: { id: true },
  });
  if (!order) return null;
  const link = await prisma.orderShipment.findFirst({ where: { orderId: order.id } });
  if (!link) return null;
  return prisma.shipment.findFirst({ where: { id: link.shipmentId, orgId }, select: { id: true, reference: true } });
}

async function processLegacy(deps: Deps, orgId: string, webhookLogId: string, rawPayload: any): Promise<void> {
  const { prisma } = deps;
  const event = rawPayload?.event || rawPayload;
  const device = event?.device || {};
  const deviceName = device?.name || device?.id || '';
  const eventType = event?.type || 'location';
  const location = event?.location?.global || event?.location || {};
  const hasLocation = !!(location?.lat && (location?.lon || location?.lng));
  const lat = hasLocation ? parseFloat(String(location.lat)) : null;
  const lng = hasLocation ? parseFloat(String(location.lon || location.lng)) : null;

  const shipment = deviceName ? await resolveLegacyShipment(prisma, orgId, device, deviceName) : null;
  let shipmentEventId: string | null = null;

  if (shipment && lat !== null && lng !== null) {
    const shipmentEvent = await prisma.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        eventType,
        deviceId: device?.id,
        deviceName,
        lat,
        lng,
        address: location.address,
        locationSummary: location.summary || location.address,
        rawPayload,
        eventTime: event?.startTime ? new Date(event.startTime) : new Date(),
      },
    });
    shipmentEventId = shipmentEvent.id;

    const eventTime = event?.startTime ? new Date(event.startTime).toISOString() : new Date().toISOString();
    await publishLocation(deps, orgId, shipment.id, lat, lng, eventTime, 'legacy_webhook');
    try {
      await deps.deliveryService.checkGeofenceAndUpdateOrders(orgId, shipment.id, lat, lng);
    } catch {
      // Geofence check is non-critical
    }
  }

  await prisma.webhookLog.update({
    where: { id: webhookLogId, orgId },
    data: {
      status: shipment ? 'success' : (deviceName ? 'not_found' : 'skipped'),
      deviceName: deviceName || null,
      deviceId: device?.id || null,
      eventType,
      hasLocation,
      lat,
      lng,
      shipmentFound: !!shipment,
      shipmentUpdated: !!shipmentEventId,
      shipmentId: shipment?.id ?? null,
      shipmentReference: shipment?.reference ?? null,
      shipmentEventId,
      processedAt: new Date(),
      responseCode: 200,
      responseBody: { processed: true, shipmentFound: !!shipment },
    },
  });
}

export function createInboundWebhookWorker(
  prisma: PrismaClient,
  deliveryService: IOrderDeliveryService,
  arrivalCriteriaService?: IArrivalCriteriaEvaluationService,
) {
  const systemLoco = new SystemLocoAdapter(prisma);
  // Wire cold chain monitoring into the sensor ingestion pipeline
  systemLoco.setColdChainService(new ColdChainService(prisma));

  // Event bus for publishing tracking.location_received so the shipment read
  // model's current position updates (drives the map/list dot).
  let eventBus: IEventBus | null = null;
  try { eventBus = container.resolve<IEventBus>(TOKENS.IEventBus); } catch { /* not available in some contexts */ }
  if (eventBus) systemLoco.setEventBus(eventBus);

  const deps: Deps = { prisma, deliveryService, arrivalCriteriaService, systemLoco, eventBus };

  return async (message: QueueMessage<WebhookEvent>) => {
    const { webhookLogId, rawPayload } = message.payload;

    const orgId = await resolveMessageOrgId(prisma, message.payload);
    if (!orgId) {
      console.error('[WebhookWorker] Cannot attribute webhook to a tenant; dead-lettering', { webhookLogId });
      throw new WebhookTenantUnresolvedError(webhookLogId);
    }

    // A log row in another org reads as missing, the same as one that was never written.
    const webhookLog = await prisma.webhookLog.findUnique({ where: { id: webhookLogId, orgId } });
    if (!webhookLog) {
      console.warn('[WebhookWorker] Log not found, skipping', { webhookLogId, orgId });
      return;
    }

    try {
      const feedType = SystemLocoAdapter.detect(rawPayload);
      if (feedType) {
        await processSystemLoco(deps, orgId, webhookLogId, rawPayload, feedType);
      } else {
        await processLegacy(deps, orgId, webhookLogId, rawPayload);
      }
    } catch (err: any) {
      if (err instanceof DeviceTenantMismatchError) {
        // Another tenant owns this device. Refuse rather than write into their data; a retry
        // would get the same answer, so this is not rethrown.
        console.warn('[WebhookWorker] Device belongs to another tenant; rejected', { webhookLogId });
        await markLog(prisma, orgId, webhookLogId, 'rejected', 'Device is registered to another organization');
        return;
      }
      await prisma.webhookLog.update({
        where: { id: webhookLogId, orgId },
        data: {
          status: 'error',
          errorMessage: err.message,
          processedAt: new Date(),
          responseCode: 500,
        },
      });
      throw err;
    }
  };
}
