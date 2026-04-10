import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCarrierUserPayload {
  carrierId: string;
  email: string;
  name: string;
  passwordHash: string;
}

export const CREATE_CARRIER_USER = 'carrier_user.create';

export class CreateCarrierUserCommandHandler extends BaseCommandHandler<CreateCarrierUserPayload, { id: string }> {
  readonly commandType = CREATE_CARRIER_USER;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<CreateCarrierUserPayload>, tx: TransactionClient, emit: EmitFn) {
    const user = await tx.carrierUser.create({ data: command.payload });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_USER_CREATED,
      entityType: 'carrier_user',
      entityId: user.id,
      payload: { carrierId: command.payload.carrierId, email: command.payload.email, name: command.payload.name },
    }));

    return { id: user.id };
  }
}
