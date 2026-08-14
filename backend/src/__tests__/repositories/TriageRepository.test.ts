import { TriageRepository } from '../../repositories/TriageRepository';

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'i1',
    title: 'Temperature excursion',
    description: null,
    status: 'open',
    priority: 'critical',
    category: 'compliance',
    issueType: 'shipment_temperature',
    latched: true,
    sourceEntityType: 'shipment',
    sourceEntityId: 'ship-1',
    assigneeId: null,
    assigneeName: null,
    labels: null,
    commentCount: 0,
    signalScore: 30,
    signalCount: 1,
    isNoise: false,
    noiseReason: null,
    slaDeadline: null,
    slaBreach: false,
    timeToFirstResponseMins: null,
    timeToResolutionMins: null,
    lastActivityAt: null,
    snoozedUntil: null,
    resolvedAt: null,
    closedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    ...over,
  };
}

function buildPrisma() {
  return {
    issue: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    issueSignal: { findMany: jest.fn().mockResolvedValue([]) },
    issueReadModel: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({
        _avg: { signalScore: null, timeToResolutionMins: null, timeToFirstResponseMins: null },
        _count: { _all: 0 },
      }),
    },
    shipmentReadModel: { findFirst: jest.fn() },
    orderReadModel: { findFirst: jest.fn() },
    carrier: { findFirst: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
  } as any;
}

const page = { sortBy: 'createdAt' as const, sortOrder: 'desc' as const, limit: 50, offset: 0 };

describe('TriageRepository.findIssues', () => {
  it('always scopes by orgId', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).findIssues({ orgId: 'org-1' }, page);

    expect(prisma.issueReadModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-1' }) }),
    );
  });

  it('excludes noise by default — that is the point of suppressing it', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).findIssues({ orgId: 'org-1' }, page);

    const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(where.isNoise).toBe(false);
  });

  it('includes noise only when explicitly asked', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).findIssues({ orgId: 'org-1', showNoise: true }, page);

    const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(where.isNoise).toBeUndefined();
  });

  it('turns array filters into Prisma `in` clauses', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).findIssues(
      { orgId: 'org-1', status: ['open', 'in_progress'], issueType: ['shipment_temperature'] },
      page,
    );

    const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['open', 'in_progress'] });
    expect(where.issueType).toEqual({ in: ['shipment_temperature'] });
  });

  it('applies a case-insensitive search across title and description', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).findIssues({ orgId: 'org-1', query: 'reefer' }, page);

    const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { title: { contains: 'reefer', mode: 'insensitive' } },
      { description: { contains: 'reefer', mode: 'insensitive' } },
    ]);
  });

  it('paginates via take/skip and returns the unpaginated total', async () => {
    const prisma = buildPrisma();
    prisma.issueReadModel.findMany.mockResolvedValue([row()]);
    prisma.issueReadModel.count.mockResolvedValue(97);

    const res = await new TriageRepository(prisma).findIssues(
      { orgId: 'org-1' },
      { sortBy: 'signalScore', sortOrder: 'asc', limit: 25, offset: 50 },
    );

    expect(prisma.issueReadModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25, skip: 50, orderBy: { signalScore: 'asc' } }),
    );
    expect(res.total).toBe(97);
  });

  it('returns an enumerated DTO rather than the raw read-model row', async () => {
    const prisma = buildPrisma();
    prisma.issueReadModel.findMany.mockResolvedValue([
      row({ secretInternalColumn: 'should not leak' } as any),
    ]);

    const res = await new TriageRepository(prisma).findIssues({ orgId: 'org-1' }, page);

    expect(res.items[0]).not.toHaveProperty('secretInternalColumn');
    expect(res.items[0].signalScore).toBe(30);
    // Dates are serialized, not handed over as Date objects
    expect(res.items[0].createdAt).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('TriageRepository.actionable', () => {
  it('excludes noise and issues still snoozed', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).actionable('org-1', 25);

    const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(where.isNoise).toBe(false);
    expect(where.status).toEqual({ in: ['open', 'in_progress'] });
    expect(where.OR).toHaveLength(2); // not snoozed, or snooze already expired
  });

  it('orders breaching issues before everything else', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).actionable('org-1', 25);

    const orderBy = prisma.issueReadModel.findMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({ slaBreach: 'desc' });
    expect(orderBy[1]).toEqual({ slaDeadline: 'asc' });
  });

  it('reports minutes remaining against the SLA deadline', async () => {
    const prisma = buildPrisma();
    const deadline = new Date(Date.now() + 90 * 60_000);
    prisma.issueReadModel.findMany.mockResolvedValue([row({ slaDeadline: deadline })]);

    const items = await new TriageRepository(prisma).actionable('org-1', 25);

    expect(items[0].minutesToDeadline).toBeGreaterThanOrEqual(89);
    expect(items[0].minutesToDeadline).toBeLessThanOrEqual(90);
  });

  it('reports a negative remaining time once the deadline has passed', async () => {
    const prisma = buildPrisma();
    prisma.issueReadModel.findMany.mockResolvedValue([
      row({ slaDeadline: new Date(Date.now() - 30 * 60_000) }),
    ]);

    const items = await new TriageRepository(prisma).actionable('org-1', 25);
    expect(items[0].minutesToDeadline).toBeLessThan(0);
  });
});

describe('TriageRepository.spotCheck', () => {
  it('samples only settled issues in the window', async () => {
    const prisma = buildPrisma();
    await new TriageRepository(prisma).spotCheck('org-1', new Date('2026-08-01'), 20, false);

    const where = prisma.issueReadModel.count.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['resolved', 'closed'] });
    expect(where.isNoise).toBe(false);
  });

  it('spreads the sample across the window instead of clustering at one end', async () => {
    const prisma = buildPrisma();
    // 100 settled issues, sample of 10 -> stride 10, so every 10th row.
    prisma.issueReadModel.count.mockResolvedValue(100);
    prisma.issueReadModel.findMany.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => row({ id: `i${i}` })),
    );

    const res = await new TriageRepository(prisma).spotCheck('org-1', new Date('2026-08-01'), 10, false);

    expect(res.sampled).toBe(10);
    expect(res.items[0].id).toBe('i0');
    expect(res.items[1].id).toBe('i10');
    expect(res.items[9].id).toBe('i90');
  });

  it('returns everything when there is less data than the sample size', async () => {
    const prisma = buildPrisma();
    prisma.issueReadModel.count.mockResolvedValue(3);
    prisma.issueReadModel.findMany.mockResolvedValue([row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })]);

    const res = await new TriageRepository(prisma).spotCheck('org-1', new Date('2026-08-01'), 20, false);
    expect(res.sampled).toBe(3);
  });

  it('computes breach rate and mean resolution time over the sample', async () => {
    const prisma = buildPrisma();
    prisma.issueReadModel.count.mockResolvedValue(2);
    prisma.issueReadModel.findMany.mockResolvedValue([
      row({ id: 'a', slaBreach: true, timeToResolutionMins: 100 }),
      row({ id: 'b', slaBreach: false, timeToResolutionMins: 200 }),
    ]);

    const res = await new TriageRepository(prisma).spotCheck('org-1', new Date('2026-08-01'), 20, false);
    expect(res.breachRate).toBe(50);
    expect(res.avgTimeToResolutionMins).toBe(150);
  });

  it('does not divide by zero on an empty window', async () => {
    const prisma = buildPrisma();
    const res = await new TriageRepository(prisma).spotCheck('org-1', new Date('2026-08-01'), 20, false);
    expect(res.breachRate).toBe(0);
    expect(res.avgTimeToResolutionMins).toBeNull();
  });
});

describe('TriageRepository.context', () => {
  it('scopes the lookup by orgId so a cross-tenant id misses', async () => {
    const prisma = buildPrisma();
    prisma.issue.findFirst.mockResolvedValue(null);

    const res = await new TriageRepository(prisma).context('i1', 'org-1');

    expect(prisma.issue.findFirst).toHaveBeenCalledWith({ where: { id: 'i1', orgId: 'org-1' } });
    expect(res).toBeNull();
  });

  it('returns signals and open sibling issues on the same entity', async () => {
    const prisma = buildPrisma();
    prisma.issue.findFirst.mockResolvedValue({
      id: 'i1', orgId: 'org-1', sourceEntityType: 'shipment', sourceEntityId: 'ship-1',
      issueType: 'shipment_temperature',
    });
    prisma.issueSignal.findMany.mockResolvedValue([{ id: 's1' }]);
    prisma.issueReadModel.findMany.mockResolvedValue([row({ id: 'i2' })]);

    const res = await new TriageRepository(prisma).context('i1', 'org-1');

    expect(res!.signals).toHaveLength(1);
    expect(res!.siblingIssues[0].id).toBe('i2');
    const siblingWhere = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(siblingWhere.id).toEqual({ not: 'i1' });
    expect(siblingWhere.status).toEqual({ in: ['open', 'in_progress'] });
  });
});

describe('TriageRepository batch scoping', () => {
  it('returns only ids that exist within the org', async () => {
    const prisma = buildPrisma();
    prisma.issue.findMany.mockResolvedValue([{ id: 'a' }, { id: 'c' }]);

    const allowed = await new TriageRepository(prisma).scopeIds(['a', 'b', 'c'], 'org-1');

    expect(prisma.issue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['a', 'b', 'c'] }, orgId: 'org-1' } }),
    );
    expect([...allowed].sort()).toEqual(['a', 'c']);
  });

  it('finds latched issues so they can be refused as noise dismissals', async () => {
    const prisma = buildPrisma();
    prisma.issue.findMany.mockResolvedValue([{ id: 'a', title: 'Temperature excursion' }]);

    const latched = await new TriageRepository(prisma).findLatched(['a', 'b'], 'org-1');

    expect(prisma.issue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['a', 'b'] }, orgId: 'org-1', latched: true } }),
    );
    expect(latched).toHaveLength(1);
  });
});
