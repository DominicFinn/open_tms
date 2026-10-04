import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';
import { ConsolidationRuleError } from './consolidationMembership.js';

export interface TransitionConsolidationStatusPayload {
  id: string;
  to: 'draft' | 'ready';
}

export const TRANSITION_CONSOLIDATION_STATUS = 'consolidation.transition_status';

/** Why the run can't move to `to`, or null when it can. */
export function transitionProblem(from: string, to: string, shipments: Array<{ reference: string; status: string }>): string | null {
  if (from === to) return null;
  if (to === 'ready') {
    // BUSINESS RULE: a run is ready only when there is something to carry and every shipment on
    // it has passed its own readiness gate, so tracking can start on all of them together.
    if (from !== 'draft') return 'Only a draft consolidation can be marked ready.';
    if (shipments.length === 0) return 'Add shipments before marking the consolidation ready.';
    const notReady = shipments.filter((s) => s.status !== 'ready').map((s) => s.reference);
    if (notReady.length > 0) return `Every shipment must be ready first: ${notReady.join(', ')}.`;
    return null;
  }
  if (from !== 'ready') return 'Only a ready consolidation can go back to draft.';
  return null;
}

export class TransitionConsolidationStatusCommandHandler extends BaseCommandHandler<TransitionConsolidationStatusPayload, { status: string }> {
  readonly commandType = TRANSITION_CONSOLIDATION_STATUS;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<TransitionConsolidationStatusPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ status: string }> {
    const { orgId } = command;
    const { id, to } = command.payload;

    const run = await tx.consolidation.findFirst({
      where: { id, orgId, archived: false },
      select: { status: true, shipments: { select: { shipment: { select: { reference: true, status: true } } } } },
    });
    if (!run) throw new Error('Consolidation not found');

    const problem = transitionProblem(run.status, to, run.shipments.map((m) => m.shipment));
    if (problem) throw new ConsolidationRuleError(problem);
    if (run.status === to) return { status: to };

    await tx.consolidation.update({ where: { id, orgId }, data: { status: to } });
    emit(this.createEvent(command, {
      type: EVENT_TYPES.CONSOLIDATION_STATUS_CHANGED,
      entityType: 'consolidation',
      entityId: id,
      payload: { from: run.status, to, automatic: false },
    }));
    return { status: to };
  }
}
