import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CompleteLoadPlanPayload {
  loadPlanId: string;
  sealNumber?: string | null;
  /** Auto-generate BOL on completion */
  generateBol?: boolean;
}

export const COMPLETE_LOAD_PLAN = 'load_plan.complete';

export class CompleteLoadPlanCommandHandler extends BaseCommandHandler<
  CompleteLoadPlanPayload,
  { id: string; status: string; sealNumber: string | null; loadedUnits: number; bolGenerated: boolean }
> {
  readonly commandType = COMPLETE_LOAD_PLAN;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CompleteLoadPlanPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; status: string; sealNumber: string | null; loadedUnits: number; bolGenerated: boolean }> {
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
      },
    }));

    // BOL generation - emit event that triggers async generation
    // The actual PDF generation would be handled by an event handler
    // that calls DocumentGenerationService.generateBOL()
    let bolGenerated = false;
    if ((p.generateBol ?? true) && plan.shipmentId) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.LOAD_PLAN_BOL_GENERATED,
        entityType: 'load_plan',
        entityId: plan.id,
        payload: {
          shipmentId: plan.shipmentId,
          loadPlanId: plan.id,
          sealNumber: p.sealNumber ?? plan.sealNumber,
          trailerNumber: plan.trailerNumber,
        },
      }));
      bolGenerated = true;
    }

    return {
      id: plan.id,
      status: 'completed',
      sealNumber: p.sealNumber ?? plan.sealNumber,
      loadedUnits: loadedLines.length,
      bolGenerated,
    };
  }
}
