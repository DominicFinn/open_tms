import { CreateTenderCommandHandler, CREATE_TENDER } from '../../commands/tenders/CreateTenderCommand';
import { OpenTenderCommandHandler, OPEN_TENDER } from '../../commands/tenders/OpenTenderCommand';
import { AwardTenderCommandHandler, AWARD_TENDER } from '../../commands/tenders/AwardTenderCommand';
import { CancelTenderCommandHandler, CANCEL_TENDER } from '../../commands/tenders/CancelTenderCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockTender = {
  id: 'tender-1', shipmentId: 'ship-1', strategy: 'broadcast',
  status: 'draft', tenderDurationMinutes: 60,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  tender: {
    create: jest.fn().mockResolvedValue(mockTender),
    update: jest.fn().mockResolvedValue(mockTender),
  },
  tenderOffer: {
    updateMany: jest.fn().mockResolvedValue({ count: 3 }),
  },
  tenderBid: {
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'bid-1', carrierId: 'carrier-1', rate: 1500 }),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Tender Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateTenderCommandHandler', () => {
    it('creates tender with offers and emits TENDER_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateTenderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_TENDER, {
          shipmentId: 'ship-1',
          strategy: 'broadcast' as const,
          carrierIds: ['c1', 'c2', 'c3'],
          tenderDurationMinutes: 120,
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.TENDER_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ carrierCount: 3, strategy: 'broadcast' })
      );
    });
  });

  describe('OpenTenderCommandHandler', () => {
    it('opens tender and emits TENDER_PUBLISHED', async () => {
      const { bus } = mockEventBus();
      const handler = new OpenTenderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(OPEN_TENDER, { id: 'tender-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.TENDER_PUBLISHED);
      expect(mockTx.tenderOffer.updateMany).toHaveBeenCalled();
    });
  });

  describe('AwardTenderCommandHandler', () => {
    it('awards tender and emits TENDER_AWARDED', async () => {
      const { bus } = mockEventBus();
      const handler = new AwardTenderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(AWARD_TENDER, { tenderId: 'tender-1', bidId: 'bid-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.TENDER_AWARDED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ bidId: 'bid-1', carrierId: 'carrier-1', rate: 1500 })
      );
    });
  });

  describe('CancelTenderCommandHandler', () => {
    it('cancels tender and emits TENDER_CANCELLED', async () => {
      const { bus } = mockEventBus();
      const handler = new CancelTenderCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CANCEL_TENDER, { id: 'tender-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.TENDER_CANCELLED);
    });
  });
});
