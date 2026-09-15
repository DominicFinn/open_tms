/**
 * #220, third batch: the WMS dashboard, cycle counts and load plans.
 *
 * The dashboard was the worst single case — twelve counts, none of them carrying orgId, so it
 * reported another tenant's warehouse to anyone who supplied their location id.
 */

import { WmsDashboardRepository } from '../../repositories/WmsDashboardRepository';
import { CycleCountRepository } from '../../repositories/CycleCountRepository';
import { LoadPlanRepository } from '../../repositories/LoadPlanRepository';

function buildPrisma() {
  const counter = () => ({ count: jest.fn().mockResolvedValue(0) });
  return {
    warehouseZone: counter(),
    warehouseBin: counter(),
    receivingTask: counter(),
    putawayTask: counter(),
    pickTask: counter(),
    packTask: counter(),
    stagingAssignment: counter(),
    inventoryRecord: { groupBy: jest.fn().mockResolvedValue([{ sku: 'A' }, { sku: 'B' }]) },
    cycleCount: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    loadPlan: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('WmsDashboardRepository org scoping', () => {
  it('carries orgId on every one of the twelve counts', async () => {
    const prisma = buildPrisma();
    await new WmsDashboardRepository(prisma).counts('org-1', { facilityId: 'fac-1' });

    const everyWhere = [
      ...prisma.warehouseZone.count.mock.calls,
      ...prisma.warehouseBin.count.mock.calls,
      ...prisma.receivingTask.count.mock.calls,
      ...prisma.putawayTask.count.mock.calls,
      ...prisma.pickTask.count.mock.calls,
      ...prisma.packTask.count.mock.calls,
      ...prisma.stagingAssignment.count.mock.calls,
      ...prisma.inventoryRecord.groupBy.mock.calls,
    ].map((call: any) => call[0].where);

    expect(everyWhere).toHaveLength(12);
    for (const where of everyWhere) {
      expect(where.orgId).toBe('org-1');
    }
  });

  /**
   * Every count is narrowed to the facility, but not all of them the same way. InventoryRecord has
   * no facilityId, because inventory is still keyed on Location until Phase 4, so spreading the
   * facility filter into it was a 500 (#285). It goes through the bins the facility owns instead.
   */
  it('narrows every count to the facility, inventory through its bins', async () => {
    const prisma = buildPrisma();
    await new WmsDashboardRepository(prisma).counts('org-1', { facilityId: 'fac-1' });

    const direct = [
      ...prisma.warehouseZone.count.mock.calls,
      ...prisma.warehouseBin.count.mock.calls,
      ...prisma.receivingTask.count.mock.calls,
      ...prisma.putawayTask.count.mock.calls,
      ...prisma.pickTask.count.mock.calls,
      ...prisma.packTask.count.mock.calls,
      ...prisma.stagingAssignment.count.mock.calls,
    ].map((call: any) => call[0].where);

    for (const where of direct) {
      expect(where.facilityId).toBe('fac-1');
    }

    const stock = prisma.inventoryRecord.groupBy.mock.calls[0][0].where;
    expect(stock.facilityId).toBeUndefined();
    expect(stock.bin).toEqual({ orgId: 'org-1', facilityId: 'fac-1' });
  });

  it('counts distinct SKUs with stock on hand', async () => {
    const prisma = buildPrisma();
    const counts = await new WmsDashboardRepository(prisma).counts('org-1', { facilityId: 'fac-1' });

    expect(counts.totalSkus).toBe(2);
    expect(prisma.inventoryRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ quantityOnHand: { gt: 0 } }) })
    );
  });
});

describe('CycleCountRepository org scoping', () => {
  it('filters the list by org as well as location', async () => {
    const prisma = buildPrisma();
    await new CycleCountRepository(prisma).find('org-1', { facilityId: 'fac-1' }, 'open');

    expect(prisma.cycleCount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', facilityId: 'fac-1', status: 'open' }, take: 500 })
    );
  });

  it('looks a count up by id and org', async () => {
    const prisma = buildPrisma();
    await new CycleCountRepository(prisma).findById('org-1', 'cc-1');

    expect(prisma.cycleCount.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cc-1', orgId: 'org-1' } })
    );
  });
});

describe('LoadPlanRepository org scoping', () => {
  it('filters the list by org as well as location', async () => {
    const prisma = buildPrisma();
    await new LoadPlanRepository(prisma).find('org-1', { facilityId: 'fac-1' });

    expect(prisma.loadPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1', facilityId: 'fac-1' } })
    );
  });

  it('caps the list, which previously had no ceiling at all', async () => {
    const prisma = buildPrisma();
    await new LoadPlanRepository(prisma).find('org-1', { facilityId: 'fac-1' });

    expect(prisma.loadPlan.findMany.mock.calls[0][0].take).toBe(500);
  });

  it('looks a plan up by id and org', async () => {
    const prisma = buildPrisma();
    await new LoadPlanRepository(prisma).findById('org-1', 'lp-1');

    expect(prisma.loadPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'lp-1', orgId: 'org-1' } })
    );
  });
});
