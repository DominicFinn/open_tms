import { PrismaClient } from '@prisma/client';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { ShipmentEvent } from '../queue/events.js';
import { GenericWebhookTrackingAdapter } from '../integrations/GenericWebhookTrackingAdapter.js';

const webhookAdapter = new GenericWebhookTrackingAdapter();

export function createOutboundTrackingWorker(prisma: PrismaClient) {
  return async (message: QueueMessage<ShipmentEvent>) => {
    const { shipmentId, eventType } = message.payload;

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
      }
    });

    if (!shipment) {
      console.warn(`[TrackingWorker] Shipment ${shipmentId} not found, skipping`);
      return;
    }

    // Find active tracking integrations
    const integrations = await prisma.outboundIntegration.findMany({
      where: {
        active: true,
        integrationType: 'tracking',
      }
    });

    if (integrations.length === 0) return;

    for (const integration of integrations) {
      // Create pending log
      const log = await prisma.outboundIntegrationLog.create({
        data: {
          integrationId: integration.id,
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          url: integration.url,
          method: 'POST',
          status: 'pending',
        }
      });

      try {
        const result = await webhookAdapter.registerShipment(
          {
            shipmentId: shipment.id,
            shipmentReference: shipment.reference,
            origin: shipment.origin,
            destination: shipment.destination,
            carrier: shipment.carrier ? { name: shipment.carrier.name } : null,
            expectedPickup: shipment.pickupDate,
            expectedDelivery: shipment.deliveryDate,
            customerName: shipment.customer.name,
          },
          {
            id: integration.id,
            url: integration.url,
            authType: integration.authType,
            authHeader: integration.authHeader,
            authValue: integration.authValue,
          }
        );

        await prisma.outboundIntegrationLog.update({
          where: { id: log.id },
          data: {
            status: result.success ? 'success' : 'error',
            responseCode: result.responseCode,
            responseBody: result.rawResponse?.substring(0, 10000),
            errorMessage: result.errorMessage,
            respondedAt: new Date(),
          }
        });

        if (result.success) {
          console.log(`[TrackingWorker] ${eventType} registered with ${integration.name} for ${shipment.reference}`);
        }
      } catch (err: any) {
        await prisma.outboundIntegrationLog.update({
          where: { id: log.id },
          data: {
            status: 'error',
            errorMessage: err.message,
            respondedAt: new Date(),
          }
        });
        throw err;
      }
    }
  };
}
