import { CreateReplenishmentRuleCommandHandler, CREATE_REPLENISHMENT_RULE } from '../../commands/warehouse/CreateReplenishmentRuleCommand';
import { CheckReplenishmentCommandHandler, CHECK_REPLENISHMENT } from '../../commands/warehouse/CheckReplenishmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── CreateReplenishmentRuleCommandHandler ─────────────────── */

describe('CreateReplenishmentRuleCommandHandler', () => {
  it('creates rule and emits event', async () => {
    const mockRule = { id: 'rule-1', sku: 'SKU-001', minQuantity: 5, maxQuantity: 20, orgId: 'test-org' };
    const tx = {
      warehouseBin: { findUnique: jest.fn().mockResolvedValue({ id: 'bin-1' }) },
      warehouseZone: { findUnique: jest.fn().mockResolvedValue({ id: 'zone-1' }) },
      replenishmentRule: { create: jest.fn().mockResolvedValue(mockRule) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateReplenishmentRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_REPLENISHMENT_RULE, {
        locationId: 'loc-1', sku: 'SKU-001',
        pickFaceBinId: 'bin-1', bulkZoneId: 'zone-1',
        minQuantity: 5, maxQuantity: 20,
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.sku).toBe('SKU-001');
    expect(result.events[0].type).toBe(EVENT_TYPES.REPLENISHMENT_RULE_CREATED);
  });

  it('fails if min >= max', async () => {
    const tx = { domainEventLog: { create: jest.fn().mockResolvedValue({}) } } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateReplenishmentRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_REPLENISHMENT_RULE, {
        locationId: 'loc-1', sku: 'SKU-001',
        pickFaceBinId: 'bin-1', bulkZoneId: 'zone-1',
        minQuantity: 20, maxQuantity: 5,
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('less than');
  });
});

/* ── CheckReplenishmentCommandHandler ──────────────────────── */

describe('CheckReplenishmentCommandHandler', () => {
  it('creates replenishment task when pick face below minimum', async () => {
    const rule = { id: 'rule-1', locationId: 'loc-1', sku: 'SKU-001', pickFaceBinId: 'bin-pf', bulkZoneId: 'zone-bulk', minQuantity: 10, maxQuantity: 50, active: true };
    const pickFaceInv = { id: 'inv-pf', binId: 'bin-pf', sku: 'SKU-001', quantityOnHand: 3 };
    const bulkInv = { id: 'inv-bulk', binId: 'bin-bulk', sku: 'SKU-001', quantityAvailable: 100, bin: { id: 'bin-bulk' } };
    const tx = {
      replenishmentRule: { findMany: jest.fn().mockResolvedValue([rule]) },
      inventoryRecord: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(pickFaceInv)   // pick face check
          .mockResolvedValueOnce(bulkInv),       // bulk inventory check
      },
      putawayTask: {
        findFirst: jest.fn().mockResolvedValue(null), // no existing replenishment
        create: jest.fn().mockResolvedValue({ id: 'putaway-repl-1' }),
      },
      warehouseBin: { findUnique: jest.fn().mockResolvedValue({ label: 'PF-A-01' }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CheckReplenishmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CHECK_REPLENISHMENT, { locationId: 'loc-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.tasksCreated).toBe(1);
    expect(result.data?.details[0].sku).toBe('SKU-001');

    expect(tx.putawayTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          putawayType: 'replenishment',
          targetBinId: 'bin-pf',
          sourceBinId: 'bin-bulk',
        }),
      })
    );

    expect(result.events.some(e => e.type === EVENT_TYPES.INVENTORY_BELOW_MINIMUM)).toBe(true);
    expect(result.events.some(e => e.type === EVENT_TYPES.REPLENISHMENT_TRIGGERED)).toBe(true);
  });

  it('skips if pick face is above minimum', async () => {
    const rule = { id: 'rule-1', locationId: 'loc-1', sku: 'SKU-001', pickFaceBinId: 'bin-pf', bulkZoneId: 'zone-bulk', minQuantity: 10, maxQuantity: 50, active: true };
    const pickFaceInv = { id: 'inv-pf', quantityOnHand: 15 }; // Above min of 10
    const tx = {
      replenishmentRule: { findMany: jest.fn().mockResolvedValue([rule]) },
      inventoryRecord: { findFirst: jest.fn().mockResolvedValue(pickFaceInv) },
      putawayTask: { findFirst: jest.fn(), create: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CheckReplenishmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CHECK_REPLENISHMENT, { locationId: 'loc-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.tasksCreated).toBe(0);
    expect(tx.putawayTask.create).not.toHaveBeenCalled();
  });

  it('skips if replenishment already pending', async () => {
    const rule = { id: 'rule-1', locationId: 'loc-1', sku: 'SKU-001', pickFaceBinId: 'bin-pf', bulkZoneId: 'zone-bulk', minQuantity: 10, maxQuantity: 50, active: true };
    const pickFaceInv = { id: 'inv-pf', quantityOnHand: 3 };
    const tx = {
      replenishmentRule: { findMany: jest.fn().mockResolvedValue([rule]) },
      inventoryRecord: { findFirst: jest.fn().mockResolvedValue(pickFaceInv) },
      putawayTask: {
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-repl' }), // Already pending
        create: jest.fn(),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CheckReplenishmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CHECK_REPLENISHMENT, { locationId: 'loc-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.tasksCreated).toBe(0);
    expect(tx.putawayTask.create).not.toHaveBeenCalled();
  });

  it('skips if no bulk stock available', async () => {
    const rule = { id: 'rule-1', locationId: 'loc-1', sku: 'SKU-001', pickFaceBinId: 'bin-pf', bulkZoneId: 'zone-bulk', minQuantity: 10, maxQuantity: 50, active: true };
    const pickFaceInv = { id: 'inv-pf', quantityOnHand: 3 };
    const tx = {
      replenishmentRule: { findMany: jest.fn().mockResolvedValue([rule]) },
      inventoryRecord: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(pickFaceInv) // pick face
          .mockResolvedValueOnce(null),        // no bulk inventory
      },
      putawayTask: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CheckReplenishmentCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CHECK_REPLENISHMENT, { locationId: 'loc-1' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.tasksCreated).toBe(0);
  });
});
