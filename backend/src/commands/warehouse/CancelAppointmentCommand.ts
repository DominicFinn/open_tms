import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CancelAppointmentPayload {
  appointmentId: string;
  reason?: string | null;
}

export const CANCEL_APPOINTMENT = 'receiving_appointment.cancel';

export class CancelAppointmentCommandHandler extends BaseCommandHandler<
  CancelAppointmentPayload,
  { id: string; status: string }
> {
  readonly commandType = CANCEL_APPOINTMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CancelAppointmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string }> {
    const p = command.payload;

    const existing = await tx.receivingAppointment.findFirst({
      where: { id: p.appointmentId, orgId: command.orgId },
    });
    if (!existing) throw new Error(`Appointment ${p.appointmentId} not found`);

    // BUSINESS RULE: goods already received cannot be un-received by cancelling the appointment.
    if (existing.status === 'completed') {
      throw new Error('Cannot cancel a completed appointment');
    }
    if (existing.status === 'cancelled') {
      return { id: existing.id, status: existing.status };
    }

    const updated = await tx.receivingAppointment.update({
      where: { id: p.appointmentId },
      data: { status: 'cancelled' },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RECEIVING_APPOINTMENT_CANCELLED,
      entityType: 'receiving_appointment',
      entityId: updated.id,
      payload: {
        locationId: updated.locationId,
        previousStatus: existing.status,
        reason: p.reason ?? null,
      },
    }));

    return { id: updated.id, status: updated.status };
  }
}
