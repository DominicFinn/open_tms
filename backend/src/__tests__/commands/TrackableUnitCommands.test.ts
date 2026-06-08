import {
  CreateTrackableUnitCommandHandler, CREATE_TRACKABLE_UNIT,
  UpdateTrackableUnitCommandHandler, UPDATE_TRACKABLE_UNIT,
  DeleteTrackableUnitCommandHandler, DELETE_TRACKABLE_UNIT,
  GenerateTrackableUnitBarcodeCommandHandler, GENERATE_TRACKABLE_UNIT_BARCODE,
  AddLineItemToUnitCommandHandler, ADD_LINE_ITEM_TO_UNIT,
  MoveLineItemBetweenUnitsCommandHandler, MOVE_LINE_ITEM_BETWEEN_UNITS,
  MergeTrackableUnitsCommandHandler, MERGE_TRACKABLE_UNITS,
  SplitTrackableUnitCommandHandler, SPLIT_TRACKABLE_UNIT,
} from '../../commands/trackableUnits';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makeMockTx(overrides: Partial<any> = {}) {
  return {
    trackableUnit: {
      findFirst: jest.fn().mockResolvedValue({ sequenceNumber: 2 }),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    orderLineItem: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    domainEventLog: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

function makeMockPrisma(tx: any) {
  return {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
}

describe('CreateTrackableUnitCommandHandler', () => {
  it('assigns the next sequence number and emits trackable_unit.created', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findFirst.mockResolvedValueOnce({ sequenceNumber: 5 });
    tx.trackableUnit.create.mockResolvedValueOnce({
      id: 'tu-1', orderId: 'order-1', identifier: 'PALLET-006', unitType: 'pallet', packagingTypeId: 'pt-eur1',
    });
    const { bus } = mockEventBus();
    const handler = new CreateTrackableUnitCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(CREATE_TRACKABLE_UNIT, {
      orderId: 'order-1',
      identifier: 'PALLET-006',
      unitType: 'pallet',
      packagingTypeId: 'pt-eur1',
      weight: 850,
      weightUnit: 'kg',
      length: 120, width: 80, height: 144, dimUnit: 'cm',
      stackable: true,
    }));

    expect(result.success).toBe(true);
    expect(result.data?.sequenceNumber).toBe(6);
    expect(tx.trackableUnit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1', identifier: 'PALLET-006', sequenceNumber: 6,
        weight: 850, length: 120, width: 80, height: 144, stackable: true,
      }),
    }));
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKABLE_UNIT_CREATED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({ orderId: 'order-1', sequenceNumber: 6 }));
  });

  it('starts at sequenceNumber 1 when the order has no units yet', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findFirst.mockResolvedValueOnce(null);
    tx.trackableUnit.create.mockResolvedValueOnce({ id: 'tu-1', orderId: 'order-1', identifier: 'A', unitType: 'pallet' });
    const { bus } = mockEventBus();
    const handler = new CreateTrackableUnitCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(CREATE_TRACKABLE_UNIT, {
      orderId: 'order-1', identifier: 'A', unitType: 'pallet',
    }));

    expect(result.data?.sequenceNumber).toBe(1);
  });
});

describe('UpdateTrackableUnitCommandHandler', () => {
  it('emits an UPDATED event with the changes diff', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'tu-1', orderId: 'order-1', identifier: 'A', weight: null, stackable: true, length: null,
    });
    tx.trackableUnit.update.mockResolvedValueOnce({
      id: 'tu-1', orderId: 'order-1', identifier: 'A', weight: 850, stackable: false, length: 120,
    });
    const { bus } = mockEventBus();
    const handler = new UpdateTrackableUnitCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(UPDATE_TRACKABLE_UNIT, {
      id: 'tu-1',
      data: { weight: 850, stackable: false, length: 120 },
    }));

    expect(result.success).toBe(true);
    const evt = result.events[0];
    expect(evt.type).toBe(EVENT_TYPES.TRACKABLE_UNIT_UPDATED);
    const changes = (evt.payload as any).changes;
    expect(changes.weight).toEqual({ before: null, after: 850 });
    expect(changes.stackable).toEqual({ before: true, after: false });
    expect(changes.length).toEqual({ before: null, after: 120 });
  });
});

describe('DeleteTrackableUnitCommandHandler', () => {
  it('captures the cascaded line item count in the event payload', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'tu-1', orderId: 'order-1', identifier: 'A', _count: { lineItems: 4 },
    });
    tx.trackableUnit.delete.mockResolvedValueOnce({});
    const { bus } = mockEventBus();
    const handler = new DeleteTrackableUnitCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(DELETE_TRACKABLE_UNIT, { id: 'tu-1' }));

    expect(result.success).toBe(true);
    const evt = result.events[0];
    expect(evt.type).toBe(EVENT_TYPES.TRACKABLE_UNIT_DELETED);
    expect(evt.payload).toEqual(expect.objectContaining({ cascadedLineItems: 4, orderId: 'order-1' }));
  });
});

describe('GenerateTrackableUnitBarcodeCommandHandler', () => {
  it('writes a barcode in the TU-{id}-{timestamp} format and emits an event', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.update.mockResolvedValueOnce({ id: 'tu-1', orderId: 'order-1', barcode: 'TU-tu-1-12345' });
    const { bus } = mockEventBus();
    const handler = new GenerateTrackableUnitBarcodeCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(GENERATE_TRACKABLE_UNIT_BARCODE, { id: 'tu-1' }));

    expect(result.success).toBe(true);
    expect(result.data?.barcode).toMatch(/^TU-tu-1-\d+$/);
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKABLE_UNIT_BARCODE_GENERATED);
  });
});

describe('AddLineItemToUnitCommandHandler', () => {
  it('attaches a new OrderLineItem to the unit and propagates Phase 1 fields', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({ id: 'tu-1', orderId: 'order-1', identifier: 'A' });
    tx.orderLineItem.create.mockResolvedValueOnce({ id: 'li-1', sku: 'WIDGET', quantity: 10 });
    const { bus } = mockEventBus();
    const handler = new AddLineItemToUnitCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(ADD_LINE_ITEM_TO_UNIT, {
      unitId: 'tu-1',
      item: {
        sku: 'WIDGET', description: 'thing', quantity: 10, unitOfMeasure: 'pieces',
        weight: 5, weightUnit: 'kg', length: 30, width: 20, height: 15, dimUnit: 'cm',
        hazmat: true, unNumber: 'UN1203', hazmatClass: '3', packingGroup: 'II', properShippingName: 'Gasoline',
        hsCode: '2710.12', countryOfOrigin: 'US', tempMinC: -10, tempMaxC: 30,
        freightClass: '70', nmfcCode: '12345',
      },
    }));

    expect(result.success).toBe(true);
    expect(tx.orderLineItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1', trackableUnitId: 'tu-1', sku: 'WIDGET',
        unitOfMeasure: 'pieces', unNumber: 'UN1203', hazmatClass: '3',
        hsCode: '2710.12', tempMinC: -10, tempMaxC: 30, freightClass: '70',
      }),
    }));
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_ADDED);
  });
});

describe('MoveLineItemBetweenUnitsCommandHandler', () => {
  it('moves a line item to another unit on the same order', async () => {
    const tx = makeMockTx();
    tx.orderLineItem.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'li-1', orderId: 'order-1', trackableUnitId: 'tu-source', sku: 'WIDGET',
    });
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({ orderId: 'order-1' });
    tx.orderLineItem.update.mockResolvedValueOnce({});
    const { bus } = mockEventBus();
    const handler = new MoveLineItemBetweenUnitsCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(MOVE_LINE_ITEM_BETWEEN_UNITS, {
      lineItemId: 'li-1', targetUnitId: 'tu-target',
    }));

    expect(result.success).toBe(true);
    expect(tx.orderLineItem.update).toHaveBeenCalledWith({
      where: { id: 'li-1' },
      data: { trackableUnitId: 'tu-target' },
    });
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKABLE_UNIT_LINE_ITEM_MOVED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({
      fromUnitId: 'tu-source', toUnitId: 'tu-target',
    }));
  });

  it('rejects cross-order moves', async () => {
    const tx = makeMockTx();
    tx.orderLineItem.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'li-1', orderId: 'order-A', trackableUnitId: 'tu-source', sku: 'WIDGET',
    });
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({ orderId: 'order-B' });
    const { bus } = mockEventBus();
    const handler = new MoveLineItemBetweenUnitsCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(MOVE_LINE_ITEM_BETWEEN_UNITS, {
      lineItemId: 'li-1', targetUnitId: 'tu-target',
    }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/different order|across orders|target order/i);
    expect(result.events).toHaveLength(0);
  });

  it('allows detaching by passing targetUnitId: null', async () => {
    const tx = makeMockTx();
    tx.orderLineItem.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'li-1', orderId: 'order-1', trackableUnitId: 'tu-source', sku: 'WIDGET',
    });
    tx.orderLineItem.update.mockResolvedValueOnce({});
    const { bus } = mockEventBus();
    const handler = new MoveLineItemBetweenUnitsCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(MOVE_LINE_ITEM_BETWEEN_UNITS, {
      lineItemId: 'li-1', targetUnitId: null,
    }));

    expect(result.success).toBe(true);
    expect(tx.orderLineItem.update).toHaveBeenCalledWith({
      where: { id: 'li-1' },
      data: { trackableUnitId: null },
    });
    expect(result.events[0].payload).toEqual(expect.objectContaining({ toUnitId: null }));
  });
});

describe('MergeTrackableUnitsCommandHandler', () => {
  it('moves all source line items onto target and deletes source', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findUniqueOrThrow
      .mockResolvedValueOnce({ id: 'tu-src', orderId: 'order-1', identifier: 'A', _count: { lineItems: 3 } })
      .mockResolvedValueOnce({ id: 'tu-tgt', orderId: 'order-1', identifier: 'B' });
    tx.orderLineItem.updateMany.mockResolvedValueOnce({ count: 3 });
    tx.trackableUnit.delete.mockResolvedValueOnce({});
    const { bus } = mockEventBus();
    const handler = new MergeTrackableUnitsCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(MERGE_TRACKABLE_UNITS, {
      sourceUnitId: 'tu-src', targetUnitId: 'tu-tgt',
    }));

    expect(result.success).toBe(true);
    expect(result.data?.movedLineItems).toBe(3);
    expect(tx.orderLineItem.updateMany).toHaveBeenCalledWith({
      where: { trackableUnitId: 'tu-src' },
      data: { trackableUnitId: 'tu-tgt' },
    });
    expect(tx.trackableUnit.delete).toHaveBeenCalledWith({ where: { id: 'tu-src' } });
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKABLE_UNITS_MERGED);
  });

  it('rejects merging units from different orders', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findUniqueOrThrow
      .mockResolvedValueOnce({ id: 'tu-src', orderId: 'order-A', identifier: 'A', _count: { lineItems: 1 } })
      .mockResolvedValueOnce({ id: 'tu-tgt', orderId: 'order-B', identifier: 'B' });
    const { bus } = mockEventBus();
    const handler = new MergeTrackableUnitsCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(MERGE_TRACKABLE_UNITS, {
      sourceUnitId: 'tu-src', targetUnitId: 'tu-tgt',
    }));

    expect(result.success).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it('rejects merging a unit into itself', async () => {
    const { bus } = mockEventBus();
    const handler = new MergeTrackableUnitsCommandHandler(makeMockPrisma(makeMockTx()), bus);
    const result = await handler.execute(createTestCommand(MERGE_TRACKABLE_UNITS, {
      sourceUnitId: 'tu-x', targetUnitId: 'tu-x',
    }));
    expect(result.success).toBe(false);
  });
});

describe('SplitTrackableUnitCommandHandler', () => {
  it('creates a new unit and moves the specified lines onto it', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'tu-src', orderId: 'order-1', identifier: 'A', unitType: 'pallet',
      packagingTypeId: 'pt-eur1', weightUnit: 'kg', dimUnit: 'cm', stackable: true, notes: null, customTypeName: null,
    });
    tx.orderLineItem.findMany.mockResolvedValueOnce([{ id: 'li-1' }, { id: 'li-2' }]);
    tx.trackableUnit.findFirst.mockResolvedValueOnce({ sequenceNumber: 2 });
    tx.trackableUnit.create.mockResolvedValueOnce({ id: 'tu-new', orderId: 'order-1', sequenceNumber: 3 });
    tx.orderLineItem.updateMany.mockResolvedValueOnce({ count: 2 });
    const { bus } = mockEventBus();
    const handler = new SplitTrackableUnitCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(SPLIT_TRACKABLE_UNIT, {
      unitId: 'tu-src', lineItemIds: ['li-1', 'li-2'], newIdentifier: 'A.2',
    }));

    expect(result.success).toBe(true);
    expect(result.data?.movedLineItems).toBe(2);
    expect(tx.trackableUnit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        orderId: 'order-1', identifier: 'A.2', sequenceNumber: 3, packagingTypeId: 'pt-eur1',
      }),
    }));
    expect(tx.orderLineItem.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['li-1', 'li-2'] } },
      data: { trackableUnitId: 'tu-new' },
    });
    expect(result.events[0].type).toBe(EVENT_TYPES.TRACKABLE_UNIT_SPLIT);
  });

  it('rejects splits where the lines do not belong to the source unit', async () => {
    const tx = makeMockTx();
    tx.trackableUnit.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'tu-src', orderId: 'order-1', identifier: 'A', unitType: 'pallet',
      packagingTypeId: null, weightUnit: 'kg', dimUnit: 'cm', stackable: true, notes: null, customTypeName: null,
    });
    // Only one line actually lives on the source — the other id is bogus.
    tx.orderLineItem.findMany.mockResolvedValueOnce([{ id: 'li-1' }]);
    const { bus } = mockEventBus();
    const handler = new SplitTrackableUnitCommandHandler(makeMockPrisma(tx), bus);

    const result = await handler.execute(createTestCommand(SPLIT_TRACKABLE_UNIT, {
      unitId: 'tu-src', lineItemIds: ['li-1', 'li-bogus'], newIdentifier: 'A.2',
    }));

    expect(result.success).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it('rejects empty splits', async () => {
    const { bus } = mockEventBus();
    const handler = new SplitTrackableUnitCommandHandler(makeMockPrisma(makeMockTx()), bus);
    const result = await handler.execute(createTestCommand(SPLIT_TRACKABLE_UNIT, {
      unitId: 'tu-src', lineItemIds: [], newIdentifier: 'A.2',
    }));
    expect(result.success).toBe(false);
  });
});
