/**
 * ConsolidationProjection — maintains ConsolidationReadModel (#329).
 *
 * Every consolidation event changes some mix of shipments, stops and carrier, so each one rebuilds
 * the whole row from the source tables rather than patching fields.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { SubscribeOptions } from '../IEventBus.js';

/** Recomputes one consolidation's read model row from its source rows. */
export async function refreshConsolidationReadModel(prisma: PrismaClient, orgId: string, id: string): Promise<boolean> {
  const c = await prisma.consolidation.findFirst({
    where: { id, orgId },
    select: {
      id: true,
      orgId: true,
      reference: true,
      status: true,
      archived: true,
      createdAt: true,
      updatedAt: true,
      carrier: { select: { name: true } },
      stops: { orderBy: { sequenceNumber: 'asc' }, select: { location: { select: { name: true } } } },
      shipments: {
        orderBy: { addedAt: 'asc' },
        select: { shipment: { select: { pickupDate: true, deliveryDate: true, customer: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!c) return false;

  const shipments = c.shipments.map((s) => s.shipment);
  const customers = new Map(shipments.map((s) => [s.customer.id, s.customer.name]));
  const pickups = shipments.map((s) => s.pickupDate).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime());
  const deliveries = shipments.map((s) => s.deliveryDate).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime());

  const row = {
    reference: c.reference,
    status: c.status,
    archived: c.archived,
    carrierName: c.carrier?.name ?? null,
    shipmentCount: shipments.length,
    customerCount: customers.size,
    customerNames: [...customers.values()],
    stopCount: c.stops.length,
    firstStopName: c.stops[0]?.location.name ?? null,
    lastStopName: c.stops[c.stops.length - 1]?.location.name ?? null,
    pickupDate: pickups[0] ?? null,
    deliveryDate: deliveries[deliveries.length - 1] ?? null,
    updatedAt: c.updatedAt,
  };
  await prisma.consolidationReadModel.upsert({
    where: { id: c.id, orgId: c.orgId },
    create: { id: c.id, orgId: c.orgId, createdAt: c.createdAt, ...row },
    update: row,
  });
  return true;
}

export class ConsolidationProjection implements IEventHandler {
  readonly name = 'projection.consolidation';
  readonly eventPatterns = ['consolidation.*'];
  readonly options: SubscribeOptions = {
    concurrency: 3,
    priority: 5,
    retryLimit: 5,
    expireInSeconds: 600,
    pollingIntervalSeconds: 0.5,
  };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    await refreshConsolidationReadModel(this.prisma, event.orgId, event.entityId);
  }
}
