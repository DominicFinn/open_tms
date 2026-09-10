import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { loadFacilityForWrite } from '../facilities/resolveFacility.js';

export interface CreateStagingAssignmentPayload {
  facilityId: string;
  orderId: string;
  trackableUnitId: string;
  stagingBinId: string;
  shipmentId?: string | null;
  loadSequence?: number | null;
}

export const CREATE_STAGING_ASSIGNMENT = 'staging_assignment.create';

export class CreateStagingAssignmentCommandHandler extends BaseCommandHandler<
  CreateStagingAssignmentPayload,
  { id: string; status: string; stagingBinLabel: string }
> {
  readonly commandType = CREATE_STAGING_ASSIGNMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateStagingAssignmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; stagingBinLabel: string }> {
    const p = command.payload;

    // Both lookups are scoped to the caller's org (#220). Staging another tenant's bin would put
    // our goods on their dock, and the trackableUnit update below would move their stock.
    const bin = await tx.warehouseBin.findFirst({
      where: { id: p.stagingBinId, orgId: command.orgId },
    });
    if (!bin) throw new Error(`Staging bin ${p.stagingBinId} not found`);
    if (!bin.active) throw new Error(`Staging bin "${bin.label}" is inactive`);

    // TrackableUnit carries no orgId of its own, so it is scoped through its order. Splitting it
    // into a WMS HandlingUnit that does is Phase 2b.
    const unit = await tx.trackableUnit.findFirst({
      where: { id: p.trackableUnitId, order: { orgId: command.orgId } },
      select: { id: true },
    });
    if (!unit) throw new Error(`Trackable unit ${p.trackableUnitId} not found`);

    // Phase 2a (#248): the caller names the facility. locationId is still written from the
    // facility's source location until 6c drops the column, and is null in a warehouse-only
    // install.
    const facility = await loadFacilityForWrite(tx, command.orgId, p.facilityId);

    const assignment = await tx.stagingAssignment.create({
      data: {
        facilityId: facility.id,
        locationId: facility.sourceLocationId,
        orderId: p.orderId,
        trackableUnitId: p.trackableUnitId,
        stagingBinId: p.stagingBinId,
        shipmentId: p.shipmentId ?? null,
        loadSequence: p.loadSequence ?? null,
        status: 'staged',
        orgId: command.orgId,
      },
    });

    // Move the trackable unit to the staging bin
    await tx.trackableUnit.update({
      where: { id: p.trackableUnitId },
      data: {
        currentBinId: p.stagingBinId,
        currentZoneId: bin.zoneId,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.STAGING_ASSIGNMENT_CREATED,
      entityType: 'staging_assignment',
      entityId: assignment.id,
      payload: {
        orderId: p.orderId,
        trackableUnitId: p.trackableUnitId,
        stagingBinId: p.stagingBinId,
        stagingBinLabel: bin.label,
        shipmentId: p.shipmentId,
      },
    }));

    return { id: assignment.id, status: 'staged', stagingBinLabel: bin.label };
  }
}
