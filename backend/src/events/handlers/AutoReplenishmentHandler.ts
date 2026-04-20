/**
 * AutoReplenishmentHandler
 *
 * Listens to events that change pick-face inventory (pick line completion,
 * inventory adjustments) and dispatches CHECK_REPLENISHMENT for the affected
 * location + SKU. The check command looks up active ReplenishmentRules and
 * creates replenishment putaway tasks as needed.
 *
 * Benefits over the manual sweep:
 *  - Fires immediately after a pick so the bin refills before the next wave hits it
 *  - Scoped to one SKU per event (fast, avoids scanning every rule per cycle)
 *
 * The CHECK_REPLENISHMENT command itself already dedupes - it won't create
 * duplicate tasks for a bin+sku that already has a pending replenishment.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { CHECK_REPLENISHMENT } from '../../commands/warehouse/CheckReplenishmentCommand.js';
import crypto from 'crypto';

export class AutoReplenishmentHandler implements IEventHandler {
  readonly name = 'handler.auto_replenishment';
  readonly eventPatterns = [
    'pick_line.completed',
    'inventory.adjusted',
  ];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 15,
  };

  constructor(
    private prisma: PrismaClient,
    private commandBus: ICommandBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      const payload = event.payload as Record<string, unknown>;
      const sku = payload?.sku as string | undefined;
      if (!sku) return;

      const locationId = await this.resolveLocationId(event);
      if (!locationId) return;

      await this.commandBus.dispatch({
        type: CHECK_REPLENISHMENT,
        orgId: event.orgId,
        actorId: 'auto-replenishment',
        payload: { locationId, sku },
        metadata: { correlationId: crypto.randomUUID(), source: 'auto-replenishment-handler' },
      });
    } catch (err) {
      console.error('[AutoReplenishmentHandler] Failed:', (err as Error).message);
    }
  }

  /**
   * Resolve the locationId for the event. inventory.adjusted carries it directly;
   * pick_line.completed carries pickTaskId so we walk PickTask → locationId.
   */
  private async resolveLocationId(event: DomainEvent): Promise<string | null> {
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.locationId === 'string') return payload.locationId;

    if (event.type === 'pick_line.completed' && typeof payload.pickTaskId === 'string') {
      const task = await this.prisma.pickTask.findUnique({
        where: { id: payload.pickTaskId },
        select: { locationId: true },
      });
      return task?.locationId ?? null;
    }

    if (event.type === 'inventory.adjusted' && typeof payload.binId === 'string') {
      const bin = await this.prisma.warehouseBin.findUnique({
        where: { id: payload.binId },
        select: { locationId: true },
      });
      return bin?.locationId ?? null;
    }

    return null;
  }
}
