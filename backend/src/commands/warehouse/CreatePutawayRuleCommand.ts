import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { resolveFacilityForLocation } from '../facilities/resolveFacility.js';

export interface CreatePutawayRulePayload {
  locationId: string;
  name: string;
  priority?: number;
  skuPattern?: string | null;
  temperatureRequirement?: string | null;
  hazmat?: boolean | null;
  customerId?: string | null;
  velocityClass?: string | null;
  unitType?: string | null;
  crossDockSortBy?: string | null;
  targetType: string;
  targetZoneId?: string | null;
  targetBinId?: string | null;
  preferLevel?: string | null;
}

export const CREATE_PUTAWAY_RULE = 'putaway_rule.create';

export class CreatePutawayRuleCommandHandler extends BaseCommandHandler<
  CreatePutawayRulePayload,
  { id: string; name: string }
> {
  readonly commandType = CREATE_PUTAWAY_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreatePutawayRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const p = command.payload;

    // A rule pointing at another tenant's zone or bin would route their stock into ours, so both
    // targets are checked against the caller's org rather than trusted from the request body.
    if (p.targetZoneId) {
      const zone = await tx.warehouseZone.findFirst({
        where: { id: p.targetZoneId, orgId: command.orgId },
        select: { id: true },
      });
      if (!zone) throw new Error(`Zone ${p.targetZoneId} not found`);
    }
    if (p.targetBinId) {
      const bin = await tx.warehouseBin.findFirst({
        where: { id: p.targetBinId, orgId: command.orgId },
        select: { id: true },
      });
      if (!bin) throw new Error(`Bin ${p.targetBinId} not found`);
    }

    // Phase 2a dual-write (#225): the rule is filed under both the Location and the Facility
    // derived from it, so nothing is left without a facility when reads switch over.
    const facilityId = await resolveFacilityForLocation(tx, command, p.locationId, emit);

    const rule = await tx.putawayRule.create({
      data: {
        locationId: p.locationId,
        facilityId,
        name: p.name,
        priority: p.priority ?? 50,
        skuPattern: p.skuPattern ?? null,
        temperatureRequirement: p.temperatureRequirement ?? null,
        hazmat: p.hazmat ?? null,
        customerId: p.customerId ?? null,
        velocityClass: p.velocityClass ?? null,
        unitType: p.unitType ?? null,
        crossDockSortBy: p.crossDockSortBy ?? null,
        targetType: p.targetType,
        targetZoneId: p.targetZoneId ?? null,
        targetBinId: p.targetBinId ?? null,
        preferLevel: p.preferLevel ?? null,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.PUTAWAY_RULE_CREATED,
      entityType: 'putaway_rule',
      entityId: rule.id,
      payload: {
        locationId: rule.locationId,
        name: rule.name,
        priority: rule.priority,
        targetType: rule.targetType,
      },
    }));

    return { id: rule.id, name: rule.name };
  }
}
