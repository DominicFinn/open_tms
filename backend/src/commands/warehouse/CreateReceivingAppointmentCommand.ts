import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { loadFacilityForWrite } from '../facilities/resolveFacility.js';

export interface CreateReceivingAppointmentPayload {
  facilityId: string;
  inboundShipmentId?: string | null;
  dockBinId?: string | null;
  scheduledAt: string;
  scheduledEndAt: string;
  carrierName?: string | null;
  trailerNumber?: string | null;
  sealNumber?: string | null;
  asnReference?: string | null;
}

export const CREATE_RECEIVING_APPOINTMENT = 'receiving_appointment.create';

export class CreateReceivingAppointmentCommandHandler extends BaseCommandHandler<
  CreateReceivingAppointmentPayload,
  { id: string; scheduledAt: Date }
> {
  readonly commandType = CREATE_RECEIVING_APPOINTMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateReceivingAppointmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; scheduledAt: Date }> {
    const p = command.payload;

    const scheduledAt = new Date(p.scheduledAt);
    const scheduledEndAt = new Date(p.scheduledEndAt);
    if (scheduledEndAt <= scheduledAt) {
      throw new Error('scheduledEndAt must be after scheduledAt');
    }

    // A dock bin belonging to another tenant would put their dock on our schedule.
    if (p.dockBinId) {
      const bin = await tx.warehouseBin.findFirst({
        where: { id: p.dockBinId, orgId: command.orgId },
        select: { id: true },
      });
      if (!bin) throw new Error(`Bin ${p.dockBinId} not found`);
    }

    // Phase 2a (#248): the caller names the facility. locationId is still written from the
    // facility's source location until 6c drops the column, and is null in a warehouse-only
    // install.
    const facility = await loadFacilityForWrite(tx, command.orgId, p.facilityId);

    const appointment = await tx.receivingAppointment.create({
      data: {
        facilityId: facility.id,
        locationId: facility.sourceLocationId,
        inboundShipmentId: p.inboundShipmentId ?? null,
        dockBinId: p.dockBinId ?? null,
        scheduledAt,
        scheduledEndAt,
        carrierName: p.carrierName ?? null,
        trailerNumber: p.trailerNumber ?? null,
        sealNumber: p.sealNumber ?? null,
        asnReference: p.asnReference ?? null,
        orgId: command.orgId,
      },
    });

    // No carrier contact or driver detail on the event: an appointment links to its own id, and
    // that is enough for a subscriber to look up what it is allowed to see.
    emit(this.createEvent(command, {
      type: EVENT_TYPES.RECEIVING_APPOINTMENT_CREATED,
      entityType: 'receiving_appointment',
      entityId: appointment.id,
      payload: {
        locationId: appointment.locationId,
        dockBinId: appointment.dockBinId,
        scheduledAt: appointment.scheduledAt.toISOString(),
        inboundShipmentId: appointment.inboundShipmentId,
      },
    }));

    return { id: appointment.id, scheduledAt: appointment.scheduledAt };
  }
}
