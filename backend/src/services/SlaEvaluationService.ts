/**
 * SlaEvaluationService — core SLA evaluation logic.
 *
 * Responsibilities:
 * - Resolve applicable SLA policy for an entity (customer override → org default)
 * - Create SlaEvaluation records when entities are created
 * - Mark evaluations as met when SLA conditions are satisfied
 * - Run periodic sweep for time-based breaches (called by slaMonitorWorker)
 * - Auto-create triage issues on breach
 *
 * This service is used by both:
 * - SlaEvaluationHandler (event-driven, instant reactions to state changes)
 * - slaMonitorWorker (cron-driven, periodic sweep for time-based breaches)
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ISlaRepository } from '../repositories/SlaRepository.js';
import { IEventBus } from '../events/IEventBus.js';
import { createEvent } from '../events/createEvent.js';
import { EVENT_TYPES } from '../events/eventTypes.js';

export interface ISlaEvaluationService {
  /** Create SLA evaluations for a newly created shipment */
  createEvaluationsForShipment(shipmentId: string, orgId: string, customerId?: string): Promise<number>;

  /** Create SLA evaluations for a newly created issue */
  createEvaluationsForIssue(issueId: string, orgId: string, priority: string, category: string, customerId?: string): Promise<number>;

  /** Create SLA evaluations for a shipment stop arrival at a typed location */
  createEvaluationsForStop(stopId: string, shipmentId: string, orgId: string, customerId?: string): Promise<number>;

  /** Mark SLA evaluations as met for an entity event (e.g., issue resolved, shipment delivered) */
  markEvaluationsMet(entityType: string, entityId: string, ruleTypes?: string[]): Promise<number>;

  /** Run the periodic breach detection sweep (called by cron worker) */
  runBreachSweep(): Promise<BreachSweepResult>;
}

export interface BreachSweepResult {
  runId: string;
  evaluationsChecked: number;
  warningsIssued: number;
  breachesDetected: number;
  issuesCreated: number;
  startedAt: string;
  completedAt: string;
}

const RULE_TYPES = {
  ETA_DELIVERY: 'eta_delivery',
  ISSUE_RESPONSE: 'issue_response',
  ISSUE_RESOLUTION: 'issue_resolution',
  DWELL_TIME: 'dwell_time',
  LIGHT_EVENT: 'light_event',
  SEAL_EVENT: 'seal_event',
  TEMPERATURE_EXCURSION: 'temperature_excursion',
  TEMPERATURE_OUT_OF_RANGE: 'temperature_out_of_range',
  // Location-type-specific rules (evaluated per stop, not per shipment)
  DOCK_TURNAROUND: 'dock_turnaround',
  SORT_TO_DISPATCH: 'sort_to_dispatch',
  FACILITY_DWELL: 'facility_dwell',
} as const;

/** Rule types that are evaluated per-stop at a specific location, not per-shipment */
const STOP_LEVEL_RULE_TYPES = [
  RULE_TYPES.DOCK_TURNAROUND,
  RULE_TYPES.SORT_TO_DISPATCH,
  RULE_TYPES.FACILITY_DWELL,
] as string[];

export class SlaEvaluationService implements ISlaEvaluationService {
  constructor(
    private prisma: PrismaClient,
    private slaRepo: ISlaRepository,
    private eventBus: IEventBus,
  ) {}

  async createEvaluationsForShipment(
    shipmentId: string,
    orgId: string,
    customerId?: string,
  ): Promise<number> {
    const policy = await this.slaRepo.findPolicyForEntity(orgId, customerId);
    if (!policy) return 0;

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { id: true, reference: true, pickupDate: true, customerId: true },
    });
    if (!shipment) return 0;

    let created = 0;
    const now = new Date();

    for (const rule of policy.rules) {
      // Only create evaluations for shipment-applicable rule types
      if (![RULE_TYPES.ETA_DELIVERY, RULE_TYPES.DWELL_TIME, RULE_TYPES.LIGHT_EVENT,
            RULE_TYPES.SEAL_EVENT, RULE_TYPES.TEMPERATURE_EXCURSION,
            RULE_TYPES.TEMPERATURE_OUT_OF_RANGE].includes(rule.ruleType)) {
        continue;
      }

      const slaStartedAt = shipment.pickupDate ?? now;
      let slaDueAt: Date | null = null;
      let warningAt: Date | null = null;

      if (rule.ruleType === RULE_TYPES.ETA_DELIVERY && rule.maxDeliveryMinutes) {
        slaDueAt = new Date(slaStartedAt.getTime() + rule.maxDeliveryMinutes * 60_000);
        if (rule.warningThresholdMinutes) {
          // Warning fires when we're within warningThresholdMinutes of the deadline
          warningAt = new Date(slaDueAt.getTime() - rule.warningThresholdMinutes * 60_000);
        }
      } else if (rule.breachThresholdMinutes) {
        slaDueAt = new Date(slaStartedAt.getTime() + rule.breachThresholdMinutes * 60_000);
        if (rule.warningThresholdMinutes) {
          warningAt = new Date(slaStartedAt.getTime() + rule.warningThresholdMinutes * 60_000);
        }
      }

      try {
        const evaluation = await this.slaRepo.createEvaluation({
          id: randomUUID(),
          orgId,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          ruleName: rule.name,
          entityType: 'shipment',
          entityId: shipmentId,
          entityReference: shipment.reference,
          policyId: policy.id,
          customerId: shipment.customerId,
          slaStartedAt,
          slaDueAt,
          warningAt,
          status: 'active',
          updatedAt: now,
        });

        await this.publishEvent(orgId, EVENT_TYPES.SLA_EVALUATION_CREATED, 'sla_evaluation', evaluation.id, {
          evaluationId: evaluation.id,
          ruleType: rule.ruleType,
          ruleName: rule.name,
          entityType: 'shipment',
          entityId: shipmentId,
          entityReference: shipment.reference,
          slaDueAt: slaDueAt?.toISOString(),
        });

        created++;
      } catch (err: any) {
        // Unique constraint violation = evaluation already exists, skip
        if (err.code === 'P2002') continue;
        throw err;
      }
    }

    return created;
  }

  async createEvaluationsForIssue(
    issueId: string,
    orgId: string,
    priority: string,
    category: string,
    customerId?: string,
  ): Promise<number> {
    const policy = await this.slaRepo.findPolicyForEntity(orgId, customerId);
    if (!policy) return 0;

    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, title: true, createdAt: true },
    });
    if (!issue) return 0;

    let created = 0;
    const now = new Date();

    for (const rule of policy.rules) {
      if (![RULE_TYPES.ISSUE_RESPONSE, RULE_TYPES.ISSUE_RESOLUTION].includes(rule.ruleType)) {
        continue;
      }

      // Check priority/category filters on the rule
      if (rule.issuePriority && rule.issuePriority !== priority) continue;
      if (rule.issueCategory && rule.issueCategory !== category) continue;

      if (!rule.breachThresholdMinutes) continue;

      const slaStartedAt = issue.createdAt;
      const slaDueAt = new Date(slaStartedAt.getTime() + rule.breachThresholdMinutes * 60_000);
      const warningAt = rule.warningThresholdMinutes
        ? new Date(slaStartedAt.getTime() + rule.warningThresholdMinutes * 60_000)
        : null;

      try {
        const evaluation = await this.slaRepo.createEvaluation({
          id: randomUUID(),
          orgId,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          ruleName: rule.name,
          entityType: 'issue',
          entityId: issueId,
          entityReference: issue.title,
          policyId: policy.id,
          customerId,
          slaStartedAt,
          slaDueAt,
          warningAt,
          status: 'active',
          updatedAt: now,
        });

        await this.publishEvent(orgId, EVENT_TYPES.SLA_EVALUATION_CREATED, 'sla_evaluation', evaluation.id, {
          evaluationId: evaluation.id,
          ruleType: rule.ruleType,
          ruleName: rule.name,
          entityType: 'issue',
          entityId: issueId,
          entityReference: issue.title,
          slaDueAt: slaDueAt.toISOString(),
        });

        created++;
      } catch (err: any) {
        if (err.code === 'P2002') continue;
        throw err;
      }
    }

    return created;
  }

  async createEvaluationsForStop(
    stopId: string,
    shipmentId: string,
    orgId: string,
    customerId?: string,
  ): Promise<number> {
    const policy = await this.slaRepo.findPolicyForEntity(orgId, customerId);
    if (!policy) return 0;

    // Get the stop with its location to determine facility type
    const stop = await this.prisma.shipmentStop.findUnique({
      where: { id: stopId },
      select: {
        id: true,
        shipmentId: true,
        actualArrival: true,
        stopType: true,
        status: true,
        location: {
          select: { id: true, name: true, locationType: true },
        },
        shipment: {
          select: { reference: true },
        },
      },
    });
    if (!stop || !stop.actualArrival) return 0;

    const locationType = stop.location.locationType;
    let created = 0;
    const now = new Date();

    for (const rule of policy.rules) {
      // Only process location-specific rule types AND the generic dwell_time
      const isStopRule = STOP_LEVEL_RULE_TYPES.includes(rule.ruleType);
      const isDwellWithLocType = rule.ruleType === RULE_TYPES.DWELL_TIME && rule.locationType;

      if (!isStopRule && !isDwellWithLocType) continue;

      // Check location type filter — if the rule specifies a locationType,
      // only create an evaluation if the stop's location matches
      if (rule.locationType && rule.locationType !== locationType) continue;

      // Determine the threshold
      const thresholdMinutes = rule.maxDwellMinutes || rule.breachThresholdMinutes;
      if (!thresholdMinutes) continue;

      const slaStartedAt = stop.actualArrival;
      const slaDueAt = new Date(slaStartedAt.getTime() + thresholdMinutes * 60_000);
      const warningAt = rule.warningThresholdMinutes
        ? new Date(slaStartedAt.getTime() + rule.warningThresholdMinutes * 60_000)
        : null;

      // Entity is the stop itself — unique per (ruleId, 'shipment_stop', stopId)
      try {
        const evaluation = await this.slaRepo.createEvaluation({
          id: randomUUID(),
          orgId,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          ruleName: rule.name,
          entityType: 'shipment_stop',
          entityId: stopId,
          entityReference: `${stop.shipment.reference} @ ${stop.location.name}`,
          policyId: policy.id,
          customerId,
          slaStartedAt,
          slaDueAt,
          warningAt,
          status: 'active',
          updatedAt: now,
        });

        await this.publishEvent(orgId, EVENT_TYPES.SLA_EVALUATION_CREATED, 'sla_evaluation', evaluation.id, {
          evaluationId: evaluation.id,
          ruleType: rule.ruleType,
          ruleName: rule.name,
          entityType: 'shipment_stop',
          entityId: stopId,
          entityReference: `${stop.shipment.reference} @ ${stop.location.name}`,
          slaDueAt: slaDueAt.toISOString(),
        });

        created++;
      } catch (err: any) {
        if (err.code === 'P2002') continue;
        throw err;
      }
    }

    return created;
  }

  async markEvaluationsMet(
    entityType: string,
    entityId: string,
    ruleTypes?: string[],
  ): Promise<number> {
    const evaluations = await this.slaRepo.findEvaluationsByEntity(entityType, entityId);
    const now = new Date();
    let marked = 0;

    for (const evaluation of evaluations) {
      if (!['active', 'warning'].includes(evaluation.status)) continue;
      if (ruleTypes && !ruleTypes.includes(evaluation.ruleType)) continue;

      const updated = await this.slaRepo.updateEvaluationStatus(
        evaluation.id,
        evaluation.status,
        { status: 'met', metAt: now, updatedAt: now },
      );

      if (updated) {
        await this.publishEvent(evaluation.orgId, EVENT_TYPES.SLA_MET, 'sla_evaluation', evaluation.id, {
          evaluationId: evaluation.id,
          ruleType: evaluation.ruleType,
          ruleName: evaluation.ruleName,
          entityType: evaluation.entityType,
          entityId: evaluation.entityId,
          entityReference: evaluation.entityReference,
          metAt: now.toISOString(),
        });
        marked++;
      }
    }

    return marked;
  }

  async runBreachSweep(): Promise<BreachSweepResult> {
    const runId = randomUUID();
    const startedAt = new Date();
    let evaluationsChecked = 0;
    let warningsIssued = 0;
    let breachesDetected = 0;
    let issuesCreated = 0;

    const now = new Date();

    // 1. Find evaluations that should transition to 'warning'
    const warningCandidates = await this.slaRepo.findActiveEvaluationsWarningBefore(now);
    for (const evaluation of warningCandidates) {
      evaluationsChecked++;
      const updated = await this.slaRepo.updateEvaluationStatus(
        evaluation.id,
        'active',
        {
          status: 'warning',
          remainingMinutes: evaluation.slaDueAt
            ? Math.max(0, Math.round((evaluation.slaDueAt.getTime() - now.getTime()) / 60_000))
            : null,
          updatedAt: now,
        },
      );

      if (updated) {
        warningsIssued++;
        await this.publishEvent(evaluation.orgId, EVENT_TYPES.SLA_WARNING, 'sla_evaluation', evaluation.id, {
          evaluationId: evaluation.id,
          ruleType: evaluation.ruleType,
          ruleName: evaluation.ruleName,
          entityType: evaluation.entityType,
          entityId: evaluation.entityId,
          entityReference: evaluation.entityReference,
          remainingMinutes: updated.remainingMinutes ?? 0,
          slaDueAt: evaluation.slaDueAt?.toISOString() ?? '',
        });
      }
    }

    // 2. Find evaluations that should transition to 'breached'
    const breachCandidates = await this.slaRepo.findActiveEvaluationsDueBefore(now);
    for (const evaluation of breachCandidates) {
      evaluationsChecked++;
      const breachDuration = evaluation.slaDueAt
        ? Math.round((now.getTime() - evaluation.slaDueAt.getTime()) / 60_000)
        : 0;

      const updated = await this.slaRepo.updateEvaluationStatus(
        evaluation.id,
        evaluation.status, // could be 'active' or 'warning'
        {
          status: 'breached',
          breachedAt: now,
          breachDurationMinutes: breachDuration,
          updatedAt: now,
        },
      );

      if (updated) {
        breachesDetected++;

        // Auto-create triage issue if configured
        let issueId: string | undefined;
        const rule = await this.prisma.slaRule.findUnique({ where: { id: evaluation.ruleId } });

        if (rule?.autoCreateIssue) {
          const issue = await this.createBreachIssue(evaluation, rule);
          if (issue) {
            issueId = issue.id;
            issuesCreated++;

            // Link issue back to the evaluation
            await this.prisma.slaEvaluation.update({
              where: { id: evaluation.id },
              data: { issueId: issue.id },
            });
          }
        }

        await this.publishEvent(evaluation.orgId, EVENT_TYPES.SLA_BREACHED, 'sla_evaluation', evaluation.id, {
          evaluationId: evaluation.id,
          ruleType: evaluation.ruleType,
          ruleName: evaluation.ruleName,
          entityType: evaluation.entityType,
          entityId: evaluation.entityId,
          entityReference: evaluation.entityReference,
          customerId: evaluation.customerId,
          breachedAt: now.toISOString(),
          breachDurationMinutes: breachDuration,
          issueId,
        });
      }
    }

    return {
      runId,
      evaluationsChecked,
      warningsIssued,
      breachesDetected,
      issuesCreated,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
    };
  }

  private async createBreachIssue(evaluation: any, rule: any): Promise<{ id: string } | null> {
    // Don't create duplicate issues for the same SLA evaluation
    if (evaluation.issueId) return null;

    // Check if an open issue already exists for this entity + SLA
    const existing = await this.prisma.issue.findFirst({
      where: {
        sourceEntityType: evaluation.entityType,
        sourceEntityId: evaluation.entityId,
        category: 'compliance',
        status: { in: ['open', 'in_progress'] },
        title: { contains: 'SLA Breach' },
      },
    });
    if (existing) return existing;

    return this.prisma.issue.create({
      data: {
        orgId: evaluation.orgId,
        title: `SLA Breach: ${evaluation.ruleName} on ${evaluation.entityReference || evaluation.entityId}`,
        description: `${evaluation.ruleType} SLA breached. ` +
          `The ${evaluation.ruleName} threshold was exceeded for ${evaluation.entityType} "${evaluation.entityReference || evaluation.entityId}". ` +
          `SLA started at ${evaluation.slaStartedAt.toISOString()}, ` +
          `due at ${evaluation.slaDueAt?.toISOString() ?? 'N/A'}.`,
        status: 'open',
        priority: rule.issuePriorityOnBreach || 'high',
        category: 'compliance',
        sourceEntityType: evaluation.entityType,
        sourceEntityId: evaluation.entityId,
      },
    });
  }

  private async publishEvent(orgId: string, type: string, entityType: string, entityId: string, payload: any): Promise<void> {
    try {
      const event = createEvent({
        type,
        orgId,
        actorId: 'system',
        entityType,
        entityId,
        payload,
        source: 'sla_engine',
      });
      await this.eventBus.publish(event);
    } catch (err) {
      console.error(`[SlaEvaluationService] Failed to publish ${type} event:`, (err as Error).message);
    }
  }
}
