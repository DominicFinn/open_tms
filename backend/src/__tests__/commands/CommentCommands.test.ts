import {
  CreateCommentCommandHandler,
  CREATE_COMMENT,
} from '../../commands/comments/CreateCommentCommand';
import {
  UpdateCommentCommandHandler,
  UPDATE_COMMENT,
} from '../../commands/comments/UpdateCommentCommand';
import {
  DeleteCommentCommandHandler,
  DELETE_COMMENT,
} from '../../commands/comments/DeleteCommentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const baseComment = {
  id: 'cmt-1',
  orgId: 'test-org',
  entityType: 'issue',
  entityId: 'issue-1',
  authorId: 'user-1',
  authorName: 'Jane Dispatcher',
  authorType: 'user',
  body: 'Carrier confirmed PoD',
  visibleToCustomer: false,
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date('2026-05-01T10:00:00Z'),
  updatedAt: new Date('2026-05-01T10:00:00Z'),
};

function buildPrisma(overrides: { findUnique?: any; updateReturn?: any } = {}) {
  const findResult = 'findUnique' in overrides ? overrides.findUnique : baseComment;
  const tx = {
    comment: {
      create: jest.fn().mockResolvedValue(baseComment),
      findUnique: jest.fn().mockResolvedValue(findResult),
      update: jest.fn().mockResolvedValue(overrides.updateReturn ?? baseComment),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;

  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;

  return { prisma, tx };
}

describe('Comment command handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateCommentCommandHandler', () => {
    it('persists the comment and emits COMMENT_ADDED', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateCommentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_COMMENT, {
          entityType: 'issue',
          entityId: 'issue-1',
          body: 'Carrier confirmed PoD',
          authorId: 'user-1',
          authorName: 'Jane Dispatcher',
          authorType: 'user',
        })
      );

      expect(result.success).toBe(true);
      expect(tx.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'issue',
            entityId: 'issue-1',
            body: 'Carrier confirmed PoD',
            authorId: 'user-1',
            authorName: 'Jane Dispatcher',
            authorType: 'user',
          }),
        })
      );
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.COMMENT_ADDED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          commentId: 'cmt-1',
          authorId: 'user-1',
          authorName: 'Jane Dispatcher',
          authorType: 'user',
        })
      );
    });

    it('defaults visibleToCustomer to false for internal authors', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateCommentCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_COMMENT, {
          entityType: 'issue',
          entityId: 'issue-1',
          body: 'internal note',
          authorId: 'user-1',
          authorName: 'Jane Dispatcher',
          authorType: 'user',
        })
      );

      expect(tx.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ visibleToCustomer: false }) })
      );
    });

    it('honors visibleToCustomer=true when set by an internal author', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateCommentCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_COMMENT, {
          entityType: 'issue',
          entityId: 'issue-1',
          body: 'public reply to customer',
          authorId: 'user-1',
          authorName: 'Jane Dispatcher',
          authorType: 'user',
          visibleToCustomer: true,
        })
      );

      expect(tx.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ visibleToCustomer: true }) })
      );
    });

    it('forces visibleToCustomer=true for customer-authored comments', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateCommentCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_COMMENT, {
          entityType: 'issue',
          entityId: 'issue-1',
          body: 'when will this ship?',
          authorId: 'cust-user-1',
          authorName: 'Acme Co (ops@acme.demo)',
          authorType: 'customer',
          // explicitly omit so we prove the handler still forces true
        })
      );

      expect(tx.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ visibleToCustomer: true, authorType: 'customer' }) })
      );
    });

    it('stores an optional tag when provided', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateCommentCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_COMMENT, {
          entityType: 'shipment',
          entityId: 'ship-1',
          body: 'Needs a liftgate at delivery',
          authorId: 'user-1',
          authorName: 'Jane Dispatcher',
          authorType: 'user',
          tag: 'requirement',
        })
      );

      expect(tx.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tag: 'requirement' }) })
      );
    });

    it('defaults tag to null when not provided', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateCommentCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_COMMENT, {
          entityType: 'issue',
          entityId: 'issue-1',
          body: 'Carrier confirmed PoD',
          authorId: 'user-1',
          authorName: 'Jane Dispatcher',
          authorType: 'user',
        })
      );

      expect(tx.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tag: null }) })
      );
    });

    it('carries orgId from the command envelope onto the row', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateCommentCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(
          CREATE_COMMENT,
          {
            entityType: 'shipment',
            entityId: 'ship-1',
            body: 'Heads up',
            authorId: null,
            authorName: 'System',
            authorType: 'system',
          },
          { orgId: 'org-acme' }
        )
      );

      expect(tx.comment.create.mock.calls[0][0].data.orgId).toBe('org-acme');
    });
  });

  describe('UpdateCommentCommandHandler', () => {
    it('updates body and emits COMMENT_UPDATED', async () => {
      const { prisma, tx } = buildPrisma({
        updateReturn: { ...baseComment, body: 'Updated body' },
      });
      const { bus } = mockEventBus();
      const handler = new UpdateCommentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_COMMENT, { id: 'cmt-1', body: 'Updated body' })
      );

      expect(result.success).toBe(true);
      expect(tx.comment.update).toHaveBeenCalledWith({
        where: { id: 'cmt-1' },
        data: { body: 'Updated body' },
      });
      expect(result.events[0].type).toBe(EVENT_TYPES.COMMENT_UPDATED);
      expect(result.events[0].entityType).toBe('issue');
      expect(result.events[0].entityId).toBe('issue-1');
    });

    it('fails when comment is missing', async () => {
      const { prisma } = buildPrisma({ findUnique: null });
      const { bus } = mockEventBus();
      const handler = new UpdateCommentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_COMMENT, { id: 'missing', body: 'x' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('fails when comment is already soft-deleted', async () => {
      const { prisma } = buildPrisma({
        findUnique: { ...baseComment, deletedAt: new Date() },
      });
      const { bus } = mockEventBus();
      const handler = new UpdateCommentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_COMMENT, { id: 'cmt-1', body: 'x' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/deleted/i);
    });
  });

  describe('DeleteCommentCommandHandler', () => {
    it('soft-deletes and emits COMMENT_DELETED with the actor as deletedBy', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new DeleteCommentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_COMMENT, { id: 'cmt-1' }, { actorId: 'user-9' })
      );

      expect(result.success).toBe(true);
      expect(tx.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cmt-1' },
          data: expect.objectContaining({ deletedBy: 'user-9' }),
        })
      );
      // deletedAt is set to a fresh Date — just check it's a Date instance
      expect(tx.comment.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
      expect(result.events[0].type).toBe(EVENT_TYPES.COMMENT_DELETED);
      expect(result.data).toEqual({ id: 'cmt-1', alreadyDeleted: false });
    });

    it('is idempotent on already-deleted comments and emits no event', async () => {
      const { prisma, tx } = buildPrisma({
        findUnique: { ...baseComment, deletedAt: new Date() },
      });
      const { bus } = mockEventBus();
      const handler = new DeleteCommentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_COMMENT, { id: 'cmt-1' })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'cmt-1', alreadyDeleted: true });
      expect(tx.comment.update).not.toHaveBeenCalled();
      expect(result.events).toHaveLength(0);
    });
  });
});
