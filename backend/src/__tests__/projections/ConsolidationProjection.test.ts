import { ConsolidationProjection } from '../../events/projections/ConsolidationProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const created = new Date('2026-10-01T09:00:00Z');

function source(overrides: object = {}) {
  return {
    id: 'con-1',
    orgId: 'test-org',
    reference: 'CON-261001-ABC123',
    status: 'draft',
    archived: false,
    createdAt: created,
    updatedAt: created,
    carrier: { name: 'Acme Freight' },
    stops: [{ location: { name: 'Green Bay' } }, { location: { name: 'Chicago' } }, { location: { name: 'Memphis' } }],
    shipments: [
      { shipment: { pickupDate: new Date('2026-10-06'), deliveryDate: new Date('2026-10-08'), customer: { id: 'cust-1', name: 'Nordic Frost' } } },
      { shipment: { pickupDate: new Date('2026-10-05'), deliveryDate: new Date('2026-10-09'), customer: { id: 'cust-2', name: 'Meridian' } } },
      { shipment: { pickupDate: null, deliveryDate: null, customer: { id: 'cust-1', name: 'Nordic Frost' } } },
    ],
    ...overrides,
  };
}

function setup(row: object | null) {
  const prisma = {
    consolidation: { findFirst: jest.fn().mockResolvedValue(row) },
    consolidationReadModel: { upsert: jest.fn().mockResolvedValue({}) },
  } as any;
  return { prisma, projection: new ConsolidationProjection(prisma) };
}

describe('ConsolidationProjection (#329)', () => {
  it('creates the read model row on consolidation.created', async () => {
    const { prisma, projection } = setup(source());
    await projection.handle(createTestEvent(EVENT_TYPES.CONSOLIDATION_CREATED, 'consolidation', 'con-1', {}));

    expect(prisma.consolidation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'con-1', orgId: 'test-org' } }));
    const { where, create } = prisma.consolidationReadModel.upsert.mock.calls[0][0];
    expect(where).toEqual({ id: 'con-1', orgId: 'test-org' });
    expect(create).toMatchObject({
      id: 'con-1',
      orgId: 'test-org',
      reference: 'CON-261001-ABC123',
      status: 'draft',
      carrierName: 'Acme Freight',
      shipmentCount: 3,
      customerCount: 2,
      customerNames: ['Nordic Frost', 'Meridian'],
      stopCount: 3,
      firstStopName: 'Green Bay',
      lastStopName: 'Memphis',
      pickupDate: new Date('2026-10-05'),
      deliveryDate: new Date('2026-10-09'),
      createdAt: created,
    });
  });

  it('refreshes the fields on consolidation.updated and when shipments change', async () => {
    const { prisma, projection } = setup(source({ carrier: null, archived: true, shipments: [], stops: [] }));
    await projection.handle(createTestEvent(EVENT_TYPES.CONSOLIDATION_UPDATED, 'consolidation', 'con-1', {}));

    expect(prisma.consolidationReadModel.upsert.mock.calls[0][0].update).toMatchObject({
      carrierName: null,
      archived: true,
      shipmentCount: 0,
      customerCount: 0,
      stopCount: 0,
      firstStopName: null,
      pickupDate: null,
    });
  });

  it('writes nothing for a consolidation that is gone', async () => {
    const { prisma, projection } = setup(null);
    await projection.handle(createTestEvent(EVENT_TYPES.CONSOLIDATION_SHIPMENT_ADDED, 'consolidation', 'con-x', {}));
    expect(prisma.consolidationReadModel.upsert).not.toHaveBeenCalled();
  });
});
