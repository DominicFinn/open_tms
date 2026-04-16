import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateWaveTemplatePayload {
  locationId: string;
  name: string;
  groupingRules?: Record<string, unknown> | null;
  cutoffTime?: string | null;
  pickStrategy: string;
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

    const template = await tx.waveTemplate.create({
      data: {
        locationId: p.locationId,
        name: p.name,
        groupingRules: p.groupingRules as Prisma.InputJsonValue ?? Prisma.JsonNull,
        cutoffTime: p.cutoffTime ?? null,
        pickStrategy: p.pickStrategy,
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

    return { id: template.id, name: template.name };
  }
}
