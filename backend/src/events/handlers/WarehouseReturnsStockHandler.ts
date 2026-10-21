/**
 * WarehouseReturnsStockHandler (WMS): puts a completed RMA's restock lines back into stock (#359).
 *
 * Dispatches RECEIVE_RETURNED_STOCK with an idempotency key per RMA line, so a redelivered
 * `rma.restock_requested` never adds the stock twice. A failed dispatch throws, and the queue
 * retries and then dead-letters it.
 */

import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { RECEIVE_RETURNED_STOCK } from '../../commands/inventory/ReceiveReturnedStockCommand.js';

interface RestockRequestedPayload {
  rmaId: string;
  rmaLineId: string;
  sku: string;
  quantity: number;
  binId: string;
  unitId: string | null;
}

export class WarehouseReturnsStockHandler implements IEventHandler {
  readonly name = 'handler.warehouse_returns_stock';
  readonly eventPatterns = [EVENT_TYPES.RMA_RESTOCK_REQUESTED];
  readonly options: SubscribeOptions = { concurrency: 3, priority: 10, retryLimit: 5 };

  constructor(private commandBus: ICommandBus) {}

  async handle(event: DomainEvent): Promise<void> {
    const p = event.payload as RestockRequestedPayload;
    if (!p?.rmaLineId || !p.binId || !p.sku || !(p.quantity > 0)) return;

    const key = `rma-restock:${p.rmaLineId}`;
    const result = await this.commandBus.dispatch({
      type: RECEIVE_RETURNED_STOCK,
      orgId: event.orgId,
      actorId: event.actorId,
      payload: {
        binId: p.binId,
        sku: p.sku,
        quantity: p.quantity,
        rmaId: p.rmaId,
        rmaLineId: p.rmaLineId,
        handlingUnitId: p.unitId,
      },
      metadata: { correlationId: key, idempotencyKey: key, source: 'event' },
    });

    if (!result.success) throw new Error(`Restocking RMA line ${p.rmaLineId} failed: ${result.error}`);
  }
}
