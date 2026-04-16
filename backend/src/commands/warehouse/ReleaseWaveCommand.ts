import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface ReleaseWavePayload {
  waveId: string;
}

export const RELEASE_WAVE = 'wave.release';

/**
 * Releasing a wave:
 * 1. Hard-allocates inventory for each order line item
 * 2. Creates PickTask(s) with PickLines ordered by walk sequence
 * 3. For discrete: one PickTask per order
 * 4. For batch: one PickTask for the entire wave (lines from all orders)
 */
export class ReleaseWaveCommandHandler extends BaseCommandHandler<
  ReleaseWavePayload,
  { waveId: string; status: string; pickTasksCreated: number; allocationFailures: string[] }
> {
  readonly commandType = RELEASE_WAVE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<ReleaseWavePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ waveId: string; status: string; pickTasksCreated: number; allocationFailures: string[] }> {
    const wave = await tx.wave.findUnique({
      where: { id: command.payload.waveId },
      include: { waveOrders: { orderBy: { priority: 'asc' } } },
    });
    if (!wave) throw new Error(`Wave ${command.payload.waveId} not found`);
    if (wave.status !== 'planning') throw new Error(`Wave is ${wave.status}, can only release from planning`);

    const orderIds = wave.waveOrders.map(wo => wo.orderId);

    // Load all order line items for the wave's orders
    const orderLines = await tx.orderLineItem.findMany({
      where: { order: { id: { in: orderIds } } },
      include: { order: { select: { id: true } } },
    });

    // Allocate inventory for each line item
    const allocationFailures: string[] = [];
    const allocatedLines: Array<{
      orderLineItem: typeof orderLines[0];
      inventoryRecordId: string;
      binId: string;
      walkSequence: number;
      quantity: number;
      sku: string;
      lotNumber: string | null;
    }> = [];

    for (const line of orderLines) {
      // Find available inventory for this SKU at this location
      const inventory = await tx.inventoryRecord.findMany({
        where: {
          locationId: wave.locationId,
          sku: line.sku,
          quantityAvailable: { gt: 0 },
        },
        include: { bin: { select: { id: true, walkSequence: true } } },
        orderBy: { createdAt: 'asc' }, // FIFO default
      });

      let remaining = line.quantity;
      for (const inv of inventory) {
        if (remaining <= 0) break;
        const allocQty = Math.min(remaining, inv.quantityAvailable);

        // Hard-allocate
        await tx.inventoryRecord.update({
          where: { id: inv.id },
          data: {
            quantityAllocated: { increment: allocQty },
            quantityAvailable: { decrement: allocQty },
          },
        });

        await tx.allocation.create({
          data: {
            orderLineItemId: line.id,
            inventoryRecordId: inv.id,
            quantity: allocQty,
            uomCode: inv.uomCode,
            state: 'hard',
            lotNumber: inv.lotNumber,
            orgId: command.orgId,
          },
        });

        allocatedLines.push({
          orderLineItem: line,
          inventoryRecordId: inv.id,
          binId: inv.bin.id,
          walkSequence: inv.bin.walkSequence,
          quantity: allocQty,
          sku: line.sku,
          lotNumber: inv.lotNumber,
        });

        remaining -= allocQty;
      }

      if (remaining > 0) {
        allocationFailures.push(`${line.sku}: short ${remaining} of ${line.quantity}`);
      }
    }

    // Create pick tasks based on strategy
    let pickTasksCreated = 0;

    if (wave.pickStrategy === 'discrete') {
      // One pick task per order
      const byOrder = new Map<string, typeof allocatedLines>();
      for (const al of allocatedLines) {
        const orderId = al.orderLineItem.order.id;
        if (!byOrder.has(orderId)) byOrder.set(orderId, []);
        byOrder.get(orderId)!.push(al);
      }

      for (const [orderId, lines] of byOrder) {
        const sorted = lines.sort((a, b) => a.walkSequence - b.walkSequence);
        const pickTask = await tx.pickTask.create({
          data: {
            locationId: wave.locationId,
            waveId: wave.id,
            orderId,
            status: 'pending',
            pickType: 'discrete',
            totalLines: sorted.length,
            completedLines: 0,
            orgId: command.orgId,
          },
        });

        await tx.pickLine.createMany({
          data: sorted.map((al, i) => ({
            pickTaskId: pickTask.id,
            orderId,
            orderLineItemId: al.orderLineItem.id,
            inventoryRecordId: al.inventoryRecordId,
            binId: al.binId,
            sku: al.sku,
            uomCode: 'EA',
            requestedQuantity: al.quantity,
            pickedQuantity: 0,
            status: 'pending',
            walkSequence: al.walkSequence,
            lotNumber: al.lotNumber,
          })),
        });

        emit(this.createEvent(command, {
          type: EVENT_TYPES.PICK_TASK_CREATED,
          entityType: 'pick_task',
          entityId: pickTask.id,
          payload: { waveId: wave.id, orderId, pickType: 'discrete', lineCount: sorted.length },
        }));

        pickTasksCreated++;
      }
    } else {
      // Batch: one pick task for all lines, sorted by walk sequence
      const sorted = allocatedLines.sort((a, b) => a.walkSequence - b.walkSequence);
      if (sorted.length > 0) {
        const pickTask = await tx.pickTask.create({
          data: {
            locationId: wave.locationId,
            waveId: wave.id,
            status: 'pending',
            pickType: 'batch',
            totalLines: sorted.length,
            completedLines: 0,
            orgId: command.orgId,
          },
        });

        await tx.pickLine.createMany({
          data: sorted.map(al => ({
            pickTaskId: pickTask.id,
            orderId: al.orderLineItem.order.id,
            orderLineItemId: al.orderLineItem.id,
            inventoryRecordId: al.inventoryRecordId,
            binId: al.binId,
            sku: al.sku,
            uomCode: 'EA',
            requestedQuantity: al.quantity,
            pickedQuantity: 0,
            status: 'pending',
            walkSequence: al.walkSequence,
            lotNumber: al.lotNumber,
          })),
        });

        emit(this.createEvent(command, {
          type: EVENT_TYPES.PICK_TASK_CREATED,
          entityType: 'pick_task',
          entityId: pickTask.id,
          payload: { waveId: wave.id, pickType: 'batch', lineCount: sorted.length },
        }));

        pickTasksCreated++;
      }
    }

    // Update wave status
    await tx.wave.update({
      where: { id: wave.id },
      data: { status: allocationFailures.length > 0 ? 'released' : 'released' },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.WAVE_RELEASED,
      entityType: 'wave',
      entityId: wave.id,
      payload: {
        waveNumber: wave.waveNumber,
        pickTasksCreated,
        allocationFailures: allocationFailures.length,
        totalLines: allocatedLines.length,
      },
    }));

    return {
      waveId: wave.id,
      status: 'released',
      pickTasksCreated,
      allocationFailures,
    };
  }
}
