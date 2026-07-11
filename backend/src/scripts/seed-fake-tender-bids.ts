/**
 * Additive script: creates a handful of tenders with carrier offers + bids
 * for existing draft shipments, without touching any other data.
 *
 * Usage:
 *   npx tsx backend/src/scripts/seed-fake-tender-bids.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const shipments = await prisma.shipment.findMany({
    where: { status: 'draft', tenders: { none: {} } },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  if (shipments.length === 0) {
    console.log('No draft shipments without existing tenders found. Nothing to do.');
    return;
  }

  const carriers = await prisma.carrier.findMany({ take: 5 });
  if (carriers.length === 0) {
    console.log('No carriers found. Seed carriers first.');
    return;
  }

  const admin = await prisma.user.findFirst({ where: { email: 'admin@meridian-tms.demo' } });

  const existingCount = await prisma.tender.count();
  let tndCounter = existingCount + 1;

  const states = ['open', 'open', 'evaluating', 'awarded', 'draft'];

  for (const [idx, shipment] of shipments.entries()) {
    const state = states[idx % states.length];
    const strategy = idx % 2 === 0 ? 'broadcast' : 'waterfall';
    const targetCarriers = carriers.slice(0, 3 + (idx % 2));

    const tender = await prisma.tender.create({
      data: {
        shipmentId: shipment.id,
        reference: `TND-${String(tndCounter++).padStart(4, '0')}`,
        strategy,
        status: state,
        tenderDurationMinutes: 180,
        targetRate: 1800 + idx * 150,
        currency: 'USD',
        equipmentType: "53' Dry Van",
        notes: `Fake tender seeded for demo purposes on shipment ${shipment.reference || shipment.id}`,
        specialInstructions: 'Contract lane carriers preferred.',
        openedAt: state !== 'draft' ? daysAgo(1) : null,
        closedAt: state === 'awarded' ? minutesAgo(60) : null,
        awardedAt: state === 'awarded' ? minutesAgo(55) : null,
        createdBy: admin?.id ?? null,
      },
    });

    const offers: { id: string; carrierId: string }[] = [];
    for (const [i, c] of targetCarriers.entries()) {
      const offerStatus =
        state === 'draft' ? 'pending'
        : state === 'awarded' && i === 0 ? 'viewed'
        : state === 'open' ? (i === 0 ? 'viewed' : 'sent')
        : 'sent';

      const offer = await prisma.tenderOffer.create({
        data: {
          tenderId: tender.id,
          carrierId: c.id,
          sequence: strategy === 'waterfall' ? i + 1 : 1,
          status: offerStatus,
          sentAt: state !== 'draft' ? daysAgo(1) : null,
          expiresAt: state !== 'draft' ? daysFromNow(1) : null,
          viewedAt: offerStatus === 'viewed' ? minutesAgo(90) : null,
        },
      });
      offers.push({ id: offer.id, carrierId: c.id });
    }

    if (state !== 'draft') {
      const bidCount = state === 'awarded' ? offers.length : Math.min(offers.length, 2 + (idx % 2));
      for (let b = 0; b < bidCount; b++) {
        const offer = offers[b];
        const rate = 1850 + b * 130 + Math.floor(Math.random() * 200);
        const bidStatus = state === 'awarded' && b === 0 ? 'accepted' : state === 'awarded' ? 'rejected' : 'submitted';
        const carrierUser = await prisma.carrierUser.findFirst({ where: { carrierId: offer.carrierId } });

        await prisma.tenderBid.create({
          data: {
            tenderId: tender.id,
            tenderOfferId: offer.id,
            carrierId: offer.carrierId,
            rate,
            currency: 'USD',
            transitDays: 2 + b,
            equipmentType: "53' Dry Van",
            notes: b === 0 ? 'Can commit to pickup window. Team driver available.' : null,
            status: bidStatus,
            submittedAt: minutesAgo(120 - b * 20),
            respondedAt: bidStatus !== 'submitted' ? minutesAgo(60) : null,
            submittedById: carrierUser?.id ?? null,
            sourceType: b === 1 ? 'edi_990' : 'portal',
          },
        });
      }
    }

    console.log(`Created tender ${tender.reference} (${state}) for shipment ${shipment.id} with ${offers.length} offers`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
