import { CreateQuoteCommandHandler, CREATE_QUOTE } from '../../commands/quotes/CreateQuoteCommand';
import { AcceptQuoteCommandHandler, ACCEPT_QUOTE } from '../../commands/quotes/AcceptQuoteCommand';
import { DeclineQuoteCommandHandler, DECLINE_QUOTE } from '../../commands/quotes/DeclineQuoteCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockCustomer = { id: 'cust-1', name: 'Acme Corp' };

const futureDate = new Date(Date.now() + 30 * 86400000);

const mockQuote = {
  id: 'quote-1', orgId: 'test-org', quoteNumber: 'QTE-0001',
  customerId: 'cust-1', status: 'draft', version: 1,
  totalRevenueCents: 172500, totalCostCents: 150000,
  marginCents: 22500, marginPercent: 13.04,
  currency: 'USD', serviceLevel: 'FTL',
  validFrom: new Date(), validUntil: futureDate,
  originId: null, destinationId: null,
  customer: { name: 'Acme Corp' },
  lineItems: [
    { id: 'qli-1', chargeType: 'linehaul', description: 'Linehaul Chicago-Dallas',
      amountCents: 150000, currency: 'USD', quantity: 1,
      accessorialCode: null, freightClass: null, weight: null, ratePerCwt: null },
  ],
};

const mockOrder = { id: 'order-1' };

const mockTx = {
  customer: { findUnique: jest.fn().mockResolvedValue(mockCustomer) },
  quote: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(mockQuote),
    create: jest.fn().mockResolvedValue(mockQuote),
    update: jest.fn().mockResolvedValue(mockQuote),
  },
  order: { create: jest.fn().mockResolvedValue(mockOrder) },
  charge: { create: jest.fn().mockResolvedValue({ id: 'charge-1' }) },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Quote Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateQuoteCommandHandler', () => {
    it('creates a quote with line items and emits QUOTE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateQuoteCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_QUOTE, {
          customerId: 'cust-1',
          serviceLevel: 'FTL',
          lineItems: [
            { chargeType: 'linehaul', description: 'Linehaul', amountCents: 150000 },
          ],
          markupPercent: 15,
          validDays: 30,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.quoteNumber).toBe('QTE-0001');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.QUOTE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          customerName: 'Acme Corp',
          serviceLevel: 'FTL',
        })
      );
    });

    it('fails with empty line items', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateQuoteCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_QUOTE, {
          customerId: 'cust-1',
          lineItems: [],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one line item');
    });
  });

  describe('AcceptQuoteCommandHandler', () => {
    it('accepts a quote and creates an order with revenue charges', async () => {
      const { bus } = mockEventBus();
      const handler = new AcceptQuoteCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1' })
      );

      expect(result.success).toBe(true);
      expect(result.data?.orderId).toBe('order-1');
      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe(EVENT_TYPES.QUOTE_ACCEPTED);
      expect(result.events[1].type).toBe(EVENT_TYPES.ORDER_CREATED);

      // Verify order was created
      expect(mockTx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            status: 'validated',
          }),
        })
      );

      // Verify revenue charges were created
      expect(mockTx.charge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chargeCategory: 'revenue',
            source: 'quote',
            status: 'approved',
          }),
        })
      );
    });

    it('rejects expired quotes', async () => {
      const expiredQuote = {
        ...mockQuote,
        validUntil: new Date(Date.now() - 86400000), // Yesterday
      };
      const txExpired = {
        ...mockTx,
        quote: { ...mockTx.quote, findUnique: jest.fn().mockResolvedValue(expiredQuote) },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txExpired)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new AcceptQuoteCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('rejects already-accepted quotes', async () => {
      const acceptedQuote = { ...mockQuote, status: 'accepted' };
      const txAccepted = {
        ...mockTx,
        quote: { ...mockTx.quote, findUnique: jest.fn().mockResolvedValue(acceptedQuote) },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txAccepted)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new AcceptQuoteCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(ACCEPT_QUOTE, { quoteId: 'quote-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot accept');
    });
  });

  describe('DeclineQuoteCommandHandler', () => {
    it('declines a quote and emits QUOTE_DECLINED', async () => {
      const { bus } = mockEventBus();
      const handler = new DeclineQuoteCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(DECLINE_QUOTE, {
          quoteId: 'quote-1',
          reason: 'Too expensive',
        })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.QUOTE_DECLINED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ reason: 'Too expensive' })
      );
    });
  });
});
