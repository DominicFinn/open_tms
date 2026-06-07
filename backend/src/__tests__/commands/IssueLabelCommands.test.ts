import {
  AddIssueLabelCommandHandler,
  ADD_ISSUE_LABEL,
} from '../../commands/issues/AddIssueLabelCommand';
import {
  RemoveIssueLabelCommandHandler,
  REMOVE_ISSUE_LABEL,
} from '../../commands/issues/RemoveIssueLabelCommand';
import {
  CreateIssueLabelCommandHandler,
  CREATE_ISSUE_LABEL,
} from '../../commands/issueLabels/CreateIssueLabelCommand';
import {
  UpdateIssueLabelCommandHandler,
  UPDATE_ISSUE_LABEL,
} from '../../commands/issueLabels/UpdateIssueLabelCommand';
import {
  DeleteIssueLabelCommandHandler,
  DELETE_ISSUE_LABEL,
} from '../../commands/issueLabels/DeleteIssueLabelCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const baseLabel = { id: 'lbl-1', orgId: 'test-org', name: 'cold-chain', color: '#0066CC' };

function buildPrisma(overrides: any = {}) {
  const labelResult = 'label' in overrides ? overrides.label : baseLabel;
  const tx = {
    issueLabel: {
      findUnique: jest.fn().mockResolvedValue(labelResult),
      create: jest.fn().mockResolvedValue(overrides.created ?? baseLabel),
      update: jest.fn().mockResolvedValue(overrides.updated ?? baseLabel),
      delete: jest.fn().mockResolvedValue(baseLabel),
    },
    issueLabelAssignment: {
      findFirst: jest.fn().mockResolvedValue(overrides.existingAssignment ?? null),
      findMany: jest.fn().mockResolvedValue(overrides.assignmentsByLabel ?? []),
      create: jest.fn().mockResolvedValue({ issueId: 'issue-1', labelId: 'lbl-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: overrides.deleteCount ?? 1 }),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;

  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;

  return { prisma, tx };
}

describe('Issue label assignment commands', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('AddIssueLabelCommandHandler', () => {
    it('creates assignment and emits ISSUE_LABEL_ADDED', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new AddIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(ADD_ISSUE_LABEL, { issueId: 'issue-1', labelId: 'lbl-1' })
      );

      expect(result.success).toBe(true);
      expect(tx.issueLabelAssignment.create).toHaveBeenCalledWith({
        data: { issueId: 'issue-1', labelId: 'lbl-1' },
      });
      expect(result.events[0].type).toBe(EVENT_TYPES.ISSUE_LABEL_ADDED);
      expect(result.events[0].entityId).toBe('issue-1');
      expect(result.data?.alreadyAssigned).toBe(false);
    });

    it('is idempotent when label is already assigned and emits no event', async () => {
      const { prisma, tx } = buildPrisma({
        existingAssignment: { issueId: 'issue-1', labelId: 'lbl-1' },
      });
      const { bus } = mockEventBus();
      const handler = new AddIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(ADD_ISSUE_LABEL, { issueId: 'issue-1', labelId: 'lbl-1' })
      );

      expect(result.success).toBe(true);
      expect(tx.issueLabelAssignment.create).not.toHaveBeenCalled();
      expect(result.data?.alreadyAssigned).toBe(true);
      expect(result.events).toHaveLength(0);
    });

    it('fails when the label does not exist', async () => {
      const { prisma } = buildPrisma({ label: null });
      const { bus } = mockEventBus();
      const handler = new AddIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(ADD_ISSUE_LABEL, { issueId: 'issue-1', labelId: 'missing' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('RemoveIssueLabelCommandHandler', () => {
    it('emits ISSUE_LABEL_REMOVED when an assignment was deleted', async () => {
      const { prisma, tx } = buildPrisma({ deleteCount: 1 });
      const { bus } = mockEventBus();
      const handler = new RemoveIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(REMOVE_ISSUE_LABEL, { issueId: 'issue-1', labelId: 'lbl-1' })
      );

      expect(result.success).toBe(true);
      expect(tx.issueLabelAssignment.deleteMany).toHaveBeenCalled();
      expect(result.events[0].type).toBe(EVENT_TYPES.ISSUE_LABEL_REMOVED);
      expect(result.data?.removedCount).toBe(1);
    });

    it('is a no-op (no event) when there was no matching assignment', async () => {
      const { prisma } = buildPrisma({ deleteCount: 0 });
      const { bus } = mockEventBus();
      const handler = new RemoveIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(REMOVE_ISSUE_LABEL, { issueId: 'issue-1', labelId: 'lbl-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(0);
    });
  });
});

describe('Issue label catalogue commands', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateIssueLabelCommandHandler', () => {
    it('creates label with default colour and emits ISSUE_LABEL_CREATED', async () => {
      const { prisma, tx } = buildPrisma({ created: { ...baseLabel, color: '#6B7280', name: 'rush' } });
      const { bus } = mockEventBus();
      const handler = new CreateIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_ISSUE_LABEL, { name: 'rush' })
      );

      expect(result.success).toBe(true);
      expect(tx.issueLabel.create).toHaveBeenCalledWith({
        data: { orgId: 'test-org', name: 'rush', color: '#6B7280' },
      });
      expect(result.events[0].type).toBe(EVENT_TYPES.ISSUE_LABEL_CREATED);
    });

    it('respects an explicit colour', async () => {
      const { prisma, tx } = buildPrisma({ created: { ...baseLabel, color: '#FF0000' } });
      const { bus } = mockEventBus();
      const handler = new CreateIssueLabelCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_ISSUE_LABEL, { name: 'urgent', color: '#FF0000' })
      );

      expect(tx.issueLabel.create.mock.calls[0][0].data.color).toBe('#FF0000');
    });
  });

  describe('UpdateIssueLabelCommandHandler', () => {
    it('updates label and emits ISSUE_LABEL_UPDATED', async () => {
      const { prisma, tx } = buildPrisma({ updated: { ...baseLabel, name: 'cold-chain-renamed' } });
      const { bus } = mockEventBus();
      const handler = new UpdateIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_ISSUE_LABEL, { id: 'lbl-1', data: { name: 'cold-chain-renamed' } })
      );

      expect(result.success).toBe(true);
      expect(tx.issueLabel.update).toHaveBeenCalledWith({
        where: { id: 'lbl-1' },
        data: { name: 'cold-chain-renamed' },
      });
      expect(result.events[0].type).toBe(EVENT_TYPES.ISSUE_LABEL_UPDATED);
    });
  });

  describe('DeleteIssueLabelCommandHandler', () => {
    it('cascades label removal and emits a removal event for each affected issue', async () => {
      const { prisma, tx } = buildPrisma({
        assignmentsByLabel: [
          { issueId: 'issue-1' },
          { issueId: 'issue-2' },
          { issueId: 'issue-1' }, // duplicate to test dedup
        ],
      });
      const { bus } = mockEventBus();
      const handler = new DeleteIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_ISSUE_LABEL, { id: 'lbl-1' })
      );

      expect(result.success).toBe(true);
      expect(tx.issueLabelAssignment.deleteMany).toHaveBeenCalledWith({ where: { labelId: 'lbl-1' } });
      expect(tx.issueLabel.delete).toHaveBeenCalledWith({ where: { id: 'lbl-1' } });

      // 1 ISSUE_LABEL_DELETED + 2 ISSUE_LABEL_REMOVED (deduped)
      const deletedEvents = result.events.filter((e) => e.type === EVENT_TYPES.ISSUE_LABEL_DELETED);
      const removedEvents = result.events.filter((e) => e.type === EVENT_TYPES.ISSUE_LABEL_REMOVED);
      expect(deletedEvents).toHaveLength(1);
      expect(removedEvents).toHaveLength(2);
      expect(result.data?.affectedIssueIds).toEqual(['issue-1', 'issue-2']);
    });

    it('emits only the deletion event when no issues carry the label', async () => {
      const { prisma } = buildPrisma({ assignmentsByLabel: [] });
      const { bus } = mockEventBus();
      const handler = new DeleteIssueLabelCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_ISSUE_LABEL, { id: 'lbl-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.ISSUE_LABEL_DELETED);
    });
  });
});
