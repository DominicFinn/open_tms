import { RaiseQueryCommandHandler, RAISE_QUERY } from '../../commands/queries/RaiseQueryCommand';
import { ResolveQueryCommandHandler, RESOLVE_QUERY } from '../../commands/queries/ResolveQueryCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockQuery = {
  id: 'qry-1', orgId: 'test-org', queryNumber: 'QRY-0001',
  queryType: 'customer_dispute', reason: 'overcharge',
  description: 'Overcharged for fuel surcharge', status: 'raised',
  invoiceId: 'inv-1', shipmentId: 'ship-1',
  disputedAmountCents: 15000,
};

const mockTx = {
  financialQuery: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(mockQuery),
    create: jest.fn().mockResolvedValue(mockQuery),
    update: jest.fn().mockResolvedValue(mockQuery),
  },
  creditNote: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 'cn-1', creditNoteNumber: 'CN-0001', amountCents: 15000,
    }),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Financial Query Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('RaiseQueryCommandHandler', () => {
    it('raises a query and emits FINANCIAL_QUERY_RAISED', async () => {
      const { bus } = mockEventBus();
      const handler = new RaiseQueryCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RAISE_QUERY, {
          queryType: 'customer_dispute' as const,
          invoiceId: 'inv-1',
          shipmentId: 'ship-1',
          reason: 'overcharge',
          description: 'Overcharged for fuel surcharge',
          disputedAmountCents: 15000,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.queryNumber).toBe('QRY-0001');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.FINANCIAL_QUERY_RAISED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          queryType: 'customer_dispute',
          reason: 'overcharge',
          disputedAmountCents: 15000,
        })
      );
    });
  });

  describe('ResolveQueryCommandHandler', () => {
    it('resolves with adjustment and creates credit note', async () => {
      const { bus } = mockEventBus();
      const handler = new ResolveQueryCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RESOLVE_QUERY, {
          queryId: 'qry-1',
          resolution: 'adjusted' as const,
          resolutionNotes: 'Fuel surcharge was incorrectly calculated',
          adjustmentCents: 15000,
          createCreditNote: true,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.creditNoteId).toBe('cn-1');
      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe(EVENT_TYPES.CREDIT_NOTE_CREATED);
      expect(result.events[1].type).toBe(EVENT_TYPES.FINANCIAL_QUERY_RESOLVED);
      expect(result.events[1].payload).toEqual(
        expect.objectContaining({
          resolution: 'adjusted',
          adjustmentCents: 15000,
          creditNoteId: 'cn-1',
        })
      );
    });

    it('resolves upheld without credit note', async () => {
      const { bus } = mockEventBus();
      const handler = new ResolveQueryCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RESOLVE_QUERY, {
          queryId: 'qry-1',
          resolution: 'upheld' as const,
          resolutionNotes: 'Charge was correct per contract terms',
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.FINANCIAL_QUERY_RESOLVED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ resolution: 'upheld' })
      );
    });

    it('fails for already-resolved queries', async () => {
      const txResolved = {
        ...mockTx,
        financialQuery: {
          ...mockTx.financialQuery,
          findUnique: jest.fn().mockResolvedValue({ ...mockQuery, status: 'resolved_adjusted' }),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txResolved)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ResolveQueryCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(RESOLVE_QUERY, {
          queryId: 'qry-1',
          resolution: 'adjusted' as const,
          resolutionNotes: 'test',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot resolve query');
    });
  });
});
