import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateCustomerWebhookPayload {
  id: string;
  customerId: string; // Used for cross-tenant guard inside the handler
  data: {
    name?: string;
    url?: string;
    events?: string[];
    description?: string | null;
    enabled?: boolean;
  };
}

export interface UpdateCustomerWebhookResult {
  id: string;
}

export const UPDATE_CUSTOMER_WEBHOOK = 'customer_webhook.update';

export class UpdateCustomerWebhookCommandHandler extends BaseCommandHandler<UpdateCustomerWebhookPayload, UpdateCustomerWebhookResult> {
  readonly commandType = UPDATE_CUSTOMER_WEBHOOK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateCustomerWebhookPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<UpdateCustomerWebhookResult> {
    const { id, customerId, data } = command.payload;

    const existing = await tx.customerWebhook.findUnique({ where: { id } });
    // Cross-tenant guard inside the handler — the route already checks but
    // belt-and-braces matters for a customer-portal-facing surface.
    if (!existing || existing.customerId !== customerId) {
      throw new Error('Webhook not found');
    }

    await tx.customerWebhook.update({ where: { id }, data });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CUSTOMER_WEBHOOK_UPDATED,
      entityType: 'customer_webhook',
      entityId: id,
      payload: { customerId, changes: Object.keys(data) },
    }));

    return { id };
  }
}
