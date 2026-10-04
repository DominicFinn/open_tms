import {
  SyncConsolidationProgressCommandHandler, SYNC_CONSOLIDATION_PROGRESS, stopStatusFrom, runStatusFrom,
} from '../../commands/consolidations/SyncConsolidationProgressCommand';
import { ConsolidationProgressHandler } from '../../events/handlers/ConsolidationProgressHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, createTestEvent, mockEventBus } from '../helpers/testUtils';

describe('stopStatusFrom (#329)', () => {
  it('is done when every served shipment stop is done, reached when any is', () => {
    expect(stopStatusFrom(['completed', 'skipped'])).toBe('completed');
    expect(stopStatusFrom(['completed', 'pending'])).toBe('arrived');
    expect(stopStatusFrom(['arrived', 'pending'])).toBe('arrived');
    expect(stopStatusFrom(['pending', 'pending'])).toBe('pending');
    expect(stopStatusFrom([])).toBe('pending');
  });
});

describe('runStatusFrom (#329)', () => {
  it('starts once anything moves and completes when every shipment is complete', () => {
    expect(runStatusFrom('ready', ['ready', 'ready'], ['pending'])).toBe('ready');
    expect(runStatusFrom('ready', ['in_progress', 'ready'], ['arrived'])).toBe('in_progress');
    expect(runStatusFrom('ready', ['ready'], ['arrived'])).toBe('in_progress');
    expect(runStatusFrom('in_progress', ['complete', 'in_progress'], ['completed', 'pending'])).toBe('in_progress');
    expect(runStatusFrom('in_progress', ['complete', 'complete'], ['completed'])).toBe('complete');
  });

  it('never moves a draft, complete or cancelled run on its own', () => {
    expect(runStatusFrom('draft', ['in_progress'], ['arrived'])).toBe('draft');
    expect(runStatusFrom('cancelled', ['complete'], ['completed'])).toBe('cancelled');
  });
});

function setup(run: object | null) {
  const tx: any = {
    consolidation: { findFirst: jest.fn().mockResolvedValue(run), update: jest.fn().mockResolvedValue({}) },
    consolidationStop: { update: jest.fn().mockResolvedValue({}) },
    domainEventLog: { create: jest.fn() },
  };
  const prisma: any = { $transaction: jest.fn((fn: Function) => fn(tx)), domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) } };
  return { tx, handler: new SyncConsolidationProgressCommandHandler(prisma, mockEventBus().bus as any) };
}

describe('SyncConsolidationProgressCommandHandler (#329)', () => {
  it('mirrors the shipments onto the run stops and starts the run', async () => {
    const { tx, handler } = setup({
      status: 'ready',
      stops: [
        { id: 'cs-1', status: 'pending', shipmentStops: [{ status: 'completed' }, { status: 'completed' }] },
        { id: 'cs-2', status: 'pending', shipmentStops: [{ status: 'pending' }] },
      ],
      shipments: [{ shipment: { status: 'in_progress' } }, { shipment: { status: 'in_progress' } }],
    });

    const command = createTestCommand(SYNC_CONSOLIDATION_PROGRESS, { id: 'con-1' }, { metadata: { correlationId: 'corr-9', source: 'test' } });
    const result = await handler.execute(command);

    expect(result).toMatchObject({ success: true, data: { changed: true } });
    expect(tx.consolidationStop.update).toHaveBeenCalledTimes(1);
    expect(tx.consolidationStop.update).toHaveBeenCalledWith({ where: { id: 'cs-1', consolidationId: 'con-1', consolidation: { orgId: 'test-org' } }, data: { status: 'completed' } });
    expect(tx.consolidation.update).toHaveBeenCalledWith({ where: { id: 'con-1', orgId: 'test-org' }, data: { status: 'in_progress' } });
    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.CONSOLIDATION_STATUS_CHANGED, EVENT_TYPES.CONSOLIDATION_STOPS_UPDATED]);
    expect(result.events[0]).toMatchObject({ payload: { from: 'ready', to: 'in_progress', automatic: true } });
    expect(result.events[0].metadata).toMatchObject({ correlationId: 'corr-9' });
  });

  it('completes the run when every shipment is complete', async () => {
    const { tx, handler } = setup({
      status: 'in_progress',
      stops: [{ id: 'cs-1', status: 'completed', shipmentStops: [{ status: 'completed' }] }],
      shipments: [{ shipment: { status: 'complete' } }],
    });
    const result = await handler.execute(createTestCommand(SYNC_CONSOLIDATION_PROGRESS, { id: 'con-1' }));
    expect(tx.consolidation.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'complete' } }));
    expect(result.events.map((e) => e.type)).toEqual([EVENT_TYPES.CONSOLIDATION_STATUS_CHANGED]);
  });

  it('does nothing when nothing changed, or the run is gone or archived', async () => {
    const quiet = setup({ status: 'ready', stops: [{ id: 'cs-1', status: 'pending', shipmentStops: [{ status: 'pending' }] }], shipments: [{ shipment: { status: 'ready' } }] });
    expect(await quiet.handler.execute(createTestCommand(SYNC_CONSOLIDATION_PROGRESS, { id: 'con-1' }))).toMatchObject({ success: true, data: { changed: false }, events: [] });

    const gone = setup(null);
    expect(await gone.handler.execute(createTestCommand(SYNC_CONSOLIDATION_PROGRESS, { id: 'con-x' }))).toMatchObject({ success: true, data: { changed: false } });
    expect(gone.tx.consolidation.findFirst.mock.calls[0][0].where).toEqual({ id: 'con-x', orgId: 'test-org', archived: false });
  });
});

describe('ConsolidationProgressHandler (#329)', () => {
  function handlerWith(consolidationId: string | null) {
    const repo: any = { consolidationIdForShipment: jest.fn().mockResolvedValue(consolidationId) };
    const commandBus: any = { dispatch: jest.fn().mockResolvedValue({ success: true, events: [] }) };
    return { repo, commandBus, handler: new ConsolidationProgressHandler(repo, commandBus) };
  }

  it('syncs the run a shipment rides on when one of its stops is reached', async () => {
    const { repo, commandBus, handler } = handlerWith('con-1');
    await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STOP_COMPLETED, 'shipment', 'ship-a', { shipmentId: 'ship-a', stopId: 'stop-1' }));

    expect(repo.consolidationIdForShipment).toHaveBeenCalledWith('test-org', 'ship-a');
    expect(commandBus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: SYNC_CONSOLIDATION_PROGRESS, orgId: 'test-org', payload: { id: 'con-1' },
    }));
  });

  it('reads the shipment from the entity on a status change', async () => {
    const { repo, handler } = handlerWith('con-1');
    await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STATUS_CHANGED, 'shipment', 'ship-b', { from: 'ready', to: 'in_progress' }));
    expect(repo.consolidationIdForShipment).toHaveBeenCalledWith('test-org', 'ship-b');
  });

  it('ignores shipments that are not on a consolidation', async () => {
    const { commandBus, handler } = handlerWith(null);
    await handler.handle(createTestEvent(EVENT_TYPES.SHIPMENT_STOP_ARRIVED, 'shipment', 'ship-c', { shipmentId: 'ship-c' }));
    expect(commandBus.dispatch).not.toHaveBeenCalled();
  });
});
