import { PrismaClient } from '@prisma/client';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { WebhookEvent } from '../queue/events.js';
import { IOrderDeliveryService } from '../services/OrderDeliveryService.js';
import { IArrivalCriteriaEvaluationService } from '../services/ArrivalCriteriaEvaluationService.js';
import { SystemLocoAdapter } from '../integrations/SystemLocoAdapter.js';
import { ColdChainService } from '../services/ColdChainService.js';

export function createInboundWebhookWorker(
  prisma: PrismaClient,
  deliveryService: IOrderDeliveryService,
  arrivalCriteriaService?: IArrivalCriteriaEvaluationService,
) {
  const systemLoco = new SystemLocoAdapter(prisma);
  // Wire cold chain monitoring into the sensor ingestion pipeline
  const coldChainService = new ColdChainService(prisma);
  systemLoco.setColdChainService(coldChainService);

  return async (message: QueueMessage<WebhookEvent>) => {
    const { webhookLogId, rawPayload } = message.payload;

    // Load the webhook log entry
    const webhookLog = await prisma.webhookLog.findUnique({
      where: { id: webhookLogId }
    });

    if (!webhookLog) {
      console.warn(`[WebhookWorker] Log ${webhookLogId} not found, skipping`);
      return;
    }

    try {
      // Detect System Loco format
      const feedType = SystemLocoAdapter.detect(rawPayload);

      if (feedType) {
        // ── System Loco path ──────────────────────────────
        // Vendor gate: if an admin has switched System Loco off for the org,
        // log the webhook as disabled and skip processing. Webhooks have no
        // tenant context, so we check the fallback (first) organization.
        const gateOrg = await prisma.organization.findFirst({ select: { id: true } });
        if (gateOrg) {
          const vendor = await prisma.iotVendor.findUnique({
            where: { orgId_vendorKey: { orgId: gateOrg.id, vendorKey: 'system_loco' } },
            select: { enabled: true },
          });
          if (vendor && !vendor.enabled) {
            await prisma.webhookLog.update({
              where: { id: webhookLogId },
              data: {
                status: 'disabled',
                processedAt: new Date(),
                responseCode: 200,
                responseBody: { skipped: true, reason: 'System Loco vendor disabled' },
              },
            });
            return;
          }
        }

        const result = feedType === 'device_event'
          ? await systemLoco.processDeviceEvent(rawPayload)
          : await systemLoco.processShipmentEvent(rawPayload);

        const deviceInfo = rawPayload.device || rawPayload.payload?.device || {};
        const location = rawPayload.location?.global || rawPayload.location || {};

        await prisma.webhookLog.update({
          where: { id: webhookLogId },
          data: {
            status: result.matched ? 'success' : 'not_found',
            deviceName: deviceInfo.name || null,
            deviceId: deviceInfo.id || null,
            eventType: rawPayload.type || null,
            hasLocation: !!(location.lat),
            lat: location.lat ? Number(location.lat) : null,
            lng: (location.lon || location.lng) ? Number(location.lon || location.lng) : null,
            shipmentFound: !!result.shipmentId,
            shipmentUpdated: !!result.shipmentEventId,
            shipmentId: result.shipmentId,
            shipmentReference: null,
            shipmentEventId: result.shipmentEventId,
            processedAt: new Date(),
            responseCode: 200,
            responseBody: { processed: true, ...result },
          }
        });

        // Trigger geofence check if we have a shipment + location
        if (result.shipmentId && location.lat) {
          try {
            await deliveryService.checkGeofenceAndUpdateOrders(
              result.shipmentId,
              Number(location.lat),
              Number(location.lon || location.lng),
            );
          } catch {
            // Geofence check is non-critical
          }
        }

        // Evaluate arrival criteria (WiFi, BLE, enhanced geofence) from IoT payload
        if (result.shipmentId && arrivalCriteriaService) {
          try {
            await arrivalCriteriaService.evaluateAndUpdateOrders({
              shipmentId: result.shipmentId,
              deviceId: deviceInfo.id || undefined,
              lat: location.lat ? Number(location.lat) : undefined,
              lng: (location.lon || location.lng) ? Number(location.lon || location.lng) : undefined,
              rawPayload,
            });
          } catch {
            // Arrival criteria evaluation is non-critical
          }
        }

        return;
      }

      // ── Legacy format path (backwards compatible) ─────
      const event = rawPayload?.event || rawPayload;
      const device = event?.device || {};
      const deviceName = device?.name || device?.id || '';
      const eventType = event?.type || 'location';
      const location = event?.location?.global || event?.location || {};
      const hasLocation = !!(location?.lat && (location?.lon || location?.lng));

      let shipmentId: string | null = null;
      let shipmentReference: string | null = null;
      let shipmentEventId: string | null = null;

      if (deviceName) {
        // Try device registry first
        const registeredDevice = await prisma.device.findFirst({
          where: { OR: [{ externalId: device?.id || '' }, { name: deviceName }] },
          include: { assignments: { where: { active: true }, take: 1 } },
        });

        if (registeredDevice?.assignments[0]?.shipmentId) {
          shipmentId = registeredDevice.assignments[0].shipmentId;
          const ship = await prisma.shipment.findUnique({ where: { id: shipmentId } });
          shipmentReference = ship?.reference || null;
        }

        // Fallback: match device name against shipment reference
        if (!shipmentId) {
          const shipment = await prisma.shipment.findFirst({
            where: { reference: deviceName, archived: false }
          });
          if (shipment) {
            shipmentId = shipment.id;
            shipmentReference = shipment.reference;
          }
        }

        // Fallback: match against order number
        if (!shipmentId) {
          const order = await prisma.order.findFirst({
            where: { orderNumber: deviceName, archived: false }
          });
          if (order) {
            // Find shipment via OrderShipment
            const os = await prisma.orderShipment.findFirst({ where: { orderId: order.id } });
            if (os) {
              shipmentId = os.shipmentId;
              const ship = await prisma.shipment.findUnique({ where: { id: os.shipmentId } });
              shipmentReference = ship?.reference || null;
            }
          }
        }

        // Create shipment event if we have location data
        if (shipmentId && hasLocation) {
          const shipmentEvent = await prisma.shipmentEvent.create({
            data: {
              shipmentId,
              eventType,
              deviceId: device?.id,
              deviceName,
              lat: location.lat ? parseFloat(String(location.lat)) : null,
              lng: (location.lon || location.lng) ? parseFloat(String(location.lon || location.lng)) : null,
              address: location.address,
              locationSummary: location.summary || location.address,
              rawPayload,
              eventTime: event?.startTime ? new Date(event.startTime) : new Date(),
            }
          });
          shipmentEventId = shipmentEvent.id;

          // Trigger geofence check
          try {
            const lat = parseFloat(String(location.lat));
            const lng = parseFloat(String(location.lon || location.lng));
            await deliveryService.checkGeofenceAndUpdateOrders(shipmentId, lat, lng);
          } catch {
            // Geofence check is non-critical
          }
        }
      }

      await prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: shipmentId ? 'success' : (deviceName ? 'not_found' : 'skipped'),
          deviceName: deviceName || null,
          deviceId: device?.id || null,
          eventType,
          hasLocation,
          lat: hasLocation ? parseFloat(String(location.lat)) : null,
          lng: hasLocation ? parseFloat(String(location.lon || location.lng)) : null,
          shipmentFound: !!shipmentId,
          shipmentUpdated: !!shipmentEventId,
          shipmentId,
          shipmentReference,
          shipmentEventId,
          processedAt: new Date(),
          responseCode: 200,
          responseBody: { processed: true, shipmentFound: !!shipmentId },
        }
      });
    } catch (err: any) {
      await prisma.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'error',
          errorMessage: err.message,
          processedAt: new Date(),
          responseCode: 500,
        }
      });
      throw err;
    }
  };
}
