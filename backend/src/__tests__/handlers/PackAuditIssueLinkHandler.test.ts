import { PackAuditIssueLinkHandler } from '../../events/handlers/PackAuditIssueLinkHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { DomainEvent } from '../../events/DomainEvent';

function makePrisma(openIssue: { id: string } | null = null) {
  return {
    packAudit: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    issue: { findFirst: jest.fn().mockResolvedValue(openIssue) },
  } as any;
}

function ev(overrides: Partial<DomainEvent>): DomainEvent {
  return {
    id: 'evt-1',
    type: 'issue.created',
    timestamp: '2026-08-16T10:00:00.000Z',
    orgId: 'org-1',
    actorId: 'system:issue-engine',
    entityType: 'issue',
    entityId: 'issue-1',
    payload: {},
    metadata: { correlationId: 'c', source: 'system', schemaVersion: 1 },
    ...overrides,
  } as DomainEvent;
}

describe('PackAuditIssueLinkHandler', () => {
  it('links unlinked audits to a freshly-raised pack-audit issue', async () => {
    const prisma = makePrisma();
    const handler = new PackAuditIssueLinkHandler(prisma);

    await handler.handle(ev({
      type: 'issue.created',
      entityId: 'issue-1',
      payload: { issueType: 'pack_audit_variance', sourceEntityId: 'pack-1' },
    }));

    expect(prisma.packAudit.updateMany).toHaveBeenCalledWith({
      where: { packTaskId: 'pack-1', orgId: 'org-1', issueId: null },
      data: { issueId: 'issue-1' },
    });
  });

  it('ignores issue.created for other issue types', async () => {
    const prisma = makePrisma();
    const handler = new PackAuditIssueLinkHandler(prisma);

    await handler.handle(ev({
      type: 'issue.created',
      payload: { issueType: 'shipment_cutoff_risk', sourceEntityId: 'ship-1' },
    }));

    expect(prisma.packAudit.updateMany).not.toHaveBeenCalled();
  });

  it('links a repeat-variance audit to the already-open issue', async () => {
    const prisma = makePrisma({ id: 'issue-open' });
    const handler = new PackAuditIssueLinkHandler(prisma);

    await handler.handle(ev({
      type: EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED,
      entityType: 'pack_audit',
      entityId: 'audit-2',
      payload: { packTaskId: 'pack-1', verdict: 'warning' },
    }));

    expect(prisma.issue.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orgId: 'org-1',
        issueType: 'pack_audit_variance',
        sourceEntityId: 'pack-1',
      }),
    }));
    expect(prisma.packAudit.updateMany).toHaveBeenCalledWith({
      where: { id: 'audit-2', orgId: 'org-1', issueId: null },
      data: { issueId: 'issue-open' },
    });
  });

  it('does nothing on a variance when no issue is open yet (issue.created will link it)', async () => {
    const prisma = makePrisma(null);
    const handler = new PackAuditIssueLinkHandler(prisma);

    await handler.handle(ev({
      type: EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED,
      entityType: 'pack_audit',
      entityId: 'audit-1',
      payload: { packTaskId: 'pack-1', verdict: 'fail' },
    }));

    expect(prisma.packAudit.updateMany).not.toHaveBeenCalled();
  });

  it('never throws when the database fails (edge swallows, logs)', async () => {
    const prisma = makePrisma();
    prisma.packAudit.updateMany.mockRejectedValue(new Error('db down'));
    const handler = new PackAuditIssueLinkHandler(prisma);

    await expect(handler.handle(ev({
      type: 'issue.created',
      payload: { issueType: 'pack_audit_variance', sourceEntityId: 'pack-1' },
    }))).resolves.toBeUndefined();
  });
});
