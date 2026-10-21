import { MoveHandlingUnitCommandHandler, MOVE_HANDLING_UNIT } from '../../commands/warehouse/MoveHandlingUnitCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

function build({ bin = { id: 'bin-q', zoneId: 'zone-q' } as any, moved = 1 } = {}) {
  const tx = {
    warehouseBin: { findFirst: jest.fn().mockResolvedValue(bin) },
    handlingUnit: { updateMany: jest.fn().mockResolvedValue({ count: moved }) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = { $transaction: jest.fn((fn: Function) => fn(tx)), domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) } } as any;
  return { tx, handler: new MoveHandlingUnitCommandHandler(prisma, mockEventBus().bus) };
}

const payload = { handlingUnitId: 'hu-1', binId: 'bin-q', qualityStatus: 'quarantine', reason: 'rma', referenceId: 'rma-1' };

describe('MoveHandlingUnitCommandHandler', () => {
  it('moves the unit within the org and sets its quality', async () => {
    const { tx, handler } = build();

    const result = await handler.execute(createTestCommand(MOVE_HANDLING_UNIT, payload));

    expect(result.success).toBe(true);
    expect(tx.warehouseBin.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bin-q', orgId: 'test-org' } }));
    expect(tx.handlingUnit.updateMany).toHaveBeenCalledWith({
      where: { orgId: 'test-org', id: { in: ['hu-1'] } },
      data: { currentBinId: 'bin-q', currentZoneId: 'zone-q', qualityStatus: 'quarantine' },
    });
  });

  it('emits handling_unit.moved with the reason and carries the command metadata', async () => {
    const { handler } = build();

    const result = await handler.execute(createTestCommand(MOVE_HANDLING_UNIT, payload, { metadata: { correlationId: 'corr-9', source: 'event' } } as any));

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: EVENT_TYPES.HANDLING_UNIT_MOVED,
      entityId: 'hu-1',
      payload: { binId: 'bin-q', zoneId: 'zone-q', qualityStatus: 'quarantine', reason: 'rma', referenceId: 'rma-1' },
    });
    expect(result.events[0].metadata.correlationId).toBe('corr-9');
  });

  it('leaves quality alone when none is given', async () => {
    const { tx, handler } = build();

    await handler.execute(createTestCommand(MOVE_HANDLING_UNIT, { handlingUnitId: 'hu-1', binId: 'bin-q', reason: 'manual' }));

    expect(tx.handlingUnit.updateMany.mock.calls[0][0].data).toEqual({ currentBinId: 'bin-q', currentZoneId: 'zone-q' });
  });

  it.each([
    ['a bin from another org', { bin: null }],
    ['a unit that is not in the org', { moved: 0 }],
  ])('refuses %s', async (_label, opts) => {
    const { handler } = build(opts as any);

    const result = await handler.execute(createTestCommand(MOVE_HANDLING_UNIT, payload));

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.events).toHaveLength(0);
  });

  it('refuses an unknown quality status before writing', async () => {
    const { tx, handler } = build();

    const result = await handler.execute(createTestCommand(MOVE_HANDLING_UNIT, { ...payload, qualityStatus: 'lost' }));

    expect(result.success).toBe(false);
    expect(tx.handlingUnit.updateMany).not.toHaveBeenCalled();
  });
});
