import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateLoadPlanPayload {
  locationId: string;
  shipmentId?: string | null;
  dockBinId?: string | null;
  carrierId?: string | null;
  trailerNumber?: string | null;
  /** Staging assignment IDs to include in the load plan */
  stagingAssignmentIds: string[];
}

export const CREATE_LOAD_PLAN = 'load_plan.create';

export class CreateLoadPlanCommandHandler extends BaseCommandHandler<
  CreateLoadPlanPayload,
  { id: string; totalUnits: number; status: string }
> {
  readonly commandType = CREATE_LOAD_PLAN;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateLoadPlanPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; totalUnits: number; status: string }> {
    const p = command.payload;

    if (p.stagingAssignmentIds.length === 0) throw new Error('Load plan must include at least one staged unit');

    // Load staging assignments with order info
    const assignments = await tx.stagingAssignment.findMany({
      where: { id: { in: p.stagingAssignmentIds } },
      include: { trackableUnit: { select: { id: true, identifier: true } } },
    });

    if (assignments.length !== p.stagingAssignmentIds.length) {
      throw new Error(`Some staging assignments not found (expected ${p.stagingAssignmentIds.length}, found ${assignments.length})`);
    }

    // Build reverse load sequence based on shipment stop order
    // For now: group by orderId and assign sequence (lower = load first = back of truck)
    // In future: look up shipment stops and order by stop sequence descending
    const orderIds = [...new Set(assignments.map(a => a.orderId))];

    // If shipment has stops, use stop sequence for reverse ordering
    let orderSequence: Map<string, number>;
    if (p.shipmentId) {
      const stops = await tx.shipmentStop.findMany({
        where: { shipmentId: p.shipmentId },
        orderBy: { sequenceNumber: 'desc' }, // Reverse: last stop = lowest sequence number = load first
      });
      // Map orders to their stop sequence
      // For now, just assign by order position since we don't have direct order-to-stop mapping
      orderSequence = new Map(orderIds.map((id, i) => [id, i]));
    } else {
      orderSequence = new Map(orderIds.map((id, i) => [id, i]));
    }

    const loadPlan = await tx.loadPlan.create({
      data: {
        locationId: p.locationId,
        shipmentId: p.shipmentId ?? null,
        dockBinId: p.dockBinId ?? null,
        carrierId: p.carrierId ?? null,
        trailerNumber: p.trailerNumber ?? null,
        status: 'planning',
        totalUnits: assignments.length,
        loadedUnits: 0,
        orgId: command.orgId,
      },
    });

    // Create load plan lines with reverse load sequence
    await tx.loadPlanLine.createMany({
      data: assignments.map(a => ({
        loadPlanId: loadPlan.id,
        stagingAssignmentId: a.id,
        trackableUnitId: a.trackableUnitId,
        orderId: a.orderId,
        loadSequence: orderSequence.get(a.orderId) ?? 0,
        status: 'pending',
      })),
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LOAD_PLAN_CREATED,
      entityType: 'load_plan',
      entityId: loadPlan.id,
      payload: {
        locationId: p.locationId,
        shipmentId: p.shipmentId,
        totalUnits: assignments.length,
        orderCount: orderIds.length,
      },
    }));

    return { id: loadPlan.id, totalUnits: assignments.length, status: 'planning' };
  }
}
