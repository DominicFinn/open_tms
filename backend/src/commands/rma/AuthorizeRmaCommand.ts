import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface AuthorizeRmaPayload {
  rmaId: string;
}

export const AUTHORIZE_RMA = 'rma.authorize';

export class AuthorizeRmaCommandHandler extends BaseCommandHandler<
  AuthorizeRmaPayload,
  { id: string; rmaNumber: string; status: string }
> {
  readonly commandType = AUTHORIZE_RMA;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<AuthorizeRmaPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; rmaNumber: string; status: string }> {
    const rma = await tx.rma.findUnique({ where: { id: command.payload.rmaId } });
    if (!rma) throw new Error(`RMA ${command.payload.rmaId} not found`);
    if (rma.status !== 'requested') {
      throw new Error(`Cannot authorize RMA in status ${rma.status}`);
    }

    const updated = await tx.rma.update({
      where: { id: rma.id },
      data: { status: 'authorized', authorizedAt: new Date() },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_AUTHORIZED,
      entityType: 'rma',
      entityId: rma.id,
      payload: { rmaNumber: rma.rmaNumber, customerId: rma.customerId, orderId: rma.orderId },
    }));

    return { id: updated.id, rmaNumber: updated.rmaNumber, status: updated.status };
  }
}
