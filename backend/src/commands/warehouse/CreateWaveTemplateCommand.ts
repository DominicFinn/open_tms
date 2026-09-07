import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { resolveFacilityForLocation } from '../facilities/resolveFacility.js';

export interface CreateWaveTemplatePayload {
  locationId: string;
  name: string;
  groupingRules?: Record<string, unknown> | null;
  cutoffTime?: string | null;
  pickStrategy: string;
  zonePickMode?: 'sequential' | 'parallel' | null;
  minOrders?: number | null;
  maxOrders?: number | null;
  maxLabourHours?: number | null;
  priority?: number;
  releaseSchedule?: string | null;
  autoRelease?: boolean;
}

export const CREATE_WAVE_TEMPLATE = 'wave_template.create';

export class CreateWaveTemplateCommandHandler extends BaseCommandHandler<
  CreateWaveTemplatePayload,
  { id: string; name: string }
> {
  readonly commandType = CREATE_WAVE_TEMPLATE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateWaveTemplatePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const p = command.payload;

    // Phase 2a dual-write (#229): the template is filed under both the Location and the Facility
    // derived from it, so nothing is left without a facility when reads switch over.
    const facilityId = await resolveFacilityForLocation(tx, command, p.locationId, emit);

    const template = await tx.waveTemplate.create({
      data: {
        locationId: p.locationId,
        facilityId,
        name: p.name,
        groupingRules: p.groupingRules as Prisma.InputJsonValue ?? Prisma.JsonNull,
        cutoffTime: p.cutoffTime ?? null,
        pickStrategy: p.pickStrategy,
        zonePickMode: p.zonePickMode ?? null,
        minOrders: p.minOrders ?? null,
        maxOrders: p.maxOrders ?? null,
        maxLabourHours: p.maxLabourHours ?? null,
        priority: p.priority ?? 50,
        releaseSchedule: p.releaseSchedule ?? null,
        autoRelease: p.autoRelease ?? false,
        active: true,
        orgId: command.orgId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAVE_TEMPLATE_CREATED,
      entityType: 'wave_template',
      entityId: template.id,
      payload: {
        locationId: template.locationId,
        pickStrategy: template.pickStrategy,
        priority: template.priority,
        autoRelease: template.autoRelease,
      },
    }));

    return { id: template.id, name: template.name };
  }
}
