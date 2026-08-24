import { PackAuditIssueHandler, PACK_AUDIT_ISSUE_TYPE } from '../../events/handlers/PackAuditIssueHandler';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { DomainEvent } from '../../events/DomainEvent';

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'evt-1',
    type: EVENT_TYPES.PACK_AUDIT_VARIANCE_DETECTED,
    schemaVersion: 1,
    entityType: 'pack_audit',
    entityId: 'audit-1',
    orgId: 'org-1',
    actorId: 'user-1',
    occurredAt: new Date(),
    payload: {
      packTaskId: 'pack-1',
      orderId: 'order-1',
      verdict: 'warning',
      weightVariancePercent: 16.7,
      dimWeightVariancePercent: null,
      expectedWeightGrams: 1200,
      actualWeightGrams: 1400,
      tolerance: 10,
      notes: 'box felt heavy',
    },
    metadata: {},
    ...overrides,
  } as DomainEvent;
}

function makeDeps(opts: { openIssue?: { id: string } | null; dispatchResult?: any } = {}) {
  const prisma = {
    issue: { findFirst: jest.fn().mockResolvedValue(opts.openIssue ?? null) },
    packAudit: { update: jest.fn().mockResolvedValue({}) },
  } as any;
  const commandBus = {
    dispatch: jest.fn().mockResolvedValue(
      opts.dispatchResult ?? { success: true, data: { id: 'issue-new', title: 't' } },
    ),
  } as any;
  return { prisma, commandBus, handler: new PackAuditIssueHandler(prisma, commandBus) };
}

describe('PackAuditIssueHandler', () => {
  it('raises an issue through CREATE_ISSUE with a valid category and links it to the audit', async () => {
    const { prisma, commandBus, handler } = makeDeps();

    await handler.handle(makeEvent());

    expect(commandBus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: CREATE_ISSUE,
      orgId: 'org-1',
      payload: expect.objectContaining({
        category: 'exception',
        issueType: PACK_AUDIT_ISSUE_TYPE,
        priority: 'medium',
        sourceEntityType: 'pack_task',
        sourceEntityId: 'pack-1',
        sourceEventId: 'evt-1',
      }),
    }));
    expect(prisma.packAudit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { issueId: 'issue-new' },
    });
  });

  it('maps a fail verdict to high priority', async () => {
    const { commandBus, handler } = makeDeps();

    await handler.handle(makeEvent({ payload: { ...makeEvent().payload as any, verdict: 'fail' } }));

    expect(commandBus.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ priority: 'high' }),
    }));
  });

  it('includes the variance detail and auditor notes in the description', async () => {
    const { commandBus, handler } = makeDeps();

    await handler.handle(makeEvent());

    const payload = commandBus.dispatch.mock.calls[0][0].payload;
    expect(payload.description).toContain('Expected 1200g, actual 1400g');
    expect(payload.description).toContain('box felt heavy');
  });

  it('reuses an existing open issue for the same pack task instead of duplicating', async () => {
    const { prisma, commandBus, handler } = makeDeps({ openIssue: { id: 'issue-open' } });

    await handler.handle(makeEvent());

    expect(commandBus.dispatch).not.toHaveBeenCalled();
    expect(prisma.packAudit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { issueId: 'issue-open' },
    });
    // Dedup lookup is scoped to the tenant and the (issueType, source entity) pair
    expect(prisma.issue.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orgId: 'org-1',
        issueType: PACK_AUDIT_ISSUE_TYPE,
        sourceEntityType: 'pack_task',
        sourceEntityId: 'pack-1',
      }),
    }));
  });

  it('does not link the audit when issue creation fails', async () => {
    const { prisma, handler } = makeDeps({ dispatchResult: { success: false, error: 'boom' } });

    await handler.handle(makeEvent());

    expect(prisma.packAudit.update).not.toHaveBeenCalled();
  });

  it('ignores events without a packTaskId', async () => {
    const { commandBus, prisma, handler } = makeDeps();

    await handler.handle(makeEvent({ payload: { verdict: 'warning' } }));

    expect(commandBus.dispatch).not.toHaveBeenCalled();
    expect(prisma.packAudit.update).not.toHaveBeenCalled();
  });

  it('never throws out of handle when prisma fails (edge swallows, logs)', async () => {
    const { prisma, handler } = makeDeps();
    prisma.issue.findFirst.mockRejectedValue(new Error('db down'));

    await expect(handler.handle(makeEvent())).resolves.toBeUndefined();
  });
});
