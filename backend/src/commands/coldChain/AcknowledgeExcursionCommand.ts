/**
 * AcknowledgeExcursionCommand — marks a cold chain excursion as acknowledged.
 *
 * Transitions excursion status from "active" to "acknowledged" and records
 * who acknowledged it and when.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AcknowledgeExcursionPayload {
  id: string;
  notes?: string;
}

export const ACKNOWLEDGE_EXCURSION = 'cold_chain_excursion.acknowledge';

export class AcknowledgeExcursionCommandHandler extends BaseCommandHandler<AcknowledgeExcursionPayload, { id: string }> {
  readonly commandType = ACKNOWLEDGE_EXCURSION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AcknowledgeExcursionPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, notes } = command.payload;

    const excursion = await tx.coldChainExcursion.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedBy: command.actorId,
        acknowledgedAt: new Date(),
        ...(notes !== undefined && { notes }),
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.COLD_CHAIN_EXCURSION_ACKNOWLEDGED,
      entityType: 'cold_chain_excursion',
      entityId: id,
      payload: {
        shipmentId: excursion.shipmentId,
        excursionType: excursion.excursionType,
        severity: excursion.severity,
        acknowledgedBy: command.actorId,
      },
    }));

    return { id };
  }
}
