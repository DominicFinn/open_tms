import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteCustomerWebhookPayload {
  id: string;
  customerId: string;
}

export interface DeleteCustomerWebhookResult {
  id: string;
  deleted: boolean;
}

export const DELETE_CUSTOMER_WEBHOOK = 'customer_webhook.delete';

export class DeleteCustomerWebhookCommandHandler extends BaseCommandHandler<DeleteCustomerWebhookPayload, DeleteCustomerWebhookResult> {
  readonly commandType = DELETE_CUSTOMER_WEBHOOK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteCustomerWebhookPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<DeleteCustomerWebhookResult> {
    const { id, customerId } = command.payload;

    const existing = await tx.customerWebhook.findUnique({ where: { id } });
    if (!existing || existing.customerId !== customerId) {
      throw new Error('Webhook not found');
    }

    await tx.customerWebhook.delete({ where: { id } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CUSTOMER_WEBHOOK_DELETED,
      entityType: 'customer_webhook',
      entityId: id,
      payload: { customerId, name: existing.name, url: existing.url },
    }));

    return { id, deleted: true };
  }
}
