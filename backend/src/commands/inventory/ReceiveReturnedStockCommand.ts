import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ReceiveReturnedStockPayload {
  binId: string;
  sku: string;
  quantity: number;
  rmaId: string;
  rmaLineId: string;
  handlingUnitId?: string | null;
}

export const RECEIVE_RETURNED_STOCK = 'inventory.receive_return';

/**
 * Puts returned goods back into stock at a bin (#359). Returns are TMS, so a completed RMA announces
 * each restock line and the warehouse dispatches this.
 *
 * Idempotency: the dispatcher passes an idempotency key per RMA line, so a redelivered event is a
 * no-op once this command's event is logged (see BaseCommandHandler).
 *
 * Concurrency: the record is found or created by (bin, sku, EA, no lot, no owner) and incremented
 * atomically, the same as putaway; a concurrent putaway of the same SKU into the same bin adds to
 * the same row.
 */
export class ReceiveReturnedStockCommandHandler extends BaseCommandHandler<ReceiveReturnedStockPayload, { inventoryRecordId: string }> {
  readonly commandType = RECEIVE_RETURNED_STOCK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ReceiveReturnedStockPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ inventoryRecordId: string }> {
    const p = command.payload;
    if (p.quantity <= 0) throw new Error('Returned quantity must be positive');

    const bin = await tx.warehouseBin.findFirst({
      where: { id: p.binId, orgId: command.orgId },
      select: { id: true, locationId: true, facilityId: true },
    });
    if (!bin) throw new Error(`Bin ${p.binId} not found`);

    const existing = await tx.inventoryRecord.findFirst({
      where: { orgId: command.orgId, binId: bin.id, sku: p.sku, uomCode: 'EA', lotNumber: null, ownerCustomerId: null },
    });

    const record = existing
      ? await tx.inventoryRecord.update({
          where: { id: existing.id, orgId: command.orgId },
          data: { quantityOnHand: { increment: p.quantity }, quantityAvailable: { increment: p.quantity } },
        })
      : await tx.inventoryRecord.create({
          data: {
            locationId: bin.locationId,
            facilityId: bin.facilityId,
            binId: bin.id,
            sku: p.sku,
            uomCode: 'EA',
            quantityOnHand: p.quantity,
            quantityAvailable: p.quantity,
            quantityAllocated: 0,
            quantityOnHold: 0,
            orgId: command.orgId,
          },
        });

    const previousQuantity = existing?.quantityOnHand ?? 0;
    await tx.inventoryTransaction.create({
      data: {
        inventoryRecordId: record.id,
        transactionType: 'receive',
        quantityChange: p.quantity,
        previousQuantity,
        newQuantity: previousQuantity + p.quantity,
        reasonCode: 'return',
        referenceType: 'rma',
        referenceId: p.rmaId,
        performedBy: command.actorId,
        handlingUnitId: p.handlingUnitId ?? null,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVENTORY_RETURN_RECEIVED,
      entityType: 'inventory_record',
      entityId: record.id,
      payload: { binId: bin.id, sku: p.sku, quantity: p.quantity, rmaId: p.rmaId, rmaLineId: p.rmaLineId },
    }));

    return { inventoryRecordId: record.id };
  }
}
