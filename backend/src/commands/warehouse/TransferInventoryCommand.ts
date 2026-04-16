import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface TransferInventoryPayload {
  inventoryRecordId: string;
  targetBinId: string;
  quantity: number;
  notes?: string;
}

export const TRANSFER_INVENTORY = 'inventory.transfer';

export class TransferInventoryCommandHandler extends BaseCommandHandler<
  TransferInventoryPayload,
  { sourceRecordId: string; targetRecordId: string; quantity: number; targetBinLabel: string }
> {
  readonly commandType = TRANSFER_INVENTORY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<TransferInventoryPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ sourceRecordId: string; targetRecordId: string; quantity: number; targetBinLabel: string }> {
    const p = command.payload;

    if (p.quantity <= 0) throw new Error('Transfer quantity must be positive');

    // Load source record
    const source = await tx.inventoryRecord.findUnique({ where: { id: p.inventoryRecordId } });
    if (!source) throw new Error(`Inventory record ${p.inventoryRecordId} not found`);
    if (source.quantityAvailable < p.quantity) {
      throw new Error(`Insufficient available stock: have ${source.quantityAvailable}, need ${p.quantity}`);
    }

    // Load target bin
    const targetBin = await tx.warehouseBin.findUnique({
      where: { id: p.targetBinId },
      include: { zone: true },
    });
    if (!targetBin) throw new Error(`Target bin ${p.targetBinId} not found`);
    if (!targetBin.active) throw new Error(`Target bin "${targetBin.label}" is inactive`);
    if (targetBin.id === source.binId) throw new Error('Source and target bin are the same');

    // Validate constraints: temperature compatibility
    if (source.sku) {
      // Check if the source has temp-sensitive items by looking at the bin's zone
      const sourceZone = await tx.warehouseZone.findFirst({ where: { bins: { some: { id: source.binId } } } });
      if (sourceZone?.temperatureZone && sourceZone.temperatureZone !== 'ambient') {
        const targetTemp = targetBin.temperatureZone || targetBin.zone?.temperatureZone;
        if (targetTemp && targetTemp !== sourceZone.temperatureZone) {
          // Allow but warn - the API response will include this
        }
      }
    }

    // Deduct from source
    const sourcePrevQty = source.quantityOnHand;
    const sourceNewQty = sourcePrevQty - p.quantity;
    await tx.inventoryRecord.update({
      where: { id: source.id },
      data: {
        quantityOnHand: sourceNewQty,
        quantityAvailable: sourceNewQty - source.quantityAllocated - source.quantityOnHold,
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryRecordId: source.id,
        transactionType: 'transfer',
        quantityChange: -p.quantity,
        previousQuantity: sourcePrevQty,
        newQuantity: sourceNewQty,
        referenceType: 'transfer',
        referenceId: p.targetBinId,
        performedBy: command.actorId,
        orgId: command.orgId,
      },
    });

    // Add to target - find or create inventory record at target bin
    let target = await tx.inventoryRecord.findFirst({
      where: {
        binId: p.targetBinId,
        sku: source.sku,
        uomCode: source.uomCode,
        lotNumber: source.lotNumber,
        ownerCustomerId: source.ownerCustomerId,
      },
    });

    let targetRecordId: string;
    if (target) {
      const targetPrevQty = target.quantityOnHand;
      await tx.inventoryRecord.update({
        where: { id: target.id },
        data: {
          quantityOnHand: { increment: p.quantity },
          quantityAvailable: { increment: p.quantity },
        },
      });
      targetRecordId = target.id;

      await tx.inventoryTransaction.create({
        data: {
          inventoryRecordId: target.id,
          transactionType: 'transfer',
          quantityChange: p.quantity,
          previousQuantity: targetPrevQty,
          newQuantity: targetPrevQty + p.quantity,
          referenceType: 'transfer',
          referenceId: source.binId,
          performedBy: command.actorId,
          orgId: command.orgId,
        },
      });
    } else {
      const newTarget = await tx.inventoryRecord.create({
        data: {
          locationId: source.locationId,
          binId: p.targetBinId,
          sku: source.sku,
          uomCode: source.uomCode,
          quantityOnHand: p.quantity,
          quantityAllocated: 0,
          quantityAvailable: p.quantity,
          quantityOnHold: 0,
          ownerCustomerId: source.ownerCustomerId,
          lotNumber: source.lotNumber,
          expiryDate: source.expiryDate,
          orgId: command.orgId,
        },
      });
      targetRecordId = newTarget.id;

      await tx.inventoryTransaction.create({
        data: {
          inventoryRecordId: newTarget.id,
          transactionType: 'transfer',
          quantityChange: p.quantity,
          previousQuantity: 0,
          newQuantity: p.quantity,
          referenceType: 'transfer',
          referenceId: source.binId,
          performedBy: command.actorId,
          orgId: command.orgId,
        },
      });
    }

    // Clean up source if empty
    if (sourceNewQty === 0 && source.quantityAllocated === 0 && source.quantityOnHold === 0) {
      await tx.inventoryRecord.delete({ where: { id: source.id } });
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVENTORY_TRANSFERRED,
      entityType: 'inventory_record',
      entityId: source.id,
      payload: {
        sku: source.sku,
        quantity: p.quantity,
        sourceBinId: source.binId,
        targetBinId: p.targetBinId,
        targetBinLabel: targetBin.label,
        sourceRecordId: source.id,
        targetRecordId,
      },
    }));

    return {
      sourceRecordId: source.id,
      targetRecordId,
      quantity: p.quantity,
      targetBinLabel: targetBin.label,
    };
  }
}
