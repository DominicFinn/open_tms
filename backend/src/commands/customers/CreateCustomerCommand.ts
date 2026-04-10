import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const CREATE_CUSTOMER = 'customer.create';

export class CreateCustomerCommandHandler extends BaseCommandHandler<{ name: string; contactEmail?: string }, { id: string; name: string }> {
  readonly commandType = CREATE_CUSTOMER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ name: string; contactEmail?: string }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const customer = await tx.customer.create({ data: command.payload });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CUSTOMER_CREATED,
      entityType: 'customer',
      entityId: customer.id,
      payload: { name: customer.name, contactEmail: customer.contactEmail },
    }));

    return { id: customer.id, name: customer.name };
  }
}
