import { PrismaClient } from '@prisma/client';
import { QueueMessage } from '../queue/IQueueAdapter.js';
import { ShipmentEvent } from '../queue/events.js';
import { GenericEdiCarrierAdapter } from '../integrations/GenericEdiCarrierAdapter.js';
import { GenericJsonCarrierAdapter } from '../integrations/GenericJsonCarrierAdapter.js';
import { ICarrierAdapter } from '../integrations/ICarrierAdapter.js';

const ediAdapter = new GenericEdiCarrierAdapter();
const jsonAdapter = new GenericJsonCarrierAdapter();

function selectAdapter(payloadFormat: string): ICarrierAdapter {
  return payloadFormat === 'json' ? jsonAdapter : ediAdapter;
}

export function createOutboundCarrierWorker(prisma: PrismaClient) {
  return async (message: QueueMessage<ShipmentEvent>) => {
    const { shipmentId, eventType } = message.payload;

    // Load shipment with all relations
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: true,
        origin: true,
        destination: true,
        carrier: true,
        orderShipments: {
          include: {
            order: {
              include: {
                trackableUnits: { include: { lineItems: true } },
                lineItems: true
              }
            }
          }
        }
      }
    });

    if (!shipment) {
      console.warn(`[CarrierWorker] Shipment ${shipmentId} not found, skipping`);
      return;
    }

    // Find active carrier integrations
    const integrations = await prisma.outboundIntegration.findMany({
      where: {
        active: true,
        integrationType: 'carrier',
      }
    });

    if (integrations.length === 0) return;

    // Filter by carrier match pattern if set
    const matchingIntegrations = integrations.filter((i: any) => {
      if (!i.carrierMatch || !shipment.carrier) return !i.carrierMatch; // no pattern = match all
      const pattern = i.carrierMatch.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(shipment.carrier.name);
    });

    for (const integration of matchingIntegrations) {
      const adapter = selectAdapter((integration as any).payloadFormat || 'edi_856');

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
        const result = await adapter.sendShipment(shipment as any, {
          id: integration.id,
          url: integration.url,
          authType: integration.authType,
          authHeader: integration.authHeader,
          authValue: integration.authValue,
          senderId: integration.senderId,
          receiverId: integration.receiverId,
          interchangeControlNumber: integration.interchangeControlNumber,
          payloadFormat: (integration as any).payloadFormat || 'edi_856',
        });

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
          const proValue = result.carrierReference || result.trackingNumber;
          if (proValue && !shipment.proNumber) {
            await prisma.shipment.update({
              where: { id: shipment.id },
              data: { proNumber: proValue },
            });
          }
          console.log(`[CarrierWorker] ${eventType} sent to ${integration.name} for ${shipment.reference}`);
        } else {
          console.warn(`[CarrierWorker] Failed: ${integration.name} — ${result.errorMessage}`);
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
        throw err; // Let pg-boss retry
      }
    }
  };
}
