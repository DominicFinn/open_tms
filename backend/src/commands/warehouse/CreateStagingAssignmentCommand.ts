import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

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

    const bin = await tx.warehouseBin.findUnique({ where: { id: p.stagingBinId } });
    if (!bin) throw new Error(`Staging bin ${p.stagingBinId} not found`);
    if (!bin.active) throw new Error(`Staging bin "${bin.label}" is inactive`);

    const assignment = await tx.stagingAssignment.create({
      data: {
        locationId: p.locationId,
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
