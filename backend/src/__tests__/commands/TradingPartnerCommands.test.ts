import { CreateTradingPartnerCommandHandler, CREATE_TRADING_PARTNER } from '../../commands/tradingPartners/CreateTradingPartnerCommand';
import { UpdateTradingPartnerCommandHandler, UPDATE_TRADING_PARTNER } from '../../commands/tradingPartners/UpdateTradingPartnerCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockPartner = {
  id: 'tp-1', name: 'Acme EDI', entityType: 'carrier',
  active: true, createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  tradingPartner: {
    create: jest.fn().mockResolvedValue(mockPartner),
    update: jest.fn().mockResolvedValue(mockPartner),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('TradingPartner Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates trading partner and emits TRADING_PARTNER_CREATED', async () => {
    const { bus } = mockEventBus();
    const handler = new CreateTradingPartnerCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_TRADING_PARTNER, { name: 'Acme EDI', entityType: 'carrier' })
    );

    expect(result.success).toBe(true);
    expect(result.events[0].type).toBe(EVENT_TYPES.TRADING_PARTNER_CREATED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ name: 'Acme EDI', entityType: 'carrier' })
    );
  });

  it('updates trading partner and emits TRADING_PARTNER_UPDATED', async () => {
    const { bus } = mockEventBus();
    const handler = new UpdateTradingPartnerCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_TRADING_PARTNER, { id: 'tp-1', data: { name: 'Acme EDI v2' } })
    );

    expect(result.success).toBe(true);
    expect(result.events[0].type).toBe(EVENT_TYPES.TRADING_PARTNER_UPDATED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ changes: ['name'] })
    );
  });
});
