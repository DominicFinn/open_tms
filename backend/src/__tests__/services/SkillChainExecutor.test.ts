import { SkillRegistry } from '../../services/skills/SkillRegistry';
import { SkillChainExecutor } from '../../services/skills/SkillChainExecutor';
import { ISkill, SkillChainStep, SkillExecutionParams, SkillExecutionResult } from '../../services/skills/ISkill';
import { resolveTemplate, resolveFields } from '../../services/skills/TemplateResolver';
import { createTestEvent } from '../helpers/testUtils';
import { EVENT_TYPES } from '../../events/eventTypes';

// ── Mock skill ───────────────────────────────────────────────────

function createMockSkill(type: string, result: SkillExecutionResult = { success: true, data: { id: 'test-1' } }): ISkill {
  return {
    definition: {
      type, name: type, description: 'test', icon: 'test',
      category: 'triage', fields: [], configSchema: [], requiresConfig: false,
    },
    validateConfig: () => ({ valid: true }),
    execute: jest.fn().mockResolvedValue(result),
  };
}

const mockPrisma = {
  skillConfig: {
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
  },
} as any;

// ── Template resolver tests ──────────────────────────────────────

describe('TemplateResolver', () => {
  it('resolves simple template variables', () => {
    const data = { payload: { shipmentReference: 'SH-00042' } };
    expect(resolveTemplate('Delay on {{payload.shipmentReference}}', data)).toBe('Delay on SH-00042');
  });

  it('resolves multiple variables', () => {
    const data = { event: { type: 'shipment.exception' }, payload: { delayMinutes: 65 } };
    expect(resolveTemplate('{{event.type}}: {{payload.delayMinutes}} min delay', data)).toBe('shipment.exception: 65 min delay');
  });

  it('returns empty string for missing fields', () => {
    expect(resolveTemplate('{{missing.field}}', {})).toBe('');
  });

  it('resolves object values as JSON', () => {
    const data = { payload: { stops: [{ name: 'A' }] } };
    const result = resolveTemplate('Stops: {{payload.stops}}', data);
    expect(result).toContain('"name":"A"');
  });

  it('resolveFields resolves all fields in a record', () => {
    const data = { payload: { ref: 'SH-001', priority: 'high' } };
    const result = resolveFields({ title: 'Issue for {{payload.ref}}', priority: '{{payload.priority}}' }, data);
    expect(result.title).toBe('Issue for SH-001');
    expect(result.priority).toBe('high');
  });
});

// ── Skill registry tests ─────────────────────────────────────────

describe('SkillRegistry', () => {
  it('registers and retrieves skills', () => {
    const registry = new SkillRegistry();
    const skill = createMockSkill('test_skill');
    registry.register(skill);

    expect(registry.get('test_skill')).toBe(skill);
    expect(registry.has('test_skill')).toBe(true);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('throws on duplicate registration', () => {
    const registry = new SkillRegistry();
    registry.register(createMockSkill('dup'));
    expect(() => registry.register(createMockSkill('dup'))).toThrow('already registered');
  });

  it('returns definitions for UI', () => {
    const registry = new SkillRegistry();
    registry.register(createMockSkill('skill_a'));
    registry.register(createMockSkill('skill_b'));
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(2);
    expect(defs[0].type).toBe('skill_a');
  });
});

// ── Skill chain executor tests ───────────────────────────────────

describe('SkillChainExecutor', () => {
  it('executes a linear chain of skills', async () => {
    const registry = new SkillRegistry();
    const skillA = createMockSkill('skill_a');
    const skillB = createMockSkill('skill_b');
    registry.register(skillA);
    registry.register(skillB);

    const executor = new SkillChainExecutor(registry, mockPrisma);
    const event = createTestEvent(EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-1', { ref: 'SH-001' });

    const steps: SkillChainStep[] = [
      { type: 'skill', skillType: 'skill_a', fields: { title: 'Test A' } },
      { type: 'skill', skillType: 'skill_b', fields: { title: 'Test B' } },
    ];

    const result = await executor.execute(steps, event, {}, 'org-1');

    expect(result.success).toBe(true);
    expect(result.stepResults).toHaveLength(2);
    expect(skillA.execute).toHaveBeenCalledTimes(1);
    expect(skillB.execute).toHaveBeenCalledTimes(1);
  });

  it('executes question branching - matched branch', async () => {
    const registry = new SkillRegistry();
    const yesSkill = createMockSkill('yes_action');
    const noSkill = createMockSkill('no_action_skill');
    registry.register(yesSkill);
    registry.register(noSkill);

    const executor = new SkillChainExecutor(registry, mockPrisma);
    const event = createTestEvent(EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-1', { delayMinutes: 65 });

    const steps: SkillChainStep[] = [
      {
        type: 'question',
        question: 'Is delay > 60 minutes?',
        conditions: [{ field: 'payload.delayMinutes', operator: 'greaterThan', value: 60 }],
        branches: [
          { label: 'Yes', matched: true, steps: [{ type: 'skill', skillType: 'yes_action', fields: {} }] },
          { label: 'No', matched: false, steps: [{ type: 'skill', skillType: 'no_action_skill', fields: {} }] },
        ],
      },
    ];

    const result = await executor.execute(steps, event, {}, 'org-1');

    expect(result.success).toBe(true);
    expect(yesSkill.execute).toHaveBeenCalledTimes(1);
    expect(noSkill.execute).not.toHaveBeenCalled();
    // Question step + yes branch skill
    expect(result.stepResults.some((s) => s.branchTaken === 'Yes')).toBe(true);
  });

  it('executes question branching - unmatched branch', async () => {
    const registry = new SkillRegistry();
    const yesSkill = createMockSkill('yes_action');
    const noSkill = createMockSkill('no_action_skill');
    registry.register(yesSkill);
    registry.register(noSkill);

    const executor = new SkillChainExecutor(registry, mockPrisma);
    const event = createTestEvent(EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-1', { delayMinutes: 30 });

    const steps: SkillChainStep[] = [
      {
        type: 'question',
        question: 'Is delay > 60 minutes?',
        conditions: [{ field: 'payload.delayMinutes', operator: 'greaterThan', value: 60 }],
        branches: [
          { label: 'Yes', matched: true, steps: [{ type: 'skill', skillType: 'yes_action', fields: {} }] },
          { label: 'No', matched: false, steps: [{ type: 'skill', skillType: 'no_action_skill', fields: {} }] },
        ],
      },
    ];

    const result = await executor.execute(steps, event, {}, 'org-1');

    expect(result.success).toBe(true);
    expect(yesSkill.execute).not.toHaveBeenCalled();
    expect(noSkill.execute).toHaveBeenCalledTimes(1);
    expect(result.stepResults.some((s) => s.branchTaken === 'No')).toBe(true);
  });

  it('resolves template variables in skill fields', async () => {
    const registry = new SkillRegistry();
    const skill = createMockSkill('create_issue');
    registry.register(skill);

    const executor = new SkillChainExecutor(registry, mockPrisma);
    const event = createTestEvent(EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-1', { shipmentReference: 'SH-00042' });

    const steps: SkillChainStep[] = [
      { type: 'skill', skillType: 'create_issue', fields: { title: 'Issue for {{payload.shipmentReference}}' } },
    ];

    await executor.execute(steps, event, {}, 'org-1');

    const callArgs = (skill.execute as jest.Mock).mock.calls[0][0] as SkillExecutionParams;
    expect(callArgs.fields.title).toBe('Issue for SH-00042');
  });

  it('handles missing skill gracefully', async () => {
    const registry = new SkillRegistry();
    const executor = new SkillChainExecutor(registry, mockPrisma);
    const event = createTestEvent(EVENT_TYPES.SHIPMENT_EXCEPTION, 'shipment', 'ship-1', {});

    const steps: SkillChainStep[] = [
      { type: 'skill', skillType: 'nonexistent', fields: {} },
    ];

    const result = await executor.execute(steps, event, {}, 'org-1');

    expect(result.stepResults[0].result?.success).toBe(false);
    expect(result.stepResults[0].result?.error).toContain('not found');
  });
});
