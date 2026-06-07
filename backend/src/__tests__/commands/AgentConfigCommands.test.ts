import {
  CreateAgentConfigCommandHandler,
  CREATE_AGENT_CONFIG,
} from '../../commands/agentConfig/CreateAgentConfigCommand';
import {
  UpdateAgentConfigCommandHandler,
  UPDATE_AGENT_CONFIG,
} from '../../commands/agentConfig/UpdateAgentConfigCommand';
import {
  CreatePromptVersionCommandHandler,
  CREATE_PROMPT_VERSION,
} from '../../commands/agentConfig/CreatePromptVersionCommand';
import {
  ActivatePromptVersionCommandHandler,
  ACTIVATE_PROMPT_VERSION,
} from '../../commands/agentConfig/ActivatePromptVersionCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const baseConfig = {
  id: 'cfg-1',
  orgId: 'test-org',
  agentType: 'triage',
  name: 'Triage',
  description: null,
  enabled: true,
  subscribedEvents: [],
  activeVersionId: null,
  temperature: null,
  maxTokens: null,
  confidenceThreshold: null,
  deduplicationWindowMinutes: null,
};

function buildPrisma(overrides: any = {}) {
  const findResult = 'findUnique' in overrides ? overrides.findUnique : baseConfig;
  const findVersionResult = 'findVersion' in overrides
    ? overrides.findVersion
    : { id: 'v-1', versionNumber: 1, configId: 'cfg-1' };
  const tx = {
    agentConfig: {
      create: jest.fn().mockResolvedValue(overrides.createReturn ?? { ...baseConfig, versions: [{ id: 'v-1', versionNumber: 1 }] }),
      findUnique: jest.fn().mockResolvedValue(findResult ? { ...findResult, versions: overrides.versions ?? [] } : null),
      update: jest.fn().mockResolvedValue(overrides.updateReturn ?? baseConfig),
    },
    agentConfigVersion: {
      create: jest.fn().mockResolvedValue(overrides.createVersionReturn ?? { id: 'v-2', versionNumber: 2 }),
      findFirst: jest.fn().mockResolvedValue(findVersionResult),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('Agent config command handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateAgentConfigCommandHandler', () => {
    it('creates config + first version + active pointer atomically', async () => {
      const { prisma, tx } = buildPrisma();
      const { bus } = mockEventBus();
      const handler = new CreateAgentConfigCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_AGENT_CONFIG, {
          agentType: 'triage',
          name: 'Triage',
          subscribedEvents: ['shipment.exception'],
          systemPrompt: 'You are a triage agent...',
          changeNote: 'Initial',
        })
      );

      expect(result.success).toBe(true);
      const createCall = tx.agentConfig.create.mock.calls[0][0];
      expect(createCall.data.versions.create).toEqual(
        expect.objectContaining({
          versionNumber: 1,
          systemPrompt: 'You are a triage agent...',
          changeNote: 'Initial',
        })
      );
      // Active pointer set after create
      expect(tx.agentConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: { activeVersionId: 'v-1' },
      });
      expect(result.events[0].type).toBe(EVENT_TYPES.AGENT_CONFIG_CREATED);
    });
  });

  describe('UpdateAgentConfigCommandHandler', () => {
    it('emits AGENT_CONFIG_UPDATED with enabledChanged=true when toggling enabled', async () => {
      const { prisma } = buildPrisma({
        findUnique: { ...baseConfig, enabled: true },
        updateReturn: { ...baseConfig, enabled: false },
      });
      const { bus } = mockEventBus();
      const handler = new UpdateAgentConfigCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_AGENT_CONFIG, { id: 'cfg-1', data: { enabled: false } })
      );

      expect(result.events[0].type).toBe(EVENT_TYPES.AGENT_CONFIG_UPDATED);
      expect((result.events[0].payload as any).enabledChanged).toBe(true);
    });

    it('reports enabledChanged=false when no enable flip occurred', async () => {
      const { prisma } = buildPrisma({
        findUnique: { ...baseConfig, enabled: true },
        updateReturn: { ...baseConfig, enabled: true, name: 'Renamed' },
      });
      const { bus } = mockEventBus();
      const handler = new UpdateAgentConfigCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_AGENT_CONFIG, { id: 'cfg-1', data: { name: 'Renamed' } })
      );

      expect((result.events[0].payload as any).enabledChanged).toBe(false);
    });

    it('fails on unknown config id', async () => {
      const { prisma } = buildPrisma({ findUnique: null });
      const { bus } = mockEventBus();
      const handler = new UpdateAgentConfigCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_AGENT_CONFIG, { id: 'missing', data: { enabled: false } })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });

  describe('CreatePromptVersionCommandHandler', () => {
    it('increments version number from the latest existing version', async () => {
      const { prisma, tx } = buildPrisma({
        findUnique: { ...baseConfig },
        versions: [{ versionNumber: 7 }],
        createVersionReturn: { id: 'v-8', versionNumber: 8 },
      });
      const { bus } = mockEventBus();
      const handler = new CreatePromptVersionCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_PROMPT_VERSION, {
          configId: 'cfg-1',
          systemPrompt: 'New prompt',
        })
      );

      expect(result.success).toBe(true);
      expect(tx.agentConfigVersion.create.mock.calls[0][0].data.versionNumber).toBe(8);
      expect(result.events[0].type).toBe(EVENT_TYPES.AGENT_CONFIG_PROMPT_VERSION_CREATED);
    });

    it('starts numbering at 1 when no prior versions exist', async () => {
      const { prisma, tx } = buildPrisma({
        findUnique: baseConfig,
        versions: [],
        createVersionReturn: { id: 'v-1', versionNumber: 1 },
      });
      const { bus } = mockEventBus();
      const handler = new CreatePromptVersionCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_PROMPT_VERSION, { configId: 'cfg-1', systemPrompt: 'first' })
      );

      expect(tx.agentConfigVersion.create.mock.calls[0][0].data.versionNumber).toBe(1);
    });

    it('auto-activates the new version', async () => {
      const { prisma, tx } = buildPrisma({
        findUnique: baseConfig,
        versions: [{ versionNumber: 3 }],
        createVersionReturn: { id: 'v-4', versionNumber: 4 },
      });
      const { bus } = mockEventBus();
      const handler = new CreatePromptVersionCommandHandler(prisma, bus);

      await handler.execute(
        createTestCommand(CREATE_PROMPT_VERSION, { configId: 'cfg-1', systemPrompt: 'next' })
      );

      expect(tx.agentConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: { activeVersionId: 'v-4' },
      });
    });
  });

  describe('ActivatePromptVersionCommandHandler', () => {
    it('points activeVersionId at the requested version and records the previous one', async () => {
      const { prisma, tx } = buildPrisma({
        findUnique: { ...baseConfig, activeVersionId: 'v-old' },
        findVersion: { id: 'v-3', versionNumber: 3, configId: 'cfg-1' },
      });
      const { bus } = mockEventBus();
      const handler = new ActivatePromptVersionCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(ACTIVATE_PROMPT_VERSION, { configId: 'cfg-1', versionId: 'v-3' })
      );

      expect(result.success).toBe(true);
      expect(tx.agentConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg-1' },
        data: { activeVersionId: 'v-3' },
      });
      const payload = result.events[0].payload as any;
      expect(payload.versionId).toBe('v-3');
      expect(payload.previousVersionId).toBe('v-old');
    });

    it('fails when the version belongs to a different config', async () => {
      const { prisma } = buildPrisma({ findVersion: null });
      const { bus } = mockEventBus();
      const handler = new ActivatePromptVersionCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(ACTIVATE_PROMPT_VERSION, { configId: 'cfg-1', versionId: 'wrong-config-version' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });
  });
});
