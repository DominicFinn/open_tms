import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface RejectRmaPayload {
  rmaId: string;
  rejectionNotes: string;
}

export const REJECT_RMA = 'rma.reject';

export class RejectRmaCommandHandler extends BaseCommandHandler<
  RejectRmaPayload,
  { id: string; status: string }
> {
  readonly commandType = REJECT_RMA;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<RejectRmaPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string }> {
    const rma = await tx.rma.findUnique({ where: { id: command.payload.rmaId } });
    if (!rma) throw new Error(`RMA ${command.payload.rmaId} not found`);
    if (rma.status === 'completed') throw new Error('Cannot reject a completed RMA');
    if (rma.status === 'rejected') throw new Error('RMA is already rejected');

    await tx.rma.update({
      where: { id: rma.id },
      data: { status: 'rejected', rejectionNotes: command.payload.rejectionNotes },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_REJECTED,
      entityType: 'rma',
      entityId: rma.id,
      payload: {
        rmaNumber: rma.rmaNumber,
        customerId: rma.customerId,
        rejectionNotes: command.payload.rejectionNotes,
      },
    }));

    return { id: rma.id, status: 'rejected' };
  }
}
