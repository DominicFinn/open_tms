import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

/**
 * Completes an RMA after all lines are dispositioned.
 * Announces each restock line for the warehouse to put back into stock, and triggers credit note
 * creation.
 */
export interface CompleteRmaPayload {
  rmaId: string;
  /** If different from suggested, finance can override here */
  actualRefundCents?: number;
  refundAdjustmentNotes?: string;
}

export const COMPLETE_RMA = 'rma.complete';

export class CompleteRmaCommandHandler extends BaseCommandHandler<
  CompleteRmaPayload,
  { id: string; status: string; actualRefundCents: number; restockTasksCreated: number }
> {
  readonly commandType = COMPLETE_RMA;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompleteRmaPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; actualRefundCents: number; restockTasksCreated: number }> {
    const p = command.payload;

    const rma = await tx.rma.findUnique({
      where: { id: p.rmaId, orgId: command.orgId },
      include: { lines: true },
    });
    if (!rma) throw new Error(`RMA ${p.rmaId} not found`);
    if (rma.status === 'completed') throw new Error('RMA is already completed');
    if (rma.status === 'rejected') throw new Error('Cannot complete a rejected RMA');

    const pendingLines = rma.lines.filter(l => l.disposition === 'pending');
    if (pendingLines.length > 0) {
      throw new Error(`Cannot complete RMA - ${pendingLines.length} line(s) still have pending disposition`);
    }

    // Auto-calculate actual refund if not provided
    const actualRefundCents = p.actualRefundCents ?? rma.suggestedRefundCents;

    // Restocking is the warehouse's job: it owns the stock and the bin. Each restock line is
    // announced, and the warehouse puts it back into stock, once per line (#359).
    let restockTasksCreated = 0;
    for (const line of rma.lines) {
      if (line.disposition === 'restock' && line.receivedQuantity > 0 && line.currentBinId) {
        emit(this.createEvent(command, {
          type: EVENT_TYPES.RMA_RESTOCK_REQUESTED,
          entityType: 'rma_line',
          entityId: line.id,
          payload: {
            rmaId: rma.id,
            rmaLineId: line.id,
            sku: line.sku,
            quantity: line.receivedQuantity,
            binId: line.currentBinId,
            unitId: line.trackableUnitId ?? null,
          },
        }));
        restockTasksCreated++;
      }
    }

    // Complete the RMA
    const refundAdjusted = p.actualRefundCents !== undefined && p.actualRefundCents !== rma.suggestedRefundCents;
    await tx.rma.update({
      where: { id: rma.id, orgId: command.orgId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        actualRefundCents,
        refundAdjustmentNotes: p.refundAdjustmentNotes ?? null,
      },
    });

    if (refundAdjusted) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.RMA_REFUND_ADJUSTED,
        entityType: 'rma',
        entityId: rma.id,
        payload: {
          rmaNumber: rma.rmaNumber,
          suggestedRefundCents: rma.suggestedRefundCents,
          actualRefundCents,
          notes: p.refundAdjustmentNotes,
        },
      }));
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_COMPLETED,
      entityType: 'rma',
      entityId: rma.id,
      payload: {
        rmaNumber: rma.rmaNumber,
        customerId: rma.customerId,
        orderId: rma.orderId,
        actualRefundCents,
        suggestedRefundCents: rma.suggestedRefundCents,
        restockTasksCreated,
        dispositions: rma.lines.map(l => ({ sku: l.sku, disposition: l.disposition, qty: l.receivedQuantity })),
      },
    }));

    return {
      id: rma.id,
      status: 'completed',
      actualRefundCents,
      restockTasksCreated,
    };
  }
}
