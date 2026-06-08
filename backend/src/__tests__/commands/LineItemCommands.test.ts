import {
  CreateLineItemCommandHandler, CREATE_LINE_ITEM,
  UpdateLineItemCommandHandler, UPDATE_LINE_ITEM,
  DeleteLineItemCommandHandler, DELETE_LINE_ITEM,
} from '../../commands/lineItems';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makeTx() {
  return {
    order: {
      findUniqueOrThrow: jest.fn(),
    },
    orderLineItem: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    trackableUnit: {
      findUniqueOrThrow: jest.fn(),
    },
    domainEventLog: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as any;
}

function makePrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('CreateLineItemCommandHandler', () => {
  it('attaches a new line item to the order and emits order_line_item.created', async () => {
    const tx = makeTx();
    tx.order.findUniqueOrThrow.mockResolvedValueOnce({ id: 'order-1', orderNumber: 'ORD-1' });
    tx.orderLineItem.create.mockResolvedValueOnce({ id: 'li-1', sku: 'WIDGET', quantity: 5 });
    const { bus } = mockEventBus();
    const handler = new CreateLineItemCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(CREATE_LINE_ITEM, {
      orderId: 'order-1',
      item: {
        sku: 'WIDGET',
        description: 'thing',
        quantity: 5,
        unitOfMeasure: 'pieces',
        weight: 10,
        weightUnit: 'kg',
        length: 30, width: 20, height: 15, dimUnit: 'cm',
        hazmat: true,
        unNumber: 'UN1203', hazmatClass: '3', packingGroup: 'II', properShippingName: 'Gasoline',
        hsCode: '2710.12', countryOfOrigin: 'US',
        tempMinC: -10, tempMaxC: 30,
        freightClass: '85', nmfcCode: '12345',
      },
    }));

    expect(result.success).toBe(true);
    expect(tx.orderLineItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1', sku: 'WIDGET',
        unitOfMeasure: 'pieces',
        unNumber: 'UN1203', hsCode: '2710.12', tempMinC: -10, tempMaxC: 30,
      }),
    }));
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_LINE_ITEM_CREATED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({
      orderId: 'order-1', orderReference: 'ORD-1', trackableUnitId: null, sku: 'WIDGET', quantity: 5,
    }));
  });

  it('rejects when the target trackable unit belongs to a different order', async () => {
    const tx = makeTx();
    tx.order.findUniqueOrThrow.mockResolvedValueOnce({ id: 'order-1', orderNumber: 'ORD-1' });
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({ orderId: 'order-OTHER' });
    const { bus } = mockEventBus();
    const handler = new CreateLineItemCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(CREATE_LINE_ITEM, {
      orderId: 'order-1',
      trackableUnitId: 'tu-X',
      item: { sku: 'WIDGET', quantity: 1 },
    }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not belong/);
    expect(tx.orderLineItem.create).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });

  it('attaches the line item to the given trackable unit when valid', async () => {
    const tx = makeTx();
    tx.order.findUniqueOrThrow.mockResolvedValueOnce({ id: 'order-1', orderNumber: 'ORD-1' });
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({ orderId: 'order-1' });
    tx.orderLineItem.create.mockResolvedValueOnce({ id: 'li-2', sku: 'BOLT', quantity: 100 });
    const { bus } = mockEventBus();
    const handler = new CreateLineItemCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(CREATE_LINE_ITEM, {
      orderId: 'order-1',
      trackableUnitId: 'tu-1',
      item: { sku: 'BOLT', quantity: 100 },
    }));

    expect(result.success).toBe(true);
    expect(tx.orderLineItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ trackableUnitId: 'tu-1' }),
    }));
    expect(result.events[0].payload).toEqual(expect.objectContaining({ trackableUnitId: 'tu-1' }));
  });
});

describe('UpdateLineItemCommandHandler', () => {
  it('emits an UPDATED event with a changes diff', async () => {
    const tx = makeTx();
    tx.orderLineItem.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'li-1', orderId: 'order-1', sku: 'WIDGET',
      quantity: 5, weight: 10, freightClass: null, hazmat: false, trackableUnitId: null,
    });
    tx.orderLineItem.update.mockResolvedValueOnce({
      id: 'li-1', orderId: 'order-1', sku: 'WIDGET',
      quantity: 7, weight: 12, freightClass: '70', hazmat: false, trackableUnitId: null,
    });
    const { bus } = mockEventBus();
    const handler = new UpdateLineItemCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(UPDATE_LINE_ITEM, {
      id: 'li-1',
      data: { quantity: 7, weight: 12, freightClass: '70' },
    }));

    expect(result.success).toBe(true);
    const evt = result.events[0];
    expect(evt.type).toBe(EVENT_TYPES.ORDER_LINE_ITEM_UPDATED);
    const changes = (evt.payload as any).changes;
    expect(changes.quantity).toEqual({ before: 5, after: 7 });
    expect(changes.weight).toEqual({ before: 10, after: 12 });
    expect(changes.freightClass).toEqual({ before: null, after: '70' });
  });
});

describe('DeleteLineItemCommandHandler', () => {
  it('deletes the line and emits a DELETED event referencing the parent order', async () => {
    const tx = makeTx();
    tx.orderLineItem.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'li-1', orderId: 'order-1', sku: 'WIDGET', trackableUnitId: 'tu-1',
    });
    tx.orderLineItem.delete.mockResolvedValueOnce({});
    const { bus } = mockEventBus();
    const handler = new DeleteLineItemCommandHandler(makePrisma(tx), bus);

    const result = await handler.execute(createTestCommand(DELETE_LINE_ITEM, { id: 'li-1' }));

    expect(result.success).toBe(true);
    expect(tx.orderLineItem.delete).toHaveBeenCalledWith({ where: { id: 'li-1' } });
    expect(result.events[0].type).toBe(EVENT_TYPES.ORDER_LINE_ITEM_DELETED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({
      orderId: 'order-1', sku: 'WIDGET', trackableUnitId: 'tu-1',
    }));
  });
});
