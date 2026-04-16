import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateReplenishmentRulePayload {
  locationId: string;
  sku: string;
  pickFaceBinId: string;
  bulkZoneId: string;
  minQuantity: number;
  maxQuantity: number;
}

export const CREATE_REPLENISHMENT_RULE = 'replenishment_rule.create';

export class CreateReplenishmentRuleCommandHandler extends BaseCommandHandler<
  CreateReplenishmentRulePayload,
  { id: string; sku: string; minQuantity: number; maxQuantity: number }
> {
  readonly commandType = CREATE_REPLENISHMENT_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateReplenishmentRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; sku: string; minQuantity: number; maxQuantity: number }> {
    const p = command.payload;

    if (p.minQuantity >= p.maxQuantity) {
      throw new Error('minQuantity must be less than maxQuantity');
    }

    // Verify bin and zone exist
    const bin = await tx.warehouseBin.findUnique({ where: { id: p.pickFaceBinId } });
    if (!bin) throw new Error(`Pick face bin ${p.pickFaceBinId} not found`);

    const zone = await tx.warehouseZone.findUnique({ where: { id: p.bulkZoneId } });
    if (!zone) throw new Error(`Bulk zone ${p.bulkZoneId} not found`);

    const rule = await tx.replenishmentRule.create({
      data: {
        locationId: p.locationId,
        sku: p.sku,
        pickFaceBinId: p.pickFaceBinId,
        bulkZoneId: p.bulkZoneId,
        minQuantity: p.minQuantity,
        maxQuantity: p.maxQuantity,
        active: true,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.REPLENISHMENT_RULE_CREATED,
      entityType: 'replenishment_rule',
      entityId: rule.id,
      payload: {
        sku: p.sku,
        pickFaceBinId: p.pickFaceBinId,
        bulkZoneId: p.bulkZoneId,
        minQuantity: p.minQuantity,
        maxQuantity: p.maxQuantity,
      },
    }));

    return { id: rule.id, sku: rule.sku, minQuantity: rule.minQuantity, maxQuantity: rule.maxQuantity };
  }
}
