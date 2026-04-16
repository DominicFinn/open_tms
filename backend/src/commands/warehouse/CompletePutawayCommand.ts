import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompletePutawayPayload {
  taskId: string;
  /** The bin label the worker actually scanned (for deviation detection) */
  scannedBinLabel: string;
}

export interface CompletePutawayResult {
  id: string;
  status: string;
  actualBinId: string;
  actualBinLabel: string;
  deviation: boolean;
  deviationReason: string | null;
  inventoryRecordId: string;
  constraintWarnings: string[];
}

export const COMPLETE_PUTAWAY = 'putaway_task.complete';

export class CompletePutawayCommandHandler extends BaseCommandHandler<
  CompletePutawayPayload,
  CompletePutawayResult
> {
  readonly commandType = COMPLETE_PUTAWAY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompletePutawayPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CompletePutawayResult> {
    const p = command.payload;

    // 1. Load task with relations
    const task = await tx.putawayTask.findUnique({
      where: { id: p.taskId },
      include: {
        targetBin: { include: { zone: true } },
      },
    });
    if (!task) throw new Error(`Putaway task ${p.taskId} not found`);
    if (task.status === 'completed') throw new Error('Task is already completed');
    if (task.status === 'cancelled') throw new Error('Task is cancelled');

    // 2. Resolve the scanned bin
    const scannedBin = await tx.warehouseBin.findFirst({
      where: { locationId: task.locationId, label: p.scannedBinLabel },
      include: { zone: true },
    });
    if (!scannedBin) {
      throw new Error(`Bin label "${p.scannedBinLabel}" not found at this location`);
    }
    if (!scannedBin.active) {
      throw new Error(`Bin "${p.scannedBinLabel}" is inactive`);
    }

    // 3. Detect deviation (scanned bin != directed target bin)
    const deviation = scannedBin.id !== task.targetBinId;
    let deviationReason: string | null = null;
    if (deviation) {
      deviationReason = `Directed to ${(task as any).targetBin?.label ?? task.targetBinId}, scanned at ${p.scannedBinLabel}`;
    }

    // 4. Validate bin constraints against the unit being stored
    const unit = await tx.trackableUnit.findUnique({
      where: { id: task.trackableUnitId },
      include: {
        lineItems: true,
        order: true,
      },
    });
    if (!unit) throw new Error(`TrackableUnit ${task.trackableUnitId} not found`);

    const constraintWarnings: string[] = [];
    const actualBin = scannedBin;
    const actualZone = scannedBin.zone;

    // Temperature check: if unit has temperature-sensitive items, bin/zone must match
    const unitTemp = unit.lineItems?.find(li => li.temperature)?.temperature;
    if (unitTemp && unitTemp !== 'ambient') {
      const binTemp = actualBin.temperatureZone || actualZone?.temperatureZone;
      if (binTemp && binTemp !== unitTemp) {
        constraintWarnings.push(`Temperature mismatch: unit requires ${unitTemp}, bin is ${binTemp}`);
      }
      if (!binTemp) {
        constraintWarnings.push(`Unit requires ${unitTemp} storage but bin has no temperature zone set`);
      }
    }

    // Hazmat check: if unit has hazmat items, bin/zone must be certified
    const hasHazmat = unit.lineItems?.some(li => li.hazmat);
    if (hasHazmat) {
      const binHazmat = actualBin.hazmatCertified || actualZone?.hazmatCertified;
      if (!binHazmat) {
        constraintWarnings.push('Hazmat item placed in non-hazmat-certified bin');
      }
    }

    // 5. Use the actual scanned bin as the destination
    const actualBinId = actualBin.id;

    // 6. Update TrackableUnit location
    await tx.trackableUnit.update({
      where: { id: unit.id },
      data: {
        currentBinId: actualBinId,
        currentZoneId: actualZone?.id ?? null,
      },
    });

    // Also update any nested child units
    await tx.trackableUnit.updateMany({
      where: { parentUnitId: unit.id },
      data: {
        currentBinId: actualBinId,
        currentZoneId: actualZone?.id ?? null,
      },
    });

    // 7. Update bin capacity counters
    if (unit.unitType === 'pallet') {
      await tx.warehouseBin.update({
        where: { id: actualBinId },
        data: { currentPalletCount: { increment: 1 } },
      });
    }
    // Weight update if available
    const totalWeight = unit.lineItems?.reduce((sum, li) => sum + (li.weight ?? 0), 0) ?? 0;
    if (totalWeight > 0) {
      await tx.warehouseBin.update({
        where: { id: actualBinId },
        data: { currentWeightKg: { increment: totalWeight } },
      });
    }

    // 8. Create or update InventoryRecord + InventoryTransaction
    const sku = unit.lineItems?.[0]?.sku ?? unit.identifier;
    const quantity = unit.lineItems?.reduce((sum, li) => sum + li.quantity, 0) ?? 1;

    // Find or create inventory record for this bin+sku combination
    let inventoryRecord = await tx.inventoryRecord.findFirst({
      where: {
        binId: actualBinId,
        sku,
        uomCode: 'EA',
        lotNumber: unit.lotNumber ?? null,
        ownerCustomerId: unit.ownerCustomerId ?? null,
      },
    });

    if (inventoryRecord) {
      // Update existing record
      const previousQty = inventoryRecord.quantityOnHand;
      inventoryRecord = await tx.inventoryRecord.update({
        where: { id: inventoryRecord.id },
        data: {
          quantityOnHand: { increment: quantity },
          quantityAvailable: { increment: quantity },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryRecordId: inventoryRecord.id,
          transactionType: 'putaway',
          quantityChange: quantity,
          previousQuantity: previousQty,
          newQuantity: previousQty + quantity,
          referenceType: 'putaway_task',
          referenceId: task.id,
          performedBy: command.actorId,
          trackableUnitId: unit.id,
          orgId: command.orgId,
        },
      });
    } else {
      // Create new record
      inventoryRecord = await tx.inventoryRecord.create({
        data: {
          locationId: task.locationId,
          binId: actualBinId,
          sku,
          uomCode: 'EA',
          quantityOnHand: quantity,
          quantityAllocated: 0,
          quantityAvailable: quantity,
          quantityOnHold: unit.qualityStatus !== 'available' ? quantity : 0,
          ownerCustomerId: unit.ownerCustomerId ?? null,
          lotNumber: unit.lotNumber ?? null,
          expiryDate: unit.expiryDate ?? null,
          orgId: command.orgId,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryRecordId: inventoryRecord.id,
          transactionType: 'putaway',
          quantityChange: quantity,
          previousQuantity: 0,
          newQuantity: quantity,
          referenceType: 'putaway_task',
          referenceId: task.id,
          performedBy: command.actorId,
          trackableUnitId: unit.id,
          orgId: command.orgId,
        },
      });
    }

    // 9. Mark task completed
    await tx.putawayTask.update({
      where: { id: task.id },
      data: { status: 'completed' },
    });

    // 10. Emit events
    if (deviation) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.PUTAWAY_TASK_DEVIATION,
        entityType: 'putaway_task',
        entityId: task.id,
        payload: {
          directedBinId: task.targetBinId,
          directedBinLabel: (task as any).targetBin?.label,
          actualBinId,
          actualBinLabel: p.scannedBinLabel,
          reason: deviationReason,
        },
      }));
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PUTAWAY_TASK_COMPLETED,
      entityType: 'putaway_task',
      entityId: task.id,
      payload: {
        trackableUnitId: unit.id,
        actualBinId,
        actualBinLabel: p.scannedBinLabel,
        deviation,
        constraintWarnings,
        inventoryRecordId: inventoryRecord.id,
        sku,
        quantity,
      },
    }));

    emit(this.createEvent(command, {
      type: EVENT_TYPES.INVENTORY_RECEIVED,
      entityType: 'inventory_record',
      entityId: inventoryRecord.id,
      payload: {
        locationId: task.locationId,
        binId: actualBinId,
        sku,
        quantity,
        lotNumber: unit.lotNumber,
        trackableUnitId: unit.id,
        source: 'putaway',
      },
    }));

    return {
      id: task.id,
      status: 'completed',
      actualBinId,
      actualBinLabel: p.scannedBinLabel,
      deviation,
      deviationReason,
      inventoryRecordId: inventoryRecord.id,
      constraintWarnings,
    };
  }
}
