/**
 * HandlingUnitReturnsHandler: applies a returned unit's move to the warehouse's HandlingUnit (#357).
 *
 * Returns are TMS, but where a unit sits and its quality are warehouse state, so the RMA commands
 * announce the move with `rma.unit_moved` and this handler dispatches MOVE_HANDLING_UNIT. A unit
 * the projection hasn't created yet fails the command, and the queue retries it.
 */

import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { MOVE_HANDLING_UNIT } from '../../commands/warehouse/MoveHandlingUnitCommand.js';

interface RmaUnitMovedPayload {
  rmaId: string;
  unitId: string | null;
  binId: string | null;
  qualityStatus?: string;
}

export class HandlingUnitReturnsHandler implements IEventHandler {
  readonly name = 'handler.handling_unit_returns';
  readonly eventPatterns = [EVENT_TYPES.RMA_UNIT_MOVED];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 10,
    retryLimit: 5,
  };

  constructor(private commandBus: ICommandBus) {}

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as RmaUnitMovedPayload;
    if (!payload?.unitId || !payload.binId) return;

    const result = await this.commandBus.dispatch({
      type: MOVE_HANDLING_UNIT,
      orgId: event.orgId,
      actorId: event.actorId,
      payload: {
        handlingUnitId: payload.unitId,
        binId: payload.binId,
        qualityStatus: payload.qualityStatus,
        reason: 'rma',
        referenceId: payload.rmaId,
      },
      metadata: { correlationId: event.metadata.correlationId, source: 'event' },
    });

    // Throwing hands the event back to the queue, which retries and then dead-letters it.
    if (!result.success) throw new Error(`Moving handling unit for RMA ${payload.rmaId} failed: ${result.error}`);
  }
}
