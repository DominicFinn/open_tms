import {
  SoftDeleteShipmentCommandHandler,
  SOFT_DELETE_SHIPMENT,
} from '../../commands/shipments/SoftDeleteShipmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makePrisma(shipment: any) {
  const update = jest.fn().mockResolvedValue({ ...shipment, deletedAt: new Date() });
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
  return { mockPrisma, update };
}

const baseShipment = { id: 'ship-1', reference: 'REF-1', deletedAt: null };

describe('SoftDeleteShipmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets deletedAt/deletedBy and emits SHIPMENT_DELETED', async () => {
    const { mockPrisma, update } = makePrisma({ ...baseShipment });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteShipmentCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(SOFT_DELETE_SHIPMENT, { id: 'ship-1' }, { actorId: 'admin-7' })
    );

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ship-1' },
      data: expect.objectContaining({ deletedBy: 'admin-7' }),
    }));
    expect(update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_DELETED);
    expect(result.events[0].payload).toEqual(
      expect.objectContaining({ shipmentReference: 'REF-1', softDelete: true })
    );
  });

  it('is idempotent — re-deleting an already-deleted shipment is a no-op', async () => {
    const { mockPrisma, update } = makePrisma({ ...baseShipment, deletedAt: new Date('2026-06-01') });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteShipmentCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(SOFT_DELETE_SHIPMENT, { id: 'ship-1' })
    );

    expect(result.success).toBe(true);
    expect((result.data as any).alreadyDeleted).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });

  it('propagates actor/org metadata onto the emitted event', async () => {
    const { mockPrisma } = makePrisma({ ...baseShipment });
    const { bus } = mockEventBus();
    const handler = new SoftDeleteShipmentCommandHandler(mockPrisma, bus);

    const result = await handler.execute(
      createTestCommand(SOFT_DELETE_SHIPMENT, { id: 'ship-1' }, { actorId: 'admin-7', orgId: 'org-3' })
    );

    expect(result.events[0].actorId).toBe('admin-7');
    expect(result.events[0].orgId).toBe('org-3');
  });
});
