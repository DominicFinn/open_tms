import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ActivatePromptVersionPayload {
  configId: string;
  versionId: string;
}

export interface ActivatePromptVersionResult {
  configId: string;
  versionId: string;
  versionNumber: number;
}

export const ACTIVATE_PROMPT_VERSION = 'agent_config.activate_prompt_version';

export class ActivatePromptVersionCommandHandler extends BaseCommandHandler<ActivatePromptVersionPayload, ActivatePromptVersionResult> {
  readonly commandType = ACTIVATE_PROMPT_VERSION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ActivatePromptVersionPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<ActivatePromptVersionResult> {
    const { configId, versionId } = command.payload;

    const config = await tx.agentConfig.findUnique({ where: { id: configId } });
    if (!config) throw new Error('Agent config not found');

    const version = await tx.agentConfigVersion.findFirst({
      where: { id: versionId, configId },
    });
    if (!version) throw new Error('Version not found');

    await tx.agentConfig.update({
      where: { id: configId },
      data: { activeVersionId: versionId },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AGENT_CONFIG_VERSION_ACTIVATED,
      entityType: 'agent_config',
      entityId: configId,
      payload: {
        agentType: config.agentType,
        versionId,
        versionNumber: version.versionNumber,
        previousVersionId: config.activeVersionId,
      },
    }));

    return { configId, versionId, versionNumber: version.versionNumber };
  }
}
