import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateTenderPayload {
  shipmentId: string;
  strategy: 'broadcast' | 'waterfall';
  carrierIds: string[];
  tenderDurationMinutes?: number;
  targetRate?: number;
  currency?: string;
  notes?: string;
}

export const CREATE_TENDER = 'tender.create';

export class CreateTenderCommandHandler extends BaseCommandHandler<CreateTenderPayload, { id: string }> {
  readonly commandType = CREATE_TENDER;
  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) { super(prisma, eventBus); }

  protected async handle(command: Command<CreateTenderPayload>, tx: TransactionClient, emit: EmitFn) {
    const reference = `TND-${Date.now()}`;
    const tender = await tx.tender.create({
      data: {
        reference,
        shipmentId: command.payload.shipmentId,
        strategy: command.payload.strategy,
        tenderDurationMinutes: command.payload.tenderDurationMinutes ?? 60,
        targetRate: command.payload.targetRate,
        currency: command.payload.currency ?? 'USD',
        notes: command.payload.notes,
        status: 'draft',
        offers: {
          create: command.payload.carrierIds.map((carrierId, i) => ({
            carrierId,
            status: 'pending',
            waterfallSequence: command.payload.strategy === 'waterfall' ? i + 1 : null,
          })),
        },
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.TENDER_CREATED,
      entityType: 'tender',
      entityId: tender.id,
      payload: {
        shipmentId: command.payload.shipmentId,
        strategy: command.payload.strategy,
        carrierCount: command.payload.carrierIds.length,
      },
    }));

    return { id: tender.id };
  }
}
