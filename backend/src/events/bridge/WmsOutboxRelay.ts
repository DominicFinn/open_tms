/**
 * Delivers the .NET service's events to Node's event bus (ADR 0006).
 *
 * For each new outbox row, in order: write it to DomainEventLog (a row already there is skipped, the
 * event id being the key), fan it out to the handlers as if a Node command had emitted it, then move
 * the cursor. The cursor moves last, so a crash repeats a delivery rather than losing one; handlers
 * are idempotent. Fan-out failures are logged by the event bus, the same guarantee a Node command's
 * events get.
 *
 * Runs in the worker. Nothing to do until the .NET service has created its outbox.
 */

import { PrismaClient } from '@prisma/client';
import type { DomainEvent, EventMetadata } from '../DomainEvent.js';
import { START_OF_OUTBOX, type OutboxCursor, type WmsOutboxReader, type WmsOutboxRow } from './WmsOutboxReader.js';

export const WMS_OUTBOX_CURSOR = 'wms.outbox';

export interface EventFanOut {
  fanOut(event: DomainEvent): Promise<void>;
}

export function toDomainEvent(row: WmsOutboxRow): DomainEvent {
  return {
    id: row.id,
    type: row.type,
    timestamp: row.occurredAt.toISOString(),
    orgId: row.orgId,
    actorId: row.actorId,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: row.payload,
    metadata: row.metadata as EventMetadata,
  };
}

export class WmsOutboxRelay {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private prisma: PrismaClient,
    private reader: WmsOutboxReader,
    private bus: EventFanOut,
    private batchSize = 100,
  ) {}

  /** Relays one batch. Returns how many events it delivered. */
  async relayOnce(): Promise<number> {
    if (!(await this.reader.exists())) return 0;

    const rows = await this.reader.readAfter(await this.cursor(), this.batchSize);
    for (const row of rows) {
      const event = toDomainEvent(row);
      await this.prisma.domainEventLog.createMany({
        data: [{
          id: event.id,
          type: event.type,
          timestamp: event.timestamp,
          orgId: event.orgId,
          actorId: event.actorId,
          entityType: event.entityType,
          entityId: event.entityId,
          payload: event.payload as object,
          metadata: event.metadata as object,
        }],
        skipDuplicates: true,
      });
      await this.bus.fanOut(event);
      await this.advance(row);
    }
    return rows.length;
  }

  /** Polls every intervalMs, or straight away again after a full batch. */
  start(intervalMs = 1000): void {
    this.stopped = false;
    const tick = async (): Promise<void> => {
      let delivered = 0;
      try {
        delivered = await this.relayOnce();
      } catch (err) {
        // The worker's edge: log and try again next tick, from the same cursor.
        console.error('[WmsOutboxRelay] Relay failed', { error: (err as Error).message });
      }
      if (!this.stopped) this.timer = setTimeout(tick, delivered === this.batchSize ? 0 : intervalMs);
    };
    this.timer = setTimeout(tick, 0);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async cursor(): Promise<OutboxCursor> {
    const row = await this.prisma.eventBridgeCursor.findUnique({ where: { name: WMS_OUTBOX_CURSOR } });
    return row ? { txId: row.txId, position: row.position } : START_OF_OUTBOX;
  }

  private async advance(row: WmsOutboxRow): Promise<void> {
    await this.prisma.eventBridgeCursor.upsert({
      where: { name: WMS_OUTBOX_CURSOR },
      create: { name: WMS_OUTBOX_CURSOR, txId: row.txId, position: row.position, relayedCount: 1 },
      update: { txId: row.txId, position: row.position, relayedCount: { increment: 1 } },
    });
  }
}
