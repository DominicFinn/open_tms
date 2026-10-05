jest.mock('../../commands/orders/combineOrdersIntoNewShipment', () => ({
  combineOrdersIntoNewShipment: jest.fn(async (_tx: any, _cmd: any, orders: any[]) => `ship-${orders[0].customerId}`),
}));
jest.mock('../../commands/consolidations/consolidationMembership', () => ({
  ...jest.requireActual('../../commands/consolidations/consolidationMembership'),
  attachShipments: jest.fn().mockResolvedValue(undefined),
  rebuildConsolidationStops: jest.fn().mockResolvedValue({ stopCount: 4, changedShipmentIds: [] }),
}));

import { ShipOrdersTogetherCommandHandler, SHIP_ORDERS_TOGETHER, shipTogetherRefusal } from '../../commands/consolidations/ShipOrdersTogetherCommand';
import { combineOrdersIntoNewShipment } from '../../commands/orders/combineOrdersIntoNewShipment';
import { attachShipments } from '../../commands/consolidations/consolidationMembership';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const order = (id: string, customerId: string, overrides: object = {}) => ({
  id, orderNumber: `ORD-${id}`, customerId, status: 'verified', serviceLevel: 'LTL', originId: 'o', destinationId: 'd', ...overrides,
});

function setup(orders: any[]) {
  const tx: any = {
    order: { findMany: jest.fn().mockResolvedValue(orders) },
    consolidation: { create: jest.fn(async ({ data }: any) => ({ id: 'con-1', ...data })) },
    domainEventLog: { create: jest.fn() },
  };
  const prisma: any = { $transaction: jest.fn((fn: Function) => fn(tx)), domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) } };
  return { tx, handler: new ShipOrdersTogetherCommandHandler(prisma, mockEventBus().bus as any) };
}

beforeEach(() => jest.clearAllMocks());

describe('shipTogetherRefusal (#329)', () => {
  it('takes available LTL orders for two or more customers', () => {
    expect(shipTogetherRefusal([order('1', 'nordic'), order('2', 'axiom')])).toBeNull();
  });

  it('explains every refusal', () => {
    expect(shipTogetherRefusal([order('1', 'nordic'), order('2', 'nordic')])).toBe('These orders are all for one customer, so they make one shipment, not a consolidation.');
    expect(shipTogetherRefusal([order('1', 'nordic', { status: 'assigned' }), order('2', 'axiom')])).toBe('Only available orders can be shipped: ORD-1.');
    expect(shipTogetherRefusal([order('1', 'nordic', { serviceLevel: 'FTL' }), order('2', 'axiom')])).toBe('FTL orders ship on their own shipment: ORD-1.');
    expect(shipTogetherRefusal([order('1', 'nordic', { originId: null }), order('2', 'axiom')])).toBe('Orders need a pickup and a drop: ORD-1.');
  });
});

describe('ShipOrdersTogetherCommandHandler (#329)', () => {
  it('makes one shipment per customer and puts them all on a new consolidation', async () => {
    const orders = [order('1', 'nordic'), order('2', 'axiom'), order('3', 'nordic')];
    const { tx, handler } = setup(orders);
    const command = createTestCommand(SHIP_ORDERS_TOGETHER, { orderIds: ['1', '2', '3'] }, { metadata: { correlationId: 'corr-5', source: 'test' } });

    const result = await handler.execute(command);

    expect(result).toMatchObject({ success: true, data: { consolidationId: 'con-1', shipmentIds: ['ship-nordic', 'ship-axiom'] } });
    const groups = (combineOrdersIntoNewShipment as jest.Mock).mock.calls.map((c) => c[2].map((o: any) => o.id));
    expect(groups).toEqual([['1', '3'], ['2']]);
    expect(tx.order.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['1', '2', '3'] }, orgId: 'test-org', archived: false });
    expect(tx.consolidation.create.mock.calls[0][0].data).toMatchObject({ orgId: 'test-org' });
    expect(attachShipments).toHaveBeenCalledWith(tx, 'test-org', 'con-1', ['ship-nordic', 'ship-axiom']);
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.CONSOLIDATION_CREATED, payload: { shipmentIds: ['ship-nordic', 'ship-axiom'], orderIds: ['1', '2', '3'] } });
    expect(result.events[0].metadata).toMatchObject({ correlationId: 'corr-5' });
  });

  it('builds nothing when the orders are refused or one is missing', async () => {
    const oneCustomer = setup([order('1', 'nordic'), order('2', 'nordic')]);
    expect(await oneCustomer.handler.execute(createTestCommand(SHIP_ORDERS_TOGETHER, { orderIds: ['1', '2'] })))
      .toMatchObject({ success: false, error: 'These orders are all for one customer, so they make one shipment, not a consolidation.' });

    const missing = setup([order('1', 'nordic')]);
    expect(await missing.handler.execute(createTestCommand(SHIP_ORDERS_TOGETHER, { orderIds: ['1', 'x'] })))
      .toMatchObject({ success: false, error: 'Order not found' });

    expect(combineOrdersIntoNewShipment).not.toHaveBeenCalled();
    expect(oneCustomer.tx.consolidation.create).not.toHaveBeenCalled();
  });
});
