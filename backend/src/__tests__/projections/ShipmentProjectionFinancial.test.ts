import { ShipmentProjection } from '../../events/projections/ShipmentProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

function buildMockPrisma(overrides: any = {}) {
  return {
    shipmentFinancialSummary: {
      findUnique: jest.fn().mockResolvedValue({
        shipmentId: 'ship-1',
        expectedRevenueCents: 10000,
        expectedCostCents: 5000,
        expectedMarginCents: 5000,
        actualRevenueCents: 10000,
        actualCostCents: 6000,
        actualMarginCents: 4000,
        ...overrides.financialSummary,
      }),
    },
    shipmentReadModel: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    shipment: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    shipmentStop: {
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
}

describe('ShipmentProjection - Financial Columns', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribes to charge.* events', () => {
    const prisma = buildMockPrisma();
    const projection = new ShipmentProjection(prisma);

    expect(projection.eventPatterns).toContain('charge.*');
  });

  it('updates read model financial columns on charge.created', async () => {
    const prisma = buildMockPrisma();
    const projection = new ShipmentProjection(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1', chargeCategory: 'cost', amountCents: 6000 },
    );

    await projection.handle(event);

    expect(prisma.shipmentFinancialSummary.findUnique).toHaveBeenCalledWith({
      where: { shipmentId: 'ship-1' },
    });

    expect(prisma.shipmentReadModel.update).toHaveBeenCalledWith({
      where: { id: 'ship-1' },
      data: expect.objectContaining({
        expectedRevenueCents: 10000,
        expectedCostCents: 5000,
        expectedMarginCents: 5000,
        actualRevenueCents: 10000,
        actualCostCents: 6000,
        actualMarginCents: 4000,
      }),
    });
  });

  it('updates read model on charge.approved', async () => {
    const prisma = buildMockPrisma();
    const projection = new ShipmentProjection(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_APPROVED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await projection.handle(event);

    expect(prisma.shipmentReadModel.update).toHaveBeenCalled();
  });

  it('skips charge events without shipmentId', async () => {
    const prisma = buildMockPrisma();
    const projection = new ShipmentProjection(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { orderId: 'order-1' }, // no shipmentId
    );

    await projection.handle(event);

    expect(prisma.shipmentFinancialSummary.findUnique).not.toHaveBeenCalled();
    expect(prisma.shipmentReadModel.update).not.toHaveBeenCalled();
  });

  it('skips if no financial summary exists for shipment', async () => {
    const prisma = buildMockPrisma({
      financialSummary: null, // no summary
    });
    prisma.shipmentFinancialSummary.findUnique.mockResolvedValue(null);
    const projection = new ShipmentProjection(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await projection.handle(event);

    expect(prisma.shipmentReadModel.update).not.toHaveBeenCalled();
  });
});
