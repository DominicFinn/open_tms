/**
 * Edi810AutoSendHandler
 *
 * Listens for invoice.sent events. When an invoice is sent to a customer,
 * auto-generates an EDI 810 (Invoice) and delivers it to any customer
 * trading partner that has outbound 810 enabled.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { EDI810Service, EDI810InvoiceData } from '../../services/EDI810Service.js';
import { OutboundEdiDeliveryService } from '../../services/OutboundEdiDeliveryService.js';

interface InvoiceSentPayload {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  totalCents: number;
  currency: string;
  dueDate: string;
}

export class Edi810AutoSendHandler implements IEventHandler {
  readonly name = 'handler.edi810_auto_send';
  readonly eventPatterns = [EVENT_TYPES.INVOICE_SENT];
  readonly options = { concurrency: 2 };

  constructor(
    private prisma: PrismaClient,
    private edi810Service: EDI810Service,
    private deliveryService: OutboundEdiDeliveryService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      if (event.type !== EVENT_TYPES.INVOICE_SENT) return;

      const payload = event.payload as InvoiceSentPayload;
      const { invoiceId, customerId } = payload;

      // Find customer trading partners with outbound 810 enabled
      const partners = await this.prisma.tradingPartner.findMany({
        where: {
          active: true,
          outboundEnabled: true,
          customerId,
          transactions: {
            some: {
              transactionType: '810',
              direction: 'outbound',
              enabled: true,
            },
          },
        },
      });

      if (partners.length === 0) return;

      // Load full invoice data
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: true,
          lineItems: true,
        },
      });

      if (!invoice) return;

      // Get shipment references
      const shipmentIds = [...new Set(invoice.lineItems.map(li => li.shipmentId).filter(Boolean) as string[])];
      const shipments = shipmentIds.length > 0
        ? await this.prisma.shipment.findMany({
            where: { id: { in: shipmentIds } },
            select: { id: true, reference: true, carrier: { select: { name: true, scacCode: true } } },
          })
        : [];
      const shipmentRefMap = new Map(shipments.map(s => [s.id, s.reference]));
      const carrier = shipments.find(s => s.carrier)?.carrier;

      const edi810Data: EDI810InvoiceData = {
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        paymentTermsDays: invoice.paymentTermsDays,
        currency: invoice.currency,
        seller: { name: 'Open TMS' },
        buyer: { name: invoice.customer.name, id: invoice.customer.id },
        lineItems: invoice.lineItems.map((li, idx) => ({
          lineNumber: idx + 1,
          description: li.description,
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          totalCents: li.totalCents,
          chargeType: li.chargeType,
          shipmentReference: li.shipmentId ? shipmentRefMap.get(li.shipmentId) : undefined,
          freightClass: li.freightClass ?? undefined,
        })),
        subtotalCents: invoice.subtotalCents,
        taxCents: invoice.taxCents,
        totalCents: invoice.totalCents,
        carrier: carrier ? { name: carrier.name, scacCode: carrier.scacCode ?? undefined } : undefined,
        shipmentReferences: shipments.map(s => s.reference),
      };

      for (const partner of partners) {
        try {
          const ediContent = this.edi810Service.generateEDI810(edi810Data, {
            senderId: partner.senderId || 'OPENTMS',
            receiverId: partner.receiverId || undefined,
          });

          await this.deliveryService.deliver({
            partnerId: partner.id,
            transactionType: '810',
            ediContent,
            referenceId: invoice.invoiceNumber,
          });

          console.log(`[Edi810AutoSendHandler] Sent 810 for ${invoice.invoiceNumber} to partner ${partner.name}`);
        } catch (err) {
          console.error(`[Edi810AutoSendHandler] Failed to send 810 to partner ${partner.name}:`, (err as Error).message);
        }
      }
    } catch (err) {
      console.error(`[Edi810AutoSendHandler] Error:`, (err as Error).message);
    }
  }
}
