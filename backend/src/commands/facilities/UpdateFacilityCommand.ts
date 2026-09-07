import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateFacilityPayload {
  facilityId: string;
  name?: string;
  code?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  timezone?: string | null;
  active?: boolean;
}

export const UPDATE_FACILITY = 'facility.update';

export class UpdateFacilityCommandHandler extends BaseCommandHandler<
  UpdateFacilityPayload,
  { id: string; name: string }
> {
  readonly commandType = UPDATE_FACILITY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateFacilityPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const { facilityId, ...updates } = command.payload;

    // Scoped by orgId as well as id: a cross-tenant guess must miss, not update.
    const existing = await tx.facility.findFirst({
      where: { id: facilityId, orgId: command.orgId },
      select: { id: true },
    });
    if (!existing) throw new Error(`Facility ${facilityId} not found`);

    // sourceLocationId is deliberately not updatable: re-pointing a facility at a different
    // Location would silently move every zone and bin under it.
    const facility = await tx.facility.update({ where: { id: facilityId }, data: updates });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.FACILITY_UPDATED,
      entityType: 'facility',
      entityId: facility.id,
      payload: { active: facility.active, changes: Object.keys(updates) },
    }));

    return { id: facility.id, name: facility.name };
  }
}
