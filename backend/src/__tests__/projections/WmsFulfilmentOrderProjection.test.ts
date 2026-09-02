import { WmsFulfilmentOrderProjection } from '../../events/projections/WmsFulfilmentOrderProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';
import type { FulfilmentDemandSnapshot } from '../../ports/fulfilmentDemand';

const snapshot: FulfilmentDemandSnapshot = {
  orgId: 'test-org',
  sourceType: 'tms_order',
  sourceId: 'order-1',
  orderNumber: 'ORD-001',
  poNumber: 'PO-9',
  status: 'verified',
  customerId: 'cust-1',
  customerName: 'Acme',
  originLocationId: 'loc-1',
  serviceLevel: 'LTL',
  temperatureControl: 'ambient',
  hazmat: false,
  requestedPickupDate: null,
  requestedDeliveryDate: null,
  sourceCreatedAt: new Date('2026-09-01T10:00:00Z'),
  lines: [
    { sourceLineId: 'line-1', sku: 'SKU-1', description: 'Widget', quantity: 4, unitOfMeasure: 'each', weight: 2, hazmat: false, temperature: null },
    { sourceLineId: 'line-2', sku: 'SKU-2', description: null, quantity: 6, unitOfMeasure: 'cases', weight: null, hazmat: false, temperature: null },
  ],
};

function build(overrides: Partial<FulfilmentDemandSnapshot> = {}) {
  const demandSource = {
    getSnapshot: jest.fn().mockResolvedValue({ ...snapshot, ...overrides }),
    listSourceIds: jest.fn().mockResolvedValue([]),
  };
  const prisma = {
    wmsFulfilmentOrder: {
      upsert: jest.fn().mockResolvedValue({ id: 'demand-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    wmsFulfilmentOrderLine: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  } as any;

  return { projection: new WmsFulfilmentOrderProjection(prisma, demandSource as any), prisma, demandSource };
}

describe('WmsFulfilmentOrderProjection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribes to order and order line events only', () => {
    const { projection } = build();

    expect(projection.name).toBe('projection.wms_fulfilment_order');
    expect(projection.eventPatterns).toEqual(['order.*', 'order_line_item.*']);
  });

  it('writes the demand and its lines on order.created', async () => {
    const { projection, prisma } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_CREATED, 'order', 'order-1', {}));

    expect(prisma.wmsFulfilmentOrder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_sourceType_sourceId: { orgId: 'test-org', sourceType: 'tms_order', sourceId: 'order-1' } },
        create: expect.objectContaining({ orderNumber: 'ORD-001', status: 'verified', lineCount: 2, totalQuantity: 10 }),
        update: expect.objectContaining({ status: 'verified', lineCount: 2, totalQuantity: 10 }),
      })
    );
    expect(prisma.wmsFulfilmentOrderLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ sourceLineId: 'line-1', sku: 'SKU-1', quantity: 4, orgId: 'test-org' }),
          expect.objectContaining({ sourceLineId: 'line-2', sku: 'SKU-2', quantity: 6, unitOfMeasure: 'cases' }),
        ],
      })
    );
  });

  it('replaces the lines rather than merging them, so an upstream deletion disappears here', async () => {
    const { projection, prisma } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_UPDATED, 'order', 'order-1', {}));

    expect(prisma.wmsFulfilmentOrderLine.deleteMany).toHaveBeenCalledWith({ where: { fulfilmentOrderId: 'demand-1' } });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('re-projects the whole order when one line changes, using the payload order id', async () => {
    const { projection, demandSource } = build();

    await projection.handle(
      createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_UPDATED, 'order_line_item', 'line-2', { orderId: 'order-1' })
    );

    expect(demandSource.getSnapshot).toHaveBeenCalledWith('test-org', 'order-1');
  });

  it('ignores a line event with no order id rather than guessing', async () => {
    const { projection, demandSource } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_CREATED, 'order_line_item', 'line-3', {}));

    expect(demandSource.getSnapshot).not.toHaveBeenCalled();
  });

  it('carries a status change through, so the order drops out of wave eligibility', async () => {
    const { projection, prisma } = build({ status: 'cancelled' });

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_STATUS_CHANGED, 'order', 'order-1', {}));

    expect(prisma.wmsFulfilmentOrder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ status: 'cancelled' }) })
    );
  });

  it('removes the demand on order.deleted', async () => {
    const { projection, prisma, demandSource } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_DELETED, 'order', 'order-1', {}));

    expect(demandSource.getSnapshot).not.toHaveBeenCalled();
    expect(prisma.wmsFulfilmentOrder.deleteMany).toHaveBeenCalledWith({
      where: { orgId: 'test-org', sourceType: 'tms_order', sourceId: 'order-1' },
    });
  });

  it('removes the demand when the source no longer resolves', async () => {
    const { projection, prisma, demandSource } = build();
    demandSource.getSnapshot.mockResolvedValue(null);

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_UPDATED, 'order', 'order-1', {}));

    expect(prisma.wmsFulfilmentOrder.deleteMany).toHaveBeenCalled();
    expect(prisma.wmsFulfilmentOrder.upsert).not.toHaveBeenCalled();
  });

  it('ignores events that do not change what the warehouse has to pick', async () => {
    const { projection, demandSource } = build();

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_DELIVERED, 'order', 'order-1', {}));

    expect(demandSource.getSnapshot).not.toHaveBeenCalled();
  });
});
