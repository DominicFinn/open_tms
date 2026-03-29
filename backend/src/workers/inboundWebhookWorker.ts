import { PrismaClient } from '@prisma/client';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { WebhookEvent } from '../queue/events.js';
import { IOrderDeliveryService } from '../services/OrderDeliveryService.js';

export function createInboundWebhookWorker(prisma: PrismaClient, deliveryService: IOrderDeliveryService) {
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
      // Extract event data from payload
      const event = rawPayload?.event || rawPayload;
      const device = event?.device || {};
      const deviceName = device?.name || device?.id || '';
      const eventType = event?.type || 'location';
      const location = event?.location?.global || event?.location || {};
      const hasLocation = !!(location?.lat && (location?.lon || location?.lng));

      // Try to find matching shipment by device name = shipment reference
      let shipmentId: string | null = null;
      let shipmentReference: string | null = null;
      let shipmentEventId: string | null = null;

      if (deviceName) {
        const shipment = await prisma.shipment.findFirst({
          where: { reference: deviceName, archived: false }
        });

        if (shipment) {
          shipmentId = shipment.id;
          shipmentReference = shipment.reference;

          // Create shipment event if we have location data
          if (hasLocation) {
            const shipmentEvent = await prisma.shipmentEvent.create({
              data: {
                shipmentId: shipment.id,
                eventType,
                deviceId: device?.id,
                deviceName: deviceName,
                lat: location.lat ? parseFloat(String(location.lat)) : null,
                lng: (location.lon || location.lng) ? parseFloat(String(location.lon || location.lng)) : null,
                address: location.address,
                locationSummary: location.summary || location.address,
                rawPayload: rawPayload,
                eventTime: event?.startTime ? new Date(event.startTime) : new Date(),
              }
            });

            shipmentEventId = shipmentEvent.id;

            // Trigger geofence check
            try {
              const lat = parseFloat(String(location.lat));
              const lng = parseFloat(String(location.lon || location.lng));
              await deliveryService.checkGeofenceAndUpdateOrders(shipment.id, lat, lng);
            } catch {
              // Geofence check is non-critical
            }
          }
        }
      }

      // Update webhook log with processing result
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
