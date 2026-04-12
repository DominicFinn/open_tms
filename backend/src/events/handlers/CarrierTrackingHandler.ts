/**
 * CarrierTrackingHandler -- reacts to carrier tracking domain events.
 *
 * - CARRIER_TRACKING_DELIVERED: logs for now; shipment status bridging in Phase 5
 * - CARRIER_TRACKING_EXCEPTION: logs for now; triage issue creation in Phase 5
 * - CARRIER_TRACKING_INTEGRATION_ERROR: updates integration status to 'error'
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';

export class CarrierTrackingHandler implements IEventHandler {
  readonly name = 'carrier_tracking.handler';
  readonly eventPatterns = [
    EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
    EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
    EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_ERROR,
  ];
  readonly options = { concurrency: 3, retryLimit: 2, expireInSeconds: 60 };

  constructor(private prisma: PrismaClient) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.type) {
        case EVENT_TYPES.CARRIER_TRACKING_DELIVERED:
          await this.handleDelivered(event);
          break;
        case EVENT_TYPES.CARRIER_TRACKING_EXCEPTION:
          await this.handleException(event);
          break;
        case EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_ERROR:
          await this.handleIntegrationError(event);
          break;
      }
    } catch (err) {
      console.error(`[CarrierTrackingHandler] Error processing ${event.type}:`, (err as Error).message);
    }
  }

  private async handleDelivered(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      shipmentId?: string;
      carrierId?: string;
      trackingNumber?: string;
      providerType?: string;
      occurredAt?: string;
      signedBy?: string;
    };

    // Phase 5: bridge to shipment status update
    // For now, log the delivery event for observability
    console.log(
      `[CarrierTrackingHandler] Carrier tracking delivered: ` +
      `shipment=${payload.shipmentId}, tracking=${payload.trackingNumber}, ` +
      `provider=${payload.providerType}, signedBy=${payload.signedBy ?? 'N/A'}`
    );
  }

  private async handleException(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      shipmentId?: string;
      carrierId?: string;
      trackingNumber?: string;
      providerType?: string;
      statusDetail?: string;
      occurredAt?: string;
    };

    // Phase 5: create a triage issue for carrier tracking exceptions
    // For now, log the exception event for observability
    console.log(
      `[CarrierTrackingHandler] Carrier tracking exception: ` +
      `shipment=${payload.shipmentId}, tracking=${payload.trackingNumber}, ` +
      `provider=${payload.providerType}, detail=${payload.statusDetail ?? 'N/A'}`
    );
  }

  private async handleIntegrationError(event: DomainEvent): Promise<void> {
    const integrationId = event.entityId;
    if (!integrationId) return;

    const payload = event.payload as {
      error?: string;
      retryable?: boolean;
    };

    console.log(
      `[CarrierTrackingHandler] Integration error: ` +
      `integrationId=${integrationId}, error=${payload.error ?? 'unknown'}, ` +
      `retryable=${payload.retryable ?? false}`
    );

    // Update integration status to 'error' so polling stops until manually re-enabled
    try {
      await this.prisma.carrierTrackingIntegration.update({
        where: { id: integrationId },
        data: { status: 'error' },
      });
    } catch (err) {
      console.error(
        `[CarrierTrackingHandler] Failed to update integration status to error: ${(err as Error).message}`
      );
    }
  }
}
