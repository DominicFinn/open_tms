/**
 * CarrierTrackingService -- orchestrator for carrier tracking operations.
 *
 * Coordinates between the provider registry, database, and event bus to:
 * - Poll carriers for tracking updates
 * - Process incoming webhooks
 * - Test integration connections
 */

import { PrismaClient } from '@prisma/client';
import type { PgBossEventBus } from '../../events/PgBossEventBus.js';
import { createEvent } from '../../events/createEvent.js';
import { openCredentials } from '../../security/secretVault.js';
import { EVENT_TYPES } from '../../events/eventTypes.js';
import type { CarrierTrackingProviderRegistry } from './ProviderRegistry.js';
import type { NormalizedTrackingStatus, TrackingPollResult } from './ICarrierTrackingProvider.js';
import { CarrierTrackingError } from './ICarrierTrackingProvider.js';

export class CarrierTrackingService {
  constructor(
    private prisma: PrismaClient,
    private eventBus: PgBossEventBus,
    private providerRegistry: CarrierTrackingProviderRegistry,
  ) {}

  /**
   * Poll a specific integration for tracking updates.
   * Finds all in-transit shipments for the integration's carrier,
   * polls the provider, and writes CarrierTrackingEvent records.
   */
  async pollForUpdates(integrationId: string): Promise<{ polled: number; eventsCreated: number }> {
    const integration = await this.prisma.carrierTrackingIntegration.findUnique({
      where: { id: integrationId },
      include: { carrier: true },
    });

    if (!integration) {
      throw new Error(`Carrier tracking integration not found: ${integrationId}`);
    }

    if (integration.status !== 'active') {
      throw new Error(`Integration ${integrationId} is not active (status: ${integration.status})`);
    }

    // Check rate limits
    if (integration.rateLimitDailyMax && integration.rateLimitCallsToday >= integration.rateLimitDailyMax) {
      console.warn(
        `[CarrierTrackingService] Rate limit reached for integration ${integrationId} ` +
        `(${integration.rateLimitCallsToday}/${integration.rateLimitDailyMax})`
      );
      return { polled: 0, eventsCreated: 0 };
    }

    // Get the provider
    const provider = this.providerRegistry.create(integration.providerType);

    // Authenticate
    try {
      const credentials = openCredentials(integration.credentials);
      await provider.authenticate(credentials);
    } catch (err) {
      await this.recordIntegrationError(integrationId, err);
      throw err;
    }

    // Find actively in-progress shipments for this carrier that have tracking
    // numbers. (Uses the canonical lifecycle status; the old in_transit/
    // dispatched/picked_up values were retired in the lifecycle change.)
    const shipments = await this.prisma.shipment.findMany({
      where: {
        carrierId: integration.carrierId,
        status: { in: ['in_progress'] },
        trackingNumber: { not: null },
        deletedAt: null,
      },
      select: { id: true, trackingNumber: true, reference: true },
    });

    if (shipments.length === 0) {
      await this.prisma.carrierTrackingIntegration.update({
        where: { id: integrationId },
        data: { lastPolledAt: new Date() },
      });
      return { polled: 0, eventsCreated: 0 };
    }

    // Batch tracking numbers by provider max batch size
    const trackingNumbers = shipments
      .filter((s) => s.trackingNumber)
      .map((s) => s.trackingNumber as string);

    const batches: string[][] = [];
    for (let i = 0; i < trackingNumbers.length; i += provider.maxBatchSize) {
      batches.push(trackingNumbers.slice(i, i + provider.maxBatchSize));
    }

    let totalEventsCreated = 0;

    for (const batch of batches) {
      let results: TrackingPollResult[];
      try {
        results = await provider.pollTracking({ trackingNumbers: batch });
      } catch (err) {
        await this.recordIntegrationError(integrationId, err);
        throw err;
      }

      // Increment rate limit counter
      await this.prisma.carrierTrackingIntegration.update({
        where: { id: integrationId },
        data: { rateLimitCallsToday: { increment: 1 } },
      });

      // Process results
      for (const result of results) {
        if (!result.success || !result.events.length) continue;

        const shipment = shipments.find((s) => s.trackingNumber === result.trackingNumber);
        if (!shipment) continue;

        for (const trackingEvent of result.events) {
          const created = await this.writeTrackingEvent(
            shipment.id,
            integration.carrierId,
            integrationId,
            integration.providerType,
            result.trackingNumber,
            trackingEvent,
            'poll',
          );
          if (created) totalEventsCreated++;
        }
      }
    }

    // Update last polled timestamp and clear errors on success
    await this.prisma.carrierTrackingIntegration.update({
      where: { id: integrationId },
      data: {
        lastPolledAt: new Date(),
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    });

    return { polled: trackingNumbers.length, eventsCreated: totalEventsCreated };
  }

  /**
   * Process an incoming webhook from a carrier tracking provider.
   */
  async processWebhook(
    providerType: string,
    payload: unknown,
    headers: Record<string, string>,
  ): Promise<{ eventsCreated: number }> {
    const provider = this.providerRegistry.create(providerType);

    if (!provider.parseWebhook) {
      throw new Error(`Provider "${providerType}" does not support webhooks`);
    }

    const webhookResults = await provider.parseWebhook(payload, headers);
    let eventsCreated = 0;

    for (const result of webhookResults) {
      // Find the integration and shipment for this tracking number
      const shipment = await this.prisma.shipment.findFirst({
        where: { trackingNumber: result.trackingNumber },
        select: { id: true, carrierId: true },
      });

      if (!shipment || !shipment.carrierId) continue;

      const integration = await this.prisma.carrierTrackingIntegration.findFirst({
        where: {
          carrierId: shipment.carrierId,
          providerType: providerType.toLowerCase(),
          status: 'active',
          webhookEnabled: true,
        },
      });

      if (!integration) continue;

      for (const trackingEvent of result.events) {
        const created = await this.writeTrackingEvent(
          shipment.id,
          shipment.carrierId,
          integration.id,
          providerType,
          result.trackingNumber,
          trackingEvent,
          'webhook',
        );
        if (created) eventsCreated++;
      }
    }

    return { eventsCreated };
  }

  /**
   * Test a connection by authenticating and optionally polling a single tracking number.
   */
  async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    const integration = await this.prisma.carrierTrackingIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return { success: false, message: 'Integration not found' };
    }

    const provider = this.providerRegistry.create(integration.providerType);
    const credentials = openCredentials(integration.credentials);

    try {
      await provider.authenticate(credentials);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Authentication failed: ${message}` };
    }

    // Try a test poll if provider supports polling
    if (provider.supportsPolling) {
      try {
        // Poll with a known-good test number if available, otherwise just verify auth worked
        await provider.pollTracking({ trackingNumbers: ['TEST_CONNECTION_PROBE'] });
      } catch (err) {
        // A "not found" error is acceptable for a test probe -- it means auth worked
        if (err instanceof CarrierTrackingError && err.statusCode === 404) {
          return { success: true, message: 'Authentication successful, API reachable' };
        }
        // Other errors may also be fine -- auth passed, so connection is valid
      }
    }

    return { success: true, message: 'Authentication successful' };
  }

  /**
   * Write a single CarrierTrackingEvent record and emit domain events.
   * Returns true if a new record was created, false if it was a duplicate.
   */
  private async writeTrackingEvent(
    shipmentId: string,
    carrierId: string,
    integrationId: string,
    providerType: string,
    trackingNumber: string,
    trackingStatus: NormalizedTrackingStatus,
    source: string,
  ): Promise<boolean> {
    // Deduplicate: skip if we already have an event with the same tracking number,
    // status, and occurredAt timestamp
    const existing = await this.prisma.carrierTrackingEvent.findFirst({
      where: {
        trackingNumber,
        status: trackingStatus.status,
        occurredAt: trackingStatus.occurredAt,
        integrationId,
      },
    });

    if (existing) return false;

    const event = await this.prisma.carrierTrackingEvent.create({
      data: {
        shipmentId,
        carrierId,
        integrationId,
        providerType,
        trackingNumber,
        status: trackingStatus.status,
        statusDetail: trackingStatus.statusDetail ?? null,
        statusCode: trackingStatus.statusCode ?? null,
        city: trackingStatus.city ?? null,
        state: trackingStatus.state ?? null,
        country: trackingStatus.country ?? null,
        postalCode: trackingStatus.postalCode ?? null,
        lat: trackingStatus.lat ?? null,
        lng: trackingStatus.lng ?? null,
        occurredAt: trackingStatus.occurredAt,
        estimatedDelivery: trackingStatus.estimatedDelivery ?? null,
        signedBy: trackingStatus.signedBy ?? null,
        source,
      },
    });

    // Emit domain event: tracking update received
    const orgResult = await this.prisma.organization.findFirst({ select: { id: true } });
    const orgId = orgResult?.id ?? 'system';

    const domainEvent = createEvent({
      type: EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED,
      orgId,
      entityType: 'carrier_tracking_event',
      entityId: event.id,
      payload: {
        shipmentId,
        carrierId,
        trackingNumber,
        status: trackingStatus.status,
        statusDetail: trackingStatus.statusDetail,
        providerType,
        source,
        occurredAt: trackingStatus.occurredAt.toISOString(),
      },
      source: 'carrier_tracking',
    });

    try {
      await this.eventBus.publish(domainEvent);
    } catch (err) {
      console.error(
        `[CarrierTrackingService] Failed to emit tracking update event: ${(err as Error).message}`
      );
    }

    // Emit additional events based on status
    if (trackingStatus.status === 'delivered') {
      await this.emitStatusEvent(
        EVENT_TYPES.CARRIER_TRACKING_DELIVERED,
        orgId,
        event.id,
        shipmentId,
        carrierId,
        trackingNumber,
        providerType,
        trackingStatus,
      );
    } else if (trackingStatus.status === 'exception') {
      await this.emitStatusEvent(
        EVENT_TYPES.CARRIER_TRACKING_EXCEPTION,
        orgId,
        event.id,
        shipmentId,
        carrierId,
        trackingNumber,
        providerType,
        trackingStatus,
      );
    }

    return true;
  }

  private async emitStatusEvent(
    eventType: string,
    orgId: string,
    eventId: string,
    shipmentId: string,
    carrierId: string,
    trackingNumber: string,
    providerType: string,
    trackingStatus: NormalizedTrackingStatus,
  ): Promise<void> {
    const domainEvent = createEvent({
      type: eventType,
      orgId,
      entityType: 'carrier_tracking_event',
      entityId: eventId,
      payload: {
        shipmentId,
        carrierId,
        trackingNumber,
        status: trackingStatus.status,
        statusDetail: trackingStatus.statusDetail,
        providerType,
        occurredAt: trackingStatus.occurredAt.toISOString(),
        signedBy: trackingStatus.signedBy,
        estimatedDelivery: trackingStatus.estimatedDelivery?.toISOString(),
      },
      source: 'carrier_tracking',
    });

    try {
      await this.eventBus.publish(domainEvent);
    } catch (err) {
      console.error(
        `[CarrierTrackingService] Failed to emit ${eventType} event: ${(err as Error).message}`
      );
    }
  }

  private async recordIntegrationError(integrationId: string, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    await this.prisma.carrierTrackingIntegration.update({
      where: { id: integrationId },
      data: {
        lastErrorMessage: message,
        lastErrorAt: new Date(),
      },
    });

    // Emit error event
    try {
      const orgResult = await this.prisma.organization.findFirst({ select: { id: true } });
      const orgId = orgResult?.id ?? 'system';

      const domainEvent = createEvent({
        type: EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_ERROR,
        orgId,
        entityType: 'carrier_tracking_integration',
        entityId: integrationId,
        payload: { error: message, retryable: err instanceof CarrierTrackingError && err.retryable },
        source: 'carrier_tracking',
      });

      await this.eventBus.publish(domainEvent);
    } catch (eventErr) {
      console.error(
        `[CarrierTrackingService] Failed to emit error event: ${(eventErr as Error).message}`
      );
    }
  }
}
