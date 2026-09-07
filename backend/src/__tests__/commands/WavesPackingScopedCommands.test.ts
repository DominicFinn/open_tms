/**
 * #220, second batch. These five writes reached rows by bare id from a route handler with no
 * tenant check; two of them were outright deletes. Each test pins the org scope on the
 * authoritative read inside the transaction.
 */

import { AssignPickTaskCommandHandler, ASSIGN_PICK_TASK } from '../../commands/warehouse/AssignPickTaskCommand';
import { UpdateReplenishmentRuleCommandHandler, UPDATE_REPLENISHMENT_RULE } from '../../commands/warehouse/UpdateReplenishmentRuleCommand';
import { DeleteReplenishmentRuleCommandHandler, DELETE_REPLENISHMENT_RULE } from '../../commands/warehouse/DeleteReplenishmentRuleCommand';
import { UpdateWaveTemplateCommandHandler, UPDATE_WAVE_TEMPLATE } from '../../commands/warehouse/UpdateWaveTemplateCommand';
import { DeleteWaveTemplateCommandHandler, DELETE_WAVE_TEMPLATE } from '../../commands/warehouse/DeleteWaveTemplateCommand';
import { CreateWaveTemplateCommandHandler, CREATE_WAVE_TEMPLATE } from '../../commands/warehouse/CreateWaveTemplateCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const pickTask = { id: 'task-1', status: 'pending', assignedToUserId: null, waveId: 'wave-1' };
const rule = { id: 'rule-1', orgId: 'test-org', locationId: 'loc-1', sku: 'SKU-1', minQuantity: 10, maxQuantity: 100 };
const template = { id: 'tpl-1', orgId: 'test-org', locationId: 'loc-1', name: 'Morning', minOrders: 5, maxOrders: 50, active: true };

function buildPrisma(o: any = {}) {
  const tx = {
    pickTask: {
      findFirst: jest.fn().mockResolvedValue('pickTask' in o ? o.pickTask : pickTask),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...pickTask, ...data })),
    },
    replenishmentRule: {
      findFirst: jest.fn().mockResolvedValue('rule' in o ? o.rule : rule),
      update: jest.fn().mockResolvedValue(rule),
      delete: jest.fn().mockResolvedValue(rule),
    },
    waveTemplate: {
      create: jest.fn().mockResolvedValue({ ...template, pickStrategy: 'batch', priority: 50, autoRelease: false }),
      findFirst: jest.fn().mockResolvedValue('template' in o ? o.template : template),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...template, ...data })),
      delete: jest.fn().mockResolvedValue(template),
    },
    wave: { count: jest.fn().mockResolvedValue(o.waveCount ?? 0) },
    domainEventLog: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const prisma = {
    $transaction: jest.fn((fn: Function) => fn(tx)),
    domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  return { prisma, tx };
}

describe('AssignPickTaskCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('assigns and emits PICK_TASK_ASSIGNED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new AssignPickTaskCommandHandler(prisma, bus).execute(
      createTestCommand(ASSIGN_PICK_TASK, { taskId: 'task-1', assignedToUserId: 'picker-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.pickTask.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { assignedToUserId: 'picker-1', status: 'assigned' } })
    );
    expect(result.events![0].type).toBe(EVENT_TYPES.PICK_TASK_ASSIGNED);
  });

  it('scopes the read by org, so another tenant s task id misses', async () => {
    const { prisma, tx } = buildPrisma({ pickTask: null });
    const { bus } = mockEventBus();

    const result = await new AssignPickTaskCommandHandler(prisma, bus).execute(
      createTestCommand(ASSIGN_PICK_TASK, { taskId: 'other-org-task', assignedToUserId: 'picker-1' })
    );

    expect(result.success).toBe(false);
    expect(tx.pickTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-org-task', orgId: 'test-org' } })
    );
    expect(tx.pickTask.update).not.toHaveBeenCalled();
  });

  it('refuses to assign a completed pick task', async () => {
    const { prisma, tx } = buildPrisma({ pickTask: { ...pickTask, status: 'completed' } });
    const { bus } = mockEventBus();

    const result = await new AssignPickTaskCommandHandler(prisma, bus).execute(
      createTestCommand(ASSIGN_PICK_TASK, { taskId: 'task-1', assignedToUserId: 'picker-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot assign');
    expect(tx.pickTask.update).not.toHaveBeenCalled();
  });

  it('allows reassigning one already in progress', async () => {
    const { prisma, tx } = buildPrisma({ pickTask: { ...pickTask, status: 'in_progress', assignedToUserId: 'picker-0' } });
    const { bus } = mockEventBus();

    const result = await new AssignPickTaskCommandHandler(prisma, bus).execute(
      createTestCommand(ASSIGN_PICK_TASK, { taskId: 'task-1', assignedToUserId: 'picker-1' })
    );

    expect(result.success).toBe(true);
    expect((result.events![0].payload as any).previousAssigneeId).toBe('picker-0');
  });
});

describe('UpdateReplenishmentRuleCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates and emits REPLENISHMENT_RULE_UPDATED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new UpdateReplenishmentRuleCommandHandler(prisma, bus).execute(
      createTestCommand(UPDATE_REPLENISHMENT_RULE, { ruleId: 'rule-1', maxQuantity: 200 })
    );

    expect(result.success).toBe(true);
    expect(result.events![0].type).toBe(EVENT_TYPES.REPLENISHMENT_RULE_UPDATED);
    expect((result.events![0].payload as any).changes).toEqual(['maxQuantity']);
  });

  it('scopes the read by org', async () => {
    const { prisma, tx } = buildPrisma({ rule: null });
    const { bus } = mockEventBus();

    const result = await new UpdateReplenishmentRuleCommandHandler(prisma, bus).execute(
      createTestCommand(UPDATE_REPLENISHMENT_RULE, { ruleId: 'other-org-rule', maxQuantity: 200 })
    );

    expect(result.success).toBe(false);
    expect(tx.replenishmentRule.update).not.toHaveBeenCalled();
  });

  it('rejects a max below the stored min, even when only max is sent', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new UpdateReplenishmentRuleCommandHandler(prisma, bus).execute(
      createTestCommand(UPDATE_REPLENISHMENT_RULE, { ruleId: 'rule-1', maxQuantity: 5 })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least minQuantity');
    expect(tx.replenishmentRule.update).not.toHaveBeenCalled();
  });
});

describe('DeleteReplenishmentRuleCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes and emits REPLENISHMENT_RULE_DELETED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new DeleteReplenishmentRuleCommandHandler(prisma, bus).execute(
      createTestCommand(DELETE_REPLENISHMENT_RULE, { ruleId: 'rule-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.replenishmentRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    expect(result.events![0].type).toBe(EVENT_TYPES.REPLENISHMENT_RULE_DELETED);
  });

  it('will not delete another tenant s rule', async () => {
    const { prisma, tx } = buildPrisma({ rule: null });
    const { bus } = mockEventBus();

    const result = await new DeleteReplenishmentRuleCommandHandler(prisma, bus).execute(
      createTestCommand(DELETE_REPLENISHMENT_RULE, { ruleId: 'other-org-rule' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(tx.replenishmentRule.delete).not.toHaveBeenCalled();
  });
});

describe('UpdateWaveTemplateCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates and emits WAVE_TEMPLATE_UPDATED', async () => {
    const { prisma } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new UpdateWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(UPDATE_WAVE_TEMPLATE, { templateId: 'tpl-1', name: 'Afternoon' })
    );

    expect(result.success).toBe(true);
    expect(result.events![0].type).toBe(EVENT_TYPES.WAVE_TEMPLATE_UPDATED);
  });

  it('scopes the read by org', async () => {
    const { prisma, tx } = buildPrisma({ template: null });
    const { bus } = mockEventBus();

    const result = await new UpdateWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(UPDATE_WAVE_TEMPLATE, { templateId: 'other-org-tpl', name: 'Nope' })
    );

    expect(result.success).toBe(false);
    expect(tx.waveTemplate.update).not.toHaveBeenCalled();
  });

  it('rejects maxOrders below the stored minOrders', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new UpdateWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(UPDATE_WAVE_TEMPLATE, { templateId: 'tpl-1', maxOrders: 2 })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least minOrders');
    expect(tx.waveTemplate.update).not.toHaveBeenCalled();
  });

  it('allows clearing both bounds', async () => {
    const { prisma } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new UpdateWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(UPDATE_WAVE_TEMPLATE, { templateId: 'tpl-1', minOrders: null, maxOrders: null })
    );

    expect(result.success).toBe(true);
  });
});

describe('DeleteWaveTemplateCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes an unused template and emits WAVE_TEMPLATE_DELETED', async () => {
    const { prisma, tx } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new DeleteWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(DELETE_WAVE_TEMPLATE, { templateId: 'tpl-1' })
    );

    expect(result.success).toBe(true);
    expect(tx.waveTemplate.delete).toHaveBeenCalledWith({ where: { id: 'tpl-1' } });
    expect(result.events![0].type).toBe(EVENT_TYPES.WAVE_TEMPLATE_DELETED);
  });

  it('will not delete another tenant s template', async () => {
    const { prisma, tx } = buildPrisma({ template: null });
    const { bus } = mockEventBus();

    const result = await new DeleteWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(DELETE_WAVE_TEMPLATE, { templateId: 'other-org-tpl' })
    );

    expect(result.success).toBe(false);
    expect(tx.waveTemplate.delete).not.toHaveBeenCalled();
  });

  it('refuses to orphan waves that already came from the template', async () => {
    const { prisma, tx } = buildPrisma({ waveCount: 4 });
    const { bus } = mockEventBus();

    const result = await new DeleteWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(DELETE_WAVE_TEMPLATE, { templateId: 'tpl-1' })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('released waves');
    expect(tx.waveTemplate.delete).not.toHaveBeenCalled();
  });
});

describe('CreateWaveTemplateCommandHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  // WAVE_TEMPLATE_CREATED was declared in eventTypes.ts but nothing emitted it (#220).
  it('emits WAVE_TEMPLATE_CREATED', async () => {
    const { prisma } = buildPrisma();
    const { bus } = mockEventBus();

    const result = await new CreateWaveTemplateCommandHandler(prisma, bus).execute(
      createTestCommand(CREATE_WAVE_TEMPLATE, {
        locationId: 'loc-1', name: 'Morning', pickStrategy: 'batch',
      })
    );

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events![0].type).toBe(EVENT_TYPES.WAVE_TEMPLATE_CREATED);
  });
});
