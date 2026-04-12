import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateLocationPayload {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
  locationType?: string;
  facilityCapabilities?: Record<string, boolean>;
  operatingHours?: Record<string, { open: string; close: string }>;
  appointmentRequired?: boolean;
  dockCount?: number;
  maxTrailerLengthFt?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export const CREATE_LOCATION = 'location.create';

export class CreateLocationCommandHandler extends BaseCommandHandler<CreateLocationPayload, { id: string; name: string }> {
  readonly commandType = CREATE_LOCATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateLocationPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const location = await tx.location.create({ data: command.payload });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LOCATION_CREATED,
      entityType: 'location',
      entityId: location.id,
      payload: { name: location.name, city: location.city, country: location.country, locationType: location.locationType },
    }));

    return { id: location.id, name: location.name };
  }
}
