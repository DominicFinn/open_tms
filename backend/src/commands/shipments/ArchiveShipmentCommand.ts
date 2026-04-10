import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ArchiveShipmentPayload {
  id: string;
}

export const ARCHIVE_SHIPMENT = 'shipment.archive';

export class ArchiveShipmentCommandHandler extends BaseCommandHandler<ArchiveShipmentPayload, { id: string }> {
  readonly commandType = ARCHIVE_SHIPMENT;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ArchiveShipmentPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const shipment = await tx.shipment.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_ARCHIVED,
      entityType: 'shipment',
      entityId: id,
      payload: { shipmentReference: shipment.reference },
    }));

    return { id };
  }
}
