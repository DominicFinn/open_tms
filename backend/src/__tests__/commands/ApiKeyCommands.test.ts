import {
  CreateApiKeyCommandHandler,
  CREATE_API_KEY,
} from '../../commands/apiKeys/CreateApiKeyCommand';
import {
  UpdateApiKeyCommandHandler,
  UPDATE_API_KEY,
} from '../../commands/apiKeys/UpdateApiKeyCommand';
import {
  DeleteApiKeyCommandHandler,
  DELETE_API_KEY,
} from '../../commands/apiKeys/DeleteApiKeyCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const baseKey = {
  id: 'key-1',
  name: 'Production',
  keyHash: 'abcd1234',
  keyPrefix: 'sk_live_abc',
  active: true,
  customerId: null,
  lastUsedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

function buildPrisma(overrides: any = {}) {
  const findResult = 'findUnique' in overrides ? overrides.findUnique : baseKey;
  const tx = {
    apiKey: {
      create: jest.fn().mockResolvedValue(baseKey),
      findUnique: jest.fn().mockResolvedValue(findResult),
      update: jest.fn().mockResolvedValue(overrides.updateReturn ?? baseKey),
      delete: jest.fn().mockResolvedValue(baseKey),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('API key command handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateApiKeyCommandHandler', () => {
    it('creates the row with the supplied hash + prefix and emits API_KEY_CREATED', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_API_KEY, {
          name: 'Production',
          customerId: null,
          keyHash: 'abcd1234',
          keyPrefix: 'sk_live_abc',
        })
      );

      expect(result.success).toBe(true);
      expect(tx.apiKey.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Production',
          keyHash: 'abcd1234',
          keyPrefix: 'sk_live_abc',
          active: true,
          customerId: null,
        }),
      });
      expect(result.events[0].type).toBe(EVENT_TYPES.API_KEY_CREATED);
    });

    it('does NOT include the keyHash in the emitted event payload', async () => {
      const { prisma } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_API_KEY, {
          name: 'Production',
          keyHash: 'super-secret-hash',
          keyPrefix: 'sk_live_abc',
        })
      );

      const payload = result.events[0].payload as any;
      expect(payload.keyHash).toBeUndefined();
      expect(payload.keyPrefix).toBe('sk_live_abc');
    });
  });

  describe('UpdateApiKeyCommandHandler', () => {
    it('emits API_KEY_REVOKED when active flips from true to false', async () => {
      const { prisma } = buildPrisma({
        findUnique: { ...baseKey, active: true },
        updateReturn: { ...baseKey, active: false },
      });
      const { bus } = mockEventBus();
      const handler = new UpdateApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_API_KEY, { id: 'key-1', data: { active: false } })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.API_KEY_REVOKED);
    });

    it('emits API_KEY_UPDATED for a name change', async () => {
      const { prisma } = buildPrisma({
        findUnique: { ...baseKey, name: 'Old' },
        updateReturn: { ...baseKey, name: 'New' },
      });
      const { bus } = mockEventBus();
      const handler = new UpdateApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_API_KEY, { id: 'key-1', data: { name: 'New' } })
      );

      expect(result.events[0].type).toBe(EVENT_TYPES.API_KEY_UPDATED);
      const payload = result.events[0].payload as any;
      expect(payload.changes).toContain('name');
    });

    it('does NOT emit REVOKED if active was already false', async () => {
      const { prisma } = buildPrisma({
        findUnique: { ...baseKey, active: false },
        updateReturn: { ...baseKey, active: false, name: 'renamed' },
      });
      const { bus } = mockEventBus();
      const handler = new UpdateApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_API_KEY, { id: 'key-1', data: { name: 'renamed', active: false } })
      );

      expect(result.events[0].type).toBe(EVENT_TYPES.API_KEY_UPDATED);
    });

    it('fails when key does not exist', async () => {
      const { prisma } = buildPrisma({ findUnique: null });
      const { bus } = mockEventBus();
      const handler = new UpdateApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_API_KEY, { id: 'missing', data: { name: 'x' } })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('DeleteApiKeyCommandHandler', () => {
    it('deletes the row and emits API_KEY_DELETED with prefix only', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new DeleteApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_API_KEY, { id: 'key-1' })
      );

      expect(result.success).toBe(true);
      expect(tx.apiKey.delete).toHaveBeenCalledWith({ where: { id: 'key-1' } });
      expect(result.events[0].type).toBe(EVENT_TYPES.API_KEY_DELETED);
      const payload = result.events[0].payload as any;
      expect(payload.keyPrefix).toBe('sk_live_abc');
      expect(payload.keyHash).toBeUndefined();
    });

    it('fails when key does not exist', async () => {
      const { prisma } = buildPrisma({ findUnique: null });
      const { bus } = mockEventBus();
      const handler = new DeleteApiKeyCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_API_KEY, { id: 'missing' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });
});
