import { CreateIssueCommandHandler, CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand';
import { UpdateIssueCommandHandler, UPDATE_ISSUE } from '../../commands/issues/UpdateIssueCommand';
import { EscalateIssueCommandHandler, ESCALATE_ISSUE } from '../../commands/issues/EscalateIssueCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

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
