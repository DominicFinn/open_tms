import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface UpdateCarrierTrackingIntegrationPayload {
  id: string;
  providerType?: string;
  status?: string;
  credentials?: Record<string, unknown>;
  webhookEnabled?: boolean;
  webhookSecret?: string;
  webhookEndpointId?: string;
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  rateLimitDailyMax?: number;
  notes?: string;
}

export const UPDATE_CARRIER_TRACKING_INTEGRATION = 'carrier_tracking_integration.update';

export class UpdateCarrierTrackingIntegrationCommandHandler extends BaseCommandHandler<
  UpdateCarrierTrackingIntegrationPayload,
  { id: string }
> {
  readonly commandType = UPDATE_CARRIER_TRACKING_INTEGRATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<UpdateCarrierTrackingIntegrationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string }> {
    const { id, ...updateData } = command.payload;

    const before = await tx.carrierTrackingIntegration.findUniqueOrThrow({ where: { id } });

    const updated = await tx.carrierTrackingIntegration.update({
      where: { id },
      data: updateData as Record<string, unknown>,
    });

    // Build a changes object for the event payload
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(updateData) as (keyof typeof updateData)[]) {
      const beforeVal = (before as Record<string, unknown>)[key];
      const afterVal = (updated as Record<string, unknown>)[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes[key] = { before: beforeVal, after: afterVal };
      }
    }

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_UPDATED,
      entityType: 'carrier_tracking_integration',
      entityId: updated.id,
      payload: {
        carrierId: updated.carrierId,
        providerType: updated.providerType,
        changes,
      },
    }));

    return { id: updated.id };
  }
}
