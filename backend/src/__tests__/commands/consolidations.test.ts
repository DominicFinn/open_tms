import {
  CreateConsolidationCommandHandler, CREATE_CONSOLIDATION,
  UpdateConsolidationCommandHandler, UPDATE_CONSOLIDATION,
  AddShipmentsToConsolidationCommandHandler, ADD_SHIPMENTS_TO_CONSOLIDATION,
  RemoveShipmentFromConsolidationCommandHandler, REMOVE_SHIPMENT_FROM_CONSOLIDATION,
  ArchiveConsolidationCommandHandler, ARCHIVE_CONSOLIDATION,
} from '../../commands/consolidations';
import { joinProblem } from '../../commands/consolidations/consolidationMembership';
import { ReorderConsolidationStopsCommandHandler, REORDER_CONSOLIDATION_STOPS, reorderProblem } from '../../commands/consolidations/ReorderConsolidationStopsCommand';
import { TransitionConsolidationStatusCommandHandler, TRANSITION_CONSOLIDATION_STATUS, transitionProblem } from '../../commands/consolidations/TransitionConsolidationStatusCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

interface FakeStop { id: string; locationId: string; stopType: string; sequenceNumber: number; consolidationStopId: string | null }
interface FakeShipment { id: string; reference: string; status: string; archived: boolean; orgId: string; stops: FakeStop[]; originId?: string; destinationId?: string; carrierId?: string | null }

const stop = (id: string, locationId: string, sequenceNumber: number, stopType = 'delivery'): FakeStop =>
  ({ id, locationId, stopType, sequenceNumber, consolidationStopId: null });

/** Shipment A: Green Bay -> Atlanta. Shipment B: Chicago -> Atlanta -> Memphis. */
function fixtures(): FakeShipment[] {
  return [
    { id: 'ship-a', reference: 'SH-A', status: 'draft', archived: false, orgId: 'test-org', stops: [stop('a1', 'GB', 1, 'pickup'), stop('a2', 'ATL', 2)] },
    { id: 'ship-b', reference: 'SH-B', status: 'ready', archived: false, orgId: 'test-org', stops: [stop('b1', 'CHI', 1, 'pickup'), stop('b2', 'ATL', 2), stop('b3', 'MEM', 3)] },
    { id: 'ship-c', reference: 'SH-C', status: 'in_progress', archived: false, orgId: 'test-org', stops: [stop('c1', 'GB', 1, 'pickup')] },
  ];
}

/** An in-memory store covering the calls the consolidation commands make. */
function fakeDb(shipments = fixtures()) {
  const consolidations: any[] = [];
  let members: Array<{ consolidationId: string; shipmentId: string; addedAt: Date }> = [];
  let cStops: Array<{ id: string; consolidationId: string; locationId: string; stopType: string; sequenceNumber: number }> = [];
  let n = 0;
  const allStops = () => shipments.flatMap((s) => s.stops);

  const tx: any = {
    carrier: { findFirst: jest.fn(async ({ where }: any) => (where.id === 'carrier-1' && where.orgId === 'test-org' ? { id: 'carrier-1' } : null)) },
    consolidation: {
      create: jest.fn(async ({ data }: any) => { const c = { id: `con-${++n}`, status: 'draft', archived: false, ...data }; consolidations.push(c); return c; }),
      findFirst: jest.fn(async ({ where }: any) => {
        const c = consolidations.find((x) => x.id === where.id && x.orgId === where.orgId);
        return c ? { ...c, shipments: members.filter((m) => m.consolidationId === c.id).map((m) => ({ shipmentId: m.shipmentId })) } : null;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(consolidations.find((x) => x.id === where.id)!, data)),
    },
    shipment: {
      update: jest.fn(async ({ where, data }: any) => Object.assign(shipments.find((s) => s.id === where.id)!, data)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = shipments.filter((s) => where.id.in.includes(s.id));
        hit.forEach((s) => Object.assign(s, data));
        return { count: hit.length };
      }),
      findMany: jest.fn(async ({ where }: any) => shipments
        .filter((s) => where.id.in.includes(s.id) && s.orgId === where.orgId)
        .filter((s) => !where.OR || s.carrierId == null || s.carrierId !== where.OR[1].carrierId.not)
        .map((s) => {
          const m = members.find((x) => x.shipmentId === s.id);
          return { ...s, consolidationShipment: m ? { consolidationId: m.consolidationId } : null };
        })),
    },
    consolidationShipment: {
      findFirst: jest.fn(async ({ where }: any) => [...members].reverse().find((m) => m.consolidationId === where.consolidationId) ?? null),
      createMany: jest.fn(async ({ data }: any) => { members.push(...data); return { count: data.length }; }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const before = members.length;
        members = members.filter((m) => !(m.consolidationId === where.consolidationId && m.shipmentId === where.shipmentId));
        return { count: before - members.length };
      }),
      findMany: jest.fn(async ({ where }: any) => members
        .filter((m) => m.consolidationId === where.consolidationId)
        .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())
        .map((m) => {
          const sh = shipments.find((s) => s.id === m.shipmentId)!;
          const stops = [...sh.stops].sort((a, b) => a.sequenceNumber - b.sequenceNumber).map((st) => {
            const c = cStops.find((x) => x.id === st.consolidationStopId);
            return { ...st, consolidationStop: c ? { sequenceNumber: c.sequenceNumber } : null };
          });
          return { shipment: { id: sh.id, originId: sh.originId, destinationId: sh.destinationId, stops } };
        })),
    },
    consolidationStop: {
      findMany: jest.fn(async ({ where }: any) => cStops.filter((s) => s.consolidationId === where.consolidationId).sort((a, b) => a.sequenceNumber - b.sequenceNumber)),
      deleteMany: jest.fn(async ({ where }: any) => {
        const gone = cStops.filter((s) => s.consolidationId === where.consolidationId && (!where.id || where.id.in.includes(s.id))).map((s) => s.id);
        cStops = cStops.filter((s) => !gone.includes(s.id));
        allStops().forEach((s) => { if (s.consolidationStopId && gone.includes(s.consolidationStopId)) s.consolidationStopId = null; });
        return { count: gone.length };
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(cStops.find((s) => s.id === where.id)!, data)),
      create: jest.fn(async ({ data }: any) => { const s = { id: `cs-${++n}`, ...data }; cStops.push(s); return s; }),
    },
    shipmentStop: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = allStops().filter((s) => (where.id ? where.id.in.includes(s.id) : shipments.find((sh) => sh.id === where.shipmentId)!.stops.includes(s)))
          .filter((s) => !where.consolidationStop || cStops.some((c) => c.id === s.consolidationStopId && c.consolidationId === where.consolidationStop.consolidationId));
        hit.forEach((s) => {
          if (data.sequenceNumber?.increment) s.sequenceNumber += data.sequenceNumber.increment;
          else Object.assign(s, data);
        });
        return { count: hit.length };
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(allStops().find((s) => s.id === where.id)!, data)),
    },
    // Cost allocation (#329): no rate on these runs, so it only clears and re-summarises.
    charge: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), deleteMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    orderShipment: { findMany: jest.fn().mockResolvedValue([]) },
    shipmentFinancialSummary: { upsert: jest.fn().mockResolvedValue({}) },
    domainEventLog: { create: jest.fn() },
  };
  const prisma: any = { $transaction: jest.fn((fn: Function) => fn(tx)), domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) } };
  const route = () => [...cStops].sort((a, b) => a.sequenceNumber - b.sequenceNumber).map((s) => `${s.sequenceNumber}:${s.stopType}:${s.locationId}`);
  const linkOf = (stopId: string) => {
    const target = cStops.find((c) => c.id === allStops().find((s) => s.id === stopId)!.consolidationStopId);
    return target ? `${target.stopType}:${target.locationId}` : null;
  };
  const shipmentRoute = (id: string) => [...shipments.find((s) => s.id === id)!.stops].sort((a, b) => a.sequenceNumber - b.sequenceNumber).map((s) => s.locationId);
  return { tx, prisma, route, linkOf, members: () => members, consolidations, shipments, cStops: () => cStops, shipmentRoute };
}

const bus = () => mockEventBus().bus as any;

async function create(db: ReturnType<typeof fakeDb>, shipmentIds: string[], extra: object = {}) {
  return new CreateConsolidationCommandHandler(db.prisma, bus()).execute(createTestCommand(CREATE_CONSOLIDATION, { shipmentIds, ...extra }));
}

describe('CreateConsolidationCommandHandler (#329)', () => {
  it('builds every pickup before every drop, sharing stops at a shared location', async () => {
    const db = fakeDb();
    const result = await create(db, ['ship-a', 'ship-b']);

    expect(result.success).toBe(true);
    expect(db.route()).toEqual(['1:pickup:GB', '2:pickup:CHI', '3:delivery:ATL', '4:delivery:MEM']);
    expect(db.linkOf('a2')).toBe('delivery:ATL');
    expect(db.linkOf('b2')).toBe('delivery:ATL');
    expect(db.linkOf('b1')).toBe('pickup:CHI');
  });

  it('emits consolidation.created carrying the command metadata', async () => {
    const db = fakeDb();
    const command = createTestCommand(CREATE_CONSOLIDATION, { shipmentIds: ['ship-a'], carrierId: 'carrier-1' }, { metadata: { correlationId: 'corr-1', source: 'test' } });
    const result = await new CreateConsolidationCommandHandler(db.prisma, bus()).execute(command);

    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.CONSOLIDATION_CREATED, EVENT_TYPES.SHIPMENT_UPDATED]);
    expect(result.events[0]).toMatchObject({
      type: EVENT_TYPES.CONSOLIDATION_CREATED,
      entityType: 'consolidation',
      orgId: 'test-org',
      payload: { shipmentIds: ['ship-a'], stopCount: 2 },
    });
    expect(result.events[0].metadata).toMatchObject({ correlationId: 'corr-1' });
    expect(db.consolidations[0]).toMatchObject({ orgId: 'test-org', carrierId: 'carrier-1' });
    // The run's carrier hauls the shipment, so it is set on it.
    expect(db.shipments[0].carrierId).toBe('carrier-1');
    expect(result.events[1]).toMatchObject({ entityType: 'shipment', entityId: 'ship-a', payload: { consolidationId: 'con-1' } });
    expect(db.consolidations[0].reference).toMatch(/^CON-\d{6}-[0-9A-F]{6}$/);
  });

  it('refuses a carrier from another org as not found', async () => {
    const result = await create(fakeDb(), ['ship-a'], { carrierId: 'carrier-x' });
    expect(result).toMatchObject({ success: false, error: 'Carrier not found' });
  });

  it('refuses a shipment that has already started, or is missing', async () => {
    expect(await create(fakeDb(), ['ship-a', 'ship-c'])).toMatchObject({ success: false, error: 'SH-C has already started.' });
    expect(await create(fakeDb(), ['ship-a', 'ship-x'])).toMatchObject({ success: false, error: 'Shipment not found' });
  });
});

describe('joinProblem', () => {
  const s = { id: 's', reference: 'SH-1', status: 'draft', archived: false, consolidationShipment: null };
  it('allows an open, unattached shipment and explains every refusal', () => {
    expect(joinProblem(s, 'con-1')).toBeNull();
    expect(joinProblem({ ...s, archived: true }, 'con-1')).toBe('SH-1 is archived.');
    expect(joinProblem({ ...s, status: 'complete' }, 'con-1')).toBe('SH-1 has already started.');
    expect(joinProblem({ ...s, consolidationShipment: { consolidationId: 'con-1' } }, 'con-1')).toBe('SH-1 is already on this consolidation.');
    expect(joinProblem({ ...s, consolidationShipment: { consolidationId: 'con-2' } }, 'con-1')).toBe('SH-1 is already on another consolidation.');
  });
});

describe('Adding and removing shipments (#329)', () => {
  it('adds a shipment after the others, keeping existing stops, and emits shipment_added', async () => {
    const db = fakeDb();
    await create(db, ['ship-b']);
    const atlBefore = db.tx.consolidationStop.create.mock.results.length;

    const result = await new AddShipmentsToConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(ADD_SHIPMENTS_TO_CONSOLIDATION, { id: 'con-1', shipmentIds: ['ship-a'] }));

    expect(result.success).toBe(true);
    expect(db.route()).toEqual(['1:pickup:CHI', '2:pickup:GB', '3:delivery:ATL', '4:delivery:MEM']);
    // Only Green Bay is new; Chicago, Atlanta and Memphis kept their rows.
    expect(db.tx.consolidationStop.create.mock.results.length - atlBefore).toBe(1);
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.CONSOLIDATION_SHIPMENT_ADDED, payload: { shipmentId: 'ship-a', stopCount: 4 } });
  });

  it('refuses a shipment already on another consolidation', async () => {
    const db = fakeDb();
    await create(db, ['ship-a']);
    await create(db, ['ship-b']);
    const result = await new AddShipmentsToConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(ADD_SHIPMENTS_TO_CONSOLIDATION, { id: 'con-1', shipmentIds: ['ship-b'] }));
    expect(result).toMatchObject({ success: false, error: 'SH-B is already on another consolidation.' });
  });

  it('removes a shipment, unlinks its stops and drops stops nobody needs', async () => {
    const db = fakeDb();
    await create(db, ['ship-a', 'ship-b']);

    const result = await new RemoveShipmentFromConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(REMOVE_SHIPMENT_FROM_CONSOLIDATION, { id: 'con-1', shipmentId: 'ship-b' }));

    expect(result.success).toBe(true);
    expect(db.route()).toEqual(['1:pickup:GB', '2:delivery:ATL']);
    expect(db.linkOf('b2')).toBeNull();
    expect(db.linkOf('a2')).toBe('delivery:ATL');
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.CONSOLIDATION_SHIPMENT_REMOVED, payload: { shipmentId: 'ship-b', stopCount: 2 } });
  });

  it('refuses changes once the consolidation is no longer a draft', async () => {
    const db = fakeDb();
    await create(db, ['ship-a']);
    db.consolidations[0].status = 'in_progress';
    const result = await new RemoveShipmentFromConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(REMOVE_SHIPMENT_FROM_CONSOLIDATION, { id: 'con-1', shipmentId: 'ship-a' }));
    expect(result).toMatchObject({ success: false, error: 'Shipments can only be changed on a draft consolidation.' });
  });

  it('reports a consolidation in another org as not found', async () => {
    const db = fakeDb();
    await create(db, ['ship-a']);
    const result = await new AddShipmentsToConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(ADD_SHIPMENTS_TO_CONSOLIDATION, { id: 'con-1', shipmentIds: ['ship-b'] }, { orgId: 'other-org' }));
    expect(result).toMatchObject({ success: false, error: 'Consolidation not found' });
  });
});

describe('UpdateConsolidationCommandHandler', () => {
  it('changes only the fields given and emits consolidation.updated', async () => {
    const db = fakeDb();
    await create(db, ['ship-a'], { notes: 'dock 4' });
    const result = await new UpdateConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(UPDATE_CONSOLIDATION, { id: 'con-1', carrierId: 'carrier-1' }));

    expect(result.success).toBe(true);
    expect(db.consolidations[0]).toMatchObject({ carrierId: 'carrier-1', notes: 'dock 4' });
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.CONSOLIDATION_UPDATED, payload: { changes: ['carrierId'] } });
  });
});

describe('ArchiveConsolidationCommandHandler', () => {
  it('frees a draft’s shipments so they can be consolidated again', async () => {
    const db = fakeDb();
    await create(db, ['ship-a', 'ship-b']);
    const result = await new ArchiveConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(ARCHIVE_CONSOLIDATION, { id: 'con-1' }));

    expect(result).toMatchObject({ success: true, data: { released: 2 } });
    expect(db.members()).toHaveLength(0);
    expect(db.route()).toEqual([]);
    expect(db.consolidations[0].archived).toBe(true);
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.CONSOLIDATION_ARCHIVED, payload: { releasedShipmentIds: ['ship-a', 'ship-b'] } });
  });

  it('refuses a consolidation on the road', async () => {
    const db = fakeDb();
    await create(db, ['ship-a']);
    db.consolidations[0].status = 'in_progress';
    const result = await new ArchiveConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(ARCHIVE_CONSOLIDATION, { id: 'con-1' }));
    expect(result).toMatchObject({ success: false, error: 'A consolidation on the road cannot be archived.' });
  });
});

describe('Run order and shipment alignment (#329)', () => {
  /** A: Green Bay -> Atlanta. B: Chicago -> Memphis -> Atlanta, the other way round to the run. */
  const crossed = (): FakeShipment[] => [
    { id: 'ship-a', reference: 'SH-A', status: 'draft', archived: false, orgId: 'test-org', originId: 'GB', destinationId: 'ATL', stops: [stop('a1', 'GB', 1, 'pickup'), stop('a2', 'ATL', 2)] },
    { id: 'ship-b', reference: 'SH-B', status: 'draft', archived: false, orgId: 'test-org', originId: 'CHI', destinationId: 'ATL', stops: [stop('b1', 'CHI', 1, 'pickup'), stop('b2', 'MEM', 2), stop('b3', 'ATL', 3)] },
    { id: 'ship-d', reference: 'SH-D', status: 'draft', archived: false, orgId: 'test-org', originId: 'HOU', destinationId: 'DAL', stops: [stop('d1', 'HOU', 1, 'pickup'), stop('d2', 'DAL', 2)] },
  ];

  it('puts each shipment\'s stops in the run\'s order and moves its destination to its last stop', async () => {
    const db = fakeDb(crossed());
    const result = await create(db, ['ship-a', 'ship-b']);

    expect(db.route()).toEqual(['1:pickup:GB', '2:pickup:CHI', '3:delivery:ATL', '4:delivery:MEM']);
    expect(db.shipmentRoute('ship-b')).toEqual(['CHI', 'ATL', 'MEM']);
    expect(db.shipments[1].destinationId).toBe('MEM');
    expect(result.events.filter((e) => e.type === EVENT_TYPES.SHIPMENT_UPDATED).map((e) => e.entityId)).toEqual(['ship-b']);
  });

  it('reorders the run and realigns the shipments it changes', async () => {
    const db = fakeDb(crossed());
    await create(db, ['ship-a', 'ship-b']);
    const id = (loc: string, kind = 'delivery') => db.cStops().find((c) => c.locationId === loc && c.stopType === kind)!.id;

    const result = await new ReorderConsolidationStopsCommandHandler(db.prisma, bus()).execute(createTestCommand(REORDER_CONSOLIDATION_STOPS, {
      id: 'con-1', stopIds: [id('CHI', 'pickup'), id('GB', 'pickup'), id('MEM'), id('ATL')],
    }));

    expect(result.success).toBe(true);
    expect(db.route()).toEqual(['1:pickup:CHI', '2:pickup:GB', '3:delivery:MEM', '4:delivery:ATL']);
    expect(db.shipmentRoute('ship-b')).toEqual(['CHI', 'MEM', 'ATL']);
    expect(db.shipments[1].destinationId).toBe('ATL');
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.CONSOLIDATION_STOPS_REORDERED, payload: { changedShipmentIds: ['ship-b'] } });
  });

  it('keeps a hand-set order when another shipment joins, adding its stops at the end of each section', async () => {
    const db = fakeDb(crossed());
    await create(db, ['ship-a', 'ship-b']);
    const id = (loc: string, kind = 'delivery') => db.cStops().find((c) => c.locationId === loc && c.stopType === kind)!.id;
    await new ReorderConsolidationStopsCommandHandler(db.prisma, bus()).execute(createTestCommand(REORDER_CONSOLIDATION_STOPS, {
      id: 'con-1', stopIds: [id('CHI', 'pickup'), id('GB', 'pickup'), id('MEM'), id('ATL')],
    }));

    await new AddShipmentsToConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(ADD_SHIPMENTS_TO_CONSOLIDATION, { id: 'con-1', shipmentIds: ['ship-d'] }));

    expect(db.route()).toEqual(['1:pickup:CHI', '2:pickup:GB', '3:pickup:HOU', '4:delivery:MEM', '5:delivery:ATL', '6:delivery:DAL']);
  });

  it('refuses an order that drops before a pickup or misses a stop', () => {
    const stops = [{ id: 'p1', stopType: 'pickup' }, { id: 'p2', stopType: 'pickup' }, { id: 'd1', stopType: 'delivery' }];
    expect(reorderProblem(stops, ['p2', 'p1', 'd1'])).toBeNull();
    expect(reorderProblem(stops, ['p1', 'd1', 'p2'])).toBe('Every pickup has to come before every drop.');
    expect(reorderProblem(stops, ['p1', 'd1'])).toBe('The new order must list every stop on the consolidation once.');
    expect(reorderProblem(stops, ['p1', 'p1', 'd1'])).toBe('The new order must list every stop on the consolidation once.');
  });
});

describe('Marking a consolidation ready (#329)', () => {
  it('needs shipments, all of them ready, and only goes back to draft from ready', () => {
    const ready = [{ reference: 'SH-A', status: 'ready' }];
    expect(transitionProblem('draft', 'ready', ready)).toBeNull();
    expect(transitionProblem('draft', 'ready', [])).toBe('Add shipments before marking the consolidation ready.');
    expect(transitionProblem('draft', 'ready', [...ready, { reference: 'SH-B', status: 'draft' }])).toBe('Every shipment must be ready first: SH-B.');
    expect(transitionProblem('ready', 'draft', ready)).toBeNull();
    expect(transitionProblem('in_progress', 'draft', ready)).toBe('Only a ready consolidation can go back to draft.');
  });

  it('marks the run ready and emits consolidation.status_changed', async () => {
    const tx: any = {
      consolidation: {
        findFirst: jest.fn().mockResolvedValue({ status: 'draft', shipments: [{ shipment: { reference: 'SH-A', status: 'ready' } }] }),
        update: jest.fn().mockResolvedValue({}),
      },
      domainEventLog: { create: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((fn: Function) => fn(tx)), domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) } };
    const result = await new TransitionConsolidationStatusCommandHandler(prisma, bus())
      .execute(createTestCommand(TRANSITION_CONSOLIDATION_STATUS, { id: 'con-1', to: 'ready' as const }));

    expect(result).toMatchObject({ success: true, data: { status: 'ready' } });
    expect(tx.consolidation.update).toHaveBeenCalledWith({ where: { id: 'con-1', orgId: 'test-org' }, data: { status: 'ready' } });
    expect(result.events[0]).toMatchObject({ type: EVENT_TYPES.CONSOLIDATION_STATUS_CHANGED, payload: { from: 'draft', to: 'ready', automatic: false } });
  });
});

describe('Carrier rate (#329)', () => {
  it('splits a rate set on the run across its shipments and emits the allocation', async () => {
    const db = fakeDb();
    await create(db, ['ship-a', 'ship-b']);
    db.tx.charge.create.mockImplementation(async ({ data }: any) => ({ id: `charge-${data.shipmentId}`, ...data }));

    const result = await new UpdateConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(UPDATE_CONSOLIDATION, { id: 'con-1', carrierRateCents: 1001 }));

    expect(result.success).toBe(true);
    // No order lines are weighed in this fixture, so the split is even, to the cent.
    expect(db.tx.charge.create.mock.calls.map((c: any[]) => [c[0].data.shipmentId, c[0].data.amountCents])).toEqual([['ship-a', 501], ['ship-b', 500]]);
    expect(result.events.map((e) => e.type)).toEqual(expect.arrayContaining([EVENT_TYPES.CONSOLIDATION_COST_ALLOCATED, EVENT_TYPES.CHARGE_CREATED]));
    expect(result.events.find((e) => e.type === EVENT_TYPES.CONSOLIDATION_COST_ALLOCATED)).toMatchObject({ payload: { basis: 'even' } });
  });

  it('leaves costs alone when only the notes change', async () => {
    const db = fakeDb();
    await create(db, ['ship-a']);
    const result = await new UpdateConsolidationCommandHandler(db.prisma, bus())
      .execute(createTestCommand(UPDATE_CONSOLIDATION, { id: 'con-1', notes: 'dock 2' }));
    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.CONSOLIDATION_UPDATED]);
    expect(db.tx.charge.findMany).not.toHaveBeenCalled();
  });
});
