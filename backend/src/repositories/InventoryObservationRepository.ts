/**
 * Inventory observation reads (#233).
 *
 * Module: inventory. InventoryObservation is a ledger table (insert-only) — every method here
 * takes orgId first and lists most-recent-first.
 */

import { InventoryObservation, PrismaClient } from '@prisma/client';

const MAX_ROWS = 200;

export interface IInventoryObservationRepository {
  listRecent(orgId: string, locationId: string, sku?: string): Promise<InventoryObservation[]>;
}

export class InventoryObservationRepository implements IInventoryObservationRepository {
  constructor(private prisma: PrismaClient) {}

  async listRecent(orgId: string, locationId: string, sku?: string): Promise<InventoryObservation[]> {
    const where: any = { orgId, locationId };
    if (sku) where.sku = { contains: sku, mode: 'insensitive' };
    return this.prisma.inventoryObservation.findMany({
      where,
      include: {
        bin: { select: { id: true, label: true } },
      },
      orderBy: { observedAt: 'desc' },
      take: MAX_ROWS,
    });
  }
}
