import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateApiKeyPayload {
  name: string;
  customerId?: string | null;
  keyHash: string;
  keyPrefix: string;
}

export interface CreateApiKeyResult {
  id: string;
  name: string;
  keyPrefix: string;
  active: boolean;
  customerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const CREATE_API_KEY = 'api_key.create';

export class CreateApiKeyCommandHandler extends BaseCommandHandler<CreateApiKeyPayload, CreateApiKeyResult> {
  readonly commandType = CREATE_API_KEY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateApiKeyPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateApiKeyResult> {
    const { name, customerId, keyHash, keyPrefix } = command.payload;

    // ApiKey.orgId is NOT NULL post phase-2 tightening; throw rather than
    // write a half-built row when the caller forgot to dispatch with one.
    if (!command.orgId) {
      throw new Error('orgId is required to create an ApiKey (multi-tenancy)');
    }

    const apiKey = await tx.apiKey.create({
      data: {
        orgId: command.orgId,
        name,
        keyHash,
        keyPrefix,
        active: true,
        customerId: customerId ?? null,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.API_KEY_CREATED,
      entityType: 'api_key',
      entityId: apiKey.id,
      // Deliberately NOT including the keyHash or full key in the event
      // payload — only the prefix is safe to log.
      payload: {
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        customerId: apiKey.customerId,
      },
    }));

    return {
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      active: apiKey.active,
      customerId: apiKey.customerId,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }
}
