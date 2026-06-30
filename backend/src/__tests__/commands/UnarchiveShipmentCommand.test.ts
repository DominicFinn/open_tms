import {
  UnarchiveShipmentCommandHandler,
  UNARCHIVE_SHIPMENT,
} from '../../commands/shipments/UnarchiveShipmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function makePrisma(shipment: any) {
  const update = jest.fn().mockResolvedValue({ ...shipment, archived: false, archivedAt: null });
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

describe('UnarchiveShipmentCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('clears archived/archivedAt and emits SHIPMENT_UNARCHIVED', async () => {
    const { mockPrisma, update } = makePrisma({ id: 'ship-1', reference: 'REF-1', archived: true, deletedAt: null });
    const { bus } = mockEventBus();
    const handler = new UnarchiveShipmentCommandHandler(mockPrisma, bus);

    const result = await handler.execute(createTestCommand(UNARCHIVE_SHIPMENT, { id: 'ship-1' }));

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: 'ship-1' }, data: { archived: false, archivedAt: null } });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.SHIPMENT_UNARCHIVED);
    expect(result.events[0].payload).toEqual(expect.objectContaining({ shipmentReference: 'REF-1' }));
  });

  it('is idempotent — unarchiving a non-archived shipment is a no-op', async () => {
    const { mockPrisma, update } = makePrisma({ id: 'ship-1', reference: 'REF-1', archived: false, deletedAt: null });
    const { bus } = mockEventBus();
    const handler = new UnarchiveShipmentCommandHandler(mockPrisma, bus);

    const result = await handler.execute(createTestCommand(UNARCHIVE_SHIPMENT, { id: 'ship-1' }));

    expect(result.success).toBe(true);
    expect((result.data as any).notArchived).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });
});
