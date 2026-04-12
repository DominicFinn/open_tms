import { PrismaClient } from '@prisma/client';
import { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import { BaseCommandHandler, TransactionClient, EmitFn } from '../BaseCommandHandler.js';
import { Command } from '../types.js';

export interface DeleteCarrierTrackingIntegrationPayload {
  id: string;
}

export const DELETE_CARRIER_TRACKING_INTEGRATION = 'carrier_tracking_integration.delete';

export class DeleteCarrierTrackingIntegrationCommandHandler extends BaseCommandHandler<
  DeleteCarrierTrackingIntegrationPayload,
  { id: string }
> {
  readonly commandType = DELETE_CARRIER_TRACKING_INTEGRATION;

  constructor(prisma: PrismaClient, eventBus: PgBossEventBus) {
    super(prisma, eventBus);
  }

  protected async handle(
    command: Command<DeleteCarrierTrackingIntegrationPayload>,
    tx: TransactionClient,
    emit: EmitFn,
  ): Promise<{ id: string }> {
    const { id } = command.payload;

    const integration = await tx.carrierTrackingIntegration.findUniqueOrThrow({ where: { id } });

    // Delete related tracking events first
    await tx.carrierTrackingEvent.deleteMany({ where: { integrationId: id } });

    // Delete the integration
    await tx.carrierTrackingIntegration.delete({ where: { id } });

    emit(this.createEvent(command, {
      type: EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_DELETED,
      entityType: 'carrier_tracking_integration',
      entityId: id,
      payload: {
        carrierId: integration.carrierId,
        providerType: integration.providerType,
      },
    }));

    return { id };
  }
}
