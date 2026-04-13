/**
 * Edi856AutoSendHandler
 *
 * Listens for shipment.delivered events. When a shipment is delivered,
 * auto-generates an EDI 856 (Advance Ship Notice) and delivers it to
 * any customer trading partner that has outbound 856 enabled.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES, ShipmentDeliveredPayload } from '../eventTypes.js';
import { EDI856Service } from '../../services/EDI856Service.js';
import { OutboundEdiDeliveryService } from '../../services/OutboundEdiDeliveryService.js';

export class Edi856AutoSendHandler implements IEventHandler {
  readonly name = 'handler.edi856_auto_send';
  readonly eventPatterns = [EVENT_TYPES.SHIPMENT_DELIVERED];
  readonly options = { concurrency: 2 };

  constructor(
    private prisma: PrismaClient,
    private edi856Service: EDI856Service,
    private deliveryService: OutboundEdiDeliveryService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (event.type !== EVENT_TYPES.SHIPMENT_DELIVERED) return;

      const payload = event.payload as ShipmentDeliveredPayload;
      const shipmentReference = payload.shipmentReference;

      // Load full shipment with related data for 856 generation
      const shipment = await this.prisma.shipment.findFirst({
        where: { reference: shipmentReference },
        include: {
          origin: true,
          destination: true,
          carrier: true,
          orders: {
            include: {
              customer: true,
              trackableUnits: { include: { lineItems: true } },
            },
          },
          stops: { include: { location: true } },
        },
      });

      if (!shipment) return;

      // Get customer ID from orders
      const customerId = shipment.orders?.[0]?.customerId;
      if (!customerId) return;

      // Find customer trading partners with outbound 856 enabled
      const partners = await this.prisma.tradingPartner.findMany({
        where: {
          active: true,
          outboundEnabled: true,
          customerId,
          transactions: {
            some: {
              transactionType: '856',
              direction: 'outbound',
              enabled: true,
            },
          },
        },
      });

      if (partners.length === 0) return;

      for (const partner of partners) {
        try {
          const ediContent = this.edi856Service.generateEDI856(shipment as any, {
            senderId: partner.senderId || 'OPENTMS',
            receiverId: partner.receiverId || undefined,
          });

          await this.deliveryService.deliver({
            partnerId: partner.id,
            transactionType: '856',
            ediContent,
            referenceId: shipmentReference,
            shipmentId: shipment.id,
          });

          console.log(`[Edi856AutoSendHandler] Sent 856 for ${shipmentReference} to partner ${partner.name}`);
        } catch (err) {
          console.error(`[Edi856AutoSendHandler] Failed to send 856 to partner ${partner.name}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.error(`[Edi856AutoSendHandler] Error:`, (err as Error).message);
    }
  }
}
