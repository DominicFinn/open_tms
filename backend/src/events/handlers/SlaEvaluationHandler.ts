/**
 * SlaEvaluationHandler — event-driven SLA evaluation.
 *
 * Subscribes to domain events and instantly creates or resolves SLA evaluations:
 * - On entity creation (shipment, issue): creates SlaEvaluation records
 * - On state changes (delivered, resolved, assigned): marks evaluations as met
 * - On tracking/sensor events: evaluates security and dwell rules
 *
 * Works in tandem with the slaMonitorWorker cron job — the handler handles
 * instant reactions, the worker handles time-based breach detection.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { ISlaEvaluationService } from '../../services/SlaEvaluationService.js';

export class SlaEvaluationHandler implements IEventHandler {
  readonly name = 'sla.evaluation';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_CREATED,
    EVENT_TYPES.SHIPMENT_STATUS_CHANGED,
    EVENT_TYPES.SHIPMENT_DELIVERED,
    EVENT_TYPES.ISSUE_CREATED,
    EVENT_TYPES.ISSUE_ASSIGNED,
    EVENT_TYPES.ISSUE_STATUS_CHANGED,
    EVENT_TYPES.ISSUE_RESOLVED,
    EVENT_TYPES.COLD_CHAIN_EXCURSION_DETECTED,
    EVENT_TYPES.COLD_CHAIN_EXCURSION_RESOLVED,
    EVENT_TYPES.TRACKING_ETA_UPDATED,
  ];
  readonly options = { concurrency: 3, retryLimit: 3, expireInSeconds: 120 };

  constructor(
    private prisma: PrismaClient,
    private slaService: ISlaEvaluationService,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.type) {
        case EVENT_TYPES.SHIPMENT_CREATED:
          await this.handleShipmentCreated(event);
          break;

        case EVENT_TYPES.SHIPMENT_DELIVERED:
          await this.handleShipmentDelivered(event);
          break;

        case EVENT_TYPES.SHIPMENT_STATUS_CHANGED:
          await this.handleShipmentStatusChanged(event);
          break;

        case EVENT_TYPES.ISSUE_CREATED:
          await this.handleIssueCreated(event);
          break;

        case EVENT_TYPES.ISSUE_ASSIGNED:
        case EVENT_TYPES.ISSUE_STATUS_CHANGED:
          await this.handleIssueProgressUpdate(event);
          break;

        case EVENT_TYPES.ISSUE_RESOLVED:
          await this.handleIssueResolved(event);
          break;

        case EVENT_TYPES.COLD_CHAIN_EXCURSION_RESOLVED:
          await this.handleExcursionResolved(event);
          break;

        case EVENT_TYPES.TRACKING_ETA_UPDATED:
          await this.handleEtaUpdated(event);
          break;
      }
    } catch (err) {
      console.error(`[SlaEvaluationHandler] Error processing ${event.type}:`, (err as Error).message);
      throw err; // Let pg-boss retry
    }
  }

  private async handleShipmentCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as { customerId?: string };
    const count = await this.slaService.createEvaluationsForShipment(
      event.entityId,
      event.orgId,
      payload.customerId,
    );
    if (count > 0) {
      console.log(`[SlaEvaluationHandler] Created ${count} SLA evaluations for shipment ${event.entityId}`);
    }
  }

  private async handleShipmentDelivered(event: DomainEvent): Promise<void> {
    const count = await this.slaService.markEvaluationsMet(
      'shipment',
      event.entityId,
      ['eta_delivery'],
    );
    if (count > 0) {
      console.log(`[SlaEvaluationHandler] Marked ${count} delivery SLAs as met for shipment ${event.entityId}`);
    }
  }

  private async handleShipmentStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { newStatus?: string };
    if (payload.newStatus === 'delivered' || payload.newStatus === 'completed') {
      await this.slaService.markEvaluationsMet('shipment', event.entityId, ['eta_delivery']);
    }
    // If shipment cancelled, cancel active evaluations
    if (payload.newStatus === 'cancelled') {
      await this.cancelEvaluations('shipment', event.entityId);
    }
  }

  private async handleIssueCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as {
      priority: string;
      category: string;
      sourceEntityType?: string;
      sourceEntityId?: string;
    };

    // Resolve customerId from source entity if it's a shipment
    let customerId: string | undefined;
    if (payload.sourceEntityType === 'shipment' && payload.sourceEntityId) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: payload.sourceEntityId },
        select: { customerId: true },
      });
      customerId = shipment?.customerId ?? undefined;
    }

    const count = await this.slaService.createEvaluationsForIssue(
      event.entityId,
      event.orgId,
      payload.priority,
      payload.category,
      customerId,
    );
    if (count > 0) {
      console.log(`[SlaEvaluationHandler] Created ${count} SLA evaluations for issue ${event.entityId}`);
    }
  }

  private async handleIssueProgressUpdate(event: DomainEvent): Promise<void> {
    const payload = event.payload as { newStatus?: string };
    // Issue being assigned or moved to in_progress satisfies the "response" SLA
    if (event.type === EVENT_TYPES.ISSUE_ASSIGNED || payload.newStatus === 'in_progress') {
      await this.slaService.markEvaluationsMet('issue', event.entityId, ['issue_response']);
    }
  }

  private async handleIssueResolved(event: DomainEvent): Promise<void> {
    // Resolving an issue satisfies both response and resolution SLAs
    await this.slaService.markEvaluationsMet('issue', event.entityId, ['issue_response', 'issue_resolution']);
  }

  private async handleExcursionResolved(event: DomainEvent): Promise<void> {
    const payload = event.payload as { shipmentId?: string };
    if (payload.shipmentId) {
      await this.slaService.markEvaluationsMet(
        'shipment',
        payload.shipmentId,
        ['temperature_excursion'],
      );
    }
  }

  private async handleEtaUpdated(event: DomainEvent): Promise<void> {
    // If the new ETA exceeds the SLA due date, proactively warn
    const payload = event.payload as { shipmentId: string; newEta: string; severity: string };
    if (payload.severity === 'critical') {
      // The cron worker will catch the actual breach; this is just for logging
      console.log(`[SlaEvaluationHandler] Critical ETA delay on shipment ${payload.shipmentId} — SLA breach check will run on next sweep`);
    }
  }

  private async cancelEvaluations(entityType: string, entityId: string): Promise<void> {
    const evaluations = await this.prisma.slaEvaluation.findMany({
      where: { entityType, entityId, status: { in: ['active', 'warning'] } },
    });
    const now = new Date();
    for (const evaluation of evaluations) {
      await this.prisma.slaEvaluation.update({
        where: { id: evaluation.id, status: evaluation.status },
        data: { status: 'cancelled', updatedAt: now },
      }).catch(() => {}); // Ignore race conditions
    }
  }
}
