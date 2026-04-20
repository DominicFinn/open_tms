/**
 * Edi945AutoSendHandler
 *
 * Listens for shipment.delivered events. When a shipment is delivered, checks
 * whether any customer trading partner has outbound 945 enabled. If so, builds
 * the Warehouse Shipping Advice and delivers it via the configured SFTP/HTTP
 * channel.
 *
 * Pairs with the inbound 940 handler - when a depositor sends a 940 to ship
 * from our warehouse, we return a 945 once it actually ships.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES, ShipmentDeliveredPayload } from '../eventTypes.js';
import { IEDI945Service } from '../../services/EDI945Service.js';
import { OutboundEdiDeliveryService } from '../../services/OutboundEdiDeliveryService.js';
import { buildEDI945DataFromShipment } from '../../routes/edi940.js';

export class Edi945AutoSendHandler implements IEventHandler {
  readonly name = 'handler.edi945_auto_send';
  readonly eventPatterns = [EVENT_TYPES.SHIPMENT_DELIVERED];
  readonly options = { concurrency: 2 };

  constructor(
    private prisma: PrismaClient,
    private edi945Service: IEDI945Service,
    private deliveryService: OutboundEdiDeliveryService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (event.type !== EVENT_TYPES.SHIPMENT_DELIVERED) return;
      const payload = event.payload as ShipmentDeliveredPayload;

      const shipment = await this.prisma.shipment.findFirst({
        where: { reference: payload.shipmentReference },
        include: {
          origin: true,
          destination: true,
          carrier: true,
          customer: true,
          orderShipments: {
            include: {
              order: {
                include: {
                  lineItems: true,
                  trackableUnits: true,
                },
              },
            },
          },
        },
      });
      if (!shipment) return;

      const customerId = shipment.customerId;
      if (!customerId) return;

      const partners = await this.prisma.tradingPartner.findMany({
        where: {
          active: true,
          outboundEnabled: true,
          customerId,
          transactions: {
            some: { transactionType: '945', direction: 'outbound', enabled: true },
          },
        },
      });
      if (partners.length === 0) return;

      for (const partner of partners) {
        try {
          const data = buildEDI945DataFromShipment(shipment);
          const generated = this.edi945Service.validateAndGenerate(data, {
            senderId: partner.senderId || 'OPENTMS',
            receiverId: partner.receiverId || undefined,
          });
          if (!generated.success || !generated.data) {
            console.error(
              `[Edi945AutoSendHandler] Validation failed for ${partner.name}: ${generated.errors.join('; ')}`,
            );
            continue;
          }
          await this.deliveryService.deliver({
            partnerId: partner.id,
            transactionType: '945',
            ediContent: generated.data,
            referenceId: shipment.reference,
            shipmentId: shipment.id,
          });
          console.log(`[Edi945AutoSendHandler] Sent 945 for ${shipment.reference} to ${partner.name}`);
        } catch (err) {
          console.error(
            `[Edi945AutoSendHandler] Failed to send 945 to ${partner.name}:`,
            (err as Error).message,
          );
        }
      }
    } catch (err) {
      console.error(`[Edi945AutoSendHandler] Error:`, (err as Error).message);
    }
  }
}
