import { QualityIssueSummaryProjection } from '../../events/projections/QualityIssueSummaryProjection';
import { createTestEvent } from '../helpers/testUtils';
import { EVENT_TYPES } from '../../events/eventTypes';

const mockIssue = {
  id: 'issue-1',
  orgId: 'org-1',
  sourceEntityType: 'shipment',
  sourceEntityId: 'ship-1',
  category: 'delay',
  priority: 'high',
  status: 'open',
  needsCapa: false,
  createdAt: new Date('2026-04-10'),
  resolvedAt: null,
};

const mockShipment = {
  id: 'ship-1',
  customerId: 'cust-1',
  carrierId: 'carrier-1',
  laneId: 'lane-1',
  originId: 'loc-1',
  destinationId: 'loc-2',
};

describe('QualityIssueSummaryProjection', () => {
  let projection: QualityIssueSummaryProjection;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      issue: {
        findUnique: jest.fn().mockResolvedValue(mockIssue),
        findMany: jest.fn().mockResolvedValue([mockIssue]),
      },
      shipment: {
        findUnique: jest.fn().mockResolvedValue(mockShipment),
        findMany: jest.fn().mockResolvedValue([{ id: 'ship-1' }]),
      },
      carrier: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Fast Freight Inc' }),
      },
      lane: {
        findUnique: jest.fn().mockResolvedValue({ name: 'NYC-LAX Express' }),
      },
      location: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ name: 'NYC Warehouse' })
          .mockResolvedValueOnce({ name: 'LAX Distribution' }),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Acme Corp' }),
      },
      qualityIssueSummary: {
        upsert: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
    };

    projection = new QualityIssueSummaryProjection(mockPrisma);
  });

  it('has correct name and event patterns', () => {
    expect(projection.name).toBe('projection.quality_issue_summary');
    expect(projection.eventPatterns).toContain('issue.*');
  });

  it('resolves dimensions from shipment on issue.created', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_CREATED,
      'issue',
      'issue-1',
      { category: 'delay' },
      { orgId: 'org-1' }
    );

    await projection.handle(event);

    // Should look up the issue and shipment
    expect(mockPrisma.issue.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'issue-1' } })
    );
    expect(mockPrisma.shipment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ship-1' } })
    );

    // Should upsert summaries for carrier, lane, locations, customer
    expect(mockPrisma.qualityIssueSummary.upsert).toHaveBeenCalled();
  });

  it('updates summaries on issue.status_changed', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_STATUS_CHANGED,
      'issue',
      'issue-1',
      { previousStatus: 'open', newStatus: 'in_progress' },
      { orgId: 'org-1' }
    );

    await projection.handle(event);

    expect(mockPrisma.issue.findUnique).toHaveBeenCalled();
    expect(mockPrisma.qualityIssueSummary.upsert).toHaveBeenCalled();
  });

  it('updates summaries on issue.closed', async () => {
    mockPrisma.issue.findUnique.mockResolvedValueOnce({
      ...mockIssue, status: 'closed', resolvedAt: new Date(),
    });

    const event = createTestEvent(
      EVENT_TYPES.ISSUE_CLOSED,
      'issue',
      'issue-1',
      { closedAt: new Date().toISOString() },
      { orgId: 'org-1' }
    );

    await projection.handle(event);

    expect(mockPrisma.qualityIssueSummary.upsert).toHaveBeenCalled();
  });

  it('updates summaries on issue.needs_capa_marked', async () => {
    mockPrisma.issue.findUnique.mockResolvedValueOnce({
      ...mockIssue, needsCapa: true,
    });

    const event = createTestEvent(
      EVENT_TYPES.ISSUE_NEEDS_CAPA_MARKED,
      'issue',
      'issue-1',
      { needsCapa: true },
      { orgId: 'org-1' }
    );

    await projection.handle(event);

    expect(mockPrisma.qualityIssueSummary.upsert).toHaveBeenCalled();
  });

  it('ignores non-relevant issue events', async () => {
    const event = createTestEvent(
      EVENT_TYPES.ISSUE_LABEL_ADDED,
      'issue',
      'issue-1',
      { labelId: 'label-1' },
      { orgId: 'org-1' }
    );

    await projection.handle(event);

    // Should NOT query the issue for label changes
    expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
  });

  it('skips when issue has no source entity', async () => {
    mockPrisma.issue.findUnique.mockResolvedValueOnce({
      ...mockIssue, sourceEntityType: null, sourceEntityId: null,
    });

    const event = createTestEvent(
      EVENT_TYPES.ISSUE_CREATED,
      'issue',
      'issue-1',
      {},
      { orgId: 'org-1' }
    );

    await projection.handle(event);

    // Should not try to upsert summaries (no dimensions to resolve)
    expect(mockPrisma.qualityIssueSummary.upsert).not.toHaveBeenCalled();
  });

  it('computes correct category and priority counts', async () => {
    // Set up multiple issues for the carrier
    mockPrisma.issue.findMany.mockResolvedValue([
      { ...mockIssue, category: 'delay', priority: 'high', status: 'open', needsCapa: false },
      { ...mockIssue, id: 'i2', category: 'damage', priority: 'critical', status: 'open', needsCapa: true },
      { ...mockIssue, id: 'i3', category: 'delay', priority: 'medium', status: 'closed', needsCapa: false, resolvedAt: new Date('2026-04-11') },
    ]);

    const event = createTestEvent(
      EVENT_TYPES.ISSUE_CREATED,
      'issue',
      'issue-1',
      {},
      { orgId: 'org-1' }
    );

    await projection.handle(event);

    // Find the upsert call for the carrier dimension
    const upsertCalls = mockPrisma.qualityIssueSummary.upsert.mock.calls;
    expect(upsertCalls.length).toBeGreaterThan(0);

    // Verify the stats in the create data
    const carrierUpsert = upsertCalls.find((c: any) =>
      c[0]?.where?.orgId_dimensionType_dimensionId?.dimensionType === 'carrier'
    );
    if (carrierUpsert) {
      const data = carrierUpsert[0].create;
      expect(data.totalIssues).toBe(3);
      expect(data.delayCount).toBe(2);
      expect(data.damageCount).toBe(1);
      expect(data.criticalCount).toBe(1);
      expect(data.highCount).toBe(1);
      expect(data.mediumCount).toBe(1);
      expect(data.capaCount).toBe(1);
      expect(data.closedCount).toBe(1);
      expect(data.openCount).toBe(2);
    }
  });

  describe('rebuildAll', () => {
    it('rebuilds all summaries for an org', async () => {
      mockPrisma.issue.findMany.mockResolvedValueOnce([mockIssue]);
      mockPrisma.qualityIssueSummary.deleteMany.mockResolvedValueOnce({});

      await projection.rebuildAll('org-1');

      expect(mockPrisma.qualityIssueSummary.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: 'org-1' } })
      );
      expect(mockPrisma.qualityIssueSummary.create).toHaveBeenCalled();
    });
  });
});
