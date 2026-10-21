/**
 * Reads the .NET service's event outbox, `wms.outbox` (ADR 0006).
 *
 * The outbox is the published contract between the stacks; Node reads nothing else in the `wms`
 * schema. Raw SQL because Prisma can't express any of it: the table is outside Prisma's schema, and
 * the read depends on `xid8` and the snapshot functions.
 */

import { PrismaClient } from '@prisma/client';

export interface OutboxCursor {
  /** xid8 of the last row read, as text. "0" before anything has been read. */
  readonly txId: string;
  readonly position: bigint;
}

export interface WmsOutboxRow {
  readonly position: bigint;
  readonly txId: string;
  readonly id: string;
  readonly type: string;
  readonly orgId: string;
  readonly actorId: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly payload: unknown;
  readonly metadata: unknown;
  readonly occurredAt: Date;
}

export const START_OF_OUTBOX: OutboxCursor = { txId: '0', position: 0n };

export class WmsOutboxReader {
  constructor(private prisma: PrismaClient) {}

  /** False until the .NET service has created its outbox. */
  async exists(): Promise<boolean> {
    const [row] = await this.prisma.$queryRaw<Array<{ name: string | null }>>`SELECT to_regclass('wms.outbox')::text AS name`;
    return Boolean(row?.name);
  }

  /**
   * Rows after the cursor whose transaction is older than the oldest one still running. Every such
   * row has committed, and nothing that commits later can sort before it, so a cursor that moves
   * past a row never needs to come back for an earlier one.
   */
  async readAfter(cursor: OutboxCursor, limit: number): Promise<WmsOutboxRow[]> {
    return this.prisma.$queryRaw<WmsOutboxRow[]>`
      SELECT position,
             tx_id::text  AS "txId",
             id,
             type,
             org_id       AS "orgId",
             actor_id     AS "actorId",
             entity_type  AS "entityType",
             entity_id    AS "entityId",
             payload,
             metadata,
             occurred_at  AS "occurredAt"
      FROM wms.outbox
      WHERE (tx_id, position) > (${cursor.txId}::xid8, ${cursor.position})
        AND tx_id < pg_snapshot_xmin(pg_current_snapshot())
      ORDER BY tx_id, position
      LIMIT ${limit}`;
  }
}
