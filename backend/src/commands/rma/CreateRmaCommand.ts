import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateRmaPayload {
  customerId: string;
  orderId: string;
  returnReason: string;
  customerNotes?: string;
  initiatedVia?: string;                 // admin, customer_portal, marketplace_webhook
  /** Lines to return, with quantities and optional suggested disposition */
  lines: Array<{
    orderLineItemId: string;
    sku: string;
    requestedQuantity: number;
    requestedDisposition?: string;
    unitPriceCents?: number;             // if not provided, looked up from order line
  }>;
  /** If true, immediately move to authorized (CSR-initiated) */
  autoAuthorize?: boolean;
}

export const CREATE_RMA = 'rma.create';

export class CreateRmaCommandHandler extends BaseCommandHandler<
  CreateRmaPayload,
  { id: string; rmaNumber: string; status: string; suggestedRefundCents: number; lineCount: number }
> {
  readonly commandType = CREATE_RMA;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateRmaPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; rmaNumber: string; status: string; suggestedRefundCents: number; lineCount: number }> {
    const p = command.payload;

    if (p.lines.length === 0) throw new Error('RMA must contain at least one line');

    // Verify order belongs to this customer
    const order = await tx.order.findUnique({
      where: { id: p.orderId },
      include: { lineItems: true },
    });
    if (!order) throw new Error(`Order ${p.orderId} not found`);
    if (order.customerId !== p.customerId) throw new Error('Order does not belong to this customer');

    // Validate each requested line
    for (const line of p.lines) {
      const orderLine = order.lineItems.find(ol => ol.id === line.orderLineItemId);
      if (!orderLine) throw new Error(`Order line ${line.orderLineItemId} not found on this order`);
      if (line.requestedQuantity <= 0) throw new Error(`Quantity must be positive for ${line.sku}`);
      if (line.requestedQuantity > orderLine.quantity) {
        throw new Error(`Cannot return ${line.requestedQuantity} of ${line.sku} - order only has ${orderLine.quantity}`);
      }
    }

    // Calculate suggested refund: sum of (unitPrice * requestedQty) per line
    let suggestedRefundCents = 0;
    const lineRefunds = p.lines.map(line => {
      const orderLine = order.lineItems.find(ol => ol.id === line.orderLineItemId)!;
      const unitPrice = line.unitPriceCents ?? orderLine.unitPriceCents ?? 0;
      const refund = unitPrice * line.requestedQuantity;
      suggestedRefundCents += refund;
      return { ...line, refundAmountCents: refund };
    });

    // Generate RMA number
    const today = new Date().toISOString().slice(0, 10);
    const existing = await tx.rma.count({
      where: { orgId: command.orgId, rmaNumber: { startsWith: `RMA-${today}` } },
    });
    const rmaNumber = `RMA-${today}-${String(existing + 1).padStart(3, '0')}`;

    // Create RMA with or without auto-authorize
    const shouldAutoAuthorize = p.autoAuthorize ?? false;
    const now = new Date();

    const rma = await tx.rma.create({
      data: {
        rmaNumber,
        customerId: p.customerId,
        orderId: p.orderId,
        status: shouldAutoAuthorize ? 'authorized' : 'requested',
        returnReason: p.returnReason,
        customerNotes: p.customerNotes ?? null,
        requestedAt: now,
        authorizedAt: shouldAutoAuthorize ? now : null,
        suggestedRefundCents,
        createdByUserId: command.actorId,
        initiatedVia: p.initiatedVia ?? 'admin',
        orgId: command.orgId,
      },
    });

    // Create lines
    await tx.rmaLine.createMany({
      data: lineRefunds.map(line => ({
        rmaId: rma.id,
        orderLineItemId: line.orderLineItemId,
        sku: line.sku,
        requestedQuantity: line.requestedQuantity,
        receivedQuantity: 0,
        requestedDisposition: line.requestedDisposition ?? null,
        disposition: 'pending',
        inspectionStatus: 'pending',
        refundAmountCents: line.refundAmountCents,
      })),
    });

    // Emit events
    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_REQUESTED,
      entityType: 'rma',
      entityId: rma.id,
      payload: {
        rmaNumber,
        customerId: p.customerId,
        orderId: p.orderId,
        returnReason: p.returnReason,
        lineCount: p.lines.length,
        suggestedRefundCents,
        initiatedVia: p.initiatedVia ?? 'admin',
      },
    }));

    if (shouldAutoAuthorize) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.RMA_AUTHORIZED,
        entityType: 'rma',
        entityId: rma.id,
        payload: { rmaNumber, customerId: p.customerId },
      }));
    }

    return {
      id: rma.id,
      rmaNumber,
      status: rma.status,
      suggestedRefundCents,
      lineCount: p.lines.length,
    };
  }
}
