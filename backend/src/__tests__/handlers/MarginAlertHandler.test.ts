import { MarginAlertHandler } from '../../events/handlers/MarginAlertHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

function buildMockPrisma(overrides: any = {}) {
  return {
    organization: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'org-1',
        marginAlertEnabled: true,
        minMarginPercent: 10,
        ...overrides.organization,
      }),
    },
    shipmentFinancialSummary: {
      findUnique: jest.fn().mockResolvedValue({
        shipmentId: 'ship-1',
        expectedRevenueCents: 10000,
        expectedCostCents: 5000,
        actualRevenueCents: 10000,
        actualCostCents: 9500,
        ...overrides.financialSummary,
      }),
    },
    shipment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ship-1',
        reference: 'SH-001',
        ...overrides.shipment,
      }),
    },
    issue: {
      findFirst: jest.fn().mockResolvedValue(overrides.existingIssue ?? null),
      create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
    },
  } as any;
}

describe('MarginAlertHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates an issue when margin drops below threshold', async () => {
    const prisma = buildMockPrisma();
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1', chargeCategory: 'cost', amountCents: 9500 },
    );

    await handler.handle(event);

    expect(prisma.issue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: 'org-1',
          category: 'margin_alert',
          priority: 'high',
          status: 'open',
          sourceEntityType: 'shipment',
          sourceEntityId: 'ship-1',
        }),
      }),
    );
  });

  it('creates critical priority issue when margin is negative', async () => {
    const prisma = buildMockPrisma({
      financialSummary: {
        shipmentId: 'ship-1',
        expectedRevenueCents: 10000,
        expectedCostCents: 5000,
        actualRevenueCents: 10000,
        actualCostCents: 11000,
      },
    });
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await handler.handle(event);

    expect(prisma.issue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority: 'critical',
        }),
      }),
    );
  });

  it('does not create issue when margin is above threshold', async () => {
    const prisma = buildMockPrisma({
      financialSummary: {
        shipmentId: 'ship-1',
        expectedRevenueCents: 10000,
        expectedCostCents: 5000,
        actualRevenueCents: 10000,
        actualCostCents: 5000, // 50% margin, well above 10% threshold
      },
    });
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await handler.handle(event);

    expect(prisma.issue.create).not.toHaveBeenCalled();
  });

  it('does not create issue when margin alerts are disabled', async () => {
    const prisma = buildMockPrisma({
      organization: { id: 'org-1', marginAlertEnabled: false, minMarginPercent: 10 },
    });
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await handler.handle(event);

    expect(prisma.shipmentFinancialSummary.findUnique).not.toHaveBeenCalled();
    expect(prisma.issue.create).not.toHaveBeenCalled();
  });

  it('does not create duplicate issue when one already exists', async () => {
    const prisma = buildMockPrisma({
      existingIssue: { id: 'existing-issue', status: 'open' },
    });
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await handler.handle(event);

    expect(prisma.issue.create).not.toHaveBeenCalled();
  });

  it('skips events without shipmentId', async () => {
    const prisma = buildMockPrisma();
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_CREATED,
      'charge',
      'charge-1',
      { orderId: 'order-1' }, // no shipmentId
    );

    await handler.handle(event);

    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('skips events that are not charge.created or charge.approved', async () => {
    const prisma = buildMockPrisma();
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_DISPUTED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await handler.handle(event);

    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  it('handles charge.approved events', async () => {
    const prisma = buildMockPrisma();
    const handler = new MarginAlertHandler(prisma);

    const event = createTestEvent(
      EVENT_TYPES.CHARGE_APPROVED,
      'charge',
      'charge-1',
      { shipmentId: 'ship-1' },
    );

    await handler.handle(event);

    expect(prisma.issue.create).toHaveBeenCalled();
  });
});
