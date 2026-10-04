import { PrismaClient } from '@prisma/client';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { WebhookEvent } from '../queue/events.js';
import { IOrderDeliveryService } from '../services/OrderDeliveryService.js';
import { IArrivalCriteriaEvaluationService } from '../services/ArrivalCriteriaEvaluationService.js';
import { SystemLocoAdapter, DeviceTenantMismatchError, fanOutKey } from '../integrations/SystemLocoAdapter.js';
import { ConsolidationRepository } from '../repositories/ConsolidationRepository.js';
import { ColdChainService } from '../services/ColdChainService.js';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IEventBus } from '../events/IEventBus.js';
import { createEvent } from '../events/createEvent.js';
import { EVENT_TYPES } from '../events/eventTypes.js';
import { ISensorReadingRepository, SensorReadingRepository } from '../repositories/SensorReadingRepository.js';
import { TrackingPing, parseGenericPing, parseSystemLocoPing } from '../integrations/tracking/TrackingPing.js';

/** A queued webhook whose tenant cannot be established. Retrying won't help; it dead-letters. */
export class WebhookTenantUnresolvedError extends Error {
  constructor(webhookLogId: string) {
    super(`Webhook ${webhookLogId} has no orgId and no API key to derive one from`);
    this.name = 'WebhookTenantUnresolvedError';
  }
}

type Deps = {
  prisma: PrismaClient;
  sensorReadings: ISensorReadingRepository;
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
    // tenancy-exempt: externalEventId is @unique across the whole DeviceEvent table, so this dedupe only needs the id, and only a boolean comes back.
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

  const ping = parseSystemLocoPing(rawPayload);

  await prisma.webhookLog.update({
    where: { id: webhookLogId, orgId },
    data: {
      status: result.matched ? 'success' : 'not_found',
      deviceName: ping.deviceName || null,
      deviceId: ping.deviceExternalId || null,
      eventType: rawPayload.type || null,
      hasLocation: !!ping.position,
      lat: ping.position?.lat ?? null,
      lng: ping.position?.lng ?? null,
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

  // A device on a consolidation drives every shipment on it, each through its own journey (#329).
  for (const shipmentId of result.shipmentIds) {
    await applyPingToJourney(deps, orgId, shipmentId, ping, rawPayload, 'system_loco_webhook');
  }
}

/**
 * Everything a ping drives once it is tied to a shipment: the current-position event, then
 * geofence arrival/departure and journey checkpoints, all stamped with the device's time.
 */
async function applyPingToJourney(
  deps: Deps,
  orgId: string,
  shipmentId: string,
  ping: TrackingPing,
  rawPayload: any,
  source: string,
): Promise<void> {
  const eventTime = ping.eventTime.toISOString();
  if (ping.position) {
    await publishLocation(deps, orgId, shipmentId, ping.position.lat, ping.position.lng, eventTime, source);
  }

  // Evaluate arrival criteria (WiFi, BLE, enhanced geofence) FIRST. This is the event-publishing
  // path (full-journey departure/checkpoint/arrival, #283) and it must win the race to flip
  // ShipmentStop.status before the legacy checkGeofenceAndUpdateOrders below, which does a silent
  // direct write with no event.
  if (deps.arrivalCriteriaService) {
    try {
      await deps.arrivalCriteriaService.evaluateAndUpdateOrders({
        orgId,
        shipmentId,
        deviceId: ping.deviceExternalId,
        lat: ping.position?.lat,
        lng: ping.position?.lng,
        eventTime,
        rawPayload,
      });
    } catch (err) {
      console.error('[WebhookWorker] Arrival criteria evaluation failed', { shipmentId, orgId, err: (err as Error).message });
    }
  }

  // Legacy geofence check runs second, so it becomes a no-op once arrival criteria above have
  // already transitioned the stop for orgs configured via ArrivalCriteria.
  if (ping.position) {
    try {
      await deps.deliveryService.checkGeofenceAndUpdateOrders(orgId, shipmentId, ping.position.lat, ping.position.lng);
    } catch (err) {
      console.error('[WebhookWorker] Legacy geofence check failed', { shipmentId, orgId, err: (err as Error).message });
    }
  }
}

interface LegacyResolution {
  /** Usually one; every live shipment on the device's consolidation when it is on one (#329). */
  shipments: Array<{ id: string; reference: string }>;
  /** The org's registered device, when there is one; readings can only be stored against it. */
  deviceId: string | null;
}

/** Resolve the device and the shipment a legacy device feed refers to, within the tenant. */
async function resolveLegacyShipment(
  prisma: PrismaClient,
  orgId: string,
  deviceExternalId: string | undefined,
  deviceName: string,
): Promise<LegacyResolution> {
  const registeredDevice = await prisma.device.findFirst({
    where: { orgId, OR: [{ externalId: deviceExternalId || '' }, { name: deviceName }] },
    include: { assignments: { where: { active: true }, take: 1 } },
  });
  const deviceId = registeredDevice?.id ?? null;
  const assignment = registeredDevice?.assignments[0];
  const byIds = async (ids: string[]) => {
    const rows = await prisma.shipment.findMany({ where: { id: { in: ids }, orgId }, select: { id: true, reference: true } });
    return ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is { id: string; reference: string } => !!r);
  };
  if (assignment?.consolidationId) {
    const ids = await new ConsolidationRepository(prisma).memberShipmentIds(orgId, assignment.consolidationId);
    return { shipments: await byIds(ids), deviceId };
  }
  if (assignment?.shipmentId) return { shipments: await byIds([assignment.shipmentId]), deviceId };

  const byReference = await prisma.shipment.findFirst({
    where: { orgId, reference: deviceName, archived: false },
    select: { id: true, reference: true },
  });
  if (byReference) return { shipments: [byReference], deviceId };

  const order = await prisma.order.findFirst({
    where: { orgId, orderNumber: deviceName, archived: false },
    select: { id: true },
  });
  if (!order) return { shipments: [], deviceId };
  const link = await prisma.orderShipment.findFirst({ where: { orderId: order.id, order: { orgId } } });
  if (!link) return { shipments: [], deviceId };
  return { shipments: await byIds([link.shipmentId]), deviceId };
}

async function processLegacy(deps: Deps, orgId: string, webhookLogId: string, rawPayload: any): Promise<void> {
  const { prisma } = deps;
  const ping = parseGenericPing(rawPayload);
  const deviceName = ping.deviceName || ping.deviceExternalId || '';

  const { shipments, deviceId } = deviceName
    ? await resolveLegacyShipment(prisma, orgId, ping.deviceExternalId, deviceName)
    : { shipments: [], deviceId: null };
  const shipment = shipments[0] ?? null;
  let shipmentEventId: string | null = null;

  for (const target of shipments) {
    if (!ping.position) break;
    const shipmentEvent = await prisma.shipmentEvent.create({
      data: {
        shipmentId: target.id,
        eventType: ping.eventType,
        deviceId: ping.deviceExternalId,
        deviceName,
        lat: ping.position.lat,
        lng: ping.position.lng,
        address: ping.position.address,
        locationSummary: ping.position.address,
        rawPayload,
        eventTime: ping.eventTime,
      },
    });
    shipmentEventId ??= shipmentEvent.id;
  }

  // Readings belong to a device, so a ping from a device the org hasn't registered keeps its
  // telemetry only in the webhook log's raw payload.
  let readingsStored = 0;
  // On a consolidation each shipment gets its own copy, so every customer's telemetry is complete.
  const readingTargets: Array<string | null> = shipments.length > 0 ? shipments.map((t) => t.id) : [null];
  for (const [n, shipmentId] of readingTargets.entries()) {
    if (!deviceId || ping.readings.length === 0) break;
    readingsStored += await deps.sensorReadings.createForDevice(
      orgId,
      deviceId,
      { shipmentId },
      ping.readings.map(({ recordedAt, ...values }, i) => ({
        ...values,
        eventTime: recordedAt,
        lat: ping.position?.lat,
        lng: ping.position?.lng,
        address: ping.position?.address,
        locationAccuracy: ping.position?.accuracyMeters,
        // One webhook log per delivered ping, so this key makes a queue retry a no-op.
        sourceReportId: fanOutKey(`webhook:${webhookLogId}:${i}`, shipmentId, n),
      })),
    ) ?? 0;
  }

  for (const target of shipments) {
    await applyPingToJourney(deps, orgId, target.id, ping, rawPayload, 'legacy_webhook');
  }

  await prisma.webhookLog.update({
    where: { id: webhookLogId, orgId },
    data: {
      status: shipment ? 'success' : (deviceName ? 'not_found' : 'skipped'),
      deviceName: deviceName || null,
      deviceId: ping.deviceExternalId || null,
      eventType: ping.eventType,
      hasLocation: !!ping.position,
      lat: ping.position?.lat ?? null,
      lng: ping.position?.lng ?? null,
      shipmentFound: !!shipment,
      shipmentUpdated: !!shipmentEventId,
      shipmentId: shipment?.id ?? null,
      shipmentReference: shipment?.reference ?? null,
      shipmentEventId,
      processedAt: new Date(),
      responseCode: 200,
      responseBody: {
        processed: true,
        shipmentFound: !!shipment,
        readingsReceived: ping.readingsCount,
        readingsStored,
      },
    },
  });
}

export function createInboundWebhookWorker(
  prisma: PrismaClient,
  deliveryService: IOrderDeliveryService,
  arrivalCriteriaService?: IArrivalCriteriaEvaluationService,
  /** Passed by the standalone worker, which has no DI container; the API process resolves it. */
  injectedEventBus?: IEventBus,
) {
  const systemLoco = new SystemLocoAdapter(prisma);
  // Wire cold chain monitoring into the sensor ingestion pipeline
  systemLoco.setColdChainService(new ColdChainService(prisma));

  // Event bus for publishing tracking.location_received so the shipment read
  // model's current position updates (drives the map/list dot).
  let eventBus: IEventBus | null = injectedEventBus ?? null;
  if (!eventBus) {
    try { eventBus = container.resolve<IEventBus>(TOKENS.IEventBus); } catch { /* not available in some contexts */ }
  }
  if (!eventBus) {
    console.warn('[WebhookWorker] No event bus available; location events will not be published');
  }
  if (eventBus) systemLoco.setEventBus(eventBus);

  const deps: Deps = {
    prisma, sensorReadings: new SensorReadingRepository(prisma), deliveryService, arrivalCriteriaService, systemLoco, eventBus,
  };

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
