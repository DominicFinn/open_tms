import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const SOFT_DELETE_CARRIER = 'carrier.soft_delete';

/**
 * Soft-delete a carrier (tombstone). Deleted carriers 404 everywhere but the
 * row is retained for audit/finance history. Delete is for accidental creates
 * / dev use — a carrier assigned to any lane can only be ARCHIVED, not deleted.
 * Idempotent: deleting an already-deleted carrier is a no-op.
 */
export class SoftDeleteCarrierCommandHandler extends BaseCommandHandler<{ id: string }, { id: string; alreadyDeleted?: boolean }> {
  readonly commandType = SOFT_DELETE_CARRIER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; alreadyDeleted?: boolean }> {
    const { id } = command.payload;

    const existing = await tx.carrier.findFirstOrThrow({ where: { id } });
    if (existing.deletedAt) {
      return { id, alreadyDeleted: true };
    }

    // Guard: a carrier tied to any lane cannot be deleted — archive instead.
    const laneCount = await tx.laneCarrier.count({ where: { carrierId: id } });
    if (laneCount > 0) {
      throw new Error('Carrier is assigned to one or more lanes and cannot be deleted. Archive it instead.');
    }

    const carrier = await tx.carrier.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: command.actorId ?? null },
    });

    // Deactivate the carrier's portal users so they can no longer log in.
    await tx.carrierUser.updateMany({ where: { carrierId: id }, data: { active: false } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_DELETED,
      entityType: 'carrier',
      entityId: id,
      payload: { name: carrier.name, softDelete: true },
    }));

    return { id };
  }
}
