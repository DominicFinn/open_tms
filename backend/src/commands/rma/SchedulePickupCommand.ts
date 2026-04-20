import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import type {
  IReturnLabelProviderRegistry,
  ReturnLabelAddress,
} from '../../services/returnLabel/IReturnLabelProvider.js';

export interface SchedulePickupPayload {
  rmaId: string;
  pickupDate: string | Date;
  pickupWindow?: string;
  address: ReturnLabelAddress;
  notes?: string;
  providerOverride?: string;
  pickupAddressId?: string;
}

export const SCHEDULE_RMA_PICKUP = 'rma.schedule_pickup';

export class SchedulePickupCommandHandler extends BaseCommandHandler<
  SchedulePickupPayload,
  { rmaId: string; confirmationNumber: string; scheduledFor: Date }
> {
  readonly commandType = SCHEDULE_RMA_PICKUP;

  constructor(
    prisma: PrismaClient,
    eventBus: PgBossEventBus,
    private providerRegistry: IReturnLabelProviderRegistry,
  ) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<SchedulePickupPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ) {
    const p = command.payload;
    const rma = await tx.rma.findUnique({ where: { id: p.rmaId } });
    if (!rma) throw new Error(`RMA ${p.rmaId} not found`);
    if (!rma.returnTrackingNumber) {
      throw new Error('Cannot schedule pickup without a return tracking number - generate the label first');
    }
    if (rma.returnPickupScheduledAt && !rma.returnPickupCancelledAt) {
      throw new Error('Return pickup is already scheduled; cancel it before rescheduling');
    }

    const providerName = p.providerOverride ?? rma.returnLabelProvider ?? 'manual';
    const provider = this.providerRegistry.get(providerName);

    let carrierAccountNumber: string | undefined;
    if (rma.returnCarrierId) {
      const carrier = await tx.carrier.findUnique({ where: { id: rma.returnCarrierId } });
      carrierAccountNumber = carrier?.returnLabelAccountNumber ?? undefined;
    }

    const pickupDate = typeof p.pickupDate === 'string' ? new Date(p.pickupDate) : p.pickupDate;

    const result = await provider.schedulePickup({
      rmaId: rma.id,
      rmaNumber: rma.rmaNumber,
      trackingNumber: rma.returnTrackingNumber,
      pickupDate,
      pickupWindow: p.pickupWindow,
      address: p.address,
      carrierAccountNumber,
      notes: p.notes,
    });

    await tx.rma.update({
      where: { id: rma.id },
      data: {
        returnPickupScheduledAt: result.scheduledFor,
        returnPickupWindow: result.window ?? p.pickupWindow ?? null,
        returnPickupConfirmationNumber: result.confirmationNumber,
        returnPickupAddressId: p.pickupAddressId ?? null,
        returnPickupCancelledAt: null,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.RMA_PICKUP_SCHEDULED,
      entityType: 'rma',
      entityId: rma.id,
      payload: {
        rmaNumber: rma.rmaNumber,
        customerId: rma.customerId,
        provider: providerName,
        trackingNumber: rma.returnTrackingNumber,
        confirmationNumber: result.confirmationNumber,
        scheduledFor: result.scheduledFor.toISOString(),
        window: result.window ?? p.pickupWindow ?? null,
      },
    }));

    return {
      rmaId: rma.id,
      confirmationNumber: result.confirmationNumber,
      scheduledFor: result.scheduledFor,
    };
  }
}
