/**
 * Backfill script — populates all read models from existing data in the
 * write model tables.
 *
 * Run once after deploying CQRS migrations, then projections keep read
 * models in sync via events.
 *
 * Usage:
 *   npx tsx backend/src/scripts/backfill-read-models.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getOrgId(): Promise<string> {
  const org = await prisma.organization.findFirst({ select: { id: true } });
  return org?.id || 'default';
}

async function backfillOrders(orgId: string): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { archived: false },
    include: {
      customer: { select: { id: true, name: true } },
      origin: { select: { name: true, city: true, state: true } },
      destination: { select: { name: true, city: true, state: true } },
      trackableUnits: { select: { id: true } },
      lineItems: { select: { id: true, weight: true } },
      orderShipments: {
        include: { shipment: { select: { id: true, reference: true } } },
        take: 1,
      },
    },
  });

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

async function backfillShipments(orgId: string): Promise<number> {
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

async function backfillCarriers(orgId: string): Promise<number> {
  const carriers = await prisma.carrier.findMany({
    where: { archived: false },
    include: {
      vehicles: { select: { id: true } },
      drivers: { select: { id: true } },
      laneCarriers: { where: { assigned: true }, select: { id: true } },
    },
  });

  let count = 0;
  for (const carrier of carriers) {
    await prisma.carrierReadModel.upsert({
      where: { id: carrier.id },
      create: {
        id: carrier.id,
        orgId,
        name: carrier.name,
        mcNumber: carrier.mcNumber,
        dotNumber: carrier.dotNumber,
        contactEmail: carrier.contactEmail,
        status: 'active',
        validationTier: carrier.validationTier,
        vehicleCount: carrier.vehicles.length,
        driverCount: carrier.drivers.length,
        activeLaneCount: carrier.laneCarriers.length,
        createdAt: carrier.createdAt,
        updatedAt: carrier.updatedAt,
      },
      update: {
        name: carrier.name,
        validationTier: carrier.validationTier,
        vehicleCount: carrier.vehicles.length,
        driverCount: carrier.drivers.length,
        activeLaneCount: carrier.laneCarriers.length,
        updatedAt: carrier.updatedAt,
      },
    });
    count++;
  }
  return count;
}

async function backfillCustomers(orgId: string): Promise<number> {
  const customers = await prisma.customer.findMany({
    where: { archived: false },
    include: {
      orders: { where: { archived: false }, select: { id: true, status: true } },
    },
  });

  let count = 0;
  for (const customer of customers) {
    const activeOrders = customer.orders.filter(
      (o) => !['archived', 'cancelled'].includes(o.status)
    ).length;

    await prisma.customerReadModel.upsert({
      where: { id: customer.id },
      create: {
        id: customer.id,
        orgId,
        name: customer.name,
        contactEmail: customer.contactEmail,
        activeOrderCount: activeOrders,
        totalOrderCount: customer.orders.length,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      update: {
        name: customer.name,
        contactEmail: customer.contactEmail,
        activeOrderCount: activeOrders,
        totalOrderCount: customer.orders.length,
        updatedAt: customer.updatedAt,
      },
    });
    count++;
  }
  return count;
}

async function backfillLanes(orgId: string): Promise<number> {
  const lanes = await prisma.lane.findMany({
    where: { archived: false },
    include: {
      origin: { select: { name: true, city: true } },
      destination: { select: { name: true, city: true } },
      laneCarriers: { select: { id: true } },
      shipments: { where: { archived: false }, select: { id: true } },
    },
  });

  let count = 0;
  for (const lane of lanes) {
    await prisma.laneReadModel.upsert({
      where: { id: lane.id },
      create: {
        id: lane.id,
        orgId,
        name: lane.name,
        originName: lane.origin.name,
        originCity: lane.origin.city,
        destinationName: lane.destination.name,
        destinationCity: lane.destination.city,
        serviceLevel: lane.serviceLevel,
        distance: lane.distance,
        carrierCount: lane.laneCarriers.length,
        activeShipmentCount: lane.shipments.length,
        status: lane.status,
        createdAt: lane.createdAt,
        updatedAt: lane.updatedAt,
      },
      update: {
        name: lane.name,
        originName: lane.origin.name,
        originCity: lane.origin.city,
        destinationName: lane.destination.name,
        destinationCity: lane.destination.city,
        carrierCount: lane.laneCarriers.length,
        activeShipmentCount: lane.shipments.length,
        status: lane.status,
        updatedAt: lane.updatedAt,
      },
    });
    count++;
  }
  return count;
}

async function backfillIssues(orgId: string): Promise<number> {
  const issues = await prisma.issue.findMany();

  let count = 0;
  for (const issue of issues) {
    await prisma.issueReadModel.upsert({
      where: { id: issue.id },
      create: {
        id: issue.id,
        orgId: issue.orgId,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        category: issue.category,
        sourceEntityType: issue.sourceEntityType,
        sourceEntityId: issue.sourceEntityId,
        assigneeName: issue.assigneeName,
        escalatedTo: issue.escalatedTo,
        resolvedAt: issue.resolvedAt,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      },
      update: {
        status: issue.status,
        priority: issue.priority,
        assigneeName: issue.assigneeName,
        escalatedTo: issue.escalatedTo,
        resolvedAt: issue.resolvedAt,
        updatedAt: issue.updatedAt,
      },
    });
    count++;
  }
  return count;
}

async function main() {
  console.log('[Backfill] Starting read model backfill...');
  const orgId = await getOrgId();

  const orderCount = await backfillOrders(orgId);
  console.log(`[Backfill] ${orderCount} orders`);

  const shipmentCount = await backfillShipments(orgId);
  console.log(`[Backfill] ${shipmentCount} shipments`);

  const carrierCount = await backfillCarriers(orgId);
  console.log(`[Backfill] ${carrierCount} carriers`);

  const customerCount = await backfillCustomers(orgId);
  console.log(`[Backfill] ${customerCount} customers`);

  const laneCount = await backfillLanes(orgId);
  console.log(`[Backfill] ${laneCount} lanes`);

  const issueCount = await backfillIssues(orgId);
  console.log(`[Backfill] ${issueCount} issues`);

  console.log('[Backfill] Done.');
}

main()
  .catch((err) => {
    console.error('[Backfill] Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
