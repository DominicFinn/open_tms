import { CreateDeviceCommandHandler, CREATE_DEVICE } from '../../commands/devices/CreateDeviceCommand';
import { UpdateDeviceCommandHandler, UPDATE_DEVICE } from '../../commands/devices/UpdateDeviceCommand';
import { AssignDeviceCommandHandler, ASSIGN_DEVICE } from '../../commands/devices/AssignDeviceCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockDevice = {
  id: 'dev-1', externalId: 'SL-001', name: 'Tracker Alpha',
  provider: 'system_loco', model: 'HGx', displayId: 'HG-00012345',
  status: 'active',
  createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  device: {
    create: jest.fn().mockResolvedValue(mockDevice),
    update: jest.fn().mockResolvedValue(mockDevice),
  },
  deviceAssignment: {
    create: jest.fn().mockResolvedValue({ id: 'assign-1' }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Device Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates device and emits DEVICE_CREATED', async () => {
    const { bus } = mockEventBus();
    const handler = new CreateDeviceCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_DEVICE, { externalId: 'SL-001', name: 'Tracker Alpha', provider: 'system_loco' })
    );

    expect(result.success).toBe(true);
    expect(result.events[0].type).toBe(EVENT_TYPES.DEVICE_CREATED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ externalId: 'SL-001', provider: 'system_loco' })
    );
  });

  it('updates device and emits DEVICE_UPDATED', async () => {
    const { bus } = mockEventBus();
    const handler = new UpdateDeviceCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_DEVICE, { id: 'dev-1', data: { name: 'Tracker Beta' } })
    );

    expect(result.success).toBe(true);
    expect(result.events[0].type).toBe(EVENT_TYPES.DEVICE_UPDATED);
  });

  it('assigns device, deactivates old assignments, and emits DEVICE_ASSIGNED', async () => {
    const { bus } = mockEventBus();
    const handler = new AssignDeviceCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(ASSIGN_DEVICE, { deviceId: 'dev-1', shipmentId: 'ship-1' })
    );

    expect(result.success).toBe(true);
    expect(mockTx.deviceAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deviceId: 'dev-1', active: true },
        data: expect.objectContaining({ active: false }),
      })
    );
    expect(result.events[0].type).toBe(EVENT_TYPES.DEVICE_ASSIGNED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ shipmentId: 'ship-1' })
    );
  });
});
