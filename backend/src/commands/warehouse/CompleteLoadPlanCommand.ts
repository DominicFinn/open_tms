import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompleteLoadPlanPayload {
  loadPlanId: string;
  sealNumber?: string | null;
  /** Ask the transport side to generate a BOL once the load is complete. Default true. */
  generateBol?: boolean;
}

export const COMPLETE_LOAD_PLAN = 'load_plan.complete';

export class CompleteLoadPlanCommandHandler extends BaseCommandHandler<
  CompleteLoadPlanPayload,
  { id: string; status: string; sealNumber: string | null; loadedUnits: number; bolRequested: boolean }
> {
  readonly commandType = COMPLETE_LOAD_PLAN;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompleteLoadPlanPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; sealNumber: string | null; loadedUnits: number; bolRequested: boolean }> {
    const p = command.payload;

    const plan = await tx.loadPlan.findUnique({
      where: { id: p.loadPlanId },
      include: { lines: true },
    });
    if (!plan) throw new Error(`Load plan ${p.loadPlanId} not found`);
    if (plan.status === 'completed') throw new Error('Load plan is already completed');
    if (plan.status === 'cancelled') throw new Error('Load plan is cancelled');

    // Mark all pending lines as loaded
    await tx.loadPlanLine.updateMany({
      where: { loadPlanId: plan.id, status: 'pending' },
      data: { status: 'loaded' },
    });

    const loadedLines = plan.lines.filter(l => l.status !== 'skipped');

    // Update staging assignments to 'loaded'
    const assignmentIds = loadedLines.map(l => l.stagingAssignmentId).filter(Boolean) as string[];
    if (assignmentIds.length > 0) {
      await tx.stagingAssignment.updateMany({
        where: { id: { in: assignmentIds } },
        data: { status: 'loaded', shipmentId: plan.shipmentId ?? undefined },
      });
    }

    // Clear unit locations (they're on the vehicle now)
    const unitIds = loadedLines.map(l => l.trackableUnitId).filter(Boolean) as string[];
    if (unitIds.length > 0) {
      await tx.trackableUnit.updateMany({
        where: { id: { in: unitIds } },
        data: { currentBinId: null, currentZoneId: null },
      });
    }

    // Complete the load plan
    await tx.loadPlan.update({
      where: { id: plan.id },
      data: {
        status: 'completed',
        sealNumber: p.sealNumber ?? plan.sealNumber,
        loadedUnits: loadedLines.length,
        completedAt: new Date(),
      },
    });

    // Sealing a trailer is a warehouse act; the Bill of Lading is a transport document. The
    // warehouse says a BOL was asked for and stops there. A TMS subscriber generates it and
    // emits load_plan.bol_generated. A standalone FinnWMS has no subscriber, produces no BOL,
    // and completes the load perfectly happily.
    const bolRequested = (p.generateBol ?? true) && plan.shipmentId !== null;

    emit(this.createEvent(command, {
      type: EVENT_TYPES.LOAD_PLAN_COMPLETED,
      entityType: 'load_plan',
      entityId: plan.id,
      payload: {
        shipmentId: plan.shipmentId,
        loadedUnits: loadedLines.length,
        sealNumber: p.sealNumber ?? plan.sealNumber,
        dockBinId: plan.dockBinId,
        carrierId: plan.carrierId,
        trailerNumber: plan.trailerNumber,
        bolRequested,
      },
    }));

    return {
      id: plan.id,
      status: 'completed',
      sealNumber: p.sealNumber ?? plan.sealNumber,
      loadedUnits: loadedLines.length,
      bolRequested,
    };
  }
}
