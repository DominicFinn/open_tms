import { CreateWarehouseZoneCommandHandler, CREATE_WAREHOUSE_ZONE } from '../../commands/warehouse/CreateWarehouseZoneCommand';
import { UpdateWarehouseZoneCommandHandler, UPDATE_WAREHOUSE_ZONE } from '../../commands/warehouse/UpdateWarehouseZoneCommand';
import { CreateWarehouseBinCommandHandler, CREATE_WAREHOUSE_BIN } from '../../commands/warehouse/CreateWarehouseBinCommand';
import { UpdateWarehouseBinCommandHandler, UPDATE_WAREHOUSE_BIN } from '../../commands/warehouse/UpdateWarehouseBinCommand';
import { BulkCreateBinsCommandHandler, BULK_CREATE_BINS } from '../../commands/warehouse/BulkCreateBinsCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── Mock Data ─────────────────────────────────────────────── */

const mockZone = {
  id: 'zone-1', locationId: 'loc-1', name: 'Bulk A', zoneType: 'bulk_storage',
  temperatureZone: null, hazmatCertified: false, maxWeightKg: null,
  maxVolumeCbm: null, sortOrder: 0, active: true, orgId: 'test-org',
  createdAt: new Date(), updatedAt: new Date(),
};

const mockBin = {
  id: 'bin-1', zoneId: 'zone-1', aisleId: null, locationId: 'loc-1',
  label: 'BULK-A-01-01', binType: 'pallet', maxWeightKg: null,
  maxVolumeCbm: null, maxPalletPositions: 2, temperatureZone: null,
  hazmatCertified: false, level: 1, walkSequence: 0, active: true,
  currentWeightKg: 0, currentVolumeCbm: 0, currentPalletCount: 0,
  orgId: 'test-org', createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  warehouseZone: {
    create: jest.fn().mockResolvedValue(mockZone),
    update: jest.fn().mockResolvedValue(mockZone),
    findUnique: jest.fn().mockResolvedValue(mockZone),
  },
  warehouseBin: {
    create: jest.fn().mockResolvedValue(mockBin),
    createMany: jest.fn().mockResolvedValue({ count: 120 }),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

/* ── Tests ─────────────────────────────────────────────────── */

describe('Warehouse Zone Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateWarehouseZoneCommandHandler', () => {
    it('creates zone and emits WAREHOUSE_ZONE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateWarehouseZoneCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_WAREHOUSE_ZONE, {
          locationId: 'loc-1',
          name: 'Bulk A',
          zoneType: 'bulk_storage',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Bulk A');
      expect(result.data?.zoneType).toBe('bulk_storage');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.WAREHOUSE_ZONE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          locationId: 'loc-1',
          name: 'Bulk A',
          zoneType: 'bulk_storage',
        })
      );
    });

    it('passes orgId from command to zone', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateWarehouseZoneCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_WAREHOUSE_ZONE, {
          locationId: 'loc-1',
          name: 'Cold Store',
          zoneType: 'bulk_storage',
          temperatureZone: 'frozen',
          hazmatCertified: false,
        })
      );

      expect(mockTx.warehouseZone.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: 'test-org',
          temperatureZone: 'frozen',
        }),
      });
    });

    it('propagates metadata to events', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateWarehouseZoneCommandHandler(mockPrisma, bus);

      const cmd = createTestCommand(CREATE_WAREHOUSE_ZONE, {
        locationId: 'loc-1', name: 'Dock 1', zoneType: 'receiving',
      }, { actorId: 'user-42' });

      const result = await handler.execute(cmd);
      expect(result.events[0].actorId).toBe('user-42');
      expect(result.events[0].metadata.source).toBe('test');
    });
  });

  describe('UpdateWarehouseZoneCommandHandler', () => {
    it('updates zone and emits WAREHOUSE_ZONE_UPDATED', async () => {
      const updatedZone = { ...mockZone, name: 'Bulk A - Updated' };
      mockTx.warehouseZone.update.mockResolvedValueOnce(updatedZone);
      const { bus } = mockEventBus();
      const handler = new UpdateWarehouseZoneCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_WAREHOUSE_ZONE, {
          zoneId: 'zone-1',
          name: 'Bulk A - Updated',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Bulk A - Updated');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.WAREHOUSE_ZONE_UPDATED);
    });

    it('fails if zone not found', async () => {
      mockTx.warehouseZone.findUnique.mockResolvedValueOnce(null);
      const { bus } = mockEventBus();
      const handler = new UpdateWarehouseZoneCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_WAREHOUSE_ZONE, {
          zoneId: 'missing-zone',
          name: 'Updated',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});

describe('Warehouse Bin Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateWarehouseBinCommandHandler', () => {
    it('creates bin and emits WAREHOUSE_BIN_CREATED', async () => {
      mockTx.warehouseZone.findUnique.mockResolvedValueOnce(mockZone);
      mockTx.warehouseBin.findUnique.mockResolvedValueOnce(null); // no duplicate
      const { bus } = mockEventBus();
      const handler = new CreateWarehouseBinCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_WAREHOUSE_BIN, {
          zoneId: 'zone-1',
          locationId: 'loc-1',
          label: 'BULK-A-01-01',
          binType: 'pallet',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.label).toBe('BULK-A-01-01');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.WAREHOUSE_BIN_CREATED);
    });

    it('fails if label already exists', async () => {
      mockTx.warehouseZone.findUnique.mockResolvedValueOnce(mockZone);
      mockTx.warehouseBin.findUnique.mockResolvedValueOnce(mockBin); // duplicate!
      const { bus } = mockEventBus();
      const handler = new CreateWarehouseBinCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_WAREHOUSE_BIN, {
          zoneId: 'zone-1',
          locationId: 'loc-1',
          label: 'BULK-A-01-01',
          binType: 'pallet',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('fails if zone not found', async () => {
      mockTx.warehouseZone.findUnique.mockResolvedValueOnce(null);
      const { bus } = mockEventBus();
      const handler = new CreateWarehouseBinCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_WAREHOUSE_BIN, {
          zoneId: 'missing', locationId: 'loc-1', label: 'X-1', binType: 'pallet',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zone');
    });
  });

  describe('UpdateWarehouseBinCommandHandler', () => {
    it('updates bin and emits WAREHOUSE_BIN_UPDATED', async () => {
      const updatedBin = { ...mockBin, active: false };
      const updateBinTx = {
        warehouseBin: {
          findUnique: jest.fn().mockResolvedValue(mockBin),
          update: jest.fn().mockResolvedValue(updatedBin),
        },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const updatePrisma = {
        $transaction: jest.fn((fn: Function) => fn(updateBinTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const { bus } = mockEventBus();
      const handler = new UpdateWarehouseBinCommandHandler(updatePrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_WAREHOUSE_BIN, {
          binId: 'bin-1',
          active: false,
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.WAREHOUSE_BIN_UPDATED);
    });

    it('fails if bin not found', async () => {
      const notFoundTx = {
        warehouseBin: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const notFoundPrisma = {
        $transaction: jest.fn((fn: Function) => fn(notFoundTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const { bus } = mockEventBus();
      const handler = new UpdateWarehouseBinCommandHandler(notFoundPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_WAREHOUSE_BIN, { binId: 'missing', active: false })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('checks label uniqueness on rename', async () => {
      const renameTx = {
        warehouseBin: {
          findUnique: jest.fn()
            .mockResolvedValueOnce(mockBin) // existing bin lookup
            .mockResolvedValueOnce({ ...mockBin, id: 'bin-other' }), // duplicate label check
          update: jest.fn(),
        },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const renamePrisma = {
        $transaction: jest.fn((fn: Function) => fn(renameTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const { bus } = mockEventBus();
      const handler = new UpdateWarehouseBinCommandHandler(renamePrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_WAREHOUSE_BIN, { binId: 'bin-1', label: 'TAKEN-LABEL' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('BulkCreateBinsCommandHandler', () => {
    it('creates bins from pattern and emits WAREHOUSE_BIN_BULK_CREATED', async () => {
      mockTx.warehouseZone.findUnique.mockResolvedValueOnce(mockZone);
      mockTx.warehouseBin.findMany.mockResolvedValueOnce([]); // no conflicts
      mockTx.warehouseBin.createMany.mockResolvedValueOnce({ count: 120 });
      const { bus } = mockEventBus();
      const handler = new BulkCreateBinsCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(BULK_CREATE_BINS, {
          zoneId: 'zone-1',
          locationId: 'loc-1',
          labelPattern: 'BULK-{aisle}-{row}-{level}',
          binType: 'pallet',
          aisles: ['A', 'B', 'C'],
          rowStart: 1,
          rowEnd: 10,
          levelStart: 1,
          levelEnd: 4,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(120);
      expect(result.data?.labels).toContain('BULK-A-01-01');
      expect(result.data?.labels).toContain('BULK-C-10-04');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.WAREHOUSE_BIN_BULK_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ count: 120, labelPattern: 'BULK-{aisle}-{row}-{level}' })
      );
    });

    it('fails if labels already exist', async () => {
      mockTx.warehouseZone.findUnique.mockResolvedValueOnce(mockZone);
      mockTx.warehouseBin.findMany.mockResolvedValueOnce([{ label: 'BULK-A-01-01' }]);
      const { bus } = mockEventBus();
      const handler = new BulkCreateBinsCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(BULK_CREATE_BINS, {
          zoneId: 'zone-1', locationId: 'loc-1',
          labelPattern: 'BULK-{aisle}-{row}-{level}', binType: 'pallet',
          aisles: ['A'], rowStart: 1, rowEnd: 1, levelStart: 1, levelEnd: 1,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exist');
    });

    it('fails if zone not found', async () => {
      mockTx.warehouseZone.findUnique.mockResolvedValueOnce(null);
      const { bus } = mockEventBus();
      const handler = new BulkCreateBinsCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(BULK_CREATE_BINS, {
          zoneId: 'missing', locationId: 'loc-1',
          labelPattern: '{aisle}-{row}-{level}', binType: 'pallet',
          aisles: ['A'], rowStart: 1, rowEnd: 1, levelStart: 1, levelEnd: 1,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zone');
    });
  });
});
