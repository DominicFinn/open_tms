import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const UNARCHIVE_CARRIER = 'carrier.unarchive';

/**
 * Restore an archived carrier back to active. Finance/admin use this to bring a
 * carrier back into circulation. A soft-deleted carrier cannot be unarchived.
 */
export class UnarchiveCarrierCommandHandler extends BaseCommandHandler<{ id: string }, { id: string }> {
  readonly commandType = UNARCHIVE_CARRIER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const existing = await tx.carrier.findFirstOrThrow({ where: { id, deletedAt: null } });
    if (!existing.archived) {
      return { id };
    }

    const carrier = await tx.carrier.update({
      where: { id },
      data: { archived: false, archivedAt: null },
    });

    // Reactivate the carrier's portal users.
    await tx.carrierUser.updateMany({ where: { carrierId: id, anonymizedAt: null }, data: { active: true } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_UNARCHIVED,
      entityType: 'carrier',
      entityId: id,
      payload: { name: carrier.name },
    }));

    return { id };
  }
}
