import {
  CreateAutomationRuleCommandHandler,
  CREATE_AUTOMATION_RULE,
} from '../../commands/automationRules/CreateAutomationRuleCommand';
import {
  UpdateAutomationRuleCommandHandler,
  UPDATE_AUTOMATION_RULE,
} from '../../commands/automationRules/UpdateAutomationRuleCommand';
import {
  DeleteAutomationRuleCommandHandler,
  DELETE_AUTOMATION_RULE,
} from '../../commands/automationRules/DeleteAutomationRuleCommand';
import {
  PromoteDecisionToRuleCommandHandler,
  PROMOTE_DECISION_TO_RULE,
} from '../../commands/automationRules/PromoteDecisionToRuleCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const baseRule = {
  id: 'rule-1',
  orgId: 'test-org',
  name: 'Critical delay escalation',
  description: null,
  enabled: true,
  priority: 50,
  eventPattern: 'shipment.exception',
  conditions: [],
  actionType: 'escalate_issue',
  actionConfig: {},
  sourceDecisionId: null,
};

function buildPrisma(overrides: any = {}) {
  const findResult = 'findUnique' in overrides ? overrides.findUnique : baseRule;
  const tx = {
    automationRule: {
      create: jest.fn().mockResolvedValue(overrides.createReturn ?? baseRule),
      findUnique: jest.fn().mockResolvedValue(findResult),
      update: jest.fn().mockResolvedValue(overrides.updateReturn ?? baseRule),
      delete: jest.fn().mockResolvedValue(baseRule),
    },
    agentDecision: {
      findUnique: jest.fn().mockResolvedValue(overrides.decision ?? null),
      update: jest.fn().mockResolvedValue({}),
    },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('CreateAutomationRuleCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a rule with default priority and emits AUTOMATION_RULE_CREATED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateAutomationRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(CREATE_AUTOMATION_RULE, {
        name: 'Critical delay escalation',
        eventPattern: 'shipment.exception',
        conditions: [{ field: 'payload.severity', operator: 'equals', value: 'critical' }],
        actionType: 'escalate_issue',
        actionConfig: { escalatedTo: 'ops' },
      })
    );

    expect(result.success).toBe(true);
    const data = tx.automationRule.create.mock.calls[0][0].data;
    expect(data.priority).toBe(50);
    expect(data.eventPattern).toBe('shipment.exception');
    expect(result.events[0].type).toBe(EVENT_TYPES.AUTOMATION_RULE_CREATED);
  });

  it('marks the source decision as promoted when sourceDecisionId is set', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateAutomationRuleCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(CREATE_AUTOMATION_RULE, {
        name: 'From decision',
        eventPattern: 'shipment.exception',
        conditions: [],
        actionType: 'create_issue',
        actionConfig: {},
        sourceDecisionId: 'dec-1',
      })
    );

    expect(tx.agentDecision.update).toHaveBeenCalledWith({
      where: { id: 'dec-1' },
      data: expect.objectContaining({ promotedToAutomation: true }),
    });
  });

  it('does not touch agentDecision when sourceDecisionId is null', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new CreateAutomationRuleCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(CREATE_AUTOMATION_RULE, {
        name: 'Manual',
        eventPattern: 'shipment.*',
        conditions: [],
        actionType: 'create_issue',
        actionConfig: {},
      })
    );

    expect(tx.agentDecision.update).not.toHaveBeenCalled();
  });
});

describe('UpdateAutomationRuleCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emits AUTOMATION_RULE_TOGGLED for a pure enable/disable flip', async () => {
    const { prisma } = buildPrisma({
      findUnique: { ...baseRule, enabled: true },
      updateReturn: { ...baseRule, enabled: false },
    });
    const { bus } = mockEventBus();
    const handler = new UpdateAutomationRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_AUTOMATION_RULE, { id: 'rule-1', data: { enabled: false } })
    );

    expect(result.events[0].type).toBe(EVENT_TYPES.AUTOMATION_RULE_TOGGLED);
  });

  it('emits AUTOMATION_RULE_UPDATED for a multi-field change even if enabled also flips', async () => {
    const { prisma } = buildPrisma({
      findUnique: { ...baseRule, enabled: true, name: 'Old' },
      updateReturn: { ...baseRule, enabled: false, name: 'New' },
    });
    const { bus } = mockEventBus();
    const handler = new UpdateAutomationRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_AUTOMATION_RULE, {
        id: 'rule-1',
        data: { name: 'New', enabled: false },
      })
    );

    expect(result.events[0].type).toBe(EVENT_TYPES.AUTOMATION_RULE_UPDATED);
  });

  it('emits AUTOMATION_RULE_UPDATED when no enable change occurred', async () => {
    const { prisma } = buildPrisma({
      findUnique: { ...baseRule, enabled: true },
      updateReturn: { ...baseRule, name: 'Renamed' },
    });
    const { bus } = mockEventBus();
    const handler = new UpdateAutomationRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_AUTOMATION_RULE, { id: 'rule-1', data: { name: 'Renamed' } })
    );

    expect(result.events[0].type).toBe(EVENT_TYPES.AUTOMATION_RULE_UPDATED);
  });

  it('fails on unknown rule id', async () => {
    const { prisma } = buildPrisma({ findUnique: null });
    const { bus } = mockEventBus();
    const handler = new UpdateAutomationRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(UPDATE_AUTOMATION_RULE, { id: 'missing', data: { enabled: false } })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

describe('DeleteAutomationRuleCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes the rule and emits AUTOMATION_RULE_DELETED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();
    const handler = new DeleteAutomationRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(DELETE_AUTOMATION_RULE, { id: 'rule-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.automationRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    expect(result.events[0].type).toBe(EVENT_TYPES.AUTOMATION_RULE_DELETED);
    expect(result.data?.deleted).toBe(true);
  });

  it('returns deleted=false and emits no event when the rule was already gone', async () => {
    const { prisma, tx } = buildPrisma({ findUnique: null });
    const { bus } = mockEventBus();
    const handler = new DeleteAutomationRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(DELETE_AUTOMATION_RULE, { id: 'missing' })
    );

    expect(result.success).toBe(true);
    expect(result.data?.deleted).toBe(false);
    expect(tx.automationRule.delete).not.toHaveBeenCalled();
    expect(result.events).toHaveLength(0);
  });
});

describe('PromoteDecisionToRuleCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  const baseDecision = {
    id: 'dec-1',
    orgId: 'test-org',
    summary: 'Auto-escalated critical delays',
    reasoning: 'Severity is critical and shipment is in transit',
    actionType: 'escalate_issue',
    actionPayload: { escalateReason: 'On-time guarantee breach' },
    matchedConditions: [
      { field: 'event.type', operator: 'equals', value: 'shipment.exception' },
      { field: 'payload.severity', operator: 'equals', value: 'critical' },
    ],
    triggerEventType: 'shipment.exception',
  };

  it('strips event.type from conditions and uses it as the eventPattern', async () => {
    const { prisma, tx } = buildPrisma({ decision: baseDecision });
    const { bus } = mockEventBus();
    const handler = new PromoteDecisionToRuleCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(PROMOTE_DECISION_TO_RULE, { decisionId: 'dec-1' })
    );

    const data = tx.automationRule.create.mock.calls[0][0].data;
    expect(data.eventPattern).toBe('shipment.exception');
    expect((data.conditions as any[]).find((c: any) => c.field === 'event.type')).toBeUndefined();
    expect((data.conditions as any[]).length).toBe(1);
  });

  it('marks the decision as promoted', async () => {
    const { prisma, tx } = buildPrisma({ decision: baseDecision });
    const { bus } = mockEventBus();
    const handler = new PromoteDecisionToRuleCommandHandler(prisma, bus);

    await handler.execute(
      createTestCommand(PROMOTE_DECISION_TO_RULE, { decisionId: 'dec-1' })
    );

    expect(tx.agentDecision.update).toHaveBeenCalledWith({
      where: { id: 'dec-1' },
      data: expect.objectContaining({ promotedToAutomation: true }),
    });
  });

  it('fails when decision has no matched conditions', async () => {
    const { prisma } = buildPrisma({ decision: { ...baseDecision, matchedConditions: [] } });
    const { bus } = mockEventBus();
    const handler = new PromoteDecisionToRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(PROMOTE_DECISION_TO_RULE, { decisionId: 'dec-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no matched conditions/i);
  });

  it('fails when the decision id does not exist', async () => {
    const { prisma } = buildPrisma({ decision: null });
    const { bus } = mockEventBus();
    const handler = new PromoteDecisionToRuleCommandHandler(prisma, bus);

    const result = await handler.execute(
      createTestCommand(PROMOTE_DECISION_TO_RULE, { decisionId: 'missing' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});
