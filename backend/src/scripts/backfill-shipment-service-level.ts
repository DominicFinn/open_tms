/**
 * Backfill script (#325) — gives shipments with no service level the one their orders share.
 *
 * Shipments created by converting, combining or splitting orders never had `serviceLevel` set, and
 * the FTL/LTL rules only bite when it is. For each such shipment: if all its orders share one
 * service level, set it; if they disagree, or it has no orders, list it
 * for someone to decide. Mixed shipments are never guessed.
 *
 * Every write is scoped by the shipment's own orgId, never one resolved for the whole run.
 *
 * Dry run by default; pass --apply to write.
 *
 * Usage:
 *   npx tsx --env-file=backend/.env backend/src/scripts/backfill-shipment-service-level.ts
 *   npx tsx --env-file=backend/.env backend/src/scripts/backfill-shipment-service-level.ts --apply
 */

import { PrismaClient } from '@prisma/client';

export interface ServiceLevelPlan {
  set: Array<{ shipmentId: string; orgId: string; serviceLevel: string }>;
  review: Array<{ shipmentId: string; orgId: string; reason: string }>;
}

export async function planServiceLevelBackfill(prisma: PrismaClient): Promise<ServiceLevelPlan> {
  // tenancy-exempt: an org-wide maintenance scan; every row carries and is written with its own orgId.
  const shipments = await prisma.shipment.findMany({
    where: { serviceLevel: null, deletedAt: null },
    select: { id: true, orgId: true, orderShipments: { select: { order: { select: { serviceLevel: true } } } } },
  });

  const plan: ServiceLevelPlan = { set: [], review: [] };
  for (const shipment of shipments) {
    const levels = new Set(shipment.orderShipments.map((os) => os.order.serviceLevel));
    if (levels.size === 1) {
      plan.set.push({ shipmentId: shipment.id, orgId: shipment.orgId, serviceLevel: [...levels][0] });
    } else {
      plan.review.push({ shipmentId: shipment.id, orgId: shipment.orgId, reason: levels.size === 0 ? 'no orders' : 'orders mix FTL and LTL' });
    }
  }
  return plan;
}

export async function applyServiceLevelBackfill(prisma: PrismaClient, plan: ServiceLevelPlan): Promise<void> {
  for (const { shipmentId, orgId, serviceLevel } of plan.set) {
    await prisma.shipment.update({ where: { id: shipmentId, orgId }, data: { serviceLevel } });
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const plan = await planServiceLevelBackfill(prisma);
    console.log(`[backfill-service-level] ${plan.set.length} shipment(s) to set, ${plan.review.length} to review`);
    for (const r of plan.review) console.log('[backfill-service-level] review', r);
    if (!apply) {
      console.log('[backfill-service-level] dry run; pass --apply to write');
      return;
    }
    await applyServiceLevelBackfill(prisma, plan);
    console.log(`[backfill-service-level] set ${plan.set.length} shipment(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('backfill-shipment-service-level.ts')) {
  main().catch((err) => {
    console.error('[backfill-service-level] failed', err);
    process.exit(1);
  });
}
