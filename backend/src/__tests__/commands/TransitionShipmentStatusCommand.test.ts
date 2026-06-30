import {
  TransitionShipmentStatusCommandHandler,
  TRANSITION_SHIPMENT_STATUS,
} from '../../commands/shipments/TransitionShipmentStatusCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

// A fully-specified shipment that satisfies the readiness gate.
const readyShipment = {
  id: 'ship-1',
  reference: 'REF-1',
  status: 'draft',
  customerId: 'cust-1',
  originId: 'origin-1',
  destinationId: 'dest-1',
  laneId: null,
  carrierId: 'carrier-1',
  pickupDate: new Date('2026-07-01'),
  deliveryDate: new Date('2026-07-03'),
  shipmentType: { requiredFields: [] },
};

function makePrisma(shipment: any) {
  const update = jest.fn().mockResolvedValue({ ...shipment });
  const mockTx = {
    shipment: {
      findFirstOrThrow: jest.fn().mockResolvedValue(shipment),
      update,
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const mockPrisma = {
    $transaction: jest.fn((fn: Function) => fn(mockTx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { mockPrisma, mockTx, update };
}

describe('TransitionShipmentStatusCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('moves a ready shipment forward (draft -> ready) and emits SHIPMENT_STATUS_CHANGED', async () => {
    const { mockPrisma, update } = makePrisma({ ...readyShipment, status: 'draft' });
    const { bus } = mockEventBus();
    const handler = new TransitionShipmentStatusCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSITION_SHIPMENT_STATUS, { id: 'ship-1', toStatus: 'ready' })
    );

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: 'ship-1' }, data: { status: 'ready' } });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_STATUS_CHANGED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ previousStatus: 'draft', newStatus: 'ready', shipmentReference: 'REF-1' })
    );
  });

  it('allows a single step back (in_progress -> ready)', async () => {
    const { mockPrisma, update } = makePrisma({ ...readyShipment, status: 'in_progress' });
    const { bus } = mockEventBus();
    const handler = new TransitionShipmentStatusCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSITION_SHIPMENT_STATUS, { id: 'ship-1', toStatus: 'ready' })
    );

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: 'ship-1' }, data: { status: 'ready' } });
  });

  it('rejects skipping a step (draft -> in_progress)', async () => {
    const { mockPrisma, update } = makePrisma({ ...readyShipment, status: 'draft' });
    const { bus } = mockEventBus();
    const handler = new TransitionShipmentStatusCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSITION_SHIPMENT_STATUS, { id: 'ship-1', toStatus: 'in_progress' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/one step/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a forward move when the readiness gate fails', async () => {
    const incomplete = { ...readyShipment, status: 'draft', carrierId: null, pickupDate: null };
    const { mockPrisma, update } = makePrisma(incomplete);
    const { bus } = mockEventBus();
    const handler = new TransitionShipmentStatusCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSITION_SHIPMENT_STATUS, { id: 'ship-1', toStatus: 'ready' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Missing required fields/i);
    expect(result.error).toMatch(/Carrier/);
    expect(update).not.toHaveBeenCalled();
  });

  it('allows moving back to draft without the readiness gate', async () => {
    const incomplete = { ...readyShipment, status: 'ready', carrierId: null };
    const { mockPrisma, update } = makePrisma(incomplete);
    const { bus } = mockEventBus();
    const handler = new TransitionShipmentStatusCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSITION_SHIPMENT_STATUS, { id: 'ship-1', toStatus: 'draft' })
    );

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: 'ship-1' }, data: { status: 'draft' } });
  });

  it('propagates command metadata (actorId/orgId) onto the emitted event', async () => {
    const { mockPrisma } = makePrisma({ ...readyShipment, status: 'draft' });
    const { bus } = mockEventBus();
    const handler = new TransitionShipmentStatusCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(
        TRANSITION_SHIPMENT_STATUS,
        { id: 'ship-1', toStatus: 'ready' },
        { actorId: 'user-42', orgId: 'org-9' }
      )
    );

    expect(result.success).toBe(true);
    expect(result.events[0].actorId).toBe('user-42');
    expect(result.events[0].orgId).toBe('org-9');
  });

  it('rejects an invalid target status', async () => {
    const { mockPrisma } = makePrisma({ ...readyShipment, status: 'draft' });
    const { bus } = mockEventBus();
    const handler = new TransitionShipmentStatusCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(TRANSITION_SHIPMENT_STATUS, { id: 'ship-1', toStatus: 'shipped' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid target status/i);
  });
});
