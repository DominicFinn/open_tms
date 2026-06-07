import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreatePromptVersionPayload {
  configId: string;
  systemPrompt: string;
  changeNote?: string | null;
  createdBy?: string | null;
}

export interface CreatePromptVersionResult {
  versionId: string;
  versionNumber: number;
}

export const CREATE_PROMPT_VERSION = 'agent_config.create_prompt_version';

export class CreatePromptVersionCommandHandler extends BaseCommandHandler<CreatePromptVersionPayload, CreatePromptVersionResult> {
  readonly commandType = CREATE_PROMPT_VERSION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreatePromptVersionPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreatePromptVersionResult> {
    const { configId, systemPrompt, changeNote, createdBy } = command.payload;

    const config = await tx.agentConfig.findUnique({
      where: { id: configId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!config) throw new Error('Agent config not found');

    const nextVersion = (config.versions[0]?.versionNumber ?? 0) + 1;

    const version = await tx.agentConfigVersion.create({
      data: {
        configId: config.id,
        versionNumber: nextVersion,
        systemPrompt,
        changeNote: changeNote ?? null,
        createdBy: createdBy ?? null,
      },
    });

    // New versions auto-activate (matches the original route behaviour) so
    // a save-and-test loop in the UI doesn't need a second click.
    await tx.agentConfig.update({
      where: { id: config.id },
      data: { activeVersionId: version.id },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AGENT_CONFIG_PROMPT_VERSION_CREATED,
      entityType: 'agent_config',
      entityId: config.id,
      payload: {
        versionId: version.id,
        versionNumber: nextVersion,
        agentType: config.agentType,
        changeNote: changeNote ?? null,
      },
    }));

    return { versionId: version.id, versionNumber: nextVersion };
  }
}
