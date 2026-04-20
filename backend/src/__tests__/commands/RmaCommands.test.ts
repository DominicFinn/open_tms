import { CreateRmaCommandHandler, CREATE_RMA } from '../../commands/rma/CreateRmaCommand';
import { AuthorizeRmaCommandHandler, AUTHORIZE_RMA } from '../../commands/rma/AuthorizeRmaCommand';
import { RejectRmaCommandHandler, REJECT_RMA } from '../../commands/rma/RejectRmaCommand';
import { ReceiveRmaLineCommandHandler, RECEIVE_RMA_LINE } from '../../commands/rma/ReceiveRmaLineCommand';
import { InspectRmaLineCommandHandler, INSPECT_RMA_LINE } from '../../commands/rma/InspectRmaLineCommand';
import { CompleteRmaCommandHandler, COMPLETE_RMA } from '../../commands/rma/CompleteRmaCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

describe('CreateRmaCommand', () => {
  const mockOrder = {
    id: 'order-1',
    customerId: 'cust-1',
    lineItems: [
      { id: 'oli-1', sku: 'SKU-A', quantity: 5, unitPriceCents: 1000 },
      { id: 'oli-2', sku: 'SKU-B', quantity: 2, unitPriceCents: 2500 },
    ],
  };

  it('creates an RMA with suggested refund calculated from order line prices', async () => {
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue(mockOrder) },
      rma: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'rma-1', rmaNumber: 'RMA-x', status: 'requested', orgId: 'test-org' }) },
      rmaLine: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_RMA, {
        customerId: 'cust-1',
        orderId: 'order-1',
        returnReason: 'wrong_item',
        lines: [
          { orderLineItemId: 'oli-1', sku: 'SKU-A', requestedQuantity: 2 },  // 2 * 1000 = 2000
          { orderLineItemId: 'oli-2', sku: 'SKU-B', requestedQuantity: 1 },  // 1 * 2500 = 2500
        ],
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.suggestedRefundCents).toBe(4500);
    expect(result.data?.status).toBe('requested');
    expect(result.events[0].type).toBe(EVENT_TYPES.RMA_REQUESTED);
  });

  it('auto-authorizes when autoAuthorize is true and emits both events', async () => {
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue(mockOrder) },
      rma: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({ id: 'rma-1', rmaNumber: 'RMA-x', status: 'authorized', orgId: 'test-org' }) },
      rmaLine: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_RMA, {
        customerId: 'cust-1',
        orderId: 'order-1',
        returnReason: 'damaged',
        autoAuthorize: true,
        lines: [{ orderLineItemId: 'oli-1', sku: 'SKU-A', requestedQuantity: 1 }],
      })
    );

    expect(result.success).toBe(true);
    expect(result.events.map(e => e.type)).toEqual([EVENT_TYPES.RMA_REQUESTED, EVENT_TYPES.RMA_AUTHORIZED]);
  });

  it('rejects when requested quantity exceeds order quantity', async () => {
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue(mockOrder) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_RMA, {
        customerId: 'cust-1',
        orderId: 'order-1',
        returnReason: 'damaged',
        lines: [{ orderLineItemId: 'oli-1', sku: 'SKU-A', requestedQuantity: 10 }],  // order only has 5
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot return');
  });

  it('rejects when order does not belong to customer', async () => {
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue({ ...mockOrder, customerId: 'cust-other' }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_RMA, {
        customerId: 'cust-1',
        orderId: 'order-1',
        returnReason: 'damaged',
        lines: [{ orderLineItemId: 'oli-1', sku: 'SKU-A', requestedQuantity: 1 }],
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not belong');
  });
});

describe('AuthorizeRmaCommand', () => {
  it('moves RMA from requested to authorized', async () => {
    const tx = {
      rma: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rma-1', rmaNumber: 'RMA-001', status: 'requested', customerId: 'c1', orderId: 'o1' }),
        update: jest.fn().mockResolvedValue({ id: 'rma-1', rmaNumber: 'RMA-001', status: 'authorized' }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new AuthorizeRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(AUTHORIZE_RMA, { rmaId: 'rma-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('authorized');
    expect(result.events[0].type).toBe(EVENT_TYPES.RMA_AUTHORIZED);
  });

  it('rejects if RMA is not in requested state', async () => {
    const tx = {
      rma: { findUnique: jest.fn().mockResolvedValue({ id: 'rma-1', status: 'completed' }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new AuthorizeRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(AUTHORIZE_RMA, { rmaId: 'rma-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot authorize');
  });
});

describe('RejectRmaCommand', () => {
  it('rejects a requested RMA with notes', async () => {
    const tx = {
      rma: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rma-1', rmaNumber: 'RMA-001', status: 'requested', customerId: 'c1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new RejectRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(REJECT_RMA, { rmaId: 'rma-1', rejectionNotes: 'Outside return window' })
    );

    expect(result.success).toBe(true);
    expect(result.events[0].type).toBe(EVENT_TYPES.RMA_REJECTED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({
      rejectionNotes: 'Outside return window',
    }));
  });
});

describe('ReceiveRmaLineCommand', () => {
  it('records physical receipt and moves unit to quarantine', async () => {
    const mockLine = {
      id: 'line-1',
      rmaId: 'rma-1',
      rma: { id: 'rma-1', status: 'authorized', rmaNumber: 'RMA-001' },
      requestedQuantity: 3,
      receivedQuantity: 0,
    };
    const tx = {
      rmaLine: {
        findUnique: jest.fn().mockResolvedValue(mockLine),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ ...mockLine, receivedQuantity: 3 }]),
      },
      rma: { update: jest.fn().mockResolvedValue({}) },
      warehouseBin: { findUnique: jest.fn().mockResolvedValue({ zoneId: 'zone-q' }) },
      trackableUnit: { update: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ReceiveRmaLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECEIVE_RMA_LINE, {
        rmaLineId: 'line-1',
        receivedQuantity: 3,
        quarantineBinId: 'bin-q',
        trackableUnitId: 'unit-1',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.receivedQuantity).toBe(3);
    expect(result.data?.rmaFullyReceived).toBe(true);
    expect(tx.trackableUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ qualityStatus: 'quarantine' }) })
    );
    expect(result.events.some(e => e.type === EVENT_TYPES.RMA_GOODS_RECEIVED)).toBe(true);
  });

  it('rejects if received quantity exceeds requested', async () => {
    const tx = {
      rmaLine: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'line-1', rma: { status: 'authorized' }, requestedQuantity: 2,
        }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new ReceiveRmaLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECEIVE_RMA_LINE, { rmaLineId: 'line-1', receivedQuantity: 5 })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('exceeds requested');
  });
});

describe('InspectRmaLineCommand', () => {
  it('sets disposition and routes unit', async () => {
    const tx = {
      rmaLine: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'line-1',
          rma: { id: 'rma-1', rmaNumber: 'RMA-001', status: 'received' },
          disposition: 'pending',
          receivedQuantity: 3,
          trackableUnitId: 'unit-1',
          sku: 'SKU-A',
        }),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([{ id: 'line-1', disposition: 'pending' }]),
      },
      rma: { update: jest.fn().mockResolvedValue({}) },
      warehouseBin: { findUnique: jest.fn().mockResolvedValue({ zoneId: 'zone-a' }) },
      trackableUnit: { update: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new InspectRmaLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(INSPECT_RMA_LINE, {
        rmaLineId: 'line-1',
        inspectionStatus: 'pass',
        disposition: 'restock',
        routeToBinId: 'bin-bulk',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.disposition).toBe('restock');
    expect(result.data?.allLinesDispositioned).toBe(true);
    expect(tx.trackableUnit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ qualityStatus: 'available' }) })
    );
    expect(result.events.some(e => e.type === EVENT_TYPES.RMA_LINE_INSPECTED)).toBe(true);
    expect(result.events.some(e => e.type === EVENT_TYPES.RMA_DISPOSITION_SET)).toBe(true);
  });

  it('rejects invalid disposition', async () => {
    const tx = {
      rmaLine: { findUnique: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new InspectRmaLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(INSPECT_RMA_LINE, {
        rmaLineId: 'line-1',
        inspectionStatus: 'pass',
        disposition: 'invalid_value',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid disposition');
  });

  it('rejects if line already has disposition', async () => {
    const tx = {
      rmaLine: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'line-1', rma: {}, disposition: 'restock', receivedQuantity: 3,
        }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new InspectRmaLineCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(INSPECT_RMA_LINE, {
        rmaLineId: 'line-1',
        inspectionStatus: 'pass',
        disposition: 'refurb',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('already has disposition');
  });
});

describe('CompleteRmaCommand', () => {
  it('completes RMA, generates inventory for restock lines, emits events', async () => {
    const restockLine = {
      id: 'line-1', sku: 'SKU-A', disposition: 'restock',
      receivedQuantity: 2, currentBinId: 'bin-restock', trackableUnitId: 'unit-1',
    };
    const scrapLine = {
      id: 'line-2', sku: 'SKU-B', disposition: 'scrap',
      receivedQuantity: 1, currentBinId: null, trackableUnitId: null,
    };
    const mockRma = {
      id: 'rma-1', rmaNumber: 'RMA-001', status: 'dispositioning',
      customerId: 'c1', orderId: 'o1',
      suggestedRefundCents: 5000,
      lines: [restockLine, scrapLine],
    };
    const tx = {
      rma: {
        findUnique: jest.fn().mockResolvedValue(mockRma),
        update: jest.fn().mockResolvedValue({}),
      },
      inventoryRecord: {
        findFirst: jest.fn().mockResolvedValue(null),  // no existing record
        create: jest.fn().mockResolvedValue({ id: 'inv-new', quantityOnHand: 2 }),
        update: jest.fn().mockResolvedValue({}),
      },
      warehouseBin: { findUnique: jest.fn().mockResolvedValue({ locationId: 'loc-1' }) },
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_RMA, { rmaId: 'rma-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.restockTasksCreated).toBe(1);
    expect(result.data?.actualRefundCents).toBe(5000);  // uses suggested
    expect(tx.inventoryRecord.create).toHaveBeenCalled();
    expect(tx.inventoryTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionType: 'receive',
          reasonCode: 'return',
          referenceType: 'rma',
        }),
      })
    );
    expect(result.events.some(e => e.type === EVENT_TYPES.RMA_COMPLETED)).toBe(true);
  });

  it('emits refund adjustment event when finance overrides suggested amount', async () => {
    const mockRma = {
      id: 'rma-1', rmaNumber: 'RMA-001', status: 'dispositioning',
      suggestedRefundCents: 5000,
      lines: [
        { id: 'line-1', sku: 'SKU-A', disposition: 'scrap', receivedQuantity: 1, currentBinId: null },
      ],
    };
    const tx = {
      rma: { findUnique: jest.fn().mockResolvedValue(mockRma), update: jest.fn() },
      inventoryRecord: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      inventoryTransaction: { create: jest.fn() },
      warehouseBin: { findUnique: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_RMA, {
        rmaId: 'rma-1',
        actualRefundCents: 4500,
        refundAdjustmentNotes: 'Restocking fee deducted',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.actualRefundCents).toBe(4500);
    expect(result.events.some(e => e.type === EVENT_TYPES.RMA_REFUND_ADJUSTED)).toBe(true);
  });

  it('rejects if lines still have pending dispositions', async () => {
    const tx = {
      rma: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rma-1', status: 'received',
          lines: [
            { id: 'line-1', disposition: 'restock' },
            { id: 'line-2', disposition: 'pending' },
          ],
        }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteRmaCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_RMA, { rmaId: 'rma-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('pending disposition');
  });
});
