import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCycleCountPayload {
  locationId: string;
  countType: string;    // full, zone, random_sample
  zoneId?: string | null;
  assignedToUserId?: string | null;
  plannedAt?: string | null;
}

export const CREATE_CYCLE_COUNT = 'cycle_count.create';

export class CreateCycleCountCommandHandler extends BaseCommandHandler<
  CreateCycleCountPayload,
  { id: string; totalBins: number; status: string }
> {
  readonly commandType = CREATE_CYCLE_COUNT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCycleCountPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; totalBins: number; status: string }> {
    const p = command.payload;

    // Find inventory records to count based on count type
    const where: any = { locationId: p.locationId, quantityOnHand: { gt: 0 } };
    if (p.countType === 'zone' && p.zoneId) {
      where.bin = { zoneId: p.zoneId };
    }

    const inventoryRecords = await tx.inventoryRecord.findMany({
      where,
      include: { bin: { select: { id: true, label: true } } },
      orderBy: { bin: { walkSequence: 'asc' } },
    });

    if (inventoryRecords.length === 0) {
      throw new Error('No inventory to count at this location');
    }

    // For random_sample, take ~20% of bins
    let recordsToCount = inventoryRecords;
    if (p.countType === 'random_sample') {
      const sampleSize = Math.max(1, Math.ceil(inventoryRecords.length * 0.2));
      const shuffled = [...inventoryRecords].sort(() => Math.random() - 0.5);
      recordsToCount = shuffled.slice(0, sampleSize);
    }

    const cycleCount = await tx.cycleCount.create({
      data: {
        locationId: p.locationId,
        countType: p.countType,
        zoneId: p.zoneId ?? null,
        status: 'planned',
        assignedToUserId: p.assignedToUserId ?? null,
        plannedAt: p.plannedAt ? new Date(p.plannedAt) : null,
        totalBins: recordsToCount.length,
        countedBins: 0,
        varianceCount: 0,
        orgId: command.orgId,
      },
    });

    // Create count lines from inventory records
    await tx.cycleCountLine.createMany({
      data: recordsToCount.map(inv => ({
        cycleCountId: cycleCount.id,
        binId: inv.binId,
        sku: inv.sku,
        uomCode: inv.uomCode,
        expectedQuantity: inv.quantityOnHand,
        inventoryRecordId: inv.id,
        status: 'pending',
      })),
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CYCLE_COUNT_CREATED,
      entityType: 'cycle_count',
      entityId: cycleCount.id,
      payload: {
        locationId: p.locationId,
        countType: p.countType,
        totalBins: recordsToCount.length,
      },
    }));

    return { id: cycleCount.id, totalBins: recordsToCount.length, status: 'planned' };
  }
}
