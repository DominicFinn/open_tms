/**
 * Replay a System Loco device webhook against the local server — for testing
 * ingestion without a live device. Builds a representative Device Event,
 * posts it to POST /api/v1/webhook, and prints the result.
 *
 * Auth: signs with the org's configured System Loco webhook secret if present;
 * otherwise creates a throwaway API key for the call and deletes it after.
 *
 * Usage:
 *   npx tsx src/scripts/replay-webhook.ts [--externalId LOCO-123] \
 *     [--type temperature] [--lat 53.4808] [--lon -2.2426] [--temp 6.5] \
 *     [--url http://localhost:3001]
 *
 * With no --externalId it picks a device currently assigned to a shipment, so
 * the event resolves to a real shipment.
 */

import { PrismaClient } from '@prisma/client';
import { createHmac, createHash, randomBytes } from 'crypto';

const prisma = new PrismaClient();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const url = arg('url', 'http://localhost:3001')!;
  const type = arg('type', 'temperature')!;
  const lat = Number(arg('lat', '53.4808'));
  const lon = Number(arg('lon', '-2.2426'));
  const temp = Number(arg('temp', '6.5'));

  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error('No organization found');

  // Resolve a device externalId: explicit arg, else an actively-assigned device.
  let externalId = arg('externalId');
  if (!externalId) {
    const assignment = await prisma.deviceAssignment.findFirst({
      where: { active: true, shipmentId: { not: null } },
      include: { device: { select: { externalId: true } } },
      orderBy: { assignedAt: 'desc' },
    });
    externalId = assignment?.device.externalId;
  }
  if (!externalId) throw new Error('No --externalId given and no actively-assigned device found. Assign a device to a shipment first.');

  const payload: Record<string, unknown> = {
    id: 'replay-' + randomBytes(8).toString('hex'),
    owner: { id: 'replay', name: 'Replay' },
    category: 'event',
    type,
    startTime: new Date().toISOString(),
    device: { id: externalId, name: `Replay ${externalId}` },
    location: { type: 'gps', global: { lat, lon, cep: 12.5, address: 'Replay location' } },
    payload: { temperature: temp, humidity: 55.3, atmosphericPressure: 1012.4, maxTemperature: 8, minTemperature: 2 },
  };
  const bodyStr = JSON.stringify(payload);

  // Auth: signature if configured, else a throwaway API key.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let tempKeyId: string | null = null;
  const vendor = await prisma.iotVendor.findUnique({
    where: { orgId_vendorKey: { orgId: org.id, vendorKey: 'system_loco' } },
    select: { webhookSecret: true },
  });
  const secret = vendor?.webhookSecret || process.env.LOCOAWARE_WEBHOOK_SECRET;
  if (secret) {
    headers['X-LocoAware-Signature'] = createHmac('sha256', secret).update(Buffer.from(bodyStr)).digest('base64');
    console.log('[replay] signing with configured System Loco secret');
  } else {
    const rawKey = 'replay_' + randomBytes(12).toString('hex');
    const key = await prisma.apiKey.create({
      data: { orgId: org.id, name: 'replay-webhook (temp)', keyHash: createHash('sha256').update(rawKey).digest('hex'), keyPrefix: rawKey.slice(0, 8), active: true },
    });
    tempKeyId = key.id;
    headers['x-api-key'] = rawKey;
    console.log('[replay] no secret configured — using a throwaway API key');
  }

  console.log(`[replay] POST ${url}/api/v1/webhook  device=${externalId} type=${type}`);
  const res = await fetch(`${url}/api/v1/webhook`, { method: 'POST', headers, body: bodyStr });
  console.log(`[replay] -> HTTP ${res.status}`, await res.text());

  if (tempKeyId) await prisma.apiKey.delete({ where: { id: tempKeyId } }).catch(() => {});
}

main()
  .catch((err) => { console.error(err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
