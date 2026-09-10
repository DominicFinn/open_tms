import { SplitOrderCommandHandler, SPLIT_ORDER } from '../../commands/orders/SplitOrderCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makeOrder(overrides: any = {}) {
  return {
    id: 'order-1',
    orgId: 'test-org',
    orderNumber: 'ORD-001',
    status: 'verified',
    customerId: 'cust-1',
    originId: 'loc-origin',
    destinationId: 'loc-dest',
    requestedPickupDate: null,
    requestedDeliveryDate: null,
    customer: { id: 'cust-1', name: 'Acme' },
    trackableUnits: [
      { id: 'unit-1', identifier: 'U1', unitType: 'pallet', lineItems: [] },
      { id: 'unit-2', identifier: 'U2', unitType: 'pallet', lineItems: [] },
    ],
    lineItems: [],
    ...overrides,
  };
}

function makeTx(order: any) {
  let shipmentSeq = 0;
  return {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue({}),
    },
    shipment: {
      create: jest.fn().mockImplementation(() => Promise.resolve({ id: `ship-${++shipmentSeq}`, items: [] })),
    },
    orderShipment: { create: jest.fn().mockResolvedValue({}) },
    shipmentStop: { create: jest.fn().mockResolvedValue({ id: 'stop-1' }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

const twoGroups = [
  { trackableUnitIds: ['unit-1'], legacyItemIds: [] },
  { trackableUnitIds: ['unit-2'], legacyItemIds: [] },
];

describe('SplitOrderCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates one draft shipment per group and emits SHIPMENT_CREATED for each', async () => {
    const order = makeOrder();
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new SplitOrderCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(SPLIT_ORDER, { orderId: 'order-1', groups: twoGroups }, { orgId: 'test-org', actorId: 'user-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.shipmentIds).toEqual(['ship-1', 'ship-2']);
    expect(tx.shipment.create).toHaveBeenCalledTimes(2);

    const shipmentCreatedEvents = result.events.filter((e) => e.type === EVENT_TYPES.SHIPMENT_CREATED);
    expect(shipmentCreatedEvents).toHaveLength(2);
    expect(shipmentCreatedEvents.map((e) => e.entityId)).toEqual(['ship-1', 'ship-2']);

    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'order-1' }, data: { status: 'assigned' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changes: expect.objectContaining({ splitGroups: 2, splitShipmentIds: ['ship-1', 'ship-2'] }),
        }),
      })
    );
  });

  it('rejects fewer than 2 groups', async () => {
    const order = makeOrder();
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new SplitOrderCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(SPLIT_ORDER, { orderId: 'order-1', groups: [twoGroups[0]] }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/At least 2 groups/);
    expect(tx.shipment.create).not.toHaveBeenCalled();
  });

  it('rejects a trackable unit assigned to multiple groups', async () => {
    const order = makeOrder();
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new SplitOrderCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(SPLIT_ORDER, {
        orderId: 'order-1',
        groups: [{ trackableUnitIds: ['unit-1'], legacyItemIds: [] }, { trackableUnitIds: ['unit-1'], legacyItemIds: [] }],
      }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/assigned to multiple groups/);
  });

  it('rejects an order that is already assigned', async () => {
    const order = makeOrder({ status: 'assigned' });
    const tx = makeTx(order);
    const prisma = makePrisma(tx);
    const { bus } = mockEventBus();
    const handler = new SplitOrderCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(SPLIT_ORDER, { orderId: 'order-1', groups: twoGroups }, { orgId: 'test-org' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Order already assigned/);
  });
});
