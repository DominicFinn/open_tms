import { WarehouseQueries } from '../../services/warehouse/WarehouseQueries';

describe('WarehouseQueries', () => {
  it('returns a pack task with its recent audits, read within the org', async () => {
    const prisma = {
      packTask: { findFirst: jest.fn().mockResolvedValue({ id: 'pt-1', orderId: 'o-1', status: 'completed', packLines: [] }) },
      packAudit: { findMany: jest.fn().mockResolvedValue([{ verdict: 'fail', weightVariancePercent: 12, createdAt: new Date(0) }]) },
    } as any;

    const context = await new WarehouseQueries(prisma).get('org-a', 'pt-1');

    expect(prisma.packTask.findFirst.mock.calls[0][0].where).toEqual({ id: 'pt-1', orgId: 'org-a' });
    expect(prisma.packAudit.findMany.mock.calls[0][0].where).toEqual({ packTaskId: 'pt-1', orgId: 'org-a' });
    expect(context).toMatchObject({ id: 'pt-1', orderId: 'o-1', recentAudits: [{ verdict: 'fail' }] });
  });

  it('answers null for a pack task outside the org, without reading its audits', async () => {
    const prisma = { packTask: { findFirst: jest.fn().mockResolvedValue(null) }, packAudit: { findMany: jest.fn() } } as any;

    expect(await new WarehouseQueries(prisma).get('org-a', 'pt-other')).toBeNull();
    expect(prisma.packAudit.findMany).not.toHaveBeenCalled();
  });

  it('lists active cartons in the org, optionally at one location', async () => {
    const prisma = { cartonCatalogue: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const queries = new WarehouseQueries(prisma);

    await queries.listActive('org-a');
    await queries.listActive('org-a', 'loc-1');

    expect(prisma.cartonCatalogue.findMany.mock.calls[0][0].where).toEqual({ orgId: 'org-a', active: true });
    expect(prisma.cartonCatalogue.findMany.mock.calls[1][0].where).toEqual({ orgId: 'org-a', active: true, locationId: 'loc-1' });
  });

  it('skips the task counts when a shipment has no orders', async () => {
    const prisma = { pickTask: { count: jest.fn() }, packTask: { count: jest.fn() }, loadPlan: { count: jest.fn().mockResolvedValue(1) } } as any;

    const progress = await new WarehouseQueries(prisma).forShipment('org-a', 'ship-1', []);

    expect(progress).toEqual({ pendingPickTasks: 0, pendingPackTasks: 0, openLoadPlans: 1 });
    expect(prisma.pickTask.count).not.toHaveBeenCalled();
  });
});
