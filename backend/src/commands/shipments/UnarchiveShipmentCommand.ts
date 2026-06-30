import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UnarchiveShipmentPayload {
  id: string;
}

export const UNARCHIVE_SHIPMENT = 'shipment.unarchive';

/**
 * Restore an archived shipment. Clears archived/archivedAt and emits
 * SHIPMENT_UNARCHIVED, which re-inserts the shipment into the read model so it
 * reappears in active lists. Idempotent — unarchiving a non-archived shipment
 * is a no-op.
 */
export class UnarchiveShipmentCommandHandler extends BaseCommandHandler<UnarchiveShipmentPayload, { id: string; notArchived?: boolean }> {
  readonly commandType = UNARCHIVE_SHIPMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UnarchiveShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; notArchived?: boolean }> {
    const { id } = command.payload;

    const existing = await tx.shipment.findFirstOrThrow({ where: { id, deletedAt: null } });
    if (!existing.archived) {
      return { id, notArchived: true };
    }

    const shipment = await tx.shipment.update({
      where: { id },
      data: { archived: false, archivedAt: null },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_UNARCHIVED,
      entityType: 'shipment',
      entityId: id,
      payload: { shipmentReference: shipment.reference },
    }));

    return { id };
  }
}
