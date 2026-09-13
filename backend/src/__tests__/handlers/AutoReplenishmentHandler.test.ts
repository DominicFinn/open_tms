import { AutoReplenishmentHandler } from '../../events/handlers/AutoReplenishmentHandler';

function makeEvent(overrides: Partial<any> = {}): any {
  return {
    id: 'evt-1',
    type: 'pick_line.completed',
    orgId: 'org1',
    actorId: 'u1',
    entityType: 'pick_line',
    entityId: 'line-1',
    payload: { pickTaskId: 'pt-1', sku: 'SKU-A', pickedQuantity: 2 },
    timestamp: new Date().toISOString(),
    metadata: { correlationId: 'c1', source: 'test', schemaVersion: 1 },
    ...overrides,
  };
}

function makePrisma(overrides: any = {}) {
  return {
    pickTask: { findFirst: jest.fn() },
    warehouseBin: { findFirst: jest.fn() },
    ...overrides,
  } as any;
}

describe('AutoReplenishmentHandler', () => {
  it('subscribes to pick_line.completed and inventory.adjusted', () => {
    const h = new AutoReplenishmentHandler(makePrisma(), {} as any);
    expect(h.eventPatterns).toEqual(['pick_line.completed', 'inventory.adjusted']);
  });

  it('resolves the facility from pick task and dispatches CHECK_REPLENISHMENT', async () => {
    const dispatch = jest.fn().mockResolvedValue({ success: true });
    const prisma = makePrisma({
      pickTask: { findFirst: jest.fn().mockResolvedValue({ facilityId: 'fac-1' }) },
    });
    const handler = new AutoReplenishmentHandler(prisma, { dispatch } as any);

    await handler.handle(makeEvent());

    expect(prisma.pickTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pt-1', orgId: 'org1' }, select: { facilityId: true } }),
    );
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'replenishment.check',
      payload: { facilityId: 'fac-1', sku: 'SKU-A' },
      orgId: 'org1',
    }));
  });

  it('resolves the facility from bin for inventory.adjusted events', async () => {
    const dispatch = jest.fn().mockResolvedValue({ success: true });
    const prisma = makePrisma({
      warehouseBin: { findFirst: jest.fn().mockResolvedValue({ facilityId: 'fac-2' }) },
    });
    const handler = new AutoReplenishmentHandler(prisma, { dispatch } as any);

    await handler.handle(makeEvent({
      type: 'inventory.adjusted',
      entityType: 'inventory_record',
      payload: { binId: 'bin-1', sku: 'SKU-B', quantityChange: -5 },
    }));

    expect(prisma.warehouseBin.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'bin-1', orgId: 'org1' }, select: { facilityId: true } }),
    );
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: { facilityId: 'fac-2', sku: 'SKU-B' },
    }));
  });

  it('uses payload.facilityId directly when present', async () => {
    const dispatch = jest.fn().mockResolvedValue({ success: true });
    const prisma = makePrisma();
    const handler = new AutoReplenishmentHandler(prisma, { dispatch } as any);

    await handler.handle(makeEvent({
      payload: { pickTaskId: 'pt-x', sku: 'SKU-C', facilityId: 'fac-direct' },
    }));

    // Should NOT look up pickTask when the event already names the facility
    expect(prisma.pickTask.findFirst).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: { facilityId: 'fac-direct', sku: 'SKU-C' },
    }));
  });

  it('silently skips when sku is missing', async () => {
    const dispatch = jest.fn();
    const handler = new AutoReplenishmentHandler(makePrisma(), { dispatch } as any);
    await handler.handle(makeEvent({ payload: { pickTaskId: 'pt-1' } }));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('silently skips when locationId cannot be resolved', async () => {
    const dispatch = jest.fn();
    const prisma = makePrisma({
      pickTask: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const handler = new AutoReplenishmentHandler(prisma, { dispatch } as any);
    await handler.handle(makeEvent());
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('catches dispatch errors without throwing', async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error('bus down'));
    const prisma = makePrisma({
      pickTask: { findFirst: jest.fn().mockResolvedValue({ facilityId: 'fac-1' }) },
    });
    const handler = new AutoReplenishmentHandler(prisma, { dispatch } as any);
    await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
  });
});
