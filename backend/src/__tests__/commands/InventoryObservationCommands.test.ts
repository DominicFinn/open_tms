import {
  RecordInventoryObservationCommandHandler,
  RECORD_INVENTORY_OBSERVATION,
} from '../../commands/inventory/RecordInventoryObservationCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockBin = { id: 'bin-1', orgId: 'test-org', locationId: 'loc-1', label: 'BULK-A-01-01' };
const mockRecord = {
  id: 'inv-1', locationId: 'loc-1', binId: 'bin-1', sku: 'SKU-001',
  uomCode: 'EA', lotNumber: null, orgId: 'test-org',
};

describe('RecordInventoryObservationCommandHandler', () => {
  const buildTx = (overrides: any = {}) => ({
    warehouseBin: {
      findFirst: jest.fn().mockResolvedValue(overrides.bin === undefined ? mockBin : overrides.bin),
    },
    inventoryRecord: {
      findFirst: jest.fn().mockResolvedValue(overrides.record === undefined ? mockRecord : overrides.record),
    },
    inventoryObservation: {
      create: jest.fn().mockResolvedValue({ id: 'obs-1' }),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any);

  const buildPrisma = (tx: any) => ({
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any);

  it('records an observation and emits INVENTORY_OBSERVATION_RECORDED', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new RecordInventoryObservationCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_INVENTORY_OBSERVATION, {
        locationId: 'loc-1', binId: 'bin-1', sku: 'SKU-001', observedQuantity: 12,
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.observationId).toBe('obs-1');
    expect(result.data?.inventoryRecordId).toBe('inv-1');
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe(EVENT_TYPES.INVENTORY_OBSERVATION_RECORDED);

    expect(tx.inventoryObservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationId: 'loc-1', binId: 'bin-1', sku: 'SKU-001', observedQuantity: 12,
          orgId: 'test-org', inventoryRecordId: 'inv-1',
        }),
      })
    );
  });

  it('records a pure scan with no quantity and no matching inventory record', async () => {
    const tx = buildTx({ record: null });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new RecordInventoryObservationCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_INVENTORY_OBSERVATION, {
        locationId: 'loc-1', binId: 'bin-1', sku: 'SKU-999',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.inventoryRecordId).toBeNull();
    expect(tx.inventoryObservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ observedQuantity: null, inventoryRecordId: null }),
      })
    );
  });

  it('carries actorId through to observedByUserId', async () => {
    const tx = buildTx();
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new RecordInventoryObservationCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(RECORD_INVENTORY_OBSERVATION, {
        locationId: 'loc-1', binId: 'bin-1', sku: 'SKU-001',
      }, { actorId: 'user-42' })
    );

    expect(tx.inventoryObservation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ observedByUserId: 'user-42' }) })
    );
  });

  it('fails if bin not found at the given location for this org', async () => {
    const tx = buildTx({ bin: null });
    const prisma = buildPrisma(tx);
    const { bus } = mockEventBus();
    const handler = new RecordInventoryObservationCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(RECORD_INVENTORY_OBSERVATION, {
        locationId: 'loc-1', binId: 'missing-bin', sku: 'SKU-001',
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
