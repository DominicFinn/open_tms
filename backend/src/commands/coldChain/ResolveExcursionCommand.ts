/**
 * ResolveExcursionCommand — marks a cold chain excursion as resolved.
 *
 * Sets the disposition decision (released or quarantined) and records
 * who resolved it and when.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ResolveExcursionPayload {
  id: string;
  dispositionDecision: 'released' | 'quarantined';
  notes?: string;
}

export const RESOLVE_EXCURSION = 'cold_chain_excursion.resolve';

export class ResolveExcursionCommandHandler extends BaseCommandHandler<ResolveExcursionPayload, { id: string }> {
  readonly commandType = RESOLVE_EXCURSION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ResolveExcursionPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, dispositionDecision, notes } = command.payload;

    const excursion = await tx.coldChainExcursion.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedBy: command.actorId,
        resolvedAt: new Date(),
        dispositionDecision,
        ...(notes !== undefined && { notes }),
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.COLD_CHAIN_EXCURSION_RESOLVED,
      entityType: 'cold_chain_excursion',
      entityId: id,
      payload: {
        shipmentId: excursion.shipmentId,
        excursionType: excursion.excursionType,
        severity: excursion.severity,
        dispositionDecision,
        resolvedBy: command.actorId,
      },
    }));

    return { id };
  }
}
