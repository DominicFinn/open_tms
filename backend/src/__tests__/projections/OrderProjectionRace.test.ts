/**
 * Regression: pg-boss can deliver `trackable_unit.*` or `order_line_item.*`
 * before `order.created` has been projected, in which case the previous
 * implementation silently dropped the count refresh (P2025 swallowed in a
 * .catch). After review fix, the projection detects the missing row and
 * materialises it from the live Order on the fly.
 */

import { OrderProjection } from '../../events/projections/OrderProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

describe('OrderProjection — out-of-order delivery recovery', () => {
  it('materialises the read-model row when a trackable_unit event arrives before order.created has been projected', async () => {
    const orderRow = {
      id: 'order-late', orgId: 'org-1', orderNumber: 'ORD-LATE', poNumber: null,
      status: 'pending', deliveryStatus: 'unassigned',
      customer: { id: 'cust-1', name: 'Acme' }, customerId: 'cust-1',
      origin: null, destination: null,
      serviceLevel: 'LTL', temperatureControl: 'ambient', requiresHazmat: false,
      trackableUnits: [{ id: 'tu-1' }], lineItems: [],
      requestedDeliveryDate: null, importSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    };

    const update = jest.fn()
      // First call (refreshAggregates) fails because the read-model row hasn't been written yet.
      .mockRejectedValueOnce(Object.assign(new Error('Record to update not found'), { code: 'P2025' }))
      // Second call (after materialise) succeeds.
      .mockResolvedValueOnce({});
    const upsert = jest.fn().mockResolvedValue({});

    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(orderRow) },
      orderReadModel: { update, upsert },
      orderLineItem: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      trackableUnit: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const projection = new OrderProjection(prisma);

    const event = createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_CREATED, 'trackable_unit', 'tu-1', { orderId: 'order-late' });
    await projection.handle(event);

    // Materialise was called (upsert path) AND the count refresh re-ran.
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-late' },
      create: expect.objectContaining({ orderNumber: 'ORD-LATE', customerName: 'Acme' }),
    }));
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('still recovers for order_line_item.created events', async () => {
    const orderRow = {
      id: 'order-late', orgId: 'org-1', orderNumber: 'ORD-LATE-LI', poNumber: null,
      status: 'pending', deliveryStatus: 'unassigned',
      customer: { id: 'cust-1', name: 'Acme' }, customerId: 'cust-1',
      origin: null, destination: null,
      serviceLevel: 'LTL', temperatureControl: 'ambient', requiresHazmat: false,
      trackableUnits: [], lineItems: [{ id: 'li-1', weight: 5 }],
      requestedDeliveryDate: null, importSource: 'manual',
      createdAt: new Date(), updatedAt: new Date(),
    };
    const update = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Record to update not found'), { code: 'P2025' }))
      .mockResolvedValueOnce({});
    const upsert = jest.fn().mockResolvedValue({});

    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(orderRow) },
      orderReadModel: { update, upsert },
      orderLineItem: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([{ weight: 5, quantity: 3 }]) },
      trackableUnit: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const projection = new OrderProjection(prisma);

    await projection.handle(createTestEvent(EVENT_TYPES.ORDER_LINE_ITEM_CREATED, 'order_line_item', 'li-1', { orderId: 'order-late' }));

    expect(upsert).toHaveBeenCalledTimes(1);
    // The recovered aggregate uses weight × quantity = 15.
    expect(update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalWeight: 15 }),
    }));
  });

  it('does not crash or upsert when refresh fails for a non-P2025 reason', async () => {
    const update = jest.fn().mockRejectedValueOnce(new Error('connection lost'));
    const upsert = jest.fn();
    const prisma = {
      order: { findUnique: jest.fn() },
      orderReadModel: { update, upsert },
      orderLineItem: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      trackableUnit: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const projection = new OrderProjection(prisma);

    await projection.handle(createTestEvent(EVENT_TYPES.TRACKABLE_UNIT_DELETED, 'trackable_unit', 'tu-1', { orderId: 'order-1' }));

    expect(upsert).not.toHaveBeenCalled(); // only P2025 triggers materialisation
  });
});
