import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteWaveTemplatePayload {
  templateId: string;
}

export const DELETE_WAVE_TEMPLATE = 'wave_template.delete';

export class DeleteWaveTemplateCommandHandler extends BaseCommandHandler<
  DeleteWaveTemplatePayload,
  { id: string }
> {
  readonly commandType = DELETE_WAVE_TEMPLATE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteWaveTemplatePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { templateId } = command.payload;

    const existing = await tx.waveTemplate.findFirst({
      where: { id: templateId, orgId: command.orgId },
      select: { id: true, locationId: true, name: true },
    });
    if (!existing) throw new Error(`Wave template ${templateId} not found`);

    // BUSINESS RULE: waves keep a foreign key to the template they came from, so deleting one that
    // has already released waves would orphan them. Deactivate it instead.
    const waveCount = await tx.wave.count({ where: { templateId } });
    if (waveCount > 0) {
      throw new Error('Cannot delete a template that has released waves; deactivate it instead');
    }

    await tx.waveTemplate.delete({ where: { id: templateId } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAVE_TEMPLATE_DELETED,
      entityType: 'wave_template',
      entityId: templateId,
      payload: { locationId: existing.locationId, name: existing.name },
    }));

    return { id: templateId };
  }
}
