/**
 * CreateSlaPolicyCommand — creates a new SLA policy with nested rules.
 *
 * Policies are scoped to an org (default) or a specific customer (override).
 * The @@unique([orgId, customerId]) constraint ensures at most one policy
 * per customer and one org-wide default.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateSlaPolicyPayload {
  name: string;
  description?: string;
  customerId?: string;
  active?: boolean;
  rules: Array<{
    ruleType: string;
    name: string;
    description?: string;
    active?: boolean;
    warningThresholdMinutes?: number;
    breachThresholdMinutes?: number;
    criticalThresholdMinutes?: number;
    issuePriority?: string;
    issueCategory?: string;
    maxDeliveryMinutes?: number;
    maxDwellMinutes?: number;
    dwellLocationType?: string;
    maxOccurrences?: number;
    maxExcursionMinutes?: number;
    autoCreateIssue?: boolean;
    issuePriorityOnBreach?: string;
  }>;
}

export const CREATE_SLA_POLICY = 'sla_policy.create';

export class CreateSlaPolicyCommandHandler extends BaseCommandHandler<CreateSlaPolicyPayload, { id: string; name: string }> {
  readonly commandType = CREATE_SLA_POLICY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateSlaPolicyPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string; name: string }> {
    const { rules, ...policyData } = command.payload;

    const policy = await tx.slaPolicy.create({
      data: {
        orgId: command.orgId,
        ...policyData,
        rules: {
          create: rules,
        },
      },
      include: { rules: true },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SLA_POLICY_CREATED,
      entityType: 'sla_policy',
      entityId: policy.id,
      payload: {
        name: policy.name,
        customerId: policy.customerId,
        ruleCount: policy.rules.length,
      },
    }));

    return { id: policy.id, name: policy.name };
  }
}
