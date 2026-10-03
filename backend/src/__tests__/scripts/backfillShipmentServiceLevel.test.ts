import { planServiceLevelBackfill, applyServiceLevelBackfill } from '../../scripts/backfill-shipment-service-level';

const shipment = (id: string, orgId: string, levels: string[]) => ({
  id, orgId, orderShipments: levels.map((serviceLevel) => ({ order: { serviceLevel } })),
});

describe('backfill-shipment-service-level (#325)', () => {
  it('sets a shipment whose orders agree, and lists mixed or empty ones for review', async () => {
    const prisma = {
      shipment: {
        findMany: jest.fn().mockResolvedValue([
          shipment('s1', 'org-a', ['LTL', 'LTL']),
          shipment('s2', 'org-b', ['FTL']),
          shipment('s3', 'org-a', ['FTL', 'LTL']),
          shipment('s4', 'org-b', []),
        ]),
      },
    } as any;

    const plan = await planServiceLevelBackfill(prisma);

    expect(plan.set).toEqual([
      { shipmentId: 's1', orgId: 'org-a', serviceLevel: 'LTL' },
      { shipmentId: 's2', orgId: 'org-b', serviceLevel: 'FTL' },
    ]);
    expect(plan.review.map((r) => [r.shipmentId, r.reason])).toEqual([['s3', 'orders mix FTL and LTL'], ['s4', 'no orders']]);
  });

  it('writes each shipment under its own org', async () => {
    const prisma = { shipment: { update: jest.fn().mockResolvedValue({}) } } as any;

    await applyServiceLevelBackfill(prisma, {
      set: [{ shipmentId: 's1', orgId: 'org-a', serviceLevel: 'LTL' }, { shipmentId: 's2', orgId: 'org-b', serviceLevel: 'FTL' }],
      review: [],
    });

    expect(prisma.shipment.update).toHaveBeenCalledWith({ where: { id: 's2', orgId: 'org-b' }, data: { serviceLevel: 'FTL' } });
    expect(prisma.shipment.update).toHaveBeenCalledWith({ where: { id: 's1', orgId: 'org-a' }, data: { serviceLevel: 'LTL' } });
  });
});
