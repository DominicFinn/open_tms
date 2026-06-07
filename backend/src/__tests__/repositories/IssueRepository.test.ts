import { IssueRepository } from '../../repositories/IssueRepository';

function buildPrisma() {
  return {
    issue: {
      findUnique: jest.fn(),
    },
    issueReadModel: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    issueLabelAssignment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    comment: {
      count: jest.fn().mockResolvedValue(0),
    },
  } as any;
}

describe('IssueRepository.findByOrg', () => {
  it('always scopes by orgId', async () => {
    const prisma = buildPrisma();
    const repo = new IssueRepository(prisma);

    await repo.findByOrg({ orgId: 'org-1' });

    expect(prisma.issueReadModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: 'org-1' } })
    );
  });

  it('splits comma-separated status into a Prisma `in` filter', async () => {
    const prisma = buildPrisma();
    const repo = new IssueRepository(prisma);

    await repo.findByOrg({ orgId: 'org-1', status: 'open,in_progress' });

    expect(prisma.issueReadModel.findMany.mock.calls[0][0].where.status).toEqual({
      in: ['open', 'in_progress'],
    });
  });

  it('drops empty entries from comma-separated filters', async () => {
    const prisma = buildPrisma();
    const repo = new IssueRepository(prisma);

    await repo.findByOrg({ orgId: 'org-1', priority: 'high, ,critical' });

    expect(prisma.issueReadModel.findMany.mock.calls[0][0].where.priority).toEqual({
      in: ['high', 'critical'],
    });
  });

  it('omits the priority filter entirely when the comma-list is all whitespace', async () => {
    const prisma = buildPrisma();
    const repo = new IssueRepository(prisma);

    await repo.findByOrg({ orgId: 'org-1', priority: ' , ' });

    expect(prisma.issueReadModel.findMany.mock.calls[0][0].where.priority).toBeUndefined();
  });

  describe('snooze filter', () => {
    it('snoozed=true filters to rows with future snoozedUntil', async () => {
      const prisma = buildPrisma();
      const repo = new IssueRepository(prisma);

      await repo.findByOrg({ orgId: 'org-1', snoozed: true });

      const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
      expect(where.snoozedUntil).toEqual({ not: null, gt: expect.any(Date) });
    });

    it('snoozed=false uses an OR for null OR past snoozedUntil', async () => {
      const prisma = buildPrisma();
      const repo = new IssueRepository(prisma);

      await repo.findByOrg({ orgId: 'org-1', snoozed: false });

      const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
      expect(Array.isArray(where.OR)).toBe(true);
      expect(where.OR).toEqual([
        { snoozedUntil: null },
        { snoozedUntil: { lte: expect.any(Date) } },
      ]);
    });

    it('omits the snooze filter when not specified', async () => {
      const prisma = buildPrisma();
      const repo = new IssueRepository(prisma);

      await repo.findByOrg({ orgId: 'org-1' });

      const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
      expect(where.snoozedUntil).toBeUndefined();
      expect(where.OR).toBeUndefined();
    });
  });

  it('makes title search case-insensitive', async () => {
    const prisma = buildPrisma();
    const repo = new IssueRepository(prisma);

    await repo.findByOrg({ orgId: 'org-1', search: 'cold chain' });

    const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(where.title).toEqual({ contains: 'cold chain', mode: 'insensitive' });
  });

  it('label filter narrows to issues that carry any of the requested labels', async () => {
    const prisma = buildPrisma();
    prisma.issueLabelAssignment.findMany.mockResolvedValue([
      { issueId: 'i-1' },
      { issueId: 'i-2' },
      { issueId: 'i-1' }, // duplicate, must be deduped
    ]);
    const repo = new IssueRepository(prisma);

    await repo.findByOrg({ orgId: 'org-1', labelIds: ['lbl-cold', 'lbl-rush'] });

    const assignmentCall = prisma.issueLabelAssignment.findMany.mock.calls[0][0];
    expect(assignmentCall.where.labelId).toEqual({ in: ['lbl-cold', 'lbl-rush'] });

    const where = prisma.issueReadModel.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ['i-1', 'i-2'] });
  });

  it('applies default limit of 50 and offset of 0', async () => {
    const prisma = buildPrisma();
    const repo = new IssueRepository(prisma);

    await repo.findByOrg({ orgId: 'org-1' });

    const args = prisma.issueReadModel.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.skip).toBe(0);
  });

  it('returns total count alongside items', async () => {
    const prisma = buildPrisma();
    prisma.issueReadModel.count.mockResolvedValue(42);
    const repo = new IssueRepository(prisma);

    const result = await repo.findByOrg({ orgId: 'org-1' });
    expect(result.total).toBe(42);
  });
});

describe('IssueRepository.findByEntityId', () => {
  it('scopes by org and entity reference', async () => {
    const prisma = buildPrisma();
    const repo = new IssueRepository(prisma);

    await repo.findByEntityId('shipment', 'ship-1', 'org-1');

    expect(prisma.issueReadModel.findMany).toHaveBeenCalledWith({
      where: { orgId: 'org-1', sourceEntityType: 'shipment', sourceEntityId: 'ship-1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('IssueRepository.getStats', () => {
  it('counts each status bucket and the snoozed bucket separately', async () => {
    const prisma = buildPrisma();
    prisma.issueReadModel.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(40)  // open
      .mockResolvedValueOnce(20)  // in_progress
      .mockResolvedValueOnce(15)  // resolved
      .mockResolvedValueOnce(25)  // closed
      .mockResolvedValueOnce(8)   // critical
      .mockResolvedValueOnce(3)   // needsCapa
      .mockResolvedValueOnce(5);  // snoozed

    const repo = new IssueRepository(prisma);
    const stats = await repo.getStats('org-1');

    expect(stats).toEqual({
      total: 100,
      open: 40,
      inProgress: 20,
      resolved: 15,
      closed: 25,
      critical: 8,
      needsCapa: 3,
      snoozed: 5,
    });
    // Every count call carries orgId
    for (const call of prisma.issueReadModel.count.mock.calls) {
      expect(call[0].where.orgId).toBe('org-1');
    }
  });
});

describe('IssueRepository.findByIdWithRelations', () => {
  it('shapes the response with labels[] and commentCount', async () => {
    const prisma = buildPrisma();
    prisma.issue.findUnique.mockResolvedValue({
      id: 'i-1',
      title: 'Late delivery',
      labelAssignments: [
        { label: { id: 'lbl-1', name: 'cold-chain', color: '#0066CC' } },
        { label: { id: 'lbl-2', name: 'rush', color: '#FF6600' } },
      ],
      capaReports: [],
    });
    prisma.comment.count.mockResolvedValue(3);

    const repo = new IssueRepository(prisma);
    const issue = await repo.findByIdWithRelations('i-1');

    expect(issue.labels).toEqual([
      { id: 'lbl-1', name: 'cold-chain', color: '#0066CC' },
      { id: 'lbl-2', name: 'rush', color: '#FF6600' },
    ]);
    expect(issue.commentCount).toBe(3);
    expect(prisma.comment.count).toHaveBeenCalledWith({
      where: { entityType: 'issue', entityId: 'i-1' },
    });
  });

  it('returns null when the issue does not exist', async () => {
    const prisma = buildPrisma();
    prisma.issue.findUnique.mockResolvedValue(null);
    const repo = new IssueRepository(prisma);

    const issue = await repo.findByIdWithRelations('missing');
    expect(issue).toBeNull();
  });
});

describe('IssueRepository.updateLabelsCache', () => {
  it('writes the array of label names to the read model', async () => {
    const prisma = buildPrisma();
    prisma.issueLabelAssignment.findMany.mockResolvedValue([
      { label: { id: 'lbl-1', name: 'cold-chain', color: '#0066CC' } },
      { label: { id: 'lbl-2', name: 'rush', color: '#FF6600' } },
    ]);
    const repo = new IssueRepository(prisma);

    await repo.updateLabelsCache('i-1');

    expect(prisma.issueReadModel.update).toHaveBeenCalledWith({
      where: { id: 'i-1' },
      data: { labels: ['cold-chain', 'rush'] },
    });
  });
});
