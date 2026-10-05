import {
  allocateConsolidationCost, allocationEvents, splitByWeight, CONSOLIDATION_CHARGE_SOURCE,
} from '../../commands/consolidations/allocateConsolidationCost';
import { ConsolidationRuleError } from '../../commands/consolidations/consolidationMembership';
import { EVENT_TYPES } from '../../events/eventTypes';

describe('splitByWeight (#329)', () => {
  it('splits in proportion to weight, in whole cents that add up to the total', () => {
    expect(splitByWeight(100000, [300, 100])).toEqual([75000, 25000]);
    const parts = splitByWeight(1000, [1, 1, 1]);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('gives leftover cents to the largest remainders', () => {
    // Exact shares 3.33, 6.67: floors 3 and 6, the spare cent goes to the .67.
    expect(splitByWeight(10, [1, 2])).toEqual([3, 7]);
  });

  it('splits evenly when nothing is weighed, and handles nothing to split', () => {
    expect(splitByWeight(901, [0, 0])).toEqual([451, 450]);
    expect(splitByWeight(0, [5, 5])).toEqual([0, 0]);
    expect(splitByWeight(500, [])).toEqual([]);
  });
});

function setup(opts: { rate?: number | null; members?: string[]; charges?: any[]; weights?: Record<string, number>; archived?: boolean; otherCurrency?: string }) {
  const members = opts.members ?? ['ship-a', 'ship-b'];
  let charges = [...(opts.charges ?? [])];
  let n = 0;
  const tx: any = {
    consolidation: {
      findFirst: jest.fn().mockResolvedValue({
        carrierRateCents: opts.rate === undefined ? 100000 : opts.rate,
        currency: 'USD',
        archived: opts.archived ?? false,
        shipments: members.map((shipmentId) => ({ shipmentId })),
      }),
    },
    orderShipment: {
      findMany: jest.fn().mockResolvedValue(Object.entries(opts.weights ?? { 'ship-a': 300, 'ship-b': 100 })
        .map(([shipmentId, kg]) => ({ shipmentId, order: { lineItems: [{ weight: kg, weightUnit: 'kg', quantity: 1 }] } }))),
    },
    charge: {
      findMany: jest.fn(async ({ where }: any) => (where.orgId ? charges : charges)),
      findFirst: jest.fn().mockResolvedValue(opts.otherCurrency ? { currency: opts.otherCurrency } : null),
      deleteMany: jest.fn(async ({ where }: any) => { charges = charges.filter((c) => !where.id.in.includes(c.id)); return { count: 0 }; }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(charges.find((c) => c.id === where.id), data)),
      create: jest.fn(async ({ data }: any) => { const c = { id: `charge-${++n}`, ...data }; charges.push(c); return c; }),
    },
    // recalculateShipmentSummary
    shipmentFinancialSummary: { upsert: jest.fn().mockResolvedValue({}) },
  };
  // recalculateShipmentSummary reads charges by shipment through the same findMany
  return { tx, charges: () => charges };
}

describe('allocateConsolidationCost (#329)', () => {
  it('writes a pending cost charge per shipment, by weight, and refreshes each summary', async () => {
    const { tx, charges } = setup({});
    const result = await allocateConsolidationCost(tx, 'org-1', 'con-1');

    expect(result.basis).toBe('weight');
    expect(result.shares).toEqual([
      { shipmentId: 'ship-a', weightKg: 300, amountCents: 75000 },
      { shipmentId: 'ship-b', weightKg: 100, amountCents: 25000 },
    ]);
    expect(tx.charge.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      orgId: 'org-1', shipmentId: 'ship-a', chargeCategory: 'cost', chargeType: 'linehaul', amountCents: 75000,
      source: CONSOLIDATION_CHARGE_SOURCE, sourceId: 'con-1', status: 'pending', currency: 'USD',
    }) });
    expect(charges()).toHaveLength(2);
    expect(tx.shipmentFinancialSummary.upsert).toHaveBeenCalledTimes(2);
    expect(tx.consolidation.findFirst.mock.calls[0][0].where).toEqual({ id: 'con-1', orgId: 'org-1' });
  });

  it('updates existing shares in place and drops the share of a shipment that left', async () => {
    const existing = [
      { id: 'c-a', shipmentId: 'ship-a', status: 'pending', amountCents: 50000 },
      { id: 'c-gone', shipmentId: 'ship-gone', status: 'pending', amountCents: 50000 },
    ];
    const { tx, charges } = setup({ members: ['ship-a'], weights: { 'ship-a': 10 }, charges: existing });

    const result = await allocateConsolidationCost(tx, 'org-1', 'con-1', ['ship-gone']);

    expect(tx.charge.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['c-gone'] }, orgId: 'org-1', status: 'pending' } });
    expect(tx.charge.update).toHaveBeenCalledWith({ where: { id: 'c-a', orgId: 'org-1' }, data: { amountCents: 100000, currency: 'USD' } });
    expect(tx.charge.create).not.toHaveBeenCalled();
    expect(charges().map((c) => [c.id, c.amountCents])).toEqual([['c-a', 100000]]);
    expect(result.createdCharges).toEqual([]);
    // Both the remaining and the departed shipment get fresh summaries.
    expect(tx.shipmentFinancialSummary.upsert).toHaveBeenCalledTimes(2);
  });

  it('splits evenly when no order lines are weighed', async () => {
    const { tx } = setup({ rate: 901, weights: {} });
    const result = await allocateConsolidationCost(tx, 'org-1', 'con-1');
    expect(result.basis).toBe('even');
    expect(result.shares.map((s) => s.amountCents)).toEqual([451, 450]);
  });

  it('clears every share when the rate is removed or the run is archived', async () => {
    const existing = [{ id: 'c-a', shipmentId: 'ship-a', status: 'pending', amountCents: 1 }];
    const cleared = setup({ rate: null, charges: existing });
    expect((await allocateConsolidationCost(cleared.tx, 'org-1', 'con-1')).basis).toBe('none');
    expect(cleared.charges()).toEqual([]);

    const archived = setup({ archived: true, charges: existing });
    await allocateConsolidationCost(archived.tx, 'org-1', 'con-1', ['ship-a']);
    expect(archived.charges()).toEqual([]);
  });

  it('refuses to re-split once a share is approved', async () => {
    const { tx } = setup({ charges: [{ id: 'c-a', shipmentId: 'ship-a', status: 'approved', amountCents: 75000 }] });
    await expect(allocateConsolidationCost(tx, 'org-1', 'con-1')).rejects.toBeInstanceOf(ConsolidationRuleError);
    expect(tx.charge.update).not.toHaveBeenCalled();
  });

  it('refuses a shipment whose charges are in another currency', async () => {
    const { tx } = setup({ otherCurrency: 'EUR' });
    await expect(allocateConsolidationCost(tx, 'org-1', 'con-1')).rejects.toThrow('already has charges in EUR');
  });

  it('emits charge.created for new shares and the allocation itself', async () => {
    const { tx } = setup({});
    const events = allocationEvents('con-1', await allocateConsolidationCost(tx, 'org-1', 'con-1'));
    expect(events.map((e) => e.type)).toEqual([EVENT_TYPES.CHARGE_CREATED, EVENT_TYPES.CHARGE_CREATED, EVENT_TYPES.CONSOLIDATION_COST_ALLOCATED]);
    expect(events[0]).toMatchObject({ entityType: 'charge', payload: { shipmentId: 'ship-a', chargeCategory: 'cost', amountCents: 75000, source: 'consolidation' } });
    expect(events[2]).toMatchObject({ entityId: 'con-1', payload: { basis: 'weight' } });
  });
});
