import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateAgentConfigPayload {
  id: string;
  data: {
    name?: string;
    description?: string | null;
    enabled?: boolean;
    subscribedEvents?: string[];
    temperature?: number | null;
    maxTokens?: number | null;
    confidenceThreshold?: number | null;
    deduplicationWindowMinutes?: number | null;
  };
}

export interface UpdateAgentConfigResult {
  id: string;
  enabled: boolean;
}

export const UPDATE_AGENT_CONFIG = 'agent_config.update';

export class UpdateAgentConfigCommandHandler extends BaseCommandHandler<UpdateAgentConfigPayload, UpdateAgentConfigResult> {
  readonly commandType = UPDATE_AGENT_CONFIG;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateAgentConfigPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<UpdateAgentConfigResult> {
    const { id, data } = command.payload;

    const existing = await tx.agentConfig.findUnique({ where: { id } });
    if (!existing) throw new Error('Agent config not found');

    const updated = await tx.agentConfig.update({ where: { id }, data });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.AGENT_CONFIG_UPDATED,
      entityType: 'agent_config',
      entityId: id,
      payload: {
        agentType: updated.agentType,
        changes: Object.keys(data),
        enabled: updated.enabled,
        // Specifically signal an enable/disable so subscribers (e.g. a
        // future "agent paused" notification) can react without diffing.
        enabledChanged: data.enabled !== undefined && data.enabled !== existing.enabled,
      },
    }));

    return { id: updated.id, enabled: updated.enabled };
  }
}
