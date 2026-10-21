import { HandlingUnitReturnsHandler } from '../../events/handlers/HandlingUnitReturnsHandler';
import { MOVE_HANDLING_UNIT } from '../../commands/warehouse/MoveHandlingUnitCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const event = (payload: any) => createTestEvent(EVENT_TYPES.RMA_UNIT_MOVED, 'rma_line', 'line-1', payload);

describe('HandlingUnitReturnsHandler', () => {
  it('turns a returned unit move into a handling unit move in the same org', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue({ success: true }) } as any;

    await new HandlingUnitReturnsHandler(bus).handle(event({ rmaId: 'rma-1', unitId: 'unit-1', binId: 'bin-q', qualityStatus: 'quarantine' }));

    expect(bus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: MOVE_HANDLING_UNIT,
      orgId: 'test-org',
      payload: { handlingUnitId: 'unit-1', binId: 'bin-q', qualityStatus: 'quarantine', reason: 'rma', referenceId: 'rma-1' },
    }));
  });

  it('throws when the move fails, so the queue retries it', async () => {
    const bus = { dispatch: jest.fn().mockResolvedValue({ success: false, error: 'Handling unit unit-1 not found' }) } as any;

    await expect(new HandlingUnitReturnsHandler(bus).handle(event({ rmaId: 'rma-1', unitId: 'unit-1', binId: 'bin-q' })))
      .rejects.toThrow('not found');
  });

  it('ignores a move with no unit or no bin', async () => {
    const bus = { dispatch: jest.fn() } as any;

    await new HandlingUnitReturnsHandler(bus).handle(event({ rmaId: 'rma-1', unitId: null, binId: 'bin-q' }));

    expect(bus.dispatch).not.toHaveBeenCalled();
  });
});
