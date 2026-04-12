import { IssueProjection } from '../../events/projections/IssueProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const mockIssue = {
  id: 'issue-1', orgId: 'org-1', title: 'Shipment delayed',
  status: 'open', priority: 'medium', category: 'delay',
  sourceEntityType: 'shipment', sourceEntityId: 'ship-1',
  assigneeName: null, escalatedTo: null, resolvedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockPrisma = {
  issue: {
    findUnique: jest.fn().mockResolvedValue(mockIssue),
  },
  issueReadModel: {
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
} as any;

describe('IssueProjection', () => {
  let projection: IssueProjection;

  beforeEach(() => {
    jest.clearAllMocks();
    projection = new IssueProjection(mockPrisma);
  });

  it('has correct name and patterns', () => {
    expect(projection.name).toBe('projection.issue');
    expect(projection.eventPatterns).toContain('issue.*');
  });

  it('creates IssueReadModel on ISSUE_CREATED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_CREATED, 'issue', 'issue-1',
      { title: 'Shipment delayed', category: 'delay' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        create: expect.objectContaining({
          title: 'Shipment delayed',
          status: 'open',
          priority: 'medium',
          category: 'delay',
        }),
      })
    );
  });

  it('updates assignment on ISSUE_ASSIGNED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_ASSIGNED, 'issue', 'issue-1',
      { assigneeName: 'Jane' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assigneeName: 'Jane' }),
      })
    );
  });

  it('marks as resolved on ISSUE_RESOLVED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_RESOLVED, 'issue', 'issue-1', {}
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'resolved' }),
      })
    );
  });

  it('sets escalation on ISSUE_ESCALATED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_ESCALATED, 'issue', 'issue-1',
      { escalatedTo: 'ops-manager' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          escalatedTo: 'ops-manager',
          status: 'in_progress',
        }),
      })
    );
  });

  it('updates read model on ISSUE_SNOOZED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_SNOOZED, 'issue', 'issue-1',
      { snoozedUntil: '2026-05-01T00:00:00Z', snoozedBy: 'user-1' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          snoozedUntil: new Date('2026-05-01T00:00:00Z'),
          snoozedBy: 'user-1',
        }),
      })
    );
  });

  it('clears snooze on ISSUE_UNSNOOZED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_UNSNOOZED, 'issue', 'issue-1',
      {}
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          snoozedUntil: null,
          snoozedBy: null,
        }),
      })
    );
  });

  it('sets status closed on ISSUE_CLOSED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_CLOSED, 'issue', 'issue-1',
      { closedAt: '2026-04-12T12:00:00Z' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          status: 'closed',
          closedAt: new Date('2026-04-12T12:00:00Z'),
        }),
      })
    );
  });

  it('sets status open on ISSUE_REOPENED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_REOPENED, 'issue', 'issue-1',
      { previousStatus: 'closed' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          status: 'open',
          closedAt: null,
        }),
      })
    );
  });

  it('updates needsCapa on ISSUE_NEEDS_CAPA_MARKED', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_NEEDS_CAPA_MARKED, 'issue', 'issue-1',
      { needsCapa: true }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          needsCapa: true,
        }),
      })
    );
  });

  it('updates labels on ISSUE_LABEL_ADDED', async () => {
    (mockPrisma as any).issueLabelAssignment = {
      findMany: jest.fn().mockResolvedValue([
        { label: { id: 'lbl-1', name: 'urgent', color: '#ff0000' } },
        { label: { id: 'lbl-2', name: 'delay', color: '#ffaa00' } },
      ]),
    };

    const event = createTestEvent(
      EVENT_TYPES.ISSUE_LABEL_ADDED, 'issue', 'issue-1',
      { labelId: 'lbl-1' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueLabelAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { issueId: 'issue-1' },
        include: { label: true },
      })
    );
    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          labels: [
            { id: 'lbl-1', name: 'urgent', color: '#ff0000' },
            { id: 'lbl-2', name: 'delay', color: '#ffaa00' },
          ],
        }),
      })
    );
  });

  it('increments commentCount on COMMENT_ADDED for issues', async () => {
    const event = createTestEvent(
      EVENT_TYPES.COMMENT_ADDED, 'comment', 'comment-1',
      { entityType: 'issue', entityId: 'issue-1' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'issue-1' },
        data: expect.objectContaining({
          commentCount: { increment: 1 },
        }),
      })
    );
  });

  it('ignores COMMENT_ADDED for non-issue entities', async () => {
    const event = createTestEvent(
      EVENT_TYPES.COMMENT_ADDED, 'comment', 'comment-2',
      { entityType: 'shipment', entityId: 'ship-1' }
    );

    await projection.handle(event);

    expect(mockPrisma.issueReadModel.update).not.toHaveBeenCalled();
  });
});
