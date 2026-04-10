import { CreateCarrierUserCommandHandler, CREATE_CARRIER_USER } from '../../commands/carrierUsers/CreateCarrierUserCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockUser = {
  id: 'cu-1', carrierId: 'carrier-1', email: 'driver@fast.com',
  name: 'John Driver', createdAt: new Date(),
};

const mockTx = {
  carrierUser: { create: jest.fn().mockResolvedValue(mockUser) },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('CarrierUser Command Handlers', () => {
  it('creates carrier user and emits CARRIER_USER_CREATED', async () => {
    const { bus } = mockEventBus();
    const handler = new CreateCarrierUserCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_CARRIER_USER, {
        carrierId: 'carrier-1',
        email: 'driver@fast.com',
        name: 'John Driver',
        passwordHash: 'hashed',
      })
    );

    expect(result.success).toBe(true);
    expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_USER_CREATED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({
        carrierId: 'carrier-1',
        email: 'driver@fast.com',
        name: 'John Driver',
      })
    );
  });
});
