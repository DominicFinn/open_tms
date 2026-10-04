/**
 * ConsolidationProgressHandler (#329) — keeps a consolidation in step with its shipments.
 *
 * Pings on a consolidation's device are applied to each of its shipments, so stop arrivals,
 * completions and status changes happen on the shipments. Each of those re-syncs the run's stop
 * statuses and status through SYNC_CONSOLIDATION_PROGRESS.
 */

import crypto from 'crypto';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { SYNC_CONSOLIDATION_PROGRESS } from '../../commands/consolidations/SyncConsolidationProgressCommand.js';
import { IConsolidationRepository } from '../../repositories/ConsolidationRepository.js';

export class ConsolidationProgressHandler implements IEventHandler {
  readonly name = 'handler.consolidation_progress';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_STOP_ARRIVED,
    EVENT_TYPES.SHIPMENT_STOP_COMPLETED,
    EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
  ];
  // One at a time: two shipments on a run finishing together would otherwise race on its row.
  readonly options: SubscribeOptions = { concurrency: 1, retryLimit: 3, expireInSeconds: 60 };

  constructor(
    private consolidations: IConsolidationRepository,
    private commandBus: ICommandBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload as { shipmentId?: string };
    const shipmentId = payload?.shipmentId ?? (event.entityType === 'shipment' ? event.entityId : undefined);
    if (!shipmentId) return;

    const consolidationId = await this.consolidations.consolidationIdForShipment(event.orgId, shipmentId);
    if (!consolidationId) return;

    const result = await this.commandBus.dispatch({
      type: SYNC_CONSOLIDATION_PROGRESS,
      orgId: event.orgId,
      actorId: null,
      payload: { id: consolidationId },
      metadata: { correlationId: event.metadata?.correlationId ?? crypto.randomUUID(), source: 'consolidation-progress-handler' },
    });
    if (!result.success) {
      console.error('[ConsolidationProgressHandler] Sync failed', { consolidationId, orgId: event.orgId, error: result.error });
    }
  }
}
