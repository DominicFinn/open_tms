/**
 * ShipmentEtaMonitorService — the core cron-driven ETA monitoring engine.
 *
 * Runs periodically via pg-boss schedule. For each in-transit shipment:
 *  1. Gets current GPS position (from ShipmentReadModel)
 *  2. Gets remaining stops
 *  3. Calls the routing provider for traffic-aware ETA
 *  4. Compares new ETA vs scheduled estimatedArrival
 *  5. Publishes tracking.eta_updated events on significant changes
 *  6. Detects route deviations and raises shipment.exception events
 *
 * Uses adaptive polling: checks more frequently as shipments approach ETA.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { IRoutingProvider, RouteResult, RoutingError } from './IRoutingProvider.js';
import { IEventBus } from '../../events/IEventBus.js';
import { DomainEvent } from '../../events/DomainEvent.js';
import { EVENT_TYPES, EVENT_SCHEMA_VERSIONS } from '../../events/eventTypes.js';

/** Configurable thresholds for the monitor */
export interface EtaMonitorConfig {
  /** Minimum delay (minutes) before raising an alert. Default: 15 */
  delayThresholdMinutes: number;
  /** Delay (minutes) for a warning-severity alert. Default: 30 */
  warningThresholdMinutes: number;
  /** Delay (minutes) for an error-severity alert. Default: 60 */
  criticalThresholdMinutes: number;
  /** Maximum distance from planned route (meters) before flagging a deviation. Default: 5000 */
  routeDeviationMeters: number;
  /** Skip shipments with no GPS update older than this (minutes). Default: 60 */
  staleGpsThresholdMinutes: number;
}

const DEFAULT_CONFIG: EtaMonitorConfig = {
  delayThresholdMinutes: 15,
  warningThresholdMinutes: 30,
  criticalThresholdMinutes: 60,
  routeDeviationMeters: 5000,
  staleGpsThresholdMinutes: 60,
};

/** Result of checking a single shipment's ETA */
export interface EtaCheckResult {
  shipmentId: string;
  shipmentReference: string;
  orgId: string;
  status: 'on_time' | 'minor_delay' | 'warning' | 'critical' | 'skipped' | 'error';
  previousEta?: string;
  newEta?: string;
  delayMinutes?: number;
  nextStopId?: string;
  nextStopName?: string;
  errorMessage?: string;
}

/** Summary of a full monitor run */
export interface EtaMonitorRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  shipmentsChecked: number;
  shipmentsSkipped: number;
  delaysDetected: number;
  errorsEncountered: number;
  results: EtaCheckResult[];
}

export interface IShipmentEtaMonitorService {
  /** Run a full ETA check cycle across all in-transit shipments */
  runEtaCheck(): Promise<EtaMonitorRunResult>;
  /** Check ETA for a single shipment (manual trigger) */
  checkSingleShipment(shipmentId: string): Promise<EtaCheckResult>;
}

export class ShipmentEtaMonitorService implements IShipmentEtaMonitorService {
  private config: EtaMonitorConfig;

  constructor(
    private prisma: PrismaClient,
    private routingProvider: IRoutingProvider,
    private eventBus: IEventBus,
    config?: Partial<EtaMonitorConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async runEtaCheck(): Promise<EtaMonitorRunResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    console.log(`[EtaMonitor] Run ${runId} starting — provider: ${this.routingProvider.name}`);

    // Find all in-transit shipments with GPS data
    const shipments = await this.findInTransitShipments();
    console.log(`[EtaMonitor] Found ${shipments.length} in-transit shipments to check`);

    const results: EtaCheckResult[] = [];
    let delaysDetected = 0;
    let errorsEncountered = 0;
    let skipped = 0;

    for (const shipment of shipments) {
      // Adaptive polling: determine if this shipment needs checking now
      if (!this.shouldCheckNow(shipment)) {
        skipped++;
        results.push({
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          orgId: shipment.orgId,
          status: 'skipped',
        });
        continue;
      }

      try {
        const result = await this.evaluateShipmentEta(shipment);
        results.push(result);

        if (result.status === 'warning' || result.status === 'critical') {
          delaysDetected++;
        }
        if (result.status === 'error') {
          errorsEncountered++;
        }
      } catch (err) {
        errorsEncountered++;
        results.push({
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          orgId: shipment.orgId,
          status: 'error',
          errorMessage: (err as Error).message,
        });
      }
    }

    const completedAt = new Date().toISOString();
    console.log(
      `[EtaMonitor] Run ${runId} completed — checked: ${shipments.length - skipped}, ` +
      `skipped: ${skipped}, delays: ${delaysDetected}, errors: ${errorsEncountered}`,
    );

    return {
      runId,
      startedAt,
      completedAt,
      shipmentsChecked: shipments.length - skipped,
      shipmentsSkipped: skipped,
      delaysDetected,
      errorsEncountered,
      results,
    };
  }

  async checkSingleShipment(shipmentId: string): Promise<EtaCheckResult> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        stops: { include: { location: true }, orderBy: { sequenceNumber: 'asc' } },
      },
    });

    if (!shipment) {
      return {
        shipmentId,
        shipmentReference: 'unknown',
        orgId: 'unknown',
        status: 'error',
        errorMessage: 'Shipment not found',
      };
    }

    // Get latest GPS position from read model
    const readModel = await this.prisma.shipmentReadModel.findFirst({
      where: { id: shipmentId },
    });

    const enriched = {
      ...shipment,
      currentLat: readModel?.currentLat ?? null,
      currentLng: readModel?.currentLng ?? null,
      lastLocationAt: readModel?.lastLocationAt ?? null,
    };

    return this.evaluateShipmentEta(enriched);
  }

  /** Find in-transit shipments with their locations and stops */
  private async findInTransitShipments() {
    // Get shipments that are in-transit (not draft, not delivered, not archived)
    const inTransitStatuses = ['in_transit', 'dispatched', 'picked_up', 'at_stop'];

    const shipments = await this.prisma.shipment.findMany({
      where: {
        status: { in: inTransitStatuses },
        archived: false,
      },
      include: {
        origin: true,
        destination: true,
        stops: {
          include: { location: true },
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    // Enrich with current GPS from read model
    const shipmentIds = shipments.map((s: any) => s.id);
    const readModels = await this.prisma.shipmentReadModel.findMany({
      where: { id: { in: shipmentIds } },
      select: { id: true, currentLat: true, currentLng: true, lastLocationAt: true },
    });

    const readModelMap = new Map(readModels.map((rm: any) => [rm.id, rm]));

    return shipments.map((s: any) => {
      const rm = readModelMap.get(s.id) as any;
      return {
        ...s,
        currentLat: rm?.currentLat ?? null,
        currentLng: rm?.currentLng ?? null,
        lastLocationAt: rm?.lastLocationAt ?? null,
      };
    });
  }

  /**
   * Adaptive polling: skip shipments that don't need checking right now.
   *
   * Strategy:
   * - No GPS data at all → skip (can't calculate route without position)
   * - GPS older than staleGpsThreshold → skip (truck probably parked/resting)
   * - Next stop >8 hours away → check every 4th run (~every 40 min with 10-min cron)
   * - Next stop 2-8 hours away → check every 2nd run (~every 20 min)
   * - Next stop <2 hours away → check every run
   */
  private shouldCheckNow(shipment: any): boolean {
    // No GPS position → skip
    if (!shipment.currentLat || !shipment.currentLng) {
      return false;
    }

    // Stale GPS → skip (truck probably parked)
    if (shipment.lastLocationAt) {
      const minutesSinceGps = (Date.now() - new Date(shipment.lastLocationAt).getTime()) / 60000;
      if (minutesSinceGps > this.config.staleGpsThresholdMinutes) {
        return false;
      }
    }

    // Find next pending stop's ETA for adaptive frequency
    const nextStop = this.findNextPendingStop(shipment);
    if (nextStop?.estimatedArrival) {
      const hoursToStop = (new Date(nextStop.estimatedArrival).getTime() - Date.now()) / 3600000;

      if (hoursToStop > 8) {
        // Far away: only check 1 in 4 runs (use minute-of-hour as cheap hash)
        return new Date().getMinutes() % 40 < 10;
      }
      if (hoursToStop > 2) {
        // Moderate distance: check every other run
        return new Date().getMinutes() % 20 < 10;
      }
    }

    // Close to delivery or no ETA data → always check
    return true;
  }

  /** Core ETA evaluation for a single shipment */
  private async evaluateShipmentEta(shipment: any): Promise<EtaCheckResult> {
    const nextStop = this.findNextPendingStop(shipment);

    // If no pending stops, use destination
    const targetLocation = nextStop?.location || shipment.destination;
    const targetLat = targetLocation?.lat;
    const targetLng = targetLocation?.lng;

    if (!targetLat || !targetLng) {
      return {
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        orgId: shipment.orgId,
        status: 'skipped',
        errorMessage: 'No target location coordinates',
      };
    }

    if (!shipment.currentLat || !shipment.currentLng) {
      return {
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        orgId: shipment.orgId,
        status: 'skipped',
        errorMessage: 'No current GPS position',
      };
    }

    // Calculate route
    let routeResult: RouteResult;
    try {
      routeResult = await this.routingProvider.computeRoute({
        origin: { lat: shipment.currentLat, lng: shipment.currentLng },
        destination: { lat: targetLat, lng: targetLng },
        trafficAware: true,
      });
    } catch (err) {
      if (err instanceof RoutingError && err.retryable) {
        console.warn(`[EtaMonitor] Retryable routing error for ${shipment.reference}: ${err.message}`);
      }
      return {
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        orgId: shipment.orgId,
        status: 'error',
        errorMessage: `Routing error: ${(err as Error).message}`,
      };
    }

    // Compare new ETA against scheduled arrival
    const scheduledArrival = nextStop?.estimatedArrival || shipment.deliveryDate;
    const newEta = routeResult.estimatedArrival;
    let delayMinutes = 0;
    let severity: string = 'on_time';

    if (scheduledArrival) {
      const scheduledTime = new Date(scheduledArrival).getTime();
      const newEtaTime = new Date(newEta).getTime();
      delayMinutes = Math.round((newEtaTime - scheduledTime) / 60000);

      if (delayMinutes >= this.config.criticalThresholdMinutes) {
        severity = 'critical';
      } else if (delayMinutes >= this.config.warningThresholdMinutes) {
        severity = 'warning';
      } else if (delayMinutes >= this.config.delayThresholdMinutes) {
        severity = 'minor_delay';
      }
    }

    // Update the stop's estimated arrival with the routing-based ETA
    if (nextStop) {
      await this.prisma.shipmentStop.update({
        where: { id: nextStop.id },
        data: { estimatedArrival: new Date(newEta) },
      });
    }

    // Publish events for delays
    if (severity !== 'on_time' && severity !== 'skipped') {
      await this.publishEtaUpdatedEvent(shipment, {
        previousEta: scheduledArrival ? new Date(scheduledArrival).toISOString() : undefined,
        newEta,
        delayMinutes,
        severity,
        nextStopId: nextStop?.id,
        nextStopName: nextStop?.location?.name || targetLocation?.name,
        trafficDelaySeconds: routeResult.trafficDelaySeconds,
        provider: routeResult.provider,
      });
    }

    // Raise exception for critical delays
    if (severity === 'critical') {
      await this.publishShipmentException(shipment, {
        delayMinutes,
        nextStopName: nextStop?.location?.name || targetLocation?.name,
        newEta,
      });
    }

    return {
      shipmentId: shipment.id,
      shipmentReference: shipment.reference,
      orgId: shipment.orgId,
      status: severity as EtaCheckResult['status'],
      previousEta: scheduledArrival ? new Date(scheduledArrival).toISOString() : undefined,
      newEta,
      delayMinutes: delayMinutes > 0 ? delayMinutes : 0,
      nextStopId: nextStop?.id,
      nextStopName: nextStop?.location?.name || targetLocation?.name,
    };
  }

  /** Find the next stop that hasn't been completed yet */
  private findNextPendingStop(shipment: any): any | null {
    if (!shipment.stops?.length) return null;
    return shipment.stops.find(
      (s: any) => s.status === 'pending' || s.status === 'in_progress',
    ) || null;
  }

  /** Publish tracking.eta_updated domain event */
  private async publishEtaUpdatedEvent(shipment: any, detail: any): Promise<void> {
    const event: DomainEvent = {
      id: randomUUID(),
      type: EVENT_TYPES.TRACKING_ETA_UPDATED,
      timestamp: new Date().toISOString(),
      orgId: shipment.orgId,
      actorId: null, // system-generated
      entityType: 'shipment',
      entityId: shipment.id,
      payload: {
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        previousEta: detail.previousEta,
        newEta: detail.newEta,
        delayMinutes: detail.delayMinutes,
        severity: detail.severity,
        nextStopId: detail.nextStopId,
        nextStopName: detail.nextStopName,
        trafficDelaySeconds: detail.trafficDelaySeconds,
        provider: detail.provider,
      },
      metadata: {
        correlationId: randomUUID(),
        source: 'eta-monitor',
        schemaVersion: EVENT_SCHEMA_VERSIONS[EVENT_TYPES.TRACKING_ETA_UPDATED] || 1,
      },
    };

    await this.eventBus.publish(event);
  }

  /** Publish shipment.exception for critical delays */
  private async publishShipmentException(shipment: any, detail: any): Promise<void> {
    const event: DomainEvent = {
      id: randomUUID(),
      type: EVENT_TYPES.SHIPMENT_EXCEPTION,
      timestamp: new Date().toISOString(),
      orgId: shipment.orgId,
      actorId: null,
      entityType: 'shipment',
      entityId: shipment.id,
      payload: {
        shipmentReference: shipment.reference,
        exceptionType: 'eta_critical_delay',
        description: `Shipment is estimated to arrive ${detail.delayMinutes} minutes late at ${detail.nextStopName}. New ETA: ${detail.newEta}`,
      },
      metadata: {
        correlationId: randomUUID(),
        source: 'eta-monitor',
        schemaVersion: EVENT_SCHEMA_VERSIONS[EVENT_TYPES.SHIPMENT_EXCEPTION] || 1,
      },
    };

    await this.eventBus.publish(event);
  }
}
