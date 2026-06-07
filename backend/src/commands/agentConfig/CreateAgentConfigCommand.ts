import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateAgentConfigPayload {
  agentType: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  subscribedEvents: string[];
  systemPrompt: string;
  changeNote?: string | null;
  createdBy?: string | null;
}

export interface CreateAgentConfigResult {
  id: string;
  agentType: string;
  versionId: string;
}

export const CREATE_AGENT_CONFIG = 'agent_config.create';

export class CreateAgentConfigCommandHandler extends BaseCommandHandler<CreateAgentConfigPayload, CreateAgentConfigResult> {
  readonly commandType = CREATE_AGENT_CONFIG;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateAgentConfigPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateAgentConfigResult> {
    const { agentType, name, description, enabled, subscribedEvents, systemPrompt, changeNote, createdBy } = command.payload;

    // Atomic: config + first version + active pointer in one transaction.
    // The previous route did three separate writes which left the config in
    // a half-built state if the second or third one failed.
    const config = await tx.agentConfig.create({
      data: {
        orgId: command.orgId,
        agentType,
        name,
        description: description ?? null,
        enabled: enabled ?? true,
        subscribedEvents,
        versions: {
          create: {
            versionNumber: 1,
            systemPrompt,
            changeNote: changeNote ?? null,
            createdBy: createdBy ?? null,
          },
        },
      },
      include: { versions: true },
    });

    const firstVersion = config.versions[0];
    await tx.agentConfig.update({
      where: { id: config.id },
      data: { activeVersionId: firstVersion.id },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AGENT_CONFIG_CREATED,
      entityType: 'agent_config',
      entityId: config.id,
      payload: { agentType, name, enabled: enabled ?? true, versionId: firstVersion.id },
    }));

    return { id: config.id, agentType: config.agentType, versionId: firstVersion.id };
  }
}
