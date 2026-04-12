/**
 * Tests for Phase 3b: location auto-creation in CreateShipmentCommand.
 */

import { CreateShipmentCommandHandler, CREATE_SHIPMENT } from '../../commands/shipments/CreateShipmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockLocation = {
  id: 'loc-auto-1', name: 'Test Warehouse', address1: '123 Main St',
  city: 'Chicago', state: 'IL', country: 'US', lat: 41.8, lng: -87.6,
};

const mockShipment = {
  id: 'ship-1', reference: 'SH-AUTO-001', status: 'draft',
  customerId: 'cust-1', originId: 'loc-auto-1', destinationId: 'loc-auto-2',
  carrierId: null, laneId: null, pickupDate: null, deliveryDate: null,
  proNumber: null, items: [],
  customer: { id: 'cust-1', name: 'Test Customer' },
  origin: { id: 'loc-auto-1', name: 'Origin', city: 'Chicago', state: 'IL' },
  destination: { id: 'loc-auto-2', name: 'Dest', city: 'Dallas', state: 'TX' },
  carrier: null, lane: null,
};

const mockTx = {
  location: {
    findFirst: jest.fn().mockResolvedValue(null), // No existing location
    create: jest.fn(),
  },
  lane: { findFirst: jest.fn() },
  shipment: {
    create: jest.fn().mockResolvedValue(mockShipment),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

const mockQueue = {
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
} as any;

describe('CreateShipmentCommand — Location Auto-Resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.location.findFirst.mockResolvedValue(null);
    mockTx.location.create
      .mockResolvedValueOnce({ id: 'loc-auto-1' })
      .mockResolvedValueOnce({ id: 'loc-auto-2' });
  });

  it('creates locations from raw address data when no IDs provided', async () => {
    const { bus } = mockEventBus();
    const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

    const result = await handler.execute(
      createTestCommand(CREATE_SHIPMENT, {
        reference: 'SH-AUTO-001',
        customerId: 'cust-1',
        originData: {
          name: 'Chicago Warehouse',
          address1: '123 Main St',
          city: 'Chicago',
          state: 'IL',
          country: 'US',
          lat: 41.8,
          lng: -87.6,
        },
        destinationData: {
          name: 'Dallas DC',
          address1: '456 Commerce Blvd',
          city: 'Dallas',
          state: 'TX',
          country: 'US',
        },
      })
    );

    expect(result.success).toBe(true);
    expect(mockTx.location.create).toHaveBeenCalledTimes(2);
    expect(mockTx.location.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Chicago Warehouse', city: 'Chicago' }),
    });
  });

  it('reuses existing location when name+city match found', async () => {
    mockTx.location.findFirst
      .mockResolvedValueOnce({ id: 'existing-origin' }) // origin found
      .mockResolvedValueOnce(null); // destination not found
    mockTx.location.create.mockResolvedValueOnce({ id: 'new-dest' });

    const { bus } = mockEventBus();
    const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

    await handler.execute(
      createTestCommand(CREATE_SHIPMENT, {
        reference: 'SH-AUTO-002',
        customerId: 'cust-1',
        originData: { name: 'Existing WH', address1: '1 St', city: 'LA', country: 'US' },
        destinationData: { name: 'New DC', address1: '2 St', city: 'NYC', country: 'US' },
      })
    );

    expect(mockTx.location.create).toHaveBeenCalledTimes(1); // Only destination created
  });

  it('errors when no origin/destination provided in any form', async () => {
    const { bus } = mockEventBus();
    const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

    const result = await handler.execute(
      createTestCommand(CREATE_SHIPMENT, {
        reference: 'SH-FAIL',
        customerId: 'cust-1',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('originData/destinationData');
  });

  it('emits SHIPMENT_CREATED with resolved location IDs', async () => {
    const { bus } = mockEventBus();
    const handler = new CreateShipmentCommandHandler(mockPrisma, bus, mockQueue);

    const result = await handler.execute(
      createTestCommand(CREATE_SHIPMENT, {
        reference: 'SH-AUTO-003',
        customerId: 'cust-1',
        originData: { name: 'WH A', address1: '1 St', city: 'A', country: 'US' },
        destinationData: { name: 'WH B', address1: '2 St', city: 'B', country: 'US' },
      })
    );

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_CREATED);
  });
});
