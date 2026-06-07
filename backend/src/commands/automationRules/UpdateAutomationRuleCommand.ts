import { PrismaClient, Prisma } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateAutomationRulePayload {
  id: string;
  data: {
    name?: string;
    description?: string | null;
    eventPattern?: string;
    conditions?: unknown[];
    actionType?: string;
    actionConfig?: Record<string, unknown>;
    priority?: number;
    enabled?: boolean;
  };
}

export interface UpdateAutomationRuleResult {
  id: string;
  enabled: boolean;
}

export const UPDATE_AUTOMATION_RULE = 'automation_rule.update';

export class UpdateAutomationRuleCommandHandler extends BaseCommandHandler<UpdateAutomationRulePayload, UpdateAutomationRuleResult> {
  readonly commandType = UPDATE_AUTOMATION_RULE;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateAutomationRulePayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<UpdateAutomationRuleResult> {
    const { id, data } = command.payload;

    const previous = await tx.automationRule.findUnique({ where: { id } });
    if (!previous) throw new Error('Rule not found');

    const updateData: Prisma.AutomationRuleUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.eventPattern !== undefined) updateData.eventPattern = data.eventPattern;
    if (data.conditions !== undefined) updateData.conditions = data.conditions as unknown as Prisma.InputJsonValue;
    if (data.actionType !== undefined) updateData.actionType = data.actionType;
    if (data.actionConfig !== undefined) updateData.actionConfig = data.actionConfig as Prisma.InputJsonValue;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    const updated = await tx.automationRule.update({ where: { id }, data: updateData });

    // Surface a dedicated TOGGLED event when this update is purely a
    // pause/resume — operations dashboards and audit logs care about that
    // transition specifically.
    const isPureToggle =
      data.enabled !== undefined &&
      data.enabled !== previous.enabled &&
      Object.keys(data).length === 1;

    if (isPureToggle) {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.AUTOMATION_RULE_TOGGLED,
        entityType: 'automation_rule',
        entityId: id,
        payload: { name: updated.name, enabled: updated.enabled },
      }));
    } else {
      emit(this.createEvent(command, {
        type: EVENT_TYPES.AUTOMATION_RULE_UPDATED,
        entityType: 'automation_rule',
        entityId: id,
        payload: {
          name: updated.name,
          changes: Object.keys(data),
          enabled: updated.enabled,
        },
      }));
    }

    return { id: updated.id, enabled: updated.enabled };
  }
}
