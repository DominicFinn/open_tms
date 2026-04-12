/**
 * DeactivateSlaPolicyCommand — soft-deactivates an SLA policy.
 *
 * Sets active = false. Existing SLA evaluations in progress are NOT
 * cancelled — they continue to be tracked until met or breached.
 * New evaluations won't be created against this policy.
 */

import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeactivateSlaPolicyPayload {
  id: string;
}

export const DEACTIVATE_SLA_POLICY = 'sla_policy.deactivate';

export class DeactivateSlaPolicyCommandHandler extends BaseCommandHandler<DeactivateSlaPolicyPayload, { id: string }> {
  readonly commandType = DEACTIVATE_SLA_POLICY;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeactivateSlaPolicyPayload>,
    tx: TransactionClient,
    emit: EmitFn
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const policy = await tx.slaPolicy.update({
      where: { id },
      data: { active: false },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.SLA_POLICY_DEACTIVATED,
      entityType: 'sla_policy',
      entityId: id,
      payload: {
        name: policy.name,
        customerId: policy.customerId,
      },
    }));

    return { id };
  }
}
