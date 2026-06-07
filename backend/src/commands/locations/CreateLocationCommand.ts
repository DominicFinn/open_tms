import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateLocationPayload {
  /** Multi-tenancy scope. Optional in the type for parity with legacy
   *  callers; falls back to command.orgId from the JWT path. */
  orgId?: string | null;
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
    const { orgId: payloadOrgId, ...locationData } = command.payload;
    // Location.orgId is NOT NULL post phase-3 tightening.
    const orgIdToWrite = payloadOrgId || command.orgId;
    if (!orgIdToWrite) {
      throw new Error('orgId is required to create a Location (multi-tenancy)');
    }
    const location = await tx.location.create({
      data: { ...locationData, orgId: orgIdToWrite },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LOCATION_CREATED,
      entityType: 'location',
      entityId: location.id,
      payload: { name: location.name, city: location.city, country: location.country, locationType: location.locationType },
    }));

    return { id: location.id, name: location.name };
  }
}
