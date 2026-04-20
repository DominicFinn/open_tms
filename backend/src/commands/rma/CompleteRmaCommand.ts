import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

/**
 * Completes an RMA after all lines are dispositioned.
 * Generates inventory movements for restock items and triggers credit note creation.
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
      where: { id: p.rmaId },
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

    // Create inventory movements for restock lines
    let restockTasksCreated = 0;
    for (const line of rma.lines) {
      if (line.disposition === 'restock' && line.receivedQuantity > 0 && line.currentBinId) {
        // Create an inventory record / transaction for the restocked items
        const existingRecord = await tx.inventoryRecord.findFirst({
          where: {
            binId: line.currentBinId,
            sku: line.sku,
            uomCode: 'EA',
            lotNumber: null,
            ownerCustomerId: null,
          },
        });

        const bin = await tx.warehouseBin.findUnique({
          where: { id: line.currentBinId },
          select: { locationId: true },
        });

        if (bin && existingRecord) {
          await tx.inventoryRecord.update({
            where: { id: existingRecord.id },
            data: {
              quantityOnHand: { increment: line.receivedQuantity },
              quantityAvailable: { increment: line.receivedQuantity },
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryRecordId: existingRecord.id,
              transactionType: 'receive',
              quantityChange: line.receivedQuantity,
              previousQuantity: existingRecord.quantityOnHand,
              newQuantity: existingRecord.quantityOnHand + line.receivedQuantity,
              reasonCode: 'return',
              referenceType: 'rma',
              referenceId: rma.id,
              performedBy: command.actorId,
              trackableUnitId: line.trackableUnitId,
              orgId: command.orgId,
            },
          });
        } else if (bin) {
          const newRecord = await tx.inventoryRecord.create({
            data: {
              locationId: bin.locationId,
              binId: line.currentBinId,
              sku: line.sku,
              uomCode: 'EA',
              quantityOnHand: line.receivedQuantity,
              quantityAvailable: line.receivedQuantity,
              quantityAllocated: 0,
              quantityOnHold: 0,
              orgId: command.orgId,
            },
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryRecordId: newRecord.id,
              transactionType: 'receive',
              quantityChange: line.receivedQuantity,
              previousQuantity: 0,
              newQuantity: line.receivedQuantity,
              reasonCode: 'return',
              referenceType: 'rma',
              referenceId: rma.id,
              performedBy: command.actorId,
              trackableUnitId: line.trackableUnitId,
              orgId: command.orgId,
            },
          });
        }

        restockTasksCreated++;
      }
    }

    // Complete the RMA
    const refundAdjusted = p.actualRefundCents !== undefined && p.actualRefundCents !== rma.suggestedRefundCents;
    await tx.rma.update({
      where: { id: rma.id },
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
