import { CreateLoadPlanCommandHandler, CREATE_LOAD_PLAN } from '../../commands/warehouse/CreateLoadPlanCommand';
import { CompleteLoadPlanCommandHandler, COMPLETE_LOAD_PLAN } from '../../commands/warehouse/CompleteLoadPlanCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ── CreateLoadPlanCommandHandler ──────────────────────────── */

describe('CreateLoadPlanCommandHandler', () => {
  it('creates load plan from staged assignments with reverse load sequence', async () => {
    const assignments = [
      { id: 'sa-1', orderId: 'order-1', trackableUnitId: 'unit-1', trackableUnit: { id: 'unit-1', identifier: 'PLT-001' } },
      { id: 'sa-2', orderId: 'order-2', trackableUnitId: 'unit-2', trackableUnit: { id: 'unit-2', identifier: 'PLT-002' } },
    ];
    const mockPlan = { id: 'lp-1', totalUnits: 2, status: 'planning', orgId: 'test-org' };
    const tx = {
      stagingAssignment: { findMany: jest.fn().mockResolvedValue(assignments) },
      shipmentStop: { findMany: jest.fn().mockResolvedValue([]) },
      loadPlan: { create: jest.fn().mockResolvedValue(mockPlan) },
      loadPlanLine: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateLoadPlanCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_LOAD_PLAN, {
        locationId: 'loc-1',
        stagingAssignmentIds: ['sa-1', 'sa-2'],
        trailerNumber: 'TRL-123',
      })
    );

    expect(result.success).toBe(true);
    expect(result.data?.totalUnits).toBe(2);
    expect(result.events[0].type).toBe(EVENT_TYPES.LOAD_PLAN_CREATED);
    expect(tx.loadPlanLine.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ orderId: 'order-1', loadSequence: expect.any(Number) }),
        ]),
      })
    );
  });

  it('fails with empty assignments', async () => {
    const tx = { domainEventLog: { create: jest.fn().mockResolvedValue({}) } } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CreateLoadPlanCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_LOAD_PLAN, { locationId: 'loc-1', stagingAssignmentIds: [] })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least one');
  });
});

/* ── CompleteLoadPlanCommandHandler ────────────────────────── */

describe('CompleteLoadPlanCommandHandler', () => {
  it('completes load plan, marks units loaded, clears locations, emits events', async () => {
    const plan = {
      id: 'lp-1', locationId: 'loc-1', shipmentId: 'ship-1', status: 'planning',
      sealNumber: null, trailerNumber: 'TRL-123', carrierId: null, dockBinId: 'bin-dock',
      lines: [
        { id: 'll-1', stagingAssignmentId: 'sa-1', trackableUnitId: 'unit-1', orderId: 'o1', status: 'pending' },
        { id: 'll-2', stagingAssignmentId: 'sa-2', trackableUnitId: 'unit-2', orderId: 'o2', status: 'pending' },
      ],
    };
    const tx = {
      loadPlan: {
        findUnique: jest.fn().mockResolvedValue(plan),
        update: jest.fn().mockResolvedValue({}),
      },
      loadPlanLine: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      stagingAssignment: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      trackableUnit: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteLoadPlanCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_LOAD_PLAN, { loadPlanId: 'lp-1', sealNumber: 'SEAL-456' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.loadedUnits).toBe(2);
    expect(result.data?.sealNumber).toBe('SEAL-456');
    expect(result.data?.bolGenerated).toBe(true);

    // Staging assignments updated
    expect(tx.stagingAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'loaded' }) })
    );

    // Units cleared from bins
    expect(tx.trackableUnit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentBinId: null, currentZoneId: null } })
    );

    const eventTypes = result.events.map(e => e.type);
    expect(eventTypes).toContain(EVENT_TYPES.LOAD_PLAN_COMPLETED);
    expect(eventTypes).toContain(EVENT_TYPES.LOAD_PLAN_BOL_GENERATED);
  });

  it('fails if already completed', async () => {
    const tx = {
      loadPlan: { findUnique: jest.fn().mockResolvedValue({ id: 'lp-1', status: 'completed', lines: [] }) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const prisma = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const { bus } = mockEventBus();
    const handler = new CompleteLoadPlanCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(COMPLETE_LOAD_PLAN, { loadPlanId: 'lp-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('already completed');
  });
});
