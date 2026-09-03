import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ArchiveFacilityPayload {
  facilityId: string;
}

export const ARCHIVE_FACILITY = 'facility.archive';

export class ArchiveFacilityCommandHandler extends BaseCommandHandler<
  ArchiveFacilityPayload,
  { id: string }
> {
  readonly commandType = ARCHIVE_FACILITY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ArchiveFacilityPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { facilityId } = command.payload;

    const existing = await tx.facility.findFirst({
      where: { id: facilityId, orgId: command.orgId },
      select: { id: true, archived: true },
    });
    if (!existing) throw new Error(`Facility ${facilityId} not found`);
    if (existing.archived) return { id: existing.id };

    // BUSINESS RULE: a facility with live storage topology under it cannot be archived. Bins hold
    // stock; archiving the root would strand it with no operator-visible home.
    const zoneCount = await tx.warehouseZone.count({ where: { facilityId, active: true } });
    if (zoneCount > 0) {
      throw new Error('Cannot archive a facility with active zones');
    }

    await tx.facility.update({
      where: { id: facilityId },
      data: { archived: true, archivedAt: new Date(), active: false },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.FACILITY_ARCHIVED,
      entityType: 'facility',
      entityId: facilityId,
      payload: {},
    }));

    return { id: facilityId };
  }
}
