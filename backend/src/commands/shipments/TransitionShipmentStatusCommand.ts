import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import {
  canTransition,
  validateShipmentReadiness,
  SHIPMENT_LIFECYCLE,
  SHIPMENT_FIELD_LABELS,
} from '@open-tms/shared';

export interface TransitionShipmentStatusPayload {
  id: string;
  toStatus: string;
}

export const TRANSITION_SHIPMENT_STATUS = 'shipment.transition_status';

/**
 * Manual, gated lifecycle transition for a shipment.
 *
 * - Enforces adjacent-only movement on the canonical lifecycle
 *   (draft -> ready -> in_progress -> complete and one step back).
 * - Re-runs the readiness gate on every forward move into ready/in_progress/complete.
 * - Emits SHIPMENT_STATUS_CHANGED, which the AuditHandler turns into an
 *   immutable AuditLog row recording who made the change (from command.actorId).
 *
 * Automatic tracking handlers intentionally bypass this command — they update
 * status directly and are allowed to skip the readiness gate.
 */
export class TransitionShipmentStatusCommandHandler extends BaseCommandHandler<
  TransitionShipmentStatusPayload,
  { id: string; status: string }
> {
  readonly commandType = TRANSITION_SHIPMENT_STATUS;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<TransitionShipmentStatusPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string }> {
    const { id, toStatus } = command.payload;

    if (!SHIPMENT_LIFECYCLE.includes(toStatus as any)) {
      throw new Error(`Invalid target status "${toStatus}"`);
    }

    const shipment = await tx.shipment.findFirstOrThrow({
      where: { id, archived: false },
      include: { shipmentType: { select: { requiredFields: true } } },
    });

    if (shipment.status === toStatus) {
      throw new Error(`Shipment is already ${toStatus}`);
    }

    if (!canTransition(shipment.status, toStatus)) {
      throw new Error(
        `Cannot move shipment from ${shipment.status} to ${toStatus}. ` +
        `Only one step forward or back is allowed.`
      );
    }

    // Readiness gate: any state beyond draft requires the mandatory fields.
    if (toStatus !== 'draft') {
      const { missing, isValid } = validateShipmentReadiness(
        shipment as any,
        shipment.shipmentType
      );
      if (!isValid) {
        const labels = missing.map(f => SHIPMENT_FIELD_LABELS[f] ?? f);
        throw new Error(`Cannot move to ${toStatus}. Missing required fields: ${labels.join(', ')}`);
      }
    }

    await tx.shipment.update({ where: { id }, data: { status: toStatus } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
      entityType: 'shipment',
      entityId: id,
      payload: {
        previousStatus: shipment.status,
        newStatus: toStatus,
        shipmentReference: shipment.reference,
      },
    }));

    return { id, status: toStatus };
  }
}
