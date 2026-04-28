import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export const ARCHIVE_SHIPMENT_TYPE = 'shipment_type.archive';

export class ArchiveShipmentTypeCommandHandler extends BaseCommandHandler<{ id: string }, { id: string }> {
  readonly commandType = ARCHIVE_SHIPMENT_TYPE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string }>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;
    const existing = await tx.shipmentType.findUniqueOrThrow({ where: { id } });
    if (existing.isBuiltIn) {
      throw new Error('Built-in shipment types cannot be archived');
    }
    const archived = await tx.shipmentType.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SHIPMENT_TYPE_ARCHIVED,
      entityType: 'shipment_type',
      entityId: id,
      payload: { name: archived.name },
    }));

    return { id };
  }
}
