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
});
