/**
 * CarrierTrackingHandler -- reacts to carrier tracking domain events.
 *
 * - CARRIER_TRACKING_DELIVERED: bridges to shipment status (marks delivered)
 * - CARRIER_TRACKING_EXCEPTION: bridges to shipment exception + creates issue
 * - CARRIER_TRACKING_INTEGRATION_ERROR: updates integration status to 'error'
 * - CARRIER_TRACKING_UPDATE_RECEIVED: updates shipment status for in-transit milestones
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { IEventBus } from '../IEventBus.js';
import { createEvent } from '../createEvent.js';

export class CarrierTrackingHandler implements IEventHandler {
  readonly name = 'carrier_tracking.handler';
  readonly eventPatterns = [
    EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
    EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
    EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_ERROR,
    EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED,
  ];
  readonly options = { concurrency: 3, retryLimit: 2, expireInSeconds: 60 };

  constructor(
    private prisma: PrismaClient,
    private eventBus: IEventBus,
  ) {}

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
        case EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED:
          await this.handleTrackingUpdate(event);
          break;
      }
    } catch (err) {
      console.error(`[CarrierTrackingHandler] Error processing ${event.type}:`, (err as Error).message);
    }
  }

  /**
   * When a carrier confirms delivery, update the shipment status to 'delivered'.
   */
  private async handleDelivered(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      shipmentId?: string;
      carrierId?: string;
      trackingNumber?: string;
      providerType?: string;
      occurredAt?: string;
      signedBy?: string;
    };

    const shipmentId = payload.shipmentId;
    if (!shipmentId) return;

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, reference: true, status: true },
    });

    if (!shipment) return;

    // Only transition if shipment is still actively in progress
    if (!['in_progress'].includes(shipment.status)) {
      console.log(
        `[CarrierTrackingHandler] Skipping delivery bridge for ${shipmentId} — status is "${shipment.status}"`
      );
      return;
    }

    const previousStatus = shipment.status;

    // Update shipment to complete
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: 'complete',
        deliveryDate: payload.occurredAt ? new Date(payload.occurredAt) : new Date(),
      },
    });

    console.log(
      `[CarrierTrackingHandler] Shipment ${shipment.reference} marked delivered via ${payload.providerType} ` +
      `(tracking: ${payload.trackingNumber}, signedBy: ${payload.signedBy ?? 'N/A'})`
    );

    // Emit SHIPMENT_DELIVERED event
    const deliveredEvent = createEvent({
      type: EVENT_TYPES.SHIPMENT_DELIVERED,
      orgId: event.orgId,
      actorId: 'system',
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        shipmentReference: shipment.reference,
        deliveredAt: (payload.occurredAt ?? new Date().toISOString()),
        source: 'carrier_tracking',
        providerType: payload.providerType,
        trackingNumber: payload.trackingNumber,
        signedBy: payload.signedBy,
      },
      source: 'carrier_tracking_handler',
    });

    await this.eventBus.publish(deliveredEvent);

    // Emit SHIPMENT_STATUS_CHANGED event for consistency
    const statusEvent = createEvent({
      type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
      orgId: event.orgId,
      actorId: 'system',
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        previousStatus,
        newStatus: 'complete',
        shipmentReference: shipment.reference,
        source: 'carrier_tracking',
      },
      source: 'carrier_tracking_handler',
    });

    await this.eventBus.publish(statusEvent);
  }

  /**
   * When a carrier reports an exception, create a shipment exception event
   * and auto-create a triage issue.
   */
  private async handleException(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      shipmentId?: string;
      carrierId?: string;
      trackingNumber?: string;
      providerType?: string;
      statusDetail?: string;
      occurredAt?: string;
    };

    const shipmentId = payload.shipmentId;
    if (!shipmentId) return;

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, reference: true, status: true, carrierId: true },
    });

    if (!shipment) return;

    // Don't re-raise exception on already-completed shipments
    if (shipment.status === 'complete') {
      console.log(
        `[CarrierTrackingHandler] Skipping exception bridge for completed shipment ${shipmentId}`
      );
      return;
    }

    console.log(
      `[CarrierTrackingHandler] Carrier tracking exception: ` +
      `shipment=${shipment.reference}, tracking=${payload.trackingNumber}, ` +
      `provider=${payload.providerType}, detail=${payload.statusDetail ?? 'N/A'}`
    );

    // Emit SHIPMENT_EXCEPTION event so the triage agent and notification systems pick it up
    const exceptionEvent = createEvent({
      type: EVENT_TYPES.SHIPMENT_EXCEPTION,
      orgId: event.orgId,
      actorId: 'system',
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        shipmentReference: shipment.reference,
        exceptionType: 'carrier_exception',
        reason: payload.statusDetail ?? 'Carrier reported an exception',
        source: 'carrier_tracking',
        providerType: payload.providerType,
        trackingNumber: payload.trackingNumber,
        occurredAt: payload.occurredAt,
      },
      source: 'carrier_tracking_handler',
    });

    await this.eventBus.publish(exceptionEvent);

    // Exceptions are orthogonal to the lifecycle status — flag the shipment
    // instead of clobbering its draft/ready/in_progress/complete state. The
    // SHIPMENT_EXCEPTION event above drives triage, notifications, and the
    // read-model flag via ShipmentProjection.onShipmentException.
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { hasException: true },
    });
  }

  /**
   * When an integration reports an error, update its status to 'error'
   * so polling stops until manually re-enabled.
   */
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

  /**
   * When a tracking update is received (any status), bridge to shipment status
   * for in-transit milestones (picked_up, in_transit, out_for_delivery).
   */
  private async handleTrackingUpdate(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      shipmentId?: string;
      status?: string;
      trackingNumber?: string;
      providerType?: string;
    };

    const shipmentId = payload.shipmentId;
    if (!shipmentId || !payload.status) return;

    // Only process milestone statuses that should update shipment status.
    // Delivered and exception are handled by their dedicated handlers.
    // Carrier milestones map onto the canonical lifecycle.
    const milestoneMap: Record<string, string> = {
      'info_received': 'draft',
      'in_transit': 'in_progress',
      'out_for_delivery': 'in_progress',
    };

    const targetStatus = milestoneMap[payload.status];
    if (!targetStatus) return;

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, reference: true, status: true },
    });

    if (!shipment) return;

    // Only advance status forward, never backwards
    const statusOrder = ['draft', 'ready', 'in_progress', 'complete'];
    const currentIdx = statusOrder.indexOf(shipment.status);
    const targetIdx = statusOrder.indexOf(targetStatus);

    // Don't regress status (e.g., don't go from in_progress back to draft)
    if (currentIdx >= targetIdx) return;

    const previousStatus = shipment.status;
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: targetStatus },
    });

    console.log(
      `[CarrierTrackingHandler] Shipment ${shipment.reference} status updated: ` +
      `${previousStatus} -> ${targetStatus} (via ${payload.providerType} tracking)`
    );

    const statusEvent = createEvent({
      type: EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
      orgId: event.orgId,
      actorId: 'system',
      entityType: 'shipment',
      entityId: shipmentId,
      payload: {
        previousStatus,
        newStatus: targetStatus,
        shipmentReference: shipment.reference,
        source: 'carrier_tracking',
      },
      source: 'carrier_tracking_handler',
    });

    await this.eventBus.publish(statusEvent);
  }
}
