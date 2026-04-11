/**
 * Edi214ForwardHandler
 *
 * Listens for edi_214.received events (inbound carrier status updates).
 * When a carrier sends a 214, this handler auto-forwards an outbound 214
 * to any customer trading partner that has outbound 214 enabled.
 *
 * This gives customers automatic visibility into their shipment status
 * without requiring manual intervention.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES, Edi214ReceivedPayload } from '../eventTypes.js';
import { EDI214Service, EDI214ShipmentData } from '../../services/EDI214Service.js';
import { OutboundEdiDeliveryService } from '../../services/OutboundEdiDeliveryService.js';

export class Edi214ForwardHandler implements IEventHandler {
  readonly name = 'handler.edi214_forward';
  readonly eventPatterns = [EVENT_TYPES.EDI_214_RECEIVED];
  readonly options = { concurrency: 2 };

  constructor(
    private prisma: PrismaClient,
    private edi214Service: EDI214Service,
    private deliveryService: OutboundEdiDeliveryService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (event.type !== EVENT_TYPES.EDI_214_RECEIVED) return;

      const payload = event.payload as Edi214ReceivedPayload;
      const { shipmentId, shipmentReference, carrierScac, statusCode, city, state } = payload;

      // Load shipment to get customer ID
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: shipmentId },
        select: { customerId: true, proNumber: true },
      });

      if (!shipment?.customerId) return;

      // Find customer trading partners with outbound 214 enabled
      const partners = await this.prisma.tradingPartner.findMany({
        where: {
          active: true,
          outboundEnabled: true,
          customerId: shipment.customerId,
          transactions: {
            some: {
              transactionType: '214',
              direction: 'outbound',
              enabled: true,
            },
          },
        },
      });

      if (partners.length === 0) return;

      // Generate 214 for each customer partner
      for (const partner of partners) {
        try {
          const ediData: EDI214ShipmentData = {
            shipmentReference,
            proNumber: shipment.proNumber || undefined,
            carrierScac,
            statusCode,
            city: city || '',
            state: state || '',
            statusDate: new Date(),
          };

          const ediContent = this.edi214Service.generateEDI214(ediData, {
            senderId: partner.senderId || 'OPENTMS',
            receiverId: partner.receiverId || undefined,
          });

          await this.deliveryService.deliver({
            partnerId: partner.id,
            transactionType: '214',
            ediContent,
            referenceId: shipmentReference,
            shipmentId,
          });

          console.log(`[Edi214ForwardHandler] Forwarded 214 (${statusCode}) for ${shipmentReference} to partner ${partner.name}`);
        } catch (err) {
          console.error(`[Edi214ForwardHandler] Failed to forward 214 to partner ${partner.name}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.error(`[Edi214ForwardHandler] Error processing ${event.type}:`, err);
    }
  }
}
