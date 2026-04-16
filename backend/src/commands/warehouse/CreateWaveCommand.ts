import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateWavePayload {
  locationId: string;
  templateId?: string | null;
  pickStrategy: string;         // discrete, batch, zone
  orderIds: string[];           // orders to include
  cutoffAt?: string | null;
}

export const CREATE_WAVE = 'wave.create';

export class CreateWaveCommandHandler extends BaseCommandHandler<
  CreateWavePayload,
  { id: string; waveNumber: string; orderCount: number; status: string }
> {
  readonly commandType = CREATE_WAVE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateWavePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; waveNumber: string; orderCount: number; status: string }> {
    const p = command.payload;

    if (p.orderIds.length === 0) throw new Error('Wave must contain at least one order');

    // Generate wave number
    const today = new Date().toISOString().slice(0, 10);
    const existing = await tx.wave.count({
      where: { orgId: command.orgId, waveNumber: { startsWith: `W-${today}` } },
    });
    const waveNumber = `W-${today}-${String(existing + 1).padStart(3, '0')}`;

    // Count total line items across orders
    const lineCount = await tx.orderLineItem.count({
      where: { order: { id: { in: p.orderIds } } },
    });

    const wave = await tx.wave.create({
      data: {
        locationId: p.locationId,
        templateId: p.templateId ?? null,
        waveNumber,
        status: 'planning',
        pickStrategy: p.pickStrategy,
        orderCount: p.orderIds.length,
        lineCount,
        cutoffAt: p.cutoffAt ? new Date(p.cutoffAt) : null,
        orgId: command.orgId,
      },
    });

    // Link orders to wave
    await tx.waveOrder.createMany({
      data: p.orderIds.map((orderId, i) => ({
        waveId: wave.id,
        orderId,
        priority: i,
      })),
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAVE_CREATED,
      entityType: 'wave',
      entityId: wave.id,
      payload: {
        waveNumber,
        locationId: p.locationId,
        pickStrategy: p.pickStrategy,
        orderCount: p.orderIds.length,
        lineCount,
      },
    }));

    return { id: wave.id, waveNumber, orderCount: p.orderIds.length, status: 'planning' };
  }
}
