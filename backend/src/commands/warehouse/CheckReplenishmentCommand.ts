import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

/**
 * Checks all active replenishment rules for a location and creates
 * putaway tasks (type: 'replenishment') for any pick face bins that
 * have dropped below their minimum quantity.
 *
 * Called after pick line completion or on demand.
 */
export interface CheckReplenishmentPayload {
  locationId: string;
  /** Optionally scope to a specific SKU (e.g. after a pick of that SKU) */
  sku?: string;
}

export const CHECK_REPLENISHMENT = 'replenishment.check';

export class CheckReplenishmentCommandHandler extends BaseCommandHandler<
  CheckReplenishmentPayload,
  { tasksCreated: number; details: Array<{ sku: string; pickFaceBin: string; quantity: number }> }
> {
  readonly commandType = CHECK_REPLENISHMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CheckReplenishmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ tasksCreated: number; details: Array<{ sku: string; pickFaceBin: string; quantity: number }> }> {
    const p = command.payload;

    // Find active rules, optionally filtered by SKU
    const where: any = { locationId: p.locationId, active: true };
    if (p.sku) where.sku = p.sku;

    const rules = await tx.replenishmentRule.findMany({ where });

    const details: Array<{ sku: string; pickFaceBin: string; quantity: number }> = [];
    let tasksCreated = 0;

    for (const rule of rules) {
      // Check current quantity at the pick face bin for this SKU
      const pickFaceInventory = await tx.inventoryRecord.findFirst({
        where: { binId: rule.pickFaceBinId, sku: rule.sku },
      });

      const currentQty = pickFaceInventory?.quantityOnHand ?? 0;

      if (currentQty >= rule.minQuantity) continue; // No replenishment needed

      // Check if there's already a pending replenishment task for this bin+sku
      const existingTask = await tx.putawayTask.findFirst({
        where: {
          targetBinId: rule.pickFaceBinId,
          putawayType: 'replenishment',
          status: { in: ['pending', 'assigned', 'in_progress'] },
        },
      });
      if (existingTask) continue; // Already being replenished

      // Calculate how much to replenish (up to maxQuantity)
      const replenishQty = rule.maxQuantity - currentQty;

      // Find bulk inventory to pull from
      const bulkInventory = await tx.inventoryRecord.findFirst({
        where: {
          bin: { zoneId: rule.bulkZoneId },
          sku: rule.sku,
          quantityAvailable: { gt: 0 },
        },
        include: { bin: true },
        orderBy: { quantityAvailable: 'desc' },
      });

      if (!bulkInventory) continue; // No bulk stock available

      const actualQty = Math.min(replenishQty, bulkInventory.quantityAvailable);

      // Create replenishment putaway task
      await tx.putawayTask.create({
        data: {
          locationId: p.locationId,
          trackableUnitId: bulkInventory.id, // Using inventory record ID as reference
          sourceBinId: bulkInventory.binId,
          targetBinId: rule.pickFaceBinId,
          status: 'pending',
          putawayType: 'replenishment',
          orgId: command.orgId,
        },
      });

      // Emit below-minimum event
      emit(this.createEvent(command, {
        type: EVENT_TYPES.INVENTORY_BELOW_MINIMUM,
        entityType: 'inventory_record',
        entityId: pickFaceInventory?.id ?? rule.pickFaceBinId,
        payload: {
          sku: rule.sku,
          binId: rule.pickFaceBinId,
          currentQuantity: currentQty,
          minQuantity: rule.minQuantity,
          maxQuantity: rule.maxQuantity,
        },
      }));

      emit(this.createEvent(command, {
        type: EVENT_TYPES.REPLENISHMENT_TRIGGERED,
        entityType: 'replenishment_rule',
        entityId: rule.id,
        payload: {
          sku: rule.sku,
          pickFaceBinId: rule.pickFaceBinId,
          sourceBinId: bulkInventory.binId,
          replenishQuantity: actualQty,
          currentQuantity: currentQty,
        },
      }));

      const bin = await tx.warehouseBin.findUnique({ where: { id: rule.pickFaceBinId }, select: { label: true } });
      details.push({ sku: rule.sku, pickFaceBin: bin?.label ?? rule.pickFaceBinId, quantity: actualQty });
      tasksCreated++;
    }

    return { tasksCreated, details };
  }
}
