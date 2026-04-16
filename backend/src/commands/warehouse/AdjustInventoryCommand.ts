import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AdjustInventoryPayload {
  inventoryRecordId: string;
  quantityChange: number;       // positive = add, negative = remove
  reasonCode: string;           // damage, expired, recount, scrap, found, return
  notes?: string;
}

export const ADJUST_INVENTORY = 'inventory.adjust';

export class AdjustInventoryCommandHandler extends BaseCommandHandler<
  AdjustInventoryPayload,
  { inventoryRecordId: string; previousQuantity: number; newQuantity: number; reasonCode: string }
> {
  readonly commandType = ADJUST_INVENTORY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AdjustInventoryPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ inventoryRecordId: string; previousQuantity: number; newQuantity: number; reasonCode: string }> {
    const p = command.payload;

    const record = await tx.inventoryRecord.findUnique({ where: { id: p.inventoryRecordId } });
    if (!record) throw new Error(`Inventory record ${p.inventoryRecordId} not found`);

    if (p.quantityChange === 0) throw new Error('Quantity change cannot be zero');

    const previousQuantity = record.quantityOnHand;
    const newQuantity = previousQuantity + p.quantityChange;
    if (newQuantity < 0) throw new Error(`Adjustment would result in negative stock (${previousQuantity} + ${p.quantityChange} = ${newQuantity})`);

    // Update the inventory record
    await tx.inventoryRecord.update({
      where: { id: record.id },
      data: {
        quantityOnHand: newQuantity,
        quantityAvailable: newQuantity - record.quantityAllocated - record.quantityOnHold,
      },
    });

    // Create immutable transaction
    await tx.inventoryTransaction.create({
      data: {
        inventoryRecordId: record.id,
        transactionType: 'adjust',
        quantityChange: p.quantityChange,
        previousQuantity,
        newQuantity,
        reasonCode: p.reasonCode,
        referenceType: 'adjustment',
        referenceId: null,
        performedBy: command.actorId,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVENTORY_ADJUSTED,
      entityType: 'inventory_record',
      entityId: record.id,
      payload: {
        locationId: record.locationId,
        binId: record.binId,
        sku: record.sku,
        quantityChange: p.quantityChange,
        previousQuantity,
        newQuantity,
        reasonCode: p.reasonCode,
      },
    }));

    return {
      inventoryRecordId: record.id,
      previousQuantity,
      newQuantity,
      reasonCode: p.reasonCode,
    };
  }
}
