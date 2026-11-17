/**
 * Deletes the pg-boss queues that belonged to the warehouse and inventory code removed in #394.
 *
 * Nothing publishes to them any more, because the event bus only fans out to handlers registered
 * in the running process. They still sit in `pgboss.queue` with whatever jobs were left, and show
 * up in the queue monitor as queues that never move. Safe to run more than once: a queue that is
 * already gone is skipped.
 *
 * Usage:
 *   npx tsx --env-file=.env src/scripts/remove-retired-queues.ts            # list what would go
 *   npx tsx --env-file=.env src/scripts/remove-retired-queues.ts --apply    # delete them
 */

import { PgBoss } from 'pg-boss';

// Handler and worker queues from the last commit carrying the warehouse code (tag last-with-wms).
const RETIRED_QUEUES = [
  'evt.projection.wms_fulfilment_order',
  'evt.projection.handling_unit',
  'evt.handler.auto_replenishment',
  'evt.handler.handling_unit_returns',
  'evt.handler.warehouse_returns_stock',
  'evt.handler.pack_audit_issue_link',
  'evt.handler.load_plan_bol_link',
  'evt.document.bol_generation',
  'wave-auto-release',
];

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    return 1;
  }
  const apply = process.argv.includes('--apply');

  const boss = new PgBoss(databaseUrl);
  boss.on('error', (error: Error) => console.error('[pg-boss]', error.message));
  await boss.start();

  try {
    let found = 0;
    for (const base of RETIRED_QUEUES) {
      // The dead-letter queue goes after the queue that points at it.
      for (const name of [base, `${base}.dead`]) {
        const queue = await boss.getQueue(name);
        if (!queue) continue;
        found++;
        if (apply) {
          await boss.deleteQueue(name);
          console.log(`deleted ${name}`);
        } else {
          console.log(`would delete ${name} (${queue.queuedCount ?? 0} queued)`);
        }
      }
    }
    if (found === 0) console.log('No retired queues found.');
    else if (!apply) console.log(`\n${found} queue(s) found. Run again with --apply to delete them.`);
    return 0;
  } finally {
    await boss.stop({ graceful: false });
  }
}

main().then((code) => { process.exitCode = code; }).catch((err) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
