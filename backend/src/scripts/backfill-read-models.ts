/**
 * Backfill script — populates OrderReadModel and ShipmentReadModel from
 * existing data in the write model tables.
 *
 * Run once after the CQRS migration, then projections keep read models in sync.
 *
 * Usage:
 *   npx tsx backend/src/scripts/backfill-read-models.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillOrders(): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { archived: false },
    include: {
      customer: { select: { id: true, name: true } },
      origin: { select: { name: true, city: true, state: true } },
      destination: { select: { name: true, city: true, state: true } },
      trackableUnits: { select: { id: true } },
      lineItems: { select: { id: true, weight: true } },
      orderShipments: {
        include: {
          shipment: { select: { id: true, reference: true } },
        },
        take: 1,
      },
    },
  });

  // Get org ID (single-tenant for now)
  const org = await prisma.organization.findFirst({ select: { id: true } });
  const orgId = org?.id || 'default';

  let count = 0;
  for (const order of orders) {
    const totalWeight = order.lineItems.reduce((sum, item) => sum + (item.weight ?? 0), 0);
    const shipment = order.orderShipments[0]?.shipment;

    await prisma.orderReadModel.upsert({
      where: { id: order.id },
      create: {
        id: order.id,
        orgId,
        orderNumber: order.orderNumber,
        poNumber: order.poNumber,
        status: order.status,
        deliveryStatus: order.deliveryStatus || 'unassigned',
        customerName: order.customer.name,
        customerId: order.customerId,
        originName: order.origin?.name ?? null,
        originCity: order.origin?.city ?? null,
        originState: order.origin?.state ?? null,
        destinationName: order.destination?.name ?? null,
        destinationCity: order.destination?.city ?? null,
        destinationState: order.destination?.state ?? null,
        shipmentId: shipment?.id ?? null,
        shipmentReference: shipment?.reference ?? null,
        serviceLevel: order.serviceLevel,
        temperatureRequired: order.temperatureControl !== 'ambient',
        hazmat: order.requiresHazmat || false,
        trackableUnitCount: order.trackableUnits.length,
        lineItemCount: order.lineItems.length,
        totalWeight: totalWeight > 0 ? totalWeight : null,
        requestedDeliveryDate: order.requestedDeliveryDate,
        deliveredAt: order.deliveredAt,
        exceptionType: order.exceptionType,
        importSource: order.importSource,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      update: {
        status: order.status,
        deliveryStatus: order.deliveryStatus || 'unassigned',
        customerName: order.customer.name,
        shipmentId: shipment?.id ?? null,
        shipmentReference: shipment?.reference ?? null,
        deliveredAt: order.deliveredAt,
        exceptionType: order.exceptionType,
        updatedAt: order.updatedAt,
      },
    });
    count++;
  }

  return count;
}

async function backfillShipments(): Promise<number> {
  const shipments = await prisma.shipment.findMany({
    where: { archived: false },
    include: {
      customer: { select: { id: true, name: true } },
      origin: { select: { name: true, city: true, state: true } },
      destination: { select: { name: true, city: true, state: true } },
      carrier: { select: { id: true, name: true } },
      lane: { select: { id: true, name: true } },
      stops: { select: { id: true } },
      orderShipments: { select: { id: true } },
    },
  });

  const org = await prisma.organization.findFirst({ select: { id: true } });
  const orgId = org?.id || 'default';

  let count = 0;
  for (const shipment of shipments) {
    await prisma.shipmentReadModel.upsert({
      where: { id: shipment.id },
      create: {
        id: shipment.id,
        orgId,
        reference: shipment.reference,
        status: shipment.status,
        customerName: shipment.customer.name,
        customerId: shipment.customerId,
        originName: shipment.origin?.name ?? null,
        originCity: shipment.origin?.city ?? null,
        originState: shipment.origin?.state ?? null,
        destinationName: shipment.destination?.name ?? null,
        destinationCity: shipment.destination?.city ?? null,
        destinationState: shipment.destination?.state ?? null,
        carrierName: shipment.carrier?.name ?? null,
        carrierId: shipment.carrierId,
        laneName: shipment.lane?.name ?? null,
        laneId: shipment.laneId,
        proNumber: shipment.proNumber,
        pickupDate: shipment.pickupDate,
        deliveryDate: shipment.deliveryDate,
        orderCount: shipment.orderShipments.length,
        stopCount: shipment.stops.length,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      },
      update: {
        status: shipment.status,
        customerName: shipment.customer.name,
        carrierName: shipment.carrier?.name ?? null,
        carrierId: shipment.carrierId,
        proNumber: shipment.proNumber,
        orderCount: shipment.orderShipments.length,
        stopCount: shipment.stops.length,
        updatedAt: shipment.updatedAt,
      },
    });
    count++;
  }

  return count;
}

async function main() {
  console.log('[Backfill] Starting read model backfill...');

  const orderCount = await backfillOrders();
  console.log(`[Backfill] Backfilled ${orderCount} orders into OrderReadModel`);

  const shipmentCount = await backfillShipments();
  console.log(`[Backfill] Backfilled ${shipmentCount} shipments into ShipmentReadModel`);

  console.log('[Backfill] Done.');
}

main()
  .catch((err) => {
    console.error('[Backfill] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
