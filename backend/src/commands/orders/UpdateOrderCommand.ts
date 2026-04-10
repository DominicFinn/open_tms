import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateOrderPayload {
  id: string;
  data: {
    orderNumber?: string;
    poNumber?: string;
    status?: string;
    originId?: string;
    destinationId?: string;
    requestedPickupDate?: Date;
    requestedDeliveryDate?: Date;
    serviceLevel?: string;
    temperatureControl?: string;
    requiresHazmat?: boolean;
    specialRequirements?: string[];
    deliveryStatus?: string;
    deliveredAt?: Date;
    deliveryConfirmedBy?: string;
    deliveryMethod?: string;
    deliveryNotes?: string;
    exceptionType?: string;
    exceptionNotes?: string;
    exceptionResolvedAt?: Date;
    specialInstructions?: string;
    notes?: string;
  };
}

export const UPDATE_ORDER = 'order.update';

export class UpdateOrderCommandHandler extends BaseCommandHandler<UpdateOrderPayload, { id: string }> {
  readonly commandType = UPDATE_ORDER;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateOrderPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, data } = command.payload;

    const previous = await tx.order.findUniqueOrThrow({ where: { id } });
    const updated = await tx.order.update({ where: { id }, data });

    // Build changes object for the event payload
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (previous as any)[key] !== value) {
        changes[key] = { before: (previous as any)[key], after: value };
      }
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.ORDER_UPDATED,
      entityType: 'order',
      entityId: id,
      payload: { orderReference: updated.orderNumber, changes },
    }));

    // If status specifically changed, emit a dedicated status event too
    if (data.status && data.status !== previous.status) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.ORDER_STATUS_CHANGED,
        entityType: 'order',
        entityId: id,
        payload: {
          orderReference: updated.orderNumber,
          previousStatus: previous.status,
          newStatus: data.status,
        },
      }));
    }

    return { id };
  }
}
