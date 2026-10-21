import { WmsOutboxRelay, WMS_OUTBOX_CURSOR, toDomainEvent } from '../../events/bridge/WmsOutboxRelay';
import { START_OF_OUTBOX, type WmsOutboxRow } from '../../events/bridge/WmsOutboxReader';

const row = (n: number): WmsOutboxRow => ({
  position: BigInt(n),
  txId: String(1000 + n),
  id: `evt-${n}`,
  type: 'handling_unit.moved',
  orgId: 'org-a',
  actorId: 'user-1',
  entityType: 'handling_unit',
  entityId: `hu-${n}`,
  payload: { binId: `bin-${n}` },
  metadata: { correlationId: 'corr', source: 'finnwms', schemaVersion: 1 },
  occurredAt: new Date('2026-10-22T10:00:00Z'),
});

function build({ exists = true, rows = [row(1), row(2)], cursor = null as any } = {}) {
  const calls: string[] = [];
  const prisma = {
    domainEventLog: { createMany: jest.fn(async (args: any) => { calls.push(`log:${args.data[0].id}`); return { count: 1 }; }) },
    eventBridgeCursor: {
      findUnique: jest.fn().mockResolvedValue(cursor),
      upsert: jest.fn(async (args: any) => { calls.push(`cursor:${args.update.position}`); return {}; }),
    },
  } as any;
  const reader = { exists: jest.fn().mockResolvedValue(exists), readAfter: jest.fn().mockResolvedValue(rows) } as any;
  const bus = { fanOut: jest.fn(async (e: any) => { calls.push(`fanOut:${e.id}`); }) };
  return { prisma, reader, bus, calls, relay: new WmsOutboxRelay(prisma, reader, bus, 100) };
}

describe('WmsOutboxRelay', () => {
  it('logs, fans out, then moves the cursor, row by row, so a crash repeats rather than loses', async () => {
    const { relay, calls } = build();

    expect(await relay.relayOnce()).toBe(2);

    expect(calls).toEqual(['log:evt-1', 'fanOut:evt-1', 'cursor:1', 'log:evt-2', 'fanOut:evt-2', 'cursor:2']);
  });

  it('skips an event already in the log rather than failing on it', async () => {
    const { relay, prisma } = build();

    await relay.relayOnce();

    expect(prisma.domainEventLog.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it('reads from the start the first time, and from the stored cursor after that', async () => {
    const first = build();
    await first.relay.relayOnce();
    expect(first.reader.readAfter).toHaveBeenCalledWith(START_OF_OUTBOX, 100);

    const later = build({ cursor: { txId: '1002', position: 2n } });
    await later.relay.relayOnce();
    expect(later.reader.readAfter).toHaveBeenCalledWith({ txId: '1002', position: 2n }, 100);
  });

  it('records the cursor under the outbox name with the row it reached', async () => {
    const { relay, prisma } = build({ rows: [row(7)] });

    await relay.relayOnce();

    expect(prisma.eventBridgeCursor.upsert).toHaveBeenCalledWith({
      where: { name: WMS_OUTBOX_CURSOR },
      create: { name: WMS_OUTBOX_CURSOR, txId: '1007', position: 7n, relayedCount: 1 },
      update: { txId: '1007', position: 7n, relayedCount: { increment: 1 } },
    });
  });

  it('does nothing until the .NET service has created its outbox', async () => {
    const { relay, reader, bus } = build({ exists: false });

    expect(await relay.relayOnce()).toBe(0);
    expect(reader.readAfter).not.toHaveBeenCalled();
    expect(bus.fanOut).not.toHaveBeenCalled();
  });

  it('turns an outbox row into the event shape Node commands emit', () => {
    expect(toDomainEvent(row(3))).toEqual({
      id: 'evt-3',
      type: 'handling_unit.moved',
      timestamp: '2026-10-22T10:00:00.000Z',
      orgId: 'org-a',
      actorId: 'user-1',
      entityType: 'handling_unit',
      entityId: 'hu-3',
      payload: { binId: 'bin-3' },
      metadata: { correlationId: 'corr', source: 'finnwms', schemaVersion: 1 },
    });
  });
});
