import { PrismaClient } from '@prisma/client';
import { IssueEngineHandler } from '../../events/handlers/IssueEngineHandler.js';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand.js';
import { UPDATE_ISSUE } from '../../commands/issues/UpdateIssueCommand.js';
import { DomainEvent } from '../../events/DomainEvent.js';

function makePrisma() {
  return {
    issueSignal: {
      create: jest.fn().mockResolvedValue({ id: 'sig-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
    },
    issue: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as unknown as PrismaClient;
}

function ev(type: string, payload: Record<string, unknown> = {}): DomainEvent {
  return {
    id: 'evt-1',
    type,
    timestamp: '2026-07-08T10:00:00.000Z',
    orgId: 'org-1',
    actorId: 'system',
    entityType: 'shipment',
    entityId: 'ship-1',
    payload,
    metadata: { correlationId: 'c', source: 'system', schemaVersion: 1 },
  } as DomainEvent;
}

describe('IssueEngineHandler', () => {
  let prisma: PrismaClient;
  let commandBus: { dispatch: jest.Mock };
  let handler: IssueEngineHandler;

  beforeEach(() => {
    prisma = makePrisma();
    commandBus = { dispatch: jest.fn().mockResolvedValue({ success: true, data: { id: 'issue-1' } }) };
    handler = new IssueEngineHandler(prisma, commandBus as any);
  });

  it('subscribes to every registry trigger + recovery event', () => {
    expect(handler.eventPatterns).toEqual(
      expect.arrayContaining([
        'shipment.cutoff_at_risk',
        'shipment.cutoff_cleared',
        'tracking.eta_updated',
        'cargo.misdrop_detected',
        'cold_chain.excursion_detected',
      ]),
    );
  });

  it('records a signal and raises a cutoff issue on the command bus', async () => {
    await handler.handle(
      ev('shipment.cutoff_at_risk', { shipmentId: 'ship-1', shipmentReference: 'SHP-1', severity: 'critical' }),
    );

    expect(prisma.issueSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ issueType: 'shipment_cutoff_risk', priority: 'high' }) }),
    );
    expect(commandBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CREATE_ISSUE,
        payload: expect.objectContaining({
          issueType: 'shipment_cutoff_risk',
          latched: false,
          category: 'delay',
          priority: 'high',
          sourceEntityId: 'ship-1',
        }),
      }),
    );
    // contributing signals attached to the new issue
    expect(prisma.issueSignal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { issueId: 'issue-1' } }),
    );
  });

  it('does not raise when the windowed signal count is below the threshold', async () => {
    (prisma.issueSignal.count as jest.Mock).mockResolvedValueOnce(0);
    await handler.handle(ev('shipment.cutoff_at_risk', { shipmentId: 'ship-1', severity: 'warning' }));
    expect(commandBus.dispatch).not.toHaveBeenCalled();
  });

  it('escalates (not duplicates) when an issue is already open and the signal is more severe', async () => {
    (prisma.issue.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'issue-9', priority: 'medium' });
    await handler.handle(ev('shipment.cutoff_at_risk', { shipmentId: 'ship-1', severity: 'critical' }));

    expect(commandBus.dispatch).toHaveBeenCalledTimes(1);
    expect(commandBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: UPDATE_ISSUE,
        payload: expect.objectContaining({ id: 'issue-9', data: expect.objectContaining({ priority: 'high' }) }),
      }),
    );
    // the signal is attached to the open issue
    expect(prisma.issueSignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { issueId: 'issue-9' } }),
    );
  });

  it('attaches the signal but does not escalate when the open issue is already as severe', async () => {
    (prisma.issue.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'issue-9', priority: 'high' });
    await handler.handle(ev('shipment.cutoff_at_risk', { shipmentId: 'ship-1', severity: 'warning' }));

    expect(commandBus.dispatch).not.toHaveBeenCalled();
    expect(prisma.issueSignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { issueId: 'issue-9' } }),
    );
  });

  it('auto-resolves an open unlatched issue on the recovery event', async () => {
    (prisma.issue.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'issue-9', priority: 'high' });
    await handler.handle(ev('shipment.cutoff_cleared', { shipmentId: 'ship-1' }));

    expect(commandBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: UPDATE_ISSUE,
        payload: expect.objectContaining({ id: 'issue-9', data: expect.objectContaining({ status: 'resolved' }) }),
      }),
    );
  });

  it('does nothing on a recovery event when no issue is open', async () => {
    (prisma.issue.findFirst as jest.Mock).mockResolvedValue(null);
    await handler.handle(ev('shipment.cutoff_cleared', { shipmentId: 'ship-1' }));
    expect(commandBus.dispatch).not.toHaveBeenCalled();
  });

  it('raises a critical latched temperature issue, ignoring the signal severity band', async () => {
    // A "warning" excursion must still produce a critical issue for the safety type.
    await handler.handle(ev('cold_chain.excursion_detected', { shipmentId: 'ship-1', severity: 'warning' }));
    expect(commandBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CREATE_ISSUE,
        payload: expect.objectContaining({
          issueType: 'shipment_temperature',
          latched: true,
          category: 'compliance',
          priority: 'critical',
        }),
      }),
    );
  });

  it('raises a critical latched tamper issue from a light-in-transit event', async () => {
    await handler.handle(ev('shipment.tamper_light', { shipmentId: 'ship-1', severity: 'critical' }));
    expect(commandBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CREATE_ISSUE,
        payload: expect.objectContaining({
          issueType: 'shipment_tamper_light',
          latched: true,
          priority: 'critical',
        }),
      }),
    );
  });

  it('raises a latched mis-ship issue from a cargo event', async () => {
    await handler.handle(ev('cargo.misdrop_detected', { shipmentId: 'ship-1', shipmentReference: 'SHP-1' }));
    expect(commandBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: CREATE_ISSUE,
        payload: expect.objectContaining({
          issueType: 'shipment_misship',
          latched: true,
          category: 'exception',
          priority: 'high',
        }),
      }),
    );
  });
});
