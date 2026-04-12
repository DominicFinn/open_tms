import { CreateChargeCommandHandler, CREATE_CHARGE } from '../../commands/charges/CreateChargeCommand';
import { ApproveChargeCommandHandler, APPROVE_CHARGE } from '../../commands/charges/ApproveChargeCommand';
import { ReweighAdjustmentCommandHandler, REWEIGH_ADJUSTMENT } from '../../commands/charges/ReweighAdjustmentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockCharge = {
  id: 'charge-1',
  orgId: 'test-org',
  shipmentId: 'ship-1',
  orderId: null,
  chargeType: 'linehaul',
  chargeCategory: 'cost',
  description: 'Linehaul charge',
  amountCents: 150000,
  currency: 'USD',
  source: 'manual',
  sourceId: null,
  accessorialCode: null,
  freightClass: null,
  nmfcCode: null,
  ratedWeight: null,
  ratePerCwt: null,
  status: 'pending',
  approvedBy: null,
  approvedAt: null,
  createdBy: 'test-user',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTx = {
  charge: {
    create: jest.fn().mockResolvedValue(mockCharge),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(mockCharge),
    findMany: jest.fn().mockResolvedValue([mockCharge]),
    update: jest.fn().mockResolvedValue({ ...mockCharge, status: 'approved', approvedBy: 'test-user', approvedAt: new Date() }),
  },
  shipmentFinancialSummary: {
    upsert: jest.fn().mockResolvedValue({}),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Charge Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateChargeCommandHandler', () => {
    it('creates a charge and emits CHARGE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateChargeCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CHARGE, {
          shipmentId: 'ship-1',
          chargeType: 'linehaul',
          chargeCategory: 'cost' as const,
          description: 'Linehaul charge',
          amountCents: 150000,
          currency: 'USD',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'charge-1' });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CHARGE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          chargeId: 'charge-1',
          shipmentId: 'ship-1',
          chargeType: 'linehaul',
          chargeCategory: 'cost',
          amountCents: 150000,
          currency: 'USD',
        })
      );
    });

    it('propagates orgId and actorId from command metadata', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateChargeCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CHARGE, {
          shipmentId: 'ship-1',
          chargeType: 'linehaul',
          chargeCategory: 'revenue' as const,
          description: 'Revenue charge',
          amountCents: 200000,
        }, { orgId: 'my-org', actorId: 'user-42' })
      );

      expect(result.success).toBe(true);
      expect(mockTx.charge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId: 'my-org',
            createdBy: 'user-42',
          }),
        })
      );
      expect(result.events[0].orgId).toBe('my-org');
      expect(result.events[0].actorId).toBe('user-42');
    });

    it('fails when neither shipmentId nor orderId is provided', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateChargeCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CHARGE, {
          chargeType: 'linehaul',
          chargeCategory: 'cost' as const,
          description: 'Orphan charge',
          amountCents: 50000,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('must be linked to a shipment or order');
      expect(result.events).toHaveLength(0);
    });

    it('enforces same currency constraint on shipment', async () => {
      const txWithExistingCharge = {
        ...mockTx,
        charge: {
          ...mockTx.charge,
          findFirst: jest.fn().mockResolvedValue({ currency: 'EUR' }),
          create: jest.fn().mockResolvedValue(mockCharge),
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as any;

      const prismaSameCurrency = {
        $transaction: jest.fn((fn: Function) => fn(txWithExistingCharge)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new CreateChargeCommandHandler(prismaSameCurrency, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CHARGE, {
          shipmentId: 'ship-1',
          chargeType: 'fuel_surcharge',
          chargeCategory: 'cost' as const,
          description: 'Fuel surcharge in USD',
          amountCents: 15000,
          currency: 'USD',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('same currency');
    });

    it('recalculates shipment financial summary after creating charge', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateChargeCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_CHARGE, {
          shipmentId: 'ship-1',
          chargeType: 'linehaul',
          chargeCategory: 'cost' as const,
          description: 'Linehaul',
          amountCents: 150000,
        })
      );

      expect(mockTx.shipmentFinancialSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shipmentId: 'ship-1' },
        })
      );
    });
  });

  describe('ApproveChargeCommandHandler', () => {
    it('approves a pending charge and emits CHARGE_APPROVED', async () => {
      const { bus } = mockEventBus();
      const handler = new ApproveChargeCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(APPROVE_CHARGE, { chargeId: 'charge-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CHARGE_APPROVED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          chargeId: 'charge-1',
          shipmentId: 'ship-1',
          approvedBy: 'test-user',
        })
      );
    });

    it('fails when charge is not found', async () => {
      const txNoCharge = {
        ...mockTx,
        charge: {
          ...mockTx.charge,
          findUnique: jest.fn().mockResolvedValue(null),
        },
      } as any;

      const prismaNoCharge = {
        $transaction: jest.fn((fn: Function) => fn(txNoCharge)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ApproveChargeCommandHandler(prismaNoCharge, bus);

      const result = await handler.execute(
        createTestCommand(APPROVE_CHARGE, { chargeId: 'nonexistent' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Charge not found');
    });

    it('fails when charge is not in pending status', async () => {
      const txApprovedCharge = {
        ...mockTx,
        charge: {
          ...mockTx.charge,
          findUnique: jest.fn().mockResolvedValue({ ...mockCharge, status: 'approved' }),
        },
      } as any;

      const prismaApproved = {
        $transaction: jest.fn((fn: Function) => fn(txApprovedCharge)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ApproveChargeCommandHandler(prismaApproved, bus);

      const result = await handler.execute(
        createTestCommand(APPROVE_CHARGE, { chargeId: 'charge-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot approve charge');
    });

    it('recalculates shipment financial summary after approval', async () => {
      const { bus } = mockEventBus();
      const handler = new ApproveChargeCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(APPROVE_CHARGE, { chargeId: 'charge-1' })
      );

      expect(mockTx.shipmentFinancialSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shipmentId: 'ship-1' },
        })
      );
    });
  });

  describe('ReweighAdjustmentCommandHandler', () => {
    it('creates cost and revenue adjustment charges', async () => {
      const costCharge = { id: 'adj-cost-1', chargeCategory: 'cost', amountCents: 20000, status: 'pending' };
      const revenueCharge = { id: 'adj-rev-1', chargeCategory: 'revenue', amountCents: 20000, status: 'pending' };

      const reweighTx = {
        charge: {
          create: jest.fn()
            .mockResolvedValueOnce(costCharge)
            .mockResolvedValueOnce(revenueCharge),
          findMany: jest.fn().mockResolvedValue([
            { chargeCategory: 'cost', amountCents: 150000, status: 'approved' },
            { chargeCategory: 'revenue', amountCents: 180000, status: 'approved' },
            costCharge,
            revenueCharge,
          ]),
        },
        shipmentFinancialSummary: { upsert: jest.fn().mockResolvedValue({}) },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;

      const reweighPrisma = {
        $transaction: jest.fn((fn: Function) => fn(reweighTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ReweighAdjustmentCommandHandler(reweighPrisma, bus);

      const result = await handler.execute(
        createTestCommand(REWEIGH_ADJUSTMENT, {
          shipmentId: 'ship-1',
          declaredWeightLbs: 1000,
          actualWeightLbs: 1200,
          declaredClass: '100',
          actualClass: '85',
          originalChargeCents: 150000,
          adjustedChargeCents: 170000,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ costChargeId: 'adj-cost-1', revenueChargeId: 'adj-rev-1' });

      // Both cost and revenue adjustment charges created
      expect(reweighTx.charge.create).toHaveBeenCalledTimes(2);

      // First call: cost adjustment
      expect(reweighTx.charge.create).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          data: expect.objectContaining({
            chargeType: 'adjustment',
            chargeCategory: 'cost',
            amountCents: 20000,
            source: 'adjustment',
            shipmentId: 'ship-1',
          }),
        })
      );

      // Second call: revenue adjustment (pass-through to customer)
      expect(reweighTx.charge.create).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          data: expect.objectContaining({
            chargeType: 'adjustment',
            chargeCategory: 'revenue',
            amountCents: 20000,
            source: 'adjustment',
            sourceId: 'adj-cost-1',
          }),
        })
      );

      // Event emitted for the cost charge
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CHARGE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          chargeId: 'adj-cost-1',
          shipmentId: 'ship-1',
          chargeType: 'adjustment',
          chargeCategory: 'cost',
          amountCents: 20000,
          currency: 'USD',
        })
      );
    });

    it('fails when no adjustment needed (same amounts)', async () => {
      const { bus } = mockEventBus();
      const handler = new ReweighAdjustmentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(REWEIGH_ADJUSTMENT, {
          shipmentId: 'ship-1',
          declaredWeightLbs: 1000,
          actualWeightLbs: 1000,
          originalChargeCents: 150000,
          adjustedChargeCents: 150000,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No adjustment needed');
      expect(result.events).toHaveLength(0);
    });

    it('recalculates shipment financial summary', async () => {
      const costCharge = { id: 'adj-cost-2', chargeCategory: 'cost', amountCents: 10000, status: 'pending' };
      const revenueCharge = { id: 'adj-rev-2', chargeCategory: 'revenue', amountCents: 10000, status: 'pending' };

      const summaryTx = {
        charge: {
          create: jest.fn()
            .mockResolvedValueOnce(costCharge)
            .mockResolvedValueOnce(revenueCharge),
          findMany: jest.fn().mockResolvedValue([
            { chargeCategory: 'cost', amountCents: 150000, status: 'approved' },
            { chargeCategory: 'revenue', amountCents: 200000, status: 'approved' },
            { chargeCategory: 'cost', amountCents: 10000, status: 'pending' },
            { chargeCategory: 'revenue', amountCents: 10000, status: 'pending' },
          ]),
        },
        shipmentFinancialSummary: { upsert: jest.fn().mockResolvedValue({}) },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;

      const summaryPrisma = {
        $transaction: jest.fn((fn: Function) => fn(summaryTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ReweighAdjustmentCommandHandler(summaryPrisma, bus);

      await handler.execute(
        createTestCommand(REWEIGH_ADJUSTMENT, {
          shipmentId: 'ship-1',
          declaredWeightLbs: 1000,
          actualWeightLbs: 1500,
          originalChargeCents: 150000,
          adjustedChargeCents: 160000,
        })
      );

      expect(summaryTx.shipmentFinancialSummary.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { shipmentId: 'ship-1' },
          create: expect.objectContaining({
            shipmentId: 'ship-1',
            expectedRevenueCents: 210000,
            expectedCostCents: 160000,
            expectedMarginCents: 50000,
            actualRevenueCents: 200000,
            actualCostCents: 150000,
            actualMarginCents: 50000,
          }),
        })
      );
    });
  });
});
