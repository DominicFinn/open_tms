import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { resolveFacilityForLocation } from '../facilities/resolveFacility.js';

export interface CreateStagingAssignmentPayload {
  locationId: string;
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

    // Phase 2a dual-write (#227): the assignment is filed under both the Location and the Facility
    // derived from it, so nothing is left without a facility when reads switch over.
    const facilityId = await resolveFacilityForLocation(tx, command, p.locationId, emit);

    const assignment = await tx.stagingAssignment.create({
      data: {
        locationId: p.locationId,
        facilityId,
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
