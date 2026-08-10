import { ShipmentAssignmentService } from '../../services/ShipmentAssignmentService';

const mockOrder = {
  id: 'order-1',
  orderNumber: 'ORD-001',
  orgId: 'test-org',
  status: 'verified',
  originId: 'loc-1',
  destinationId: 'loc-2',
  customerId: 'cust-1',
  serviceLevel: 'LTL',
  temperatureControl: 'ambient',
  requiresHazmat: false,
  trackableUnits: [],
  lineItems: [],
};

const mockLane = {
  id: 'lane-1',
  originId: 'loc-1',
  destinationId: 'loc-2',
  archived: false,
  status: 'active',
  serviceLevel: 'LTL',
  supportsTemperatureControl: false,
  supportsHazmat: false,
  maxWeight: null,
};

function makePrisma(overrides: Partial<typeof mockOrder> = {}, laneOverrides: Partial<typeof mockLane> | null = null) {
  const order = { ...mockOrder, ...overrides };
  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockResolvedValue({ ...order, status: 'issue' }),
    },
    lane: {
      findMany: jest.fn().mockResolvedValue(laneOverrides === null ? [] : [{ ...mockLane, ...laneOverrides }]),
    },
    pendingLaneRequest: {
      create: jest.fn().mockResolvedValue({ id: 'plr-1' }),
    },
    issue: {
      create: jest.fn().mockResolvedValue({ id: 'issue-1' }),
    },
    shipment: {
      findFirst: jest.fn().mockResolvedValue(null), // no existing draft shipment on the lane by default
      create: jest.fn().mockResolvedValue({ id: 'ship-1', reference: 'SH-LTL-ABC123' }),
    },
    customer: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ orgId: 'test-org' }),
    },
  } as any;
  return { prisma, order };
}

function makeOrderConversionService(success = true) {
  return {
    addOrdersToShipment: jest.fn().mockResolvedValue(
      success
        ? { success: true, shipmentIds: ['ship-1'], errors: [], message: 'ok' }
        : { success: false, shipmentIds: [], errors: ['order-1 belongs to a different customer than this shipment'], message: 'No valid orders to add' }
    ),
  } as any;
}

describe('ShipmentAssignmentService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a pending lane request AND a paired Issue row when no lane matches, and sets status to issue', async () => {
    const { prisma } = makePrisma();
    const orderConversionService = makeOrderConversionService();
    const service = new ShipmentAssignmentService(prisma, orderConversionService);

    const result = await service.assignOrderToShipment('order-1');

    expect(result.success).toBe(true);
    expect(result.pendingLaneRequestId).toBe('plr-1');
    expect(prisma.pendingLaneRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderId: 'order-1', originId: 'loc-1', destinationId: 'loc-2' }),
      })
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'issue' },
    });
    expect(prisma.issue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orgId: 'test-org',
          title: expect.stringContaining('ORD-001'),
          status: 'open',
          priority: 'high',
          category: 'other',
          sourceEntityType: 'order',
          sourceEntityId: 'order-1',
        }),
      })
    );
    expect(orderConversionService.addOrdersToShipment).not.toHaveBeenCalled();
  });

  it('rejects an order that is already assigned', async () => {
    const { prisma } = makePrisma({ status: 'assigned' });
    const orderConversionService = makeOrderConversionService();
    const service = new ShipmentAssignmentService(prisma, orderConversionService);

    const result = await service.assignOrderToShipment('order-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already assigned/);
    expect(prisma.lane.findMany).not.toHaveBeenCalled();
  });

  it('rejects an order missing origin or destination', async () => {
    const { prisma } = makePrisma({ originId: null as any });
    const orderConversionService = makeOrderConversionService();
    const service = new ShipmentAssignmentService(prisma, orderConversionService);

    const result = await service.assignOrderToShipment('order-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/valid origin and destination/);
  });

  it('finds a matching lane, creates a shipment, and delegates linking to OrderConversionService', async () => {
    const { prisma } = makePrisma({}, {});
    const orderConversionService = makeOrderConversionService(true);
    const service = new ShipmentAssignmentService(prisma, orderConversionService);

    const result = await service.assignOrderToShipment('order-1');

    expect(result.success).toBe(true);
    expect(result.shipmentId).toBe('ship-1');
    expect(prisma.shipment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'test-org', laneId: 'lane-1', customerId: 'cust-1' }),
      })
    );
    expect(orderConversionService.addOrdersToShipment).toHaveBeenCalledWith('test-org', 'ship-1', ['order-1']);
  });

  it('propagates a failure from OrderConversionService as a rejected assignment (e.g. customer mismatch on a reused LTL shipment)', async () => {
    const { prisma } = makePrisma({}, {});
    prisma.shipment.findFirst.mockResolvedValueOnce({ id: 'existing-ship', reference: 'SH-LTL-EXISTING', customerId: 'other-cust' });
    const orderConversionService = makeOrderConversionService(false);
    const service = new ShipmentAssignmentService(prisma, orderConversionService);

    const result = await service.assignOrderToShipment('order-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/different customer/);
    expect(prisma.shipment.create).not.toHaveBeenCalled(); // reused the existing shipment, didn't create a new one
  });
});
