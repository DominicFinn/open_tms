import { AutomationRuleHandler } from '../../events/handlers/AutomationRuleHandler';
import { SkillRegistry } from '../../services/skills/SkillRegistry';
import { ISkill, SkillExecutionResult } from '../../services/skills/ISkill';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

// ── Mock skill factory ──────────────────────────────────────────

function createMockSkill(
  type: string,
  result: SkillExecutionResult = { success: true, data: { id: 'result-1' } },
): ISkill {
  return {
    definition: {
      type, name: type, description: 'test', icon: 'test',
      category: 'triage', fields: [], configSchema: [], requiresConfig: false,
    },
    validateConfig: () => ({ valid: true }),
    execute: jest.fn().mockResolvedValue(result),
  };
}

function createMockSkillWithConfig(type: string): ISkill {
  return {
    definition: {
      type, name: type, description: 'test', icon: 'test',
      category: 'integration', fields: [], configSchema: [
        { key: 'webhookUrl', label: 'URL', type: 'url', required: true },
      ], requiresConfig: true,
    },
    validateConfig: () => ({ valid: true }),
    execute: jest.fn().mockResolvedValue({ success: true, data: {} }),
  };
}

// ── Mock Prisma ─────────────────────────────────────────────────

function createMockPrisma(rules: unknown[] = []) {
  return {
    automationRule: {
      findMany: jest.fn().mockResolvedValue(rules),
      update: jest.fn().mockResolvedValue({}),
    },
    automationExecutionLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    agentDecision: {
      create: jest.fn().mockResolvedValue({}),
    },
    skillChain: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    skillConfig: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as any;
}

// ── Helper: build a rule ────────────────────────────────────────

function buildRule(overrides: Partial<{
  id: string;
  orgId: string;
  name: string;
  eventPattern: string;
  conditions: unknown[];
  actionType: string;
  actionConfig: Record<string, string>;
  priority: number;
  enabled: boolean;
  skillChainId: string | null;
  inlineSteps: unknown[] | null;
  executionCount: number;
  lastExecutedAt: Date | null;
}> = {}) {
  return {
    id: overrides.id ?? 'rule-1',
    orgId: overrides.orgId ?? 'test-org',
    name: overrides.name ?? 'Test Rule',
    eventPattern: overrides.eventPattern ?? 'shipment.exception',
    conditions: overrides.conditions ?? [
      { field: 'payload.exceptionType', operator: 'equals', value: 'eta_critical_delay' },
    ],
    actionType: overrides.actionType ?? 'create_issue',
    actionConfig: overrides.actionConfig ?? { title: 'Auto: {{payload.description}}', priority: 'high' },
    priority: overrides.priority ?? 50,
    enabled: overrides.enabled ?? true,
    skillChainId: overrides.skillChainId ?? null,
    inlineSteps: overrides.inlineSteps ?? null,
    executionCount: overrides.executionCount ?? 0,
    lastExecutedAt: overrides.lastExecutedAt ?? null,
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('AutomationRuleHandler', () => {
  let registry: SkillRegistry;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let handler: AutomationRuleHandler;
  let createIssueSkill: ISkill;

  beforeEach(() => {
    registry = new SkillRegistry();
    createIssueSkill = createMockSkill('create_issue');
    registry.register(createIssueSkill);
    registry.register(createMockSkill('escalate_issue'));
    mockPrisma = createMockPrisma();
    handler = new AutomationRuleHandler(mockPrisma, registry);
  });

  describe('tryHandle return value', () => {
    it('returns true when a rule matches', async () => {
      const rule = buildRule();
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      expect(await handler.tryHandle(event)).toBe(true);
    });

    it('returns false when no rule matches', async () => {
      const rule = buildRule({
        conditions: [{ field: 'payload.exceptionType', operator: 'equals', value: 'nonexistent' }],
      });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      expect(await handler.tryHandle(event)).toBe(false);
    });
  });

  describe('rule matching', () => {
    it('executes skill when conditions match and returns true', async () => {
      const rule = buildRule();
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay', delayMinutes: 65, description: 'Late by 65 min' },
      );

      const result = await handler.tryHandle(event);

      expect(result).toBe(true);
      expect(createIssueSkill.execute).toHaveBeenCalledTimes(1);
      expect(mockPrisma.automationExecutionLog.create).toHaveBeenCalledTimes(1);
    });

    it('does not execute when conditions do not match and returns false', async () => {
      const rule = buildRule({
        conditions: [{ field: 'payload.exceptionType', operator: 'equals', value: 'temperature_excursion' }],
      });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      const result = await handler.tryHandle(event);

      expect(result).toBe(false);
      expect(createIssueSkill.execute).not.toHaveBeenCalled();
      expect(mockPrisma.automationExecutionLog.create).not.toHaveBeenCalled();
    });

    it('does not execute when event pattern does not match', async () => {
      const rule = buildRule({ eventPattern: 'sla.breached' });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(createIssueSkill.execute).not.toHaveBeenCalled();
    });

    it('matches wildcard event patterns', async () => {
      const rule = buildRule({ eventPattern: 'shipment.*' });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(createIssueSkill.execute).toHaveBeenCalledTimes(1);
    });

    it('matches global wildcard pattern', async () => {
      const rule = buildRule({ eventPattern: '*' });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SLA_BREACHED,
        'sla', 'sla-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(createIssueSkill.execute).toHaveBeenCalledTimes(1);
    });

    it('returns false when no rules exist', async () => {
      mockPrisma = createMockPrisma([]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      const result = await handler.tryHandle(event);

      expect(result).toBe(false);
      expect(mockPrisma.automationExecutionLog.create).not.toHaveBeenCalled();
      expect(mockPrisma.agentDecision.create).not.toHaveBeenCalled();
    });
  });

  describe('priority ordering', () => {
    it('executes highest-priority rule first and stops', async () => {
      const escalateSkill = registry.get('escalate_issue')!;
      const lowPriorityRule = buildRule({ id: 'rule-low', name: 'Low Priority', priority: 80, actionType: 'escalate_issue' });
      const highPriorityRule = buildRule({ id: 'rule-high', name: 'High Priority', priority: 10 });

      mockPrisma = createMockPrisma([lowPriorityRule, highPriorityRule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      // High priority (create_issue) fires, low priority (escalate_issue) does not
      expect(createIssueSkill.execute).toHaveBeenCalledTimes(1);
      expect(escalateSkill.execute).not.toHaveBeenCalled();
    });
  });

  describe('decision logging', () => {
    it('writes agent decision record after rule executes', async () => {
      const rule = buildRule();
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(mockPrisma.agentDecision.create).toHaveBeenCalledTimes(1);
      const suppressionData = mockPrisma.agentDecision.create.mock.calls[0][0].data;
      expect(suppressionData.agentType).toBe('triage');
      expect(suppressionData.triggerType).toBe('automation_rule');
      expect(suppressionData.triggerEventId).toBe(event.id);
      expect(suppressionData.actionType).toBe('create_issue');
      expect(suppressionData.confidence).toBe(1.0);
      expect(suppressionData.summary).toContain('Test Rule');
    });

    it('does not write decision record when no rule matches', async () => {
      const rule = buildRule({
        conditions: [{ field: 'payload.exceptionType', operator: 'equals', value: 'nonexistent' }],
      });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(mockPrisma.agentDecision.create).not.toHaveBeenCalled();
    });
  });

  describe('execution logging', () => {
    it('logs execution with correct fields', async () => {
      const rule = buildRule();
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay', description: 'Late' },
      );

      await handler.tryHandle(event);

      expect(mockPrisma.automationExecutionLog.create).toHaveBeenCalledTimes(1);
      const logData = mockPrisma.automationExecutionLog.create.mock.calls[0][0].data;
      expect(logData.ruleId).toBe('rule-1');
      expect(logData.ruleName).toBe('Test Rule');
      expect(logData.eventType).toBe(EVENT_TYPES.SHIPMENT_EXCEPTION);
      expect(logData.eventId).toBe(event.id);
      expect(logData.entityType).toBe('shipment');
      expect(logData.entityId).toBe('ship-1');
      expect(logData.actionType).toBe('create_issue');
      expect(logData.conditionsMatched).toBe(true);
      expect(typeof logData.evaluationMs).toBe('number');
    });

    it('updates rule execution count and lastExecutedAt', async () => {
      const rule = buildRule();
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(mockPrisma.automationRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { executionCount: { increment: 1 }, lastExecutedAt: expect.any(Date) },
      });
    });
  });

  describe('template resolution in action config', () => {
    it('resolves {{payload.*}} templates in action config fields', async () => {
      const rule = buildRule({
        actionConfig: {
          title: 'Auto: {{payload.description}}',
          priority: 'high',
          entityId: '{{event.entityId}}',
        },
      });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay', description: 'Shipment delayed 65 min' },
      );

      await handler.tryHandle(event);

      const executeCall = (createIssueSkill.execute as jest.Mock).mock.calls[0][0];
      expect(executeCall.fields.title).toBe('Auto: Shipment delayed 65 min');
      expect(executeCall.fields.entityId).toBe('ship-1');
    });
  });

  describe('skill not found', () => {
    it('handles missing skill gracefully', async () => {
      const rule = buildRule({ actionType: 'nonexistent_skill' });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      // Still logs execution + suppresses agent, but action result has error
      expect(mockPrisma.automationExecutionLog.create).toHaveBeenCalledTimes(1);
      const logData = mockPrisma.automationExecutionLog.create.mock.calls[0][0].data;
      expect(logData.actionResult).toEqual(
        expect.objectContaining({ success: false, error: expect.stringContaining('nonexistent_skill') }),
      );
    });
  });

  describe('skill chain execution', () => {
    it('executes inline skill chain steps', async () => {
      const rule = buildRule({
        actionType: 'skill_chain',
        inlineSteps: [
          { type: 'skill', skillType: 'create_issue', fields: { title: 'Chain issue', priority: 'high' } },
          { type: 'skill', skillType: 'escalate_issue', fields: { issueId: 'issue-1' } },
        ],
      });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(createIssueSkill.execute).toHaveBeenCalledTimes(1);
      expect(registry.get('escalate_issue')!.execute).toHaveBeenCalledTimes(1);
      expect(mockPrisma.automationExecutionLog.create).toHaveBeenCalledTimes(1);
    });

    it('loads named skill chain from database when skillChainId is set', async () => {
      const rule = buildRule({
        actionType: 'skill_chain',
        skillChainId: 'chain-1',
        inlineSteps: null,
      });
      mockPrisma = createMockPrisma([rule]);
      mockPrisma.skillChain.findUnique.mockResolvedValue({
        id: 'chain-1',
        steps: [
          { type: 'skill', skillType: 'create_issue', fields: { title: 'From chain DB', priority: 'critical' } },
        ],
      });
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      expect(mockPrisma.skillChain.findUnique).toHaveBeenCalledWith({ where: { id: 'chain-1' } });
      expect(createIssueSkill.execute).toHaveBeenCalledTimes(1);
    });

    it('returns error when named skill chain is not found', async () => {
      const rule = buildRule({
        actionType: 'skill_chain',
        skillChainId: 'missing-chain',
        inlineSteps: null,
      });
      mockPrisma = createMockPrisma([rule]);
      mockPrisma.skillChain.findUnique.mockResolvedValue(null);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay' },
      );

      await handler.tryHandle(event);

      const logData = mockPrisma.automationExecutionLog.create.mock.calls[0][0].data;
      expect(logData.actionResult).toEqual(
        expect.objectContaining({ success: false, error: 'Skill chain not found' }),
      );
    });
  });

  describe('skill config loading', () => {
    it('loads skill config from DB when skill requires config', async () => {
      const webhookSkill = createMockSkillWithConfig('call_webhook');
      registry.register(webhookSkill);

      const rule = buildRule({
        actionType: 'call_webhook',
        actionConfig: { url: '{{payload.callbackUrl}}' },
      });
      mockPrisma = createMockPrisma([rule]);
      mockPrisma.skillConfig.findFirst.mockResolvedValue({
        id: 'cfg-1',
        orgId: 'test-org',
        skillType: 'call_webhook',
        config: { webhookUrl: 'https://hooks.example.com/tms' },
        enabled: true,
      });
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event = createTestEvent(
        EVENT_TYPES.SHIPMENT_EXCEPTION,
        'shipment', 'ship-1',
        { exceptionType: 'eta_critical_delay', callbackUrl: '/callback' },
      );

      await handler.tryHandle(event);

      expect(mockPrisma.skillConfig.findFirst).toHaveBeenCalledWith({
        where: { orgId: 'test-org', skillType: 'call_webhook', enabled: true },
      });
      const executeCall = (webhookSkill.execute as jest.Mock).mock.calls[0][0];
      expect(executeCall.config).toEqual({ webhookUrl: 'https://hooks.example.com/tms' });
    });
  });

  describe('rules caching', () => {
    it('caches rules across multiple calls within TTL', async () => {
      const rule = buildRule({
        conditions: [{ field: 'payload.exceptionType', operator: 'equals', value: 'eta_critical_delay' }],
      });
      mockPrisma = createMockPrisma([rule]);
      handler = new AutomationRuleHandler(mockPrisma, registry);

      const event1 = createTestEvent(EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-1', { exceptionType: 'eta_critical_delay' });
      const event2 = createTestEvent(EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-2', { exceptionType: 'eta_critical_delay' });

      await handler.tryHandle(event1);
      await handler.tryHandle(event2);

      // findMany called once (cached on second call)
      expect(mockPrisma.automationRule.findMany).toHaveBeenCalledTimes(1);
      // But both events were processed
      expect(mockPrisma.automationExecutionLog.create).toHaveBeenCalledTimes(2);
    });
  });
});
