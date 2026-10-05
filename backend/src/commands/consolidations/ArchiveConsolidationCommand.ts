import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { ConsolidationRuleError, releaseShipment } from './consolidationMembership.js';
import { allocateConsolidationCost } from './allocateConsolidationCost.js';

export const ARCHIVE_CONSOLIDATION = 'consolidation.archive';

export class ArchiveConsolidationCommandHandler extends BaseCommandHandler<{ id: string }, { id: string; released: number }> {
  readonly commandType = ARCHIVE_CONSOLIDATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<{ id: string }>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string; released: number }> {
    const { orgId } = command;
    const { id } = command.payload;

    const consolidation = await tx.consolidation.findFirst({
      where: { id, orgId },
      select: { status: true, archived: true, shipments: { select: { shipmentId: true } } },
    });
    if (!consolidation) throw new Error('Consolidation not found');
    if (consolidation.archived) return { id, released: 0 };
    if (consolidation.status === 'in_progress') {
      throw new ConsolidationRuleError('A consolidation on the road cannot be archived.');
    }

    // BUSINESS RULE: archiving a draft abandons the plan, so its shipments are freed to be
    // consolidated again. A finished or cancelled run keeps them, as the record of what travelled.
    const released = consolidation.status === 'draft' ? consolidation.shipments.map((s) => s.shipmentId) : [];
    for (const shipmentId of released) await releaseShipment(tx, orgId, id, shipmentId);
    if (released.length > 0) await tx.consolidationStop.deleteMany({ where: { consolidationId: id, consolidation: { orgId } } });

    await tx.consolidation.update({ where: { id, orgId }, data: { archived: true, archivedAt: new Date() } });
    // An abandoned draft's cost shares go with it; a finished run keeps its costs.
    if (released.length > 0) await allocateConsolidationCost(tx, orgId, id, released);

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_ARCHIVED,
      entityType: 'consolidation',
      entityId: id,
      payload: { releasedShipmentIds: released },
    }));
    return { id, released: released.length };
  }
}
