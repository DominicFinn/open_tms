import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CheckInAppointmentPayload {
  appointmentId: string;
  dockBinId?: string | null;
  trailerNumber?: string | null;
  sealNumber?: string | null;
}

export const CHECK_IN_APPOINTMENT = 'receiving_appointment.check_in';

export class CheckInAppointmentCommandHandler extends BaseCommandHandler<
  CheckInAppointmentPayload,
  { id: string; status: string }
> {
  readonly commandType = CHECK_IN_APPOINTMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CheckInAppointmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string }> {
    const p = command.payload;

    // Re-read inside the transaction and scoped to the caller's org: check-in races with cancel,
    // and an unscoped read here would let one tenant check in another's appointment.
    const existing = await tx.receivingAppointment.findFirst({
      where: { id: p.appointmentId, orgId: command.orgId },
    });
    if (!existing) throw new Error(`Appointment ${p.appointmentId} not found`);

    // BUSINESS RULE: a completed or cancelled appointment is terminal. The carrier has left.
    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new Error(`Cannot check in an appointment in status "${existing.status}"`);
    }

    if (p.dockBinId) {
      const bin = await tx.warehouseBin.findFirst({
        where: { id: p.dockBinId, orgId: command.orgId },
        select: { id: true },
      });
      if (!bin) throw new Error(`Bin ${p.dockBinId} not found`);
    }

    const updated = await tx.receivingAppointment.update({
      where: { id: p.appointmentId },
      data: {
        status: 'checked_in',
        dockBinId: p.dockBinId ?? existing.dockBinId,
        trailerNumber: p.trailerNumber ?? existing.trailerNumber,
        sealNumber: p.sealNumber ?? existing.sealNumber,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RECEIVING_APPOINTMENT_CHECKED_IN,
      entityType: 'receiving_appointment',
      entityId: updated.id,
      payload: {
        locationId: updated.locationId,
        dockBinId: updated.dockBinId,
        previousStatus: existing.status,
      },
    }));

    return { id: updated.id, status: updated.status };
  }
}
