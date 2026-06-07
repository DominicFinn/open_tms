import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AcceptQuotePayload {
  quoteId: string;
  createShipment?: boolean; // For broker orgs: also create a shipment that flows to the load board
}

export const ACCEPT_QUOTE = 'quote.accept';

export class AcceptQuoteCommandHandler extends BaseCommandHandler<AcceptQuotePayload, { id: string; orderId: string; shipmentId?: string | null }> {
  readonly commandType = ACCEPT_QUOTE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(command: Command<AcceptQuotePayload>, tx: TransactionClient, emit: EmitFn) {
    const quote = await tx.quote.findUnique({
      where: { id: command.payload.quoteId },
      include: { lineItems: true, customer: { select: { name: true } } },
    });

    if (!quote) throw new Error('Quote not found');
    if (quote.status !== 'draft' && quote.status !== 'sent') {
      throw new Error(`Cannot accept quote in status "${quote.status}"`);
    }
    if (new Date() > quote.validUntil) {
      throw new Error('Quote has expired');
    }

    // Create an order from the quote. Multi-tenancy: copy orgId from the
    // source quote so the new Order lands in the same tenant rather than
    // relying on `command.orgId` (admin tooling may dispatch on behalf of
    // a different actor).
    const orderNumber = `ORD-Q-${quote.quoteNumber.slice(4)}`;
    const order = await tx.order.create({
      data: {
        orgId: quote.orgId,
        orderNumber,
        customerId: quote.customerId,
        status: 'validated',
        deliveryStatus: 'unassigned',
        serviceLevel: quote.serviceLevel,
        originId: quote.originId,
        originValidated: !!quote.originId,
        destinationId: quote.destinationId,
        destinationValidated: !!quote.destinationId,
      },
    });

    // Create revenue charges on the order from quote line items
    for (const item of quote.lineItems) {
      await tx.charge.create({
        data: {
          orgId: command.orgId,
          orderId: order.id,
          chargeType: item.chargeType,
          chargeCategory: 'revenue',
          description: item.description,
          amountCents: item.amountCents * item.quantity,
          currency: item.currency,
          source: 'quote',
          sourceId: quote.id,
          accessorialCode: item.accessorialCode,
          freightClass: item.freightClass,
          ratePerCwt: item.ratePerCwt,
          status: 'approved', // Quote-accepted charges are pre-approved
          approvedBy: command.actorId,
          approvedAt: new Date(),
        },
      });
    }

    // For broker orgs: also create a shipment so it flows to the load board
    let shipmentId: string | null = null;
    let shipmentReference: string | null = null;

    const shouldCreateShipment = command.payload.createShipment ?? false;
    if (shouldCreateShipment) {
      // Check if org is broker/3pl, or just honor the flag
      const org = await tx.organization.findFirst({
        select: { organizationType: true },
      });
      const isBrokerOrg = org?.organizationType === 'broker' || org?.organizationType === '3pl';

      if (isBrokerOrg || command.payload.createShipment) {
        // Generate shipment reference
        const shipmentCount = await tx.shipment.count();
        shipmentReference = `SH-Q-${String(shipmentCount + 1).padStart(4, '0')}`;

        const shipment = await tx.shipment.create({
          data: {
            orgId: quote.orgId,
            reference: shipmentReference,
            customerId: quote.customerId,
            originId: quote.originId!,
            destinationId: quote.destinationId!,
            status: 'booked',
            items: [],
          },
        });
        shipmentId = shipment.id;

        // Link order to shipment
        await tx.orderShipment.create({
          data: { orderId: order.id, shipmentId: shipment.id },
        });

        // Create financial summary with the sell rate (revenue from quote)
        await tx.shipmentFinancialSummary.create({
          data: {
            orgId: command.orgId,
            shipmentId: shipment.id,
            expectedRevenueCents: quote.totalRevenueCents,
            expectedCostCents: quote.totalCostCents,
            expectedMarginCents: quote.marginCents,
            actualRevenueCents: quote.totalRevenueCents,
          },
        });

        // Copy revenue charges to shipment as well
        for (const item of quote.lineItems) {
          await tx.charge.create({
            data: {
              orgId: command.orgId,
              shipmentId: shipment.id,
              chargeType: item.chargeType,
              chargeCategory: 'revenue',
              description: item.description,
              amountCents: item.amountCents * item.quantity,
              currency: item.currency,
              source: 'quote',
              sourceId: quote.id,
              accessorialCode: item.accessorialCode,
              freightClass: item.freightClass,
              ratePerCwt: item.ratePerCwt,
              status: 'approved',
              approvedBy: command.actorId,
              approvedAt: new Date(),
            },
          });
        }

        emit(this.createEvent(command, {
          type: EVENT_TYPES.SHIPMENT_CREATED,
          entityType: 'shipment',
          entityId: shipment.id,
          payload: {
            shipmentReference,
            customerId: quote.customerId,
            originId: quote.originId,
            destinationId: quote.destinationId,
            status: 'booked',
          },
        }));
      }
    }

    // Update quote status
    await tx.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted', orderId: order.id },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.QUOTE_ACCEPTED,
      entityType: 'quote',
      entityId: quote.id,
      payload: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        orderId: order.id,
        orderNumber,
        shipmentId,
        shipmentReference,
        customerId: quote.customerId,
        totalRevenueCents: quote.totalRevenueCents,
      },
    }));

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_CREATED,
      entityType: 'order',
      entityId: order.id,
      payload: {
        orderReference: orderNumber,
        customerId: quote.customerId,
        status: 'validated',
      },
    }));

    return { id: quote.id, orderId: order.id, shipmentId };
  }
}
