/**
 * Backfill script — materializes historical shipment domain events from
 * DomainEventLog into ShipmentEvent timeline rows, so existing shipments show
 * their past activity on the detail "Events" tab.
 *
 * Idempotent: skips any event already materialized (matched on sourceEventId),
 * so it is safe to re-run. Run once after deploying the timeline feature:
 *   npx tsx backend/src/scripts/backfill-shipment-timeline.ts
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../events/DomainEvent.js';
import { buildTimelineRow } from '../events/projections/ShipmentTimelineProjection.js';

const prisma = new PrismaClient();

// The shipment.* domain event types the timeline projection materializes.
const MATERIALIZED_TYPES = [
  'shipment.created',
  'shipment.updated',
  'shipment.status_changed',
  'shipment.carrier_assigned',
  'shipment.exception',
  'shipment.delivered',
  'shipment.archived',
  'shipment.unarchived',
  'shipment.deleted',
  'shipment.stop_arrived',
  'shipment.stop_completed',
];

async function main(): Promise<void> {
  console.log('[Backfill] Materializing shipment timeline from DomainEventLog...');

  const logs = await prisma.domainEventLog.findMany({
    where: { type: { in: MATERIALIZED_TYPES }, entityType: 'shipment' },
    orderBy: { timestamp: 'asc' },
  });
  console.log(`[Backfill] ${logs.length} candidate domain events`);

  // Preload already-materialized source event ids to skip in bulk.
  const existing = await prisma.shipmentEvent.findMany({
    where: { sourceEventId: { not: null } },
    select: { sourceEventId: true },
  });
  const seen = new Set(existing.map(e => e.sourceEventId));

  let created = 0;
  let skipped = 0;
  for (const log of logs) {
    if (seen.has(log.id)) { skipped++; continue; }
    const event: DomainEvent = {
      id: log.id,
      type: log.type,
      timestamp: new Date(log.timestamp).toISOString(),
      orgId: log.orgId,
      actorId: log.actorId ?? null,
      entityType: log.entityType,
      entityId: log.entityId,
      payload: log.payload as any,
      metadata: (log.metadata as any) ?? {},
    };
    try {
      const row = await buildTimelineRow(prisma, event);
      if (!row) { skipped++; continue; }
      await prisma.shipmentEvent.create({ data: row });
      seen.add(log.id);
      created++;
    } catch (err) {
      console.error(`[Backfill] Failed for event ${log.id} (${log.type}): ${(err as Error).message}`);
    }
  }

  console.log(`[Backfill] Done. Created ${created}, skipped ${skipped}.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
