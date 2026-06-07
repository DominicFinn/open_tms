import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCustomerWebhookPayload {
  customerId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  description?: string | null;
}

export interface CreateCustomerWebhookResult {
  id: string;
  customerId: string;
  url: string;
}

export const CREATE_CUSTOMER_WEBHOOK = 'customer_webhook.create';

export class CreateCustomerWebhookCommandHandler extends BaseCommandHandler<CreateCustomerWebhookPayload, CreateCustomerWebhookResult> {
  readonly commandType = CREATE_CUSTOMER_WEBHOOK;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCustomerWebhookPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<CreateCustomerWebhookResult> {
    const p = command.payload;

    const webhook = await tx.customerWebhook.create({
      data: {
        orgId: command.orgId,
        customerId: p.customerId,
        name: p.name,
        url: p.url,
        secret: p.secret,
        events: p.events,
        description: p.description ?? null,
      },
    });

    // Deliberately leaving the secret out of the event payload — it's
    // sensitive material the customer holds.
    emit(this.createEvent(command, {
      type: EVENT_TYPES.CUSTOMER_WEBHOOK_CREATED,
      entityType: 'customer_webhook',
      entityId: webhook.id,
      payload: {
        customerId: p.customerId,
        name: p.name,
        url: p.url,
        events: p.events,
      },
    }));

    return { id: webhook.id, customerId: webhook.customerId, url: webhook.url };
  }
}
