/**
 * SetDispositionCommand — sets or changes the cold chain disposition on a shipment.
 *
 * Tracks the previous disposition so consumers can react to transitions
 * (e.g., pending_review -> released).
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface SetDispositionPayload {
  shipmentId: string;
  disposition: 'released' | 'quarantined' | 'pending_review';
  notes?: string;
}

export const SET_DISPOSITION = 'cold_chain.set_disposition';

export class SetDispositionCommandHandler extends BaseCommandHandler<SetDispositionPayload, { shipmentId: string }> {
  readonly commandType = SET_DISPOSITION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<SetDispositionPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ shipmentId: string }> {
    const { shipmentId, disposition, notes } = command.payload;

    const previous = await tx.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
      select: { coldChainDisposition: true, reference: true },
    });

    await tx.shipment.update({
      where: { id: shipmentId },
      data: {
        coldChainDisposition: disposition,
        dispositionSetBy: command.actorId,
        dispositionSetAt: new Date(),
        dispositionNotes: notes ?? null,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.COLD_CHAIN_DISPOSITION_CHANGED,
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        shipmentId,
        shipmentReference: previous.reference,
        previousDisposition: previous.coldChainDisposition,
        newDisposition: disposition,
        setBy: command.actorId,
      },
    }));

    return { shipmentId };
  }
}
