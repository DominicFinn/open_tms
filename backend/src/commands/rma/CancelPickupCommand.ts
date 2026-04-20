import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import type { IReturnLabelProviderRegistry } from '../../services/returnLabel/IReturnLabelProvider.js';

export interface CancelPickupPayload {
  rmaId: string;
  reason?: string;
}

export const CANCEL_RMA_PICKUP = 'rma.cancel_pickup';

export class CancelPickupCommandHandler extends BaseCommandHandler<
  CancelPickupPayload,
  { rmaId: string; cancelledAt: Date }
> {
  readonly commandType = CANCEL_RMA_PICKUP;

  constructor(
    prisma: PrismaClient,
    eventBus: PgBossEventBus,
    private providerRegistry: IReturnLabelProviderRegistry,
  ) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CancelPickupPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ) {
    const p = command.payload;
    const rma = await tx.rma.findUnique({ where: { id: p.rmaId } });
    if (!rma) throw new Error(`RMA ${p.rmaId} not found`);
    if (!rma.returnPickupConfirmationNumber) {
      throw new Error('No pickup scheduled to cancel');
    }
    if (rma.returnPickupCancelledAt) {
      throw new Error('Pickup is already cancelled');
    }

    const providerName = rma.returnLabelProvider ?? 'manual';
    const provider = this.providerRegistry.get(providerName);

    let carrierAccountNumber: string | undefined;
    if (rma.returnCarrierId) {
      const carrier = await tx.carrier.findUnique({ where: { id: rma.returnCarrierId } });
      carrierAccountNumber = carrier?.returnLabelAccountNumber ?? undefined;
    }

    await provider.cancelPickup({
      confirmationNumber: rma.returnPickupConfirmationNumber,
      carrierAccountNumber,
      reason: p.reason,
    });

    const cancelledAt = new Date();
    await tx.rma.update({
      where: { id: rma.id },
      data: {
        returnPickupCancelledAt: cancelledAt,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_PICKUP_CANCELLED,
      entityType: 'rma',
      entityId: rma.id,
      payload: {
        rmaNumber: rma.rmaNumber,
        customerId: rma.customerId,
        provider: providerName,
        confirmationNumber: rma.returnPickupConfirmationNumber,
        cancelledAt: cancelledAt.toISOString(),
        reason: p.reason,
      },
    }));

    return { rmaId: rma.id, cancelledAt };
  }
}
