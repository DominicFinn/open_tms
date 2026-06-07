import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const CREATE_CUSTOMER = 'customer.create';

export interface CreateCustomerPayload {
  name: string;
  contactEmail?: string;
  // Multi-tenancy: route handlers thread req.user.organizationId in here so
  // the row lands scoped on first write. Optional in the type for parity
  // with legacy callers (seed scripts, tests) that don't have a JWT.
  orgId?: string | null;
}

export class CreateCustomerCommandHandler extends BaseCommandHandler<CreateCustomerPayload, { id: string; name: string }> {
  readonly commandType = CREATE_CUSTOMER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCustomerPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const { name, contactEmail, orgId } = command.payload;
    // Prefer the explicit payload value over command.orgId so callers can
    // override (e.g. system actor creating on behalf of a tenant); fall
    // through to command.orgId for the standard JWT path. Customer.orgId
    // is NOT NULL post phase-2 tightening, so we throw rather than write
    // a half-built row when neither source supplies one.
    const resolvedOrgId = orgId || command.orgId;
    if (!resolvedOrgId) {
      throw new Error('orgId is required to create a Customer (multi-tenancy)');
    }
    const customer = await tx.customer.create({
      data: { name, contactEmail, orgId: resolvedOrgId },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CUSTOMER_CREATED,
      entityType: 'customer',
      entityId: customer.id,
      payload: { name: customer.name, contactEmail: customer.contactEmail },
    }));

    return { id: customer.id, name: customer.name };
  }
}
