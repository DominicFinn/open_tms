import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCarrierPayload {
  name: string;
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
    const carrier = await tx.carrier.create({ data: command.payload });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_CREATED,
      entityType: 'carrier',
      entityId: carrier.id,
      payload: { name: carrier.name, mcNumber: carrier.mcNumber },
    }));

    return { id: carrier.id, name: carrier.name };
  }
}
