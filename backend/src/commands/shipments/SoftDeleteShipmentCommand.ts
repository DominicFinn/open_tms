import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface SoftDeleteShipmentPayload {
  id: string;
}

export const SOFT_DELETE_SHIPMENT = 'shipment.soft_delete';

/**
 * Admin-only soft delete. Distinct from archive: the row is retained for audit
 * (deletedAt/deletedBy tombstone) but hidden from every view. Idempotent —
 * re-deleting an already-deleted shipment is a no-op.
 *
 * Emits SHIPMENT_DELETED, which removes the shipment from the read model and is
 * captured by the AuditHandler (records who deleted it via command.actorId).
 */
export class SoftDeleteShipmentCommandHandler extends BaseCommandHandler<SoftDeleteShipmentPayload, { id: string; alreadyDeleted?: boolean }> {
  readonly commandType = SOFT_DELETE_SHIPMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<SoftDeleteShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; alreadyDeleted?: boolean }> {
    const { id } = command.payload;

    const existing = await tx.shipment.findFirstOrThrow({ where: { id } });
    if (existing.deletedAt) {
      return { id, alreadyDeleted: true };
    }

    const shipment = await tx.shipment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: command.actorId ?? null },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_DELETED,
      entityType: 'shipment',
      entityId: id,
      payload: { shipmentReference: shipment.reference, softDelete: true },
    }));

    return { id };
  }
}
