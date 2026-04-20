import { GenerateReturnLabelCommandHandler, GENERATE_RETURN_LABEL } from '../../commands/rma/GenerateReturnLabelCommand';
import { SchedulePickupCommandHandler, SCHEDULE_RMA_PICKUP } from '../../commands/rma/SchedulePickupCommand';
import { CancelPickupCommandHandler, CANCEL_RMA_PICKUP } from '../../commands/rma/CancelPickupCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';
import type { IReturnLabelProviderRegistry, IReturnLabelProvider } from '../../services/returnLabel/IReturnLabelProvider';
import type { IBinaryStorageProvider } from '../../storage/IBinaryStorageProvider';

const ADDR = { name: 'Customer', address1: '1 Main St', city: 'Boston', postalCode: '02101', country: 'US' };
const WAREHOUSE = { name: 'RMA Dock', address1: '100 Dock Rd', city: 'Newark', postalCode: '07101', country: 'US' };

function makeProvider(overrides: Partial<IReturnLabelProvider> = {}): IReturnLabelProvider {
  return {
    name: 'manual',
    generateLabel: jest.fn().mockResolvedValue({
      trackingNumber: 'TRK-123',
      labelContent: Buffer.from('label'),
      labelFormat: 'pdf',
      providerReference: 'test',
    }),
    schedulePickup: jest.fn().mockResolvedValue({
      confirmationNumber: 'PU-999',
      scheduledFor: new Date('2026-04-20T10:00:00Z'),
      window: '09:00-12:00',
    }),
    cancelPickup: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as IReturnLabelProvider;
}

function makeRegistry(provider: IReturnLabelProvider): IReturnLabelProviderRegistry {
  return { get: jest.fn().mockReturnValue(provider), list: () => [provider.name] };
}

function makeStorage(): IBinaryStorageProvider & { store: jest.Mock } {
  return {
    store: jest.fn().mockImplementation(async (k: string) => k),
    retrieve: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  } as any;
}

describe('GenerateReturnLabelCommand', () => {
  it('generates a label, stores it, and emits RMA_RETURN_LABEL_GENERATED', async () => {
    const rma = { id: 'rma-1', rmaNumber: 'RMA-001', status: 'authorized', returnCarrierId: null };
    const tx: any = {
      rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn().mockResolvedValue(rma) },
      carrier: { findUnique: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const provider = makeProvider();
    const registry = makeRegistry(provider);
    const storage = makeStorage();
    const { bus } = mockEventBus();
    const handler = new GenerateReturnLabelCommandHandler(prisma, bus, registry, storage);

    const result = await handler.execute(
      createTestCommand(GENERATE_RETURN_LABEL, {
        rmaId: 'rma-1',
        from: ADDR, to: WAREHOUSE,
        parcels: [{ weightKg: 1.2 }],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.trackingNumber).toBe('TRK-123');
    expect(result.data?.provider).toBe('manual');
    expect(provider.generateLabel).toHaveBeenCalled();
    expect(storage.store).toHaveBeenCalled();
    expect(tx.rma.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        returnTrackingNumber: 'TRK-123',
        returnLabelProvider: 'manual',
        returnLabelFormat: 'pdf',
      }),
    }));
    expect(result.events[0].type).toBe(EVENT_TYPES.RMA_RETURN_LABEL_GENERATED);
  });

  it('uses carrier returnLabelProvider when RMA has a carrier assigned', async () => {
    const rma = { id: 'rma-2', rmaNumber: 'RMA-002', status: 'authorized', returnCarrierId: 'car-1' };
    const carrier = { id: 'car-1', returnLabelProvider: 'fedex', returnLabelAccountNumber: 'ACCT-1', returnLabelDefaultService: 'ground' };
    const tx: any = {
      rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn().mockResolvedValue(rma) },
      carrier: { findUnique: jest.fn().mockResolvedValue(carrier) },
    };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const provider = makeProvider({ name: 'fedex' });
    const registry = makeRegistry(provider);
    const storage = makeStorage();
    const { bus } = mockEventBus();
    const handler = new GenerateReturnLabelCommandHandler(prisma, bus, registry, storage);

    const result = await handler.execute(
      createTestCommand(GENERATE_RETURN_LABEL, {
        rmaId: 'rma-2', carrierId: 'car-1',
        from: ADDR, to: WAREHOUSE, parcels: [{ weightKg: 2 }],
      }),
    );

    expect(result.success).toBe(true);
    expect(registry.get).toHaveBeenCalledWith('fedex');
    expect(provider.generateLabel).toHaveBeenCalledWith(expect.objectContaining({
      carrierAccountNumber: 'ACCT-1',
      serviceLevel: 'ground',
    }));
  });

  it('rejects when RMA is completed or rejected', async () => {
    const rma = { id: 'rma-3', rmaNumber: 'RMA-003', status: 'completed', returnCarrierId: null };
    const tx: any = { rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn() }, carrier: { findUnique: jest.fn() } };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const handler = new GenerateReturnLabelCommandHandler(
      prisma, mockEventBus().bus, makeRegistry(makeProvider()), makeStorage(),
    );
    const result = await handler.execute(
      createTestCommand(GENERATE_RETURN_LABEL, { rmaId: 'rma-3', from: ADDR, to: WAREHOUSE, parcels: [{ weightKg: 1 }] }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/completed/i);
  });
});

describe('SchedulePickupCommand', () => {
  it('schedules a pickup and emits RMA_PICKUP_SCHEDULED', async () => {
    const rma = {
      id: 'rma-1', rmaNumber: 'RMA-001', customerId: 'cust-1',
      returnTrackingNumber: 'TRK-123', returnLabelProvider: 'manual',
      returnPickupScheduledAt: null, returnPickupCancelledAt: null, returnCarrierId: null,
    };
    const tx: any = {
      rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn().mockResolvedValue(rma) },
      carrier: { findUnique: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const provider = makeProvider();
    const registry = makeRegistry(provider);
    const { bus } = mockEventBus();
    const handler = new SchedulePickupCommandHandler(prisma, bus, registry);

    const result = await handler.execute(
      createTestCommand(SCHEDULE_RMA_PICKUP, {
        rmaId: 'rma-1',
        pickupDate: '2026-04-20T09:00:00Z',
        pickupWindow: '09:00-12:00',
        address: ADDR,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.data?.confirmationNumber).toBe('PU-999');
    expect(tx.rma.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        returnPickupConfirmationNumber: 'PU-999',
        returnPickupCancelledAt: null,
      }),
    }));
    expect(result.events[0].type).toBe(EVENT_TYPES.RMA_PICKUP_SCHEDULED);
  });

  it('rejects scheduling when no tracking number exists', async () => {
    const rma = { id: 'rma-2', rmaNumber: 'RMA-002', returnTrackingNumber: null };
    const tx: any = { rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn() }, carrier: { findUnique: jest.fn() } };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const handler = new SchedulePickupCommandHandler(prisma, mockEventBus().bus, makeRegistry(makeProvider()));
    const result = await handler.execute(
      createTestCommand(SCHEDULE_RMA_PICKUP, {
        rmaId: 'rma-2', pickupDate: new Date(), address: ADDR,
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tracking number/i);
  });

  it('rejects rescheduling an active pickup', async () => {
    const rma = {
      id: 'rma-3', rmaNumber: 'RMA-003',
      returnTrackingNumber: 'TRK', returnPickupScheduledAt: new Date(), returnPickupCancelledAt: null,
    };
    const tx: any = { rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn() }, carrier: { findUnique: jest.fn() } };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const handler = new SchedulePickupCommandHandler(prisma, mockEventBus().bus, makeRegistry(makeProvider()));
    const result = await handler.execute(
      createTestCommand(SCHEDULE_RMA_PICKUP, { rmaId: 'rma-3', pickupDate: new Date(), address: ADDR }),
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already scheduled/i);
  });
});

describe('CancelPickupCommand', () => {
  it('cancels an active pickup and emits RMA_PICKUP_CANCELLED', async () => {
    const rma = {
      id: 'rma-1', rmaNumber: 'RMA-001',
      returnPickupConfirmationNumber: 'PU-999', returnPickupCancelledAt: null,
      returnLabelProvider: 'manual', returnCarrierId: null,
    };
    const tx: any = {
      rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn().mockResolvedValue(rma) },
      carrier: { findUnique: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const provider = makeProvider();
    const { bus } = mockEventBus();
    const handler = new CancelPickupCommandHandler(prisma, bus, makeRegistry(provider));

    const result = await handler.execute(
      createTestCommand(CANCEL_RMA_PICKUP, { rmaId: 'rma-1', reason: 'customer unavailable' }),
    );

    expect(result.success).toBe(true);
    expect(provider.cancelPickup).toHaveBeenCalledWith(expect.objectContaining({ confirmationNumber: 'PU-999' }));
    expect(result.events[0].type).toBe(EVENT_TYPES.RMA_PICKUP_CANCELLED);
  });

  it('rejects cancel when no pickup is scheduled', async () => {
    const rma = { id: 'rma-2', rmaNumber: 'RMA-002', returnPickupConfirmationNumber: null };
    const tx: any = { rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn() }, carrier: { findUnique: jest.fn() } };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const handler = new CancelPickupCommandHandler(prisma, mockEventBus().bus, makeRegistry(makeProvider()));
    const result = await handler.execute(createTestCommand(CANCEL_RMA_PICKUP, { rmaId: 'rma-2' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no pickup/i);
  });

  it('rejects cancel when pickup is already cancelled', async () => {
    const rma = {
      id: 'rma-3', rmaNumber: 'RMA-003',
      returnPickupConfirmationNumber: 'PU-1', returnPickupCancelledAt: new Date(),
      returnLabelProvider: 'manual', returnCarrierId: null,
    };
    const tx: any = { rma: { findUnique: jest.fn().mockResolvedValue(rma), update: jest.fn() }, carrier: { findUnique: jest.fn() } };
    const prisma: any = {
      $transaction: jest.fn((fn: Function) => fn(tx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const handler = new CancelPickupCommandHandler(prisma, mockEventBus().bus, makeRegistry(makeProvider()));
    const result = await handler.execute(createTestCommand(CANCEL_RMA_PICKUP, { rmaId: 'rma-3' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already cancelled/i);
  });
});

describe('ManualReturnLabelProvider', () => {
  it('returns a tracking number, buffer, and pickup confirmation from the built-in manual provider', async () => {
    const { ManualReturnLabelProvider } = await import('../../services/returnLabel/providers/ManualReturnLabelProvider');
    const { ReturnLabelProviderRegistry } = await import('../../services/returnLabel/ReturnLabelProviderRegistry');

    const registry = new ReturnLabelProviderRegistry();
    const manual = registry.get('manual');
    expect(manual).toBeInstanceOf(ManualReturnLabelProvider);

    const label = await manual.generateLabel({
      rmaId: 'x', rmaNumber: 'RMA-X', serviceLevel: 'ground',
      from: ADDR, to: WAREHOUSE, parcels: [{ weightKg: 1 }],
    });
    expect(label.trackingNumber).toMatch(/^MANUAL-RMA-X-/);
    expect(label.labelContent.length).toBeGreaterThan(0);
    expect(label.labelFormat).toBe('pdf');

    const pickup = await manual.schedulePickup({
      rmaId: 'x', rmaNumber: 'RMA-X', trackingNumber: label.trackingNumber,
      pickupDate: new Date('2026-04-20T10:00:00Z'), address: ADDR,
    });
    expect(pickup.confirmationNumber).toMatch(/^MANUAL-PU-/);

    await expect(manual.cancelPickup({ confirmationNumber: pickup.confirmationNumber })).resolves.toBeUndefined();
  });

  it('lists all registered providers', async () => {
    const { ReturnLabelProviderRegistry } = await import('../../services/returnLabel/ReturnLabelProviderRegistry');
    const registry = new ReturnLabelProviderRegistry();
    expect(registry.list()).toEqual(expect.arrayContaining(['manual', 'fedex', 'ups', 'dhl']));
  });

  it('throws for unknown providers', async () => {
    const { ReturnLabelProviderRegistry } = await import('../../services/returnLabel/ReturnLabelProviderRegistry');
    const registry = new ReturnLabelProviderRegistry();
    expect(() => registry.get('usps')).toThrow(/Unknown return label provider/);
  });
});
