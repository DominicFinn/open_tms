import { Prisma, PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface CreateCarrierTrackingIntegrationPayload {
  carrierId: string;
  providerType: string;
  status?: string;
  credentials?: Record<string, unknown>;
  webhookEnabled?: boolean;
  webhookSecret?: string;
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  rateLimitDailyMax?: number;
  notes?: string;
}

export const CREATE_CARRIER_TRACKING_INTEGRATION = 'carrier_tracking_integration.create';

export class CreateCarrierTrackingIntegrationCommandHandler extends BaseCommandHandler<
  CreateCarrierTrackingIntegrationPayload,
  { id: string; carrierId: string; providerType: string }
> {
  readonly commandType = CREATE_CARRIER_TRACKING_INTEGRATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<CreateCarrierTrackingIntegrationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string; carrierId: string; providerType: string }> {
    const { carrierId, providerType, ...rest } = command.payload;

    const integration = await tx.carrierTrackingIntegration.create({
      data: {
        carrierId,
        providerType,
        status: rest.status ?? 'pending_setup',
        credentials: rest.credentials ? (rest.credentials as Prisma.InputJsonValue) : undefined,
        webhookEnabled: rest.webhookEnabled ?? false,
        webhookSecret: rest.webhookSecret ?? undefined,
        pollingEnabled: rest.pollingEnabled ?? false,
        pollingIntervalSeconds: rest.pollingIntervalSeconds ?? 900,
        rateLimitDailyMax: rest.rateLimitDailyMax ?? undefined,
        notes: rest.notes ?? undefined,
      },
    });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_CREATED,
      entityType: 'carrier_tracking_integration',
      entityId: integration.id,
      payload: {
        carrierId: integration.carrierId,
        providerType: integration.providerType,
        pollingEnabled: integration.pollingEnabled,
        webhookEnabled: integration.webhookEnabled,
      },
    }));

    return {
      id: integration.id,
      carrierId: integration.carrierId,
      providerType: integration.providerType,
    };
  }
}
