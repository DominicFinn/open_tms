import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCarrierPayload {
  name: string;
  // Multi-tenancy: optional in the type for parity with legacy callers
  // (seed/test); route handlers always supply it from the JWT.
  orgId?: string | null;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export const CREATE_CARRIER = 'carrier.create';

export class CreateCarrierCommandHandler extends BaseCommandHandler<CreateCarrierPayload, { id: string; name: string }> {
  readonly commandType = CREATE_CARRIER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCarrierPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const { orgId: payloadOrgId, ...rest } = command.payload;
    // Carrier.orgId is NOT NULL post phase-2 tightening; throw if neither
    // the payload nor command.orgId supply one rather than write a
    // half-built row.
    const resolvedOrgId = payloadOrgId || command.orgId;
    if (!resolvedOrgId) {
      throw new Error('orgId is required to create a Carrier (multi-tenancy)');
    }
    const carrier = await tx.carrier.create({
      data: { ...rest, orgId: resolvedOrgId },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_CREATED,
      entityType: 'carrier',
      entityId: carrier.id,
      payload: { name: carrier.name, mcNumber: carrier.mcNumber },
    }));

    return { id: carrier.id, name: carrier.name };
  }
}
