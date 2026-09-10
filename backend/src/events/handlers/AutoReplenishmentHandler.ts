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

      const facilityId = await this.resolveFacilityId(event);
      if (!facilityId) return;

      await this.commandBus.dispatch({
        type: CHECK_REPLENISHMENT,
        orgId: event.orgId,
        actorId: 'auto-replenishment',
        payload: { facilityId, sku },
        metadata: { correlationId: crypto.randomUUID(), source: 'auto-replenishment-handler' },
      });
    } catch (err) {
      console.error('[AutoReplenishmentHandler] Failed:', (err as Error).message);
    }
  }

  /**
   * Resolve the facility the command should run against (#280).
   *
   * It used to resolve a locationId, which CHECK_REPLENISHMENT no longer takes. The warehouse row
   * the event points at carries the facility directly, so this reads that rather than walking back
   * out to a Location that a warehouse-only install would not have.
   */
  private async resolveFacilityId(event: DomainEvent): Promise<string | null> {
    const payload = event.payload as Record<string, unknown>;
    if (typeof payload.facilityId === 'string') return payload.facilityId;

    if (event.type === 'pick_line.completed' && typeof payload.pickTaskId === 'string') {
      const task = await this.prisma.pickTask.findFirst({
        where: { id: payload.pickTaskId, orgId: event.orgId },
        select: { facilityId: true },
      });
      return task?.facilityId ?? null;
    }

    if (event.type === 'inventory.adjusted' && typeof payload.binId === 'string') {
      const bin = await this.prisma.warehouseBin.findFirst({
        where: { id: payload.binId, orgId: event.orgId },
        select: { facilityId: true },
      });
      return bin?.facilityId ?? null;
    }

    return null;
  }
}
