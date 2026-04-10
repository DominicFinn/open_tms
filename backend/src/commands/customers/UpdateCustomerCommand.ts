import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const UPDATE_CUSTOMER = 'customer.update';

export class UpdateCustomerCommandHandler extends BaseCommandHandler<{ id: string; data: { name?: string; contactEmail?: string } }, { id: string }> {
  readonly commandType = UPDATE_CUSTOMER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string; data: { name?: string; contactEmail?: string } }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;
    const updated = await tx.customer.update({ where: { id }, data });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CUSTOMER_UPDATED,
      entityType: 'customer',
      entityId: id,
      payload: { name: updated.name, changes: Object.keys(data) },
    }));

    return { id };
  }
}
