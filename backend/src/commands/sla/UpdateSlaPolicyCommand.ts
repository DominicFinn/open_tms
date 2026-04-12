/**
 * UpdateSlaPolicyCommand — updates an SLA policy and replaces its rules.
 *
 * Rules are replaced wholesale (delete existing, create new) because
 * the rule set is always managed as a unit — partial updates would
 * complicate the config UI and introduce ordering/identity issues.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateSlaPolicyPayload {
  id: string;
  name?: string;
  description?: string;
  active?: boolean;
  rules?: Array<{
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

export const UPDATE_SLA_POLICY = 'sla_policy.update';

export class UpdateSlaPolicyCommandHandler extends BaseCommandHandler<UpdateSlaPolicyPayload, { id: string }> {
  readonly commandType = UPDATE_SLA_POLICY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateSlaPolicyPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id, rules, ...policyData } = command.payload;

    // Update the policy fields
    await tx.slaPolicy.update({
      where: { id },
      data: policyData,
    });

    // Replace rules if provided
    if (rules) {
      await tx.slaRule.deleteMany({ where: { policyId: id } });
      for (const rule of rules) {
        await tx.slaRule.create({
          data: { ...rule, policyId: id },
        });
      }
    }

    const updated = await tx.slaPolicy.findUniqueOrThrow({
      where: { id },
      include: { rules: true },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SLA_POLICY_UPDATED,
      entityType: 'sla_policy',
      entityId: id,
      payload: {
        name: updated.name,
        customerId: updated.customerId,
        ruleCount: updated.rules.length,
      },
    }));

    return { id };
  }
}
