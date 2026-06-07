import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateApiKeyPayload {
  id: string;
  data: { name?: string; active?: boolean };
}

export interface UpdateApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const UPDATE_API_KEY = 'api_key.update';

export class UpdateApiKeyCommandHandler extends BaseCommandHandler<UpdateApiKeyPayload, UpdateApiKeyResult> {
  readonly commandType = UPDATE_API_KEY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateApiKeyPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<UpdateApiKeyResult> {
    const { id, data } = command.payload;

    const previous = await tx.apiKey.findUnique({ where: { id } });
    if (!previous) throw new Error('API key not found');

    const updated = await tx.apiKey.update({ where: { id }, data });

    // Emit a more specific event when this update flips active->false so
    // downstream audit / notifications can distinguish revocation from a
    // simple rename.
    if (data.active === false && previous.active === true) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.API_KEY_REVOKED,
        entityType: 'api_key',
        entityId: id,
        payload: { name: updated.name, keyPrefix: updated.keyPrefix },
      }));
    } else {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.API_KEY_UPDATED,
        entityType: 'api_key',
        entityId: id,
        payload: {
          name: updated.name,
          keyPrefix: updated.keyPrefix,
          changes: Object.keys(data),
        },
      }));
    }

    return {
      id: updated.id,
      name: updated.name,
      keyPrefix: updated.keyPrefix,
      active: updated.active,
      lastUsedAt: updated.lastUsedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
