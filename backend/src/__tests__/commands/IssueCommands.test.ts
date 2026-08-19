import { CreateIssueCommandHandler, CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand';
import { UpdateIssueCommandHandler, UPDATE_ISSUE } from '../../commands/issues/UpdateIssueCommand';
import { EscalateIssueCommandHandler, ESCALATE_ISSUE } from '../../commands/issues/EscalateIssueCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';
import { MANUAL_SIGNAL_SCORE, NOISE_THRESHOLD } from '../../services/issues/issueTypeRegistry';

const mockIssue = {
  id: 'issue-1', orgId: 'org-1', title: 'Shipment delayed',
  description: 'Carrier reports 2hr delay', status: 'open', priority: 'medium',
  category: 'delay', sourceEntityType: 'shipment', sourceEntityId: 'ship-1',
  sourceEventId: null, assigneeId: null, assigneeName: null,
  escalatedTo: null, escalatedAt: null, resolvedAt: null, resolvedBy: null,
  resolution: null, createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  issue: {
    create: jest.fn().mockResolvedValue(mockIssue),
    update: jest.fn().mockResolvedValue(mockIssue),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockIssue),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Issue Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateIssueCommandHandler', () => {
    it('creates issue and emits ISSUE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_ISSUE, {
          title: 'Shipment delayed',
          category: 'delay',
          priority: 'medium',
          sourceEntityType: 'shipment',
          sourceEntityId: 'ship-1',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Shipment delayed');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.ISSUE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          category: 'delay',
          sourceEntityType: 'shipment',
        })
      );
    });

    /*
     * Manual issues have no Issue Type to inherit triage defaults from, so the
     * handler stamps them. Without this a hand-raised issue has no SLA deadline
     * and never appears in SLA health.
     */
    it('stamps manual triage defaults when there is no issueType', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_ISSUE, {
          title: 'Driver phoned in a damaged pallet',
          category: 'damage',
          priority: 'high',
        })
      );

      const data = mockTx.issue.create.mock.calls[0][0].data;
      expect(data.signalScore).toBe(MANUAL_SIGNAL_SCORE);
      expect(data.signalScore).toBeGreaterThan(NOISE_THRESHOLD);
      expect(data.lastActivityAt).toBeInstanceOf(Date);
      // 'high' maps to a 120-minute target.
      const minutes = (data.slaDeadline.getTime() - data.lastActivityAt.getTime()) / 60_000;
      expect(minutes).toBeCloseTo(120, 0);
    });

    it('derives the manual SLA deadline from priority', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_ISSUE, { title: 'Minor query', category: 'other', priority: 'low' })
      );

      const data = mockTx.issue.create.mock.calls[0][0].data;
      const minutes = (data.slaDeadline.getTime() - data.lastActivityAt.getTime()) / 60_000;
      expect(minutes).toBeCloseTo(480, 0);
    });

    /*
     * The Issue Engine computes score and SLA from the registry and passes them
     * explicitly. The manual defaults must never override those.
     */
    it('leaves engine-supplied triage values untouched', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateIssueCommandHandler(mockPrisma, bus);
      const engineDeadline = new Date('2026-01-01T12:00:00Z');

      await handler.execute(
        createTestCommand(CREATE_ISSUE, {
          title: 'Temperature excursion',
          category: 'compliance',
          priority: 'critical',
          issueType: 'shipment_temperature',
          signalScore: 30,
          slaDeadline: engineDeadline,
        })
      );

      const data = mockTx.issue.create.mock.calls[0][0].data;
      expect(data.signalScore).toBe(30);
      expect(data.slaDeadline).toBe(engineDeadline);
    });
  });

  describe('UpdateIssueCommandHandler', () => {
    it('emits ISSUE_RESOLVED when status set to resolved', async () => {
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, status: 'resolved', resolution: 'Carrier rerouted',
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { status: 'resolved', resolution: 'Carrier rerouted' },
        })
      );

      expect(result.success).toBe(true);
      expect(result.events.some((e) => e.type === EVENT_TYPES.ISSUE_RESOLVED)).toBe(true);
    });

    it('emits ISSUE_ASSIGNED when assignee changes', async () => {
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, assigneeId: 'user-2', assigneeName: 'Jane',
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { assigneeId: 'user-2', assigneeName: 'Jane' },
        })
      );

      expect(result.events.some((e) => e.type === EVENT_TYPES.ISSUE_ASSIGNED)).toBe(true);
    });

    it('emits ISSUE_STATUS_CHANGED for non-resolved status changes', async () => {
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, status: 'in_progress',
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { status: 'in_progress' },
        })
      );

      const statusEvent = result.events.find((e) => e.type === EVENT_TYPES.ISSUE_STATUS_CHANGED);
      expect(statusEvent).toBeDefined();
      expect(statusEvent!.payload).toEqual(
        expect.objectContaining({ previousStatus: 'open', newStatus: 'in_progress' })
      );
    });

    it('emits ISSUE_UPDATED for non-status, non-assignment changes', async () => {
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, title: 'Updated title',
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { title: 'Updated title' },
        })
      );

      expect(result.events.some((e) => e.type === EVENT_TYPES.ISSUE_UPDATED)).toBe(true);
    });

    it('emits ISSUE_CLOSED when status set to closed', async () => {
      const closedAt = new Date('2026-04-12T12:00:00Z');
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, status: 'closed', closedAt, closedBy: 'test-user',
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { status: 'closed' },
        })
      );

      expect(result.success).toBe(true);
      const closedEvent = result.events.find((e) => e.type === EVENT_TYPES.ISSUE_CLOSED);
      expect(closedEvent).toBeDefined();
      expect(closedEvent!.payload).toEqual(
        expect.objectContaining({ closedAt: closedAt.toISOString() })
      );
    });

    it('emits ISSUE_REOPENED when closed issue set to open', async () => {
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce({
        ...mockIssue, status: 'closed',
      });
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, status: 'open',
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { status: 'open' },
        })
      );

      const reopenedEvent = result.events.find((e) => e.type === EVENT_TYPES.ISSUE_REOPENED);
      expect(reopenedEvent).toBeDefined();
      expect(reopenedEvent!.payload).toEqual(
        expect.objectContaining({ previousStatus: 'closed' })
      );
    });

    it('emits ISSUE_SNOOZED when snoozedUntil is set', async () => {
      const snoozedUntil = new Date('2026-05-01T00:00:00Z');
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, snoozedUntil, snoozedBy: 'user-1',
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { snoozedUntil: '2026-05-01T00:00:00Z', snoozedBy: 'user-1' },
        })
      );

      const snoozedEvent = result.events.find((e) => e.type === EVENT_TYPES.ISSUE_SNOOZED);
      expect(snoozedEvent).toBeDefined();
      expect(snoozedEvent!.payload).toEqual(
        expect.objectContaining({
          snoozedUntil: snoozedUntil.toISOString(),
          snoozedBy: 'user-1',
        })
      );
    });

    it('emits ISSUE_UNSNOOZED when snoozedUntil cleared to null', async () => {
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce({
        ...mockIssue, snoozedUntil: new Date('2026-05-01T00:00:00Z'), snoozedBy: 'user-1',
      });
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, snoozedUntil: null, snoozedBy: null,
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { snoozedUntil: null },
        })
      );

      expect(result.events.some((e) => e.type === EVENT_TYPES.ISSUE_UNSNOOZED)).toBe(true);
    });

    it('emits ISSUE_NEEDS_CAPA_MARKED when needsCapa changes', async () => {
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, needsCapa: true,
      });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { needsCapa: true },
        })
      );

      const capaEvent = result.events.find((e) => e.type === EVENT_TYPES.ISSUE_NEEDS_CAPA_MARKED);
      expect(capaEvent).toBeDefined();
      expect(capaEvent!.payload).toEqual(
        expect.objectContaining({ needsCapa: true })
      );
    });
  });


  /*
   * Triage response metrics. These are stamped by the handler rather than sent
   * by the caller, so they are only observable through the tx.issue.update call.
   */
  describe('UpdateIssueCommandHandler — triage metrics', () => {
    const CREATED_AT = new Date('2026-01-01T10:00:00Z');

    /** Build a `previous` issue for tx.issue.findUniqueOrThrow to return. */
    const previous = (over: Record<string, unknown> = {}) => ({
      ...mockIssue,
      createdAt: CREATED_AT,
      status: 'open',
      assigneeId: null,
      firstResponseAt: null,
      slaDeadline: null,
      slaBreach: false,
      ...over,
    });

    const updateData = () => mockTx.issue.update.mock.calls[0][0].data;

    it('records first response when the issue first moves off open', async () => {
      const { bus } = mockEventBus();
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(previous());
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { status: 'in_progress' } })
      );

      const d = updateData();
      expect(d.firstResponseAt).toBeInstanceOf(Date);
      expect(d.timeToFirstResponseMins).toBeGreaterThanOrEqual(0);
    });

    it('records first response on first assignment', async () => {
      const { bus } = mockEventBus();
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(previous());
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { assigneeId: 'user-2' } })
      );

      expect(updateData().firstResponseAt).toBeInstanceOf(Date);
    });

    /* Recorded once — a later transition must not restart the clock. */
    it('does not overwrite an existing firstResponseAt', async () => {
      const { bus } = mockEventBus();
      const already = new Date('2026-01-01T10:05:00Z');
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(
        previous({ status: 'in_progress', firstResponseAt: already })
      );
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { status: 'resolved' } })
      );

      expect(updateData().firstResponseAt).toBeUndefined();
    });

    it('does not count a no-op status write as a first response', async () => {
      const { bus } = mockEventBus();
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(previous({ status: 'open' }));
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { status: 'open' } })
      );

      expect(updateData().firstResponseAt).toBeUndefined();
    });

    it('stamps timeToResolutionMins when the issue settles', async () => {
      const { bus } = mockEventBus();
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(previous());
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { status: 'resolved' } })
      );

      expect(updateData().timeToResolutionMins).toBeGreaterThanOrEqual(0);
    });

    it('sets slaBreach when the issue settles past its deadline', async () => {
      const { bus } = mockEventBus();
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(
        previous({ slaDeadline: new Date('2026-01-01T11:00:00Z') })
      );
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { status: 'closed' } })
      );

      expect(updateData().slaBreach).toBe(true);
    });

    it('leaves slaBreach alone when the issue settles inside its deadline', async () => {
      const { bus } = mockEventBus();
      const future = new Date(Date.now() + 60 * 60_000);
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(previous({ slaDeadline: future }));
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { status: 'resolved' } })
      );

      expect(updateData().slaBreach).toBeUndefined();
    });

    it('touches lastActivityAt on every update', async () => {
      const { bus } = mockEventBus();
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(previous());
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, { id: 'issue-1', data: { priority: 'high' } })
      );

      expect(updateData().lastActivityAt).toBeInstanceOf(Date);
    });

    it('passes through engine-maintained signal scoring', async () => {
      const { bus } = mockEventBus();
      mockTx.issue.findUniqueOrThrow.mockResolvedValueOnce(previous());
      const handler = new UpdateIssueCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_ISSUE, {
          id: 'issue-1',
          data: { signalScore: 75, signalCount: 3, isNoise: false, noiseReason: null },
        })
      );

      const d = updateData();
      expect(d.signalScore).toBe(75);
      expect(d.signalCount).toBe(3);
      expect(d.isNoise).toBe(false);
    });
  });

  describe('EscalateIssueCommandHandler', () => {
    it('escalates issue to critical and emits ISSUE_ESCALATED', async () => {
      mockTx.issue.update.mockResolvedValueOnce({
        ...mockIssue, escalatedTo: 'manager@co.com', priority: 'critical', status: 'in_progress',
      });
      const { bus } = mockEventBus();
      const handler = new EscalateIssueCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(ESCALATE_ISSUE, {
          id: 'issue-1',
          escalatedTo: 'manager@co.com',
          reason: 'SLA breach imminent',
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.ISSUE_ESCALATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          escalatedTo: 'manager@co.com',
          reason: 'SLA breach imminent',
        })
      );
    });
  });
});
