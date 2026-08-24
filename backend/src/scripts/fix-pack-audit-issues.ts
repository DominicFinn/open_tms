/**
 * One-off repair for pack-audit issues created before #131.
 *
 * RecordPackAuditCommand used to write issues directly with
 * category: 'quality' — not a valid category (exception | delay | damage |
 * compliance | other), so those issues failed every category filter, and
 * because no issue.created event fired they never reached IssueReadModel
 * or the triage board.
 *
 * This script repairs the rows in place: valid category, the issueType the
 * new PackAuditIssueHandler stamps, and a lastActivityAt so triage ranking
 * has something to sort on. Idempotent — the where clause matches nothing
 * on a second run.
 *
 * Run afterwards to materialise them into the read model:
 *   npx tsx backend/src/scripts/backfill-read-models.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orphans = await prisma.issue.findMany({
    where: { sourceEntityType: 'pack_task', category: 'quality' },
    select: { id: true, orgId: true, createdAt: true },
  });

  if (orphans.length === 0) {
    console.log('No orphaned pack-audit issues found — nothing to repair.');
    return;
  }

  for (const issue of orphans) {
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        category: 'exception',
        issueType: 'pack_audit_variance',
        lastActivityAt: issue.createdAt,
      },
    });
  }

  console.log(`Repaired ${orphans.length} pack-audit issue(s).`);
  console.log('Now run: npx tsx backend/src/scripts/backfill-read-models.ts');
}

main()
  .catch((err) => {
    console.error('Repair failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
