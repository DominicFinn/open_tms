/**
 * One-time migration: encrypt existing plaintext carrier-tracking credentials
 * at rest. Idempotent — rows already sealed (`{ __enc: ... }`) are skipped.
 *
 * Run after deploying the secretVault change (with CREDENTIALS_ENCRYPTION_KEY set):
 *   npx tsx backend/src/scripts/encrypt-carrier-credentials.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { sealCredentials } from '../security/secretVault.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const rows = await prisma.carrierTrackingIntegration.findMany({
    select: { id: true, credentials: true },
  });

  let sealed = 0;
  let skipped = 0;
  for (const row of rows) {
    const creds = row.credentials as Record<string, unknown> | null;
    if (!creds || typeof creds !== 'object') { skipped++; continue; }
    if (typeof (creds as any).__enc === 'string') { skipped++; continue; } // already encrypted

    const sealedVal = sealCredentials(creds);
    await prisma.carrierTrackingIntegration.update({
      where: { id: row.id },
      data: { credentials: (sealedVal as Prisma.InputJsonValue) ?? Prisma.JsonNull },
    });
    sealed++;
  }

  console.log(`[encrypt-carrier-credentials] Done. Encrypted ${sealed}, skipped ${skipped}.`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
