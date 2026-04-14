import { AcceptQuoteCommandHandler, ACCEPT_QUOTE } from '../../commands/quotes/AcceptQuoteCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const futureDate = new Date(Date.now() + 30 * 86400000);

const mockQuote = {
  id: 'quote-1', orgId: 'test-org', quoteNumber: 'QTE-0001',
  customerId: 'cust-1', status: 'draft', version: 1,
  totalRevenueCents: 172500, totalCostCents: 150000,
  marginCents: 22500, marginPercent: 13.04,
  currency: 'USD', serviceLevel: 'FTL',
  validFrom: new Date(), validUntil: futureDate,
  originId: 'loc-1', destinationId: 'loc-2',
  customer: { name: 'Acme Corp' },
  lineItems: [
    { id: 'qli-1', chargeType: 'linehaul', description: 'Linehaul Chicago-Dallas',
      amountCents: 172500, currency: 'USD', quantity: 1,
      accessorialCode: null, freightClass: null, weight: null, ratePerCwt: null },
  ],
};

function buildMockTx(orgType = 'broker') {
  return {
    customer: { findUnique: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Acme Corp' }) },
    quote: {
      findUnique: jest.fn().mockResolvedValue(mockQuote),
      update: jest.fn().mockResolvedValue(mockQuote),
    },
    order: { create: jest.fn().mockResolvedValue({ id: 'order-1' }) },
    charge: { create: jest.fn().mockResolvedValue({ id: 'charge-1' }) },
    organization: {
      findFirst: jest.fn().mockResolvedValue({ organizationType: orgType }),
    },
    shipment: {
      create: jest.fn().mockResolvedValue({ id: 'ship-1', reference: 'SH-Q-0001' }),
      count: jest.fn().mockResolvedValue(0),
    },
    orderShipment: { create: jest.fn().mockResolvedValue({}) },
    shipmentFinancialSummary: { create: jest.fn().mockResolvedValue({}) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

function buildMockPrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('Broker Quote-to-Book', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a shipment when createShipment=true and org is broker', async () => {
    const tx = buildMockTx('broker');
    const prisma = buildMockPrisma(tx);
    const { bus, persisted } = mockEventBus();
    const handler = new AcceptQuoteCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1', createShipment: true })
    );

    expect(result.success).toBe(true);
    expect(result.data?.shipmentId).toBe('ship-1');

    // Should have created a shipment with status 'booked'
    expect(tx.shipment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerId: 'cust-1',
        originId: 'loc-1',
        destinationId: 'loc-2',
        status: 'booked',
      }),
    }));

    // Should have created a financial summary
    expect(tx.shipmentFinancialSummary.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        expectedRevenueCents: 172500,
        expectedCostCents: 150000,
        expectedMarginCents: 22500,
      }),
    }));

    // Should have linked order to shipment
    expect(tx.orderShipment.create).toHaveBeenCalled();

    // Should have created revenue charges on shipment
    const chargeCallsForShipment = tx.charge.create.mock.calls.filter(
      (c: any) => c[0].data.shipmentId === 'ship-1'
    );
    expect(chargeCallsForShipment.length).toBeGreaterThan(0);
  });

  it('emits SHIPMENT_CREATED event when creating shipment', async () => {
    const tx = buildMockTx('broker');
    const prisma = buildMockPrisma(tx);
    const { bus, persisted } = mockEventBus();
    const handler = new AcceptQuoteCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1', createShipment: true })
    );

    const shipmentEvent = persisted.find(e => e.type === EVENT_TYPES.SHIPMENT_CREATED);
    expect(shipmentEvent).toBeDefined();
    expect(shipmentEvent?.payload).toMatchObject({
      customerId: 'cust-1',
      status: 'booked',
    });
  });

  it('does not create shipment when createShipment is false', async () => {
    const tx = buildMockTx('broker');
    const prisma = buildMockPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AcceptQuoteCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1', createShipment: false })
    );

    expect(result.success).toBe(true);
    expect(result.data?.shipmentId).toBeNull();
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it('does not create shipment when createShipment is not provided', async () => {
    const tx = buildMockTx('broker');
    const prisma = buildMockPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new AcceptQuoteCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it('includes shipmentId in QUOTE_ACCEPTED event payload', async () => {
    const tx = buildMockTx('broker');
    const prisma = buildMockPrisma(tx);
    const { bus, persisted } = mockEventBus();
    const handler = new AcceptQuoteCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1', createShipment: true })
    );

    const quoteEvent = persisted.find(e => e.type === EVENT_TYPES.QUOTE_ACCEPTED);
    expect(quoteEvent).toBeDefined();
    expect(quoteEvent?.payload).toMatchObject({
      shipmentId: 'ship-1',
    });
  });
});
