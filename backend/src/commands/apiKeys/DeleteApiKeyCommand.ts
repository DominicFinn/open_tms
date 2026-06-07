import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteApiKeyPayload {
  id: string;
}

export interface DeleteApiKeyResult {
  id: string;
  keyPrefix: string;
}

export const DELETE_API_KEY = 'api_key.delete';

export class DeleteApiKeyCommandHandler extends BaseCommandHandler<DeleteApiKeyPayload, DeleteApiKeyResult> {
  readonly commandType = DELETE_API_KEY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteApiKeyPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<DeleteApiKeyResult> {
    const { id } = command.payload;

    const existing = await tx.apiKey.findUnique({ where: { id } });
    if (!existing) throw new Error('API key not found');

    await tx.apiKey.delete({ where: { id } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.API_KEY_DELETED,
      entityType: 'api_key',
      entityId: id,
      payload: { name: existing.name, keyPrefix: existing.keyPrefix },
    }));

    return { id, keyPrefix: existing.keyPrefix };
  }
}
