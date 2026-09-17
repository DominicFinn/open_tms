import { CreateDeviceCommandHandler, CREATE_DEVICE } from '../../commands/devices/CreateDeviceCommand';
import { UpdateDeviceCommandHandler, UPDATE_DEVICE } from '../../commands/devices/UpdateDeviceCommand';
import { AssignDeviceCommandHandler, ASSIGN_DEVICE } from '../../commands/devices/AssignDeviceCommand';
import { UnassignDeviceCommandHandler, UNASSIGN_DEVICE } from '../../commands/devices/UnassignDeviceCommand';
import {
  ASSIGNMENT_TARGET_NOT_FOUND,
  ASSIGNMENT_TARGET_REQUIRED,
  DEVICE_EXTERNAL_ID_TAKEN,
  DEVICE_NOT_FOUND,
  statusForDeviceError,
} from '../../commands/devices/errors';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const ORG = 'org-1';

const mockDevice = {
  id: 'dev-1', orgId: ORG, externalId: 'SL-001', name: 'Tracker Alpha',
  provider: 'system_loco', model: 'HGx', displayId: 'HG-00012345',
  status: 'active',
  createdAt: new Date(), updatedAt: new Date(),
};

/** Rows that exist in ORG; anything else reads as absent, as it would for another tenant. */
function makeTx(opts: { activeAssignments?: string[]; externalIdTaken?: boolean } = {}) {
  const inOrg = (row: object) => ({ where }: any) => Promise.resolve(where.orgId === ORG || where.order?.orgId === ORG ? row : null);
  return {
    device: {
      findUnique: jest.fn().mockResolvedValue(opts.externalIdTaken ? { id: 'other' } : null),
      findFirst: jest.fn().mockImplementation(inOrg({ id: 'dev-1' })),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...mockDevice, ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...mockDevice, ...data })),
    },
    shipment: { findFirst: jest.fn().mockImplementation(inOrg({ id: 'ship-1' })) },
    order: { findFirst: jest.fn().mockImplementation(inOrg({ id: 'order-1' })) },
    trackableUnit: { findFirst: jest.fn().mockImplementation(inOrg({ id: 'unit-1' })) },
    deviceAssignment: {
      findMany: jest.fn().mockResolvedValue((opts.activeAssignments ?? []).map(id => ({ id }))),
      updateMany: jest.fn().mockResolvedValue({ count: opts.activeAssignments?.length ?? 0 }),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'assign-1', ...data })),
    },
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('CreateDeviceCommandHandler', () => {
  it('creates the device in the command org and emits device.created', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new CreateDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(
      CREATE_DEVICE,
      { externalId: 'SL-001', name: 'Tracker Alpha' },
      { orgId: ORG },
    ));

    expect(result.success).toBe(true);
    expect(tx.device.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      orgId: ORG, externalId: 'SL-001', provider: 'system_loco', status: 'active',
    }));
    expect(result.events[0].type).toBe(EVENT_TYPES.DEVICE_CREATED);
    expect(result.events[0].payload).toEqual({ externalId: 'SL-001', name: 'Tracker Alpha', provider: 'system_loco' });
  });

  it('carries the actor and correlation id onto the event', async () => {
    const { bus } = mockEventBus();
    const handler = new CreateDeviceCommandHandler(makePrisma(makeTx()), bus);
    const command = createTestCommand(
      CREATE_DEVICE,
      { externalId: 'SL-001', name: 'Tracker Alpha' },
      { orgId: ORG, actorId: 'user-7', metadata: { correlationId: 'corr-1', source: 'api' } },
    );

    const result = await handler.execute(command);

    expect(result.events[0].orgId).toBe(ORG);
    expect(result.events[0].actorId).toBe('user-7');
    expect(result.events[0].metadata.correlationId).toBe('corr-1');
  });

  it('refuses an external id that is already registered', async () => {
    const tx = makeTx({ externalIdTaken: true });
    const { bus } = mockEventBus();
    const handler = new CreateDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(CREATE_DEVICE, { externalId: 'SL-001', name: 'X' }, { orgId: ORG }));

    expect(result.success).toBe(false);
    expect(result.error).toBe(DEVICE_EXTERNAL_ID_TAKEN);
    expect(tx.device.create).not.toHaveBeenCalled();
    expect(bus.persist).not.toHaveBeenCalled();
  });
});

describe('UpdateDeviceCommandHandler', () => {
  it('applies only the allowed fields and emits device.updated', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new UpdateDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(
      UPDATE_DEVICE,
      { id: 'dev-1', changes: { name: 'Tracker Beta', orgId: 'org-2' } as any },
      { orgId: ORG },
    ));

    expect(result.success).toBe(true);
    expect(tx.device.update.mock.calls[0][0].data).toEqual({ name: 'Tracker Beta' });
    expect(result.events[0].type).toBe(EVENT_TYPES.DEVICE_UPDATED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({ changes: ['name'] }));
  });

  it("reports another org's device as not found", async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new UpdateDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(
      UPDATE_DEVICE, { id: 'dev-1', changes: { name: 'X' } }, { orgId: 'org-2' },
    ));

    expect(result.success).toBe(false);
    expect(result.error).toBe(DEVICE_NOT_FOUND);
    expect(tx.device.update).not.toHaveBeenCalled();
  });
});

describe('AssignDeviceCommandHandler', () => {
  it('releases existing assignments, assigns the device and emits both events', async () => {
    const tx = makeTx({ activeAssignments: ['old-1'] });
    const { bus } = mockEventBus();
    const handler = new AssignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(
      ASSIGN_DEVICE,
      { deviceId: 'dev-1', shipmentId: 'ship-1', purpose: 'cargo_condition' as const },
      { orgId: ORG },
    ));

    expect(result.success).toBe(true);
    expect(tx.deviceAssignment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['old-1'] } },
      data: expect.objectContaining({ active: false }),
    }));
    expect(tx.deviceAssignment.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      deviceId: 'dev-1', shipmentId: 'ship-1', purpose: 'cargo_condition', active: true,
    }));
    expect(result.events.map(e => e.type)).toEqual([EVENT_TYPES.DEVICE_UNASSIGNED, EVENT_TYPES.DEVICE_ASSIGNED]);
    expect(result.events[1].payload).toEqual(expect.objectContaining({ shipmentId: 'ship-1', purpose: 'cargo_condition' }));
  });

  it('assigns to an order', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new AssignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(ASSIGN_DEVICE, { deviceId: 'dev-1', orderId: 'order-1' }, { orgId: ORG }));

    expect(result.success).toBe(true);
    expect(tx.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'order-1', orgId: ORG } }));
    expect(tx.deviceAssignment.create.mock.calls[0][0].data.orderId).toBe('order-1');
  });

  it('requires something to assign the device to', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new AssignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(ASSIGN_DEVICE, { deviceId: 'dev-1' }, { orgId: ORG }));

    expect(result.error).toBe(ASSIGNMENT_TARGET_REQUIRED);
    expect(tx.deviceAssignment.create).not.toHaveBeenCalled();
  });

  it("refuses a shipment from another org without touching existing assignments", async () => {
    const tx = makeTx({ activeAssignments: ['old-1'] });
    tx.shipment.findFirst.mockResolvedValue(null);
    const { bus } = mockEventBus();
    const handler = new AssignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(ASSIGN_DEVICE, { deviceId: 'dev-1', shipmentId: 'foreign' }, { orgId: ORG }));

    expect(result.error).toBe(ASSIGNMENT_TARGET_NOT_FOUND);
    expect(tx.deviceAssignment.updateMany).not.toHaveBeenCalled();
    expect(tx.deviceAssignment.create).not.toHaveBeenCalled();
  });

  it('scopes a trackable unit through its order', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new AssignDeviceCommandHandler(makePrisma(tx), bus);

    await handler.execute(createTestCommand(ASSIGN_DEVICE, { deviceId: 'dev-1', trackableUnitId: 'unit-1' }, { orgId: ORG }));

    expect(tx.trackableUnit.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'unit-1', order: { orgId: ORG } },
    }));
  });

  it("reports another org's device as not found", async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new AssignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(ASSIGN_DEVICE, { deviceId: 'dev-1', shipmentId: 'ship-1' }, { orgId: 'org-2' }));

    expect(result.error).toBe(DEVICE_NOT_FOUND);
  });
});

describe('UnassignDeviceCommandHandler', () => {
  it('releases every active assignment and emits device.unassigned for each', async () => {
    const tx = makeTx({ activeAssignments: ['a1', 'a2'] });
    const { bus } = mockEventBus();
    const handler = new UnassignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(UNASSIGN_DEVICE, { deviceId: 'dev-1' }, { orgId: ORG }));

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ unassigned: true, releasedAssignments: 2 });
    expect(result.events.map(e => e.payload)).toEqual([{ assignmentId: 'a1' }, { assignmentId: 'a2' }]);
    expect(result.events.every(e => e.type === EVENT_TYPES.DEVICE_UNASSIGNED)).toBe(true);
  });

  it('emits nothing when the device has no active assignment', async () => {
    const tx = makeTx();
    const { bus } = mockEventBus();
    const handler = new UnassignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(UNASSIGN_DEVICE, { deviceId: 'dev-1' }, { orgId: ORG }));

    expect(result.data).toEqual({ unassigned: true, releasedAssignments: 0 });
    expect(result.events).toEqual([]);
    expect(tx.deviceAssignment.updateMany).not.toHaveBeenCalled();
  });

  it("reports another org's device as not found", async () => {
    const tx = makeTx({ activeAssignments: ['a1'] });
    const { bus } = mockEventBus();
    const handler = new UnassignDeviceCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(UNASSIGN_DEVICE, { deviceId: 'dev-1' }, { orgId: 'org-2' }));

    expect(result.error).toBe(DEVICE_NOT_FOUND);
    expect(tx.deviceAssignment.updateMany).not.toHaveBeenCalled();
  });
});

describe('statusForDeviceError', () => {
  it('maps error codes onto HTTP statuses', () => {
    expect(statusForDeviceError(DEVICE_NOT_FOUND)).toBe(404);
    expect(statusForDeviceError(ASSIGNMENT_TARGET_NOT_FOUND)).toBe(404);
    expect(statusForDeviceError(DEVICE_EXTERNAL_ID_TAKEN)).toBe(409);
    expect(statusForDeviceError(ASSIGNMENT_TARGET_REQUIRED)).toBe(400);
  });
});
