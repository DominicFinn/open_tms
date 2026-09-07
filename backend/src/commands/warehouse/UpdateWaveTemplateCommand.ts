import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateWaveTemplatePayload {
  templateId: string;
  name?: string;
  groupingRules?: Record<string, unknown> | null;
  cutoffTime?: string | null;
  pickStrategy?: string;
  zonePickMode?: string | null;
  minOrders?: number | null;
  maxOrders?: number | null;
  priority?: number;
  releaseSchedule?: string | null;
  autoRelease?: boolean;
  active?: boolean;
}

export const UPDATE_WAVE_TEMPLATE = 'wave_template.update';

export class UpdateWaveTemplateCommandHandler extends BaseCommandHandler<
  UpdateWaveTemplatePayload,
  { id: string; name: string }
> {
  readonly commandType = UPDATE_WAVE_TEMPLATE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateWaveTemplatePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const { templateId, ...updates } = command.payload;

    const existing = await tx.waveTemplate.findFirst({
      where: { id: templateId, orgId: command.orgId },
    });
    if (!existing) throw new Error(`Wave template ${templateId} not found`);

    // BUSINESS RULE: a template whose maximum sits below its minimum can never release a wave.
    // Merged against the stored values, since a request can move one side of the pair alone.
    const min = updates.minOrders !== undefined ? updates.minOrders : existing.minOrders;
    const max = updates.maxOrders !== undefined ? updates.maxOrders : existing.maxOrders;
    if (min != null && max != null && max < min) {
      throw new Error('maxOrders must be at least minOrders');
    }

    const template = await tx.waveTemplate.update({
      where: { id: templateId },
      data: updates as any,
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAVE_TEMPLATE_UPDATED,
      entityType: 'wave_template',
      entityId: template.id,
      payload: {
        locationId: template.locationId,
        active: template.active,
        changes: Object.keys(updates),
      },
    }));

    return { id: template.id, name: template.name };
  }
}
