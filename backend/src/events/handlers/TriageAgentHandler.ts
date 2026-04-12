/**
 * TriageAgentHandler — AI-powered event handler that triages shipment issues.
 *
 * Subscribes to exception events (shipment delays, SLA breaches, cargo issues,
 * cold chain excursions) and uses an LLM to decide what action to take:
 * create an issue, escalate an existing one, or take no action.
 *
 * Every decision is logged via the AgentDecision system for compliance and
 * automation discovery.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { EVENT_TYPES } from '../eventTypes.js';
import { ILlmProvider, LlmMessage } from '../../services/llm/ILlmProvider.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { CREATE_AGENT_DECISION } from '../../commands/agentDecisions/CreateAgentDecisionCommand.js';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand.js';
import { ESCALATE_ISSUE } from '../../commands/issues/EscalateIssueCommand.js';
import { randomUUID } from 'crypto';

/** Structured response expected from the LLM */
interface TriageDecision {
  summary: string;
  reasoning: string;
  actionType: 'create_issue' | 'escalate_issue' | 'no_action';
  confidence: number;
  /** Only when actionType = create_issue */
  issuePriority?: 'low' | 'medium' | 'high' | 'critical';
  issueCategory?: string;
  issueTitle?: string;
  /** Only when actionType = escalate_issue */
  escalateIssueId?: string;
  escalateReason?: string;
}

const SYSTEM_PROMPT = `You are a triage agent for a Transportation Management System (TMS). Your job is to analyze shipment events and decide what action to take.

You will receive an event describing something that happened (a delay, SLA breach, cargo issue, temperature excursion, etc.) along with context about the shipment, any existing issues, and SLA status.

You must respond with ONLY a JSON object (no markdown, no explanation outside the JSON) with these fields:

{
  "summary": "One-line human-readable summary of your decision",
  "reasoning": "2-3 sentences explaining WHY you made this decision",
  "actionType": "create_issue" | "escalate_issue" | "no_action",
  "confidence": 0.0-1.0,
  "issuePriority": "low" | "medium" | "high" | "critical",
  "issueCategory": "exception" | "delay" | "damage" | "compliance" | "other",
  "issueTitle": "Title for the new issue (if creating one)",
  "escalateIssueId": "ID of existing issue to escalate (if escalating)",
  "escalateReason": "Reason for escalation (if escalating)"
}

Guidelines:
- If there's already an open issue for this exact problem, choose "no_action" to avoid duplicates
- If there's an open issue but the situation has worsened, choose "escalate_issue"
- For new problems with no existing issue, choose "create_issue"
- Set priority based on business impact: critical = customer SLA breach or safety, high = significant delay, medium = minor delay, low = informational
- Be conservative with critical priority - only use it for genuine emergencies
- Always explain your reasoning clearly - this will be reviewed by humans`;

export class TriageAgentHandler implements IEventHandler {
  readonly name = 'agent.triage';
  readonly eventPatterns = [
    EVENT_TYPES.SHIPMENT_EXCEPTION,
    EVENT_TYPES.SLA_BREACHED,
    EVENT_TYPES.CARGO_MISDROP_DETECTED,
    EVENT_TYPES.CARGO_MISSING_AT_STOP,
    EVENT_TYPES.CARGO_LEFT_ON_VEHICLE,
    EVENT_TYPES.COLD_CHAIN_EXCURSION_DETECTED,
  ];
  readonly options = {
    concurrency: 2,
    retryLimit: 2,
    // LLM calls can be slow — allow up to 3 minutes per job
    expireInSeconds: 180,
    priority: 1, // Lower priority than projections
  };

  constructor(
    private prisma: PrismaClient,
    private llm: ILlmProvider,
    private commandBus: ICommandBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    const correlationId = randomUUID();

    try {
      // 1. Gather context
      const context = await this.gatherContext(event);

      // 2. Check for recent duplicate decisions (debounce)
      const recentDecision = await this.findRecentDecision(event);
      if (recentDecision) {
        console.log(`[TriageAgent] Skipping ${event.type} for ${event.entityId} — recent decision exists (${recentDecision.id})`);
        return;
      }

      // 3. Build prompt and call LLM
      const messages = this.buildPrompt(event, context);
      const llmResponse = await this.llm.complete({
        messages,
        maxTokens: 512,
        temperature: 0.2,
      });

      // 4. Parse the structured response
      const decision = this.parseDecision(llmResponse.content);

      // 5. Execute the action
      const actionResult = await this.executeAction(event, decision, correlationId);

      // 6. Log the decision
      await this.logDecision(event, context, decision, messages, llmResponse, actionResult, correlationId);

      console.log(`[TriageAgent] ${event.type} on ${event.entityType}/${event.entityId} — ${decision.actionType} (confidence: ${decision.confidence})`);
    } catch (err) {
      console.error(`[TriageAgent] Error processing ${event.type} for ${event.entityId}:`, (err as Error).message);
      throw err; // Let pg-boss retry
    }
  }

  // ── Context gathering ──────────────────────────────────────────

  private async gatherContext(event: DomainEvent): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {
      event: {
        type: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: event.payload,
        timestamp: event.timestamp,
      },
    };

    // Get the entity details based on type
    const entityId = this.resolveEntityId(event);
    const entityType = this.resolveEntityType(event);

    if (entityType === 'shipment' && entityId) {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: entityId },
        include: {
          customer: { select: { id: true, name: true } },
          origin: { select: { id: true, name: true, city: true, state: true } },
          destination: { select: { id: true, name: true, city: true, state: true } },
          carrier: { select: { id: true, name: true } },
          stops: {
            select: { id: true, stopType: true, sequenceNumber: true, status: true, estimatedArrival: true, actualArrival: true, location: { select: { name: true, city: true } } },
            orderBy: { sequenceNumber: 'asc' },
          },
        },
      });
      if (shipment) {
        context.shipment = {
          id: shipment.id,
          reference: shipment.reference,
          status: shipment.status,
          customerName: shipment.customer?.name,
          origin: shipment.origin ? `${shipment.origin.name}, ${shipment.origin.city}, ${shipment.origin.state}` : null,
          destination: shipment.destination ? `${shipment.destination.name}, ${shipment.destination.city}, ${shipment.destination.state}` : null,
          carrierName: shipment.carrier?.name,
          pickupDate: shipment.pickupDate,
          deliveryDate: shipment.deliveryDate,
          stops: shipment.stops.map((s) => ({
            stopType: s.stopType,
            sequence: s.sequenceNumber,
            status: s.status,
            location: s.location ? `${s.location.name}, ${s.location.city}` : null,
            estimatedArrival: s.estimatedArrival,
            actualArrival: s.actualArrival,
          })),
        };
      }

      // Get open issues linked to this shipment
      const openIssues = await this.prisma.issue.findMany({
        where: {
          sourceEntityType: 'shipment',
          sourceEntityId: entityId,
          status: { in: ['open', 'in_progress'] },
        },
        select: { id: true, title: true, priority: true, category: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      context.openIssues = openIssues;

      // Get active SLA evaluations
      const slaEvaluations = await this.prisma.slaEvaluation.findMany({
        where: {
          entityType: 'shipment',
          entityId,
          status: { in: ['active', 'warning', 'breached'] },
        },
        select: { id: true, ruleType: true, ruleName: true, status: true, slaDueAt: true },
        take: 10,
      });
      context.slaStatus = slaEvaluations;
    }

    return context;
  }

  /** Resolve the shipment ID from different event types */
  private resolveEntityId(event: DomainEvent): string | null {
    // For shipment events, entityId IS the shipment
    if (event.entityType === 'shipment') return event.entityId;

    // For SLA/cargo events, the payload often contains shipmentId
    const payload = event.payload as Record<string, unknown>;
    if (payload.shipmentId && typeof payload.shipmentId === 'string') return payload.shipmentId;
    if (payload.entityId && typeof payload.entityId === 'string') return payload.entityId;

    return event.entityId;
  }

  /** Resolve the entity type for context gathering */
  private resolveEntityType(event: DomainEvent): string {
    if (event.entityType === 'shipment') return 'shipment';
    const payload = event.payload as Record<string, unknown>;
    if (payload.entityType === 'shipment') return 'shipment';
    if (payload.shipmentId) return 'shipment';
    return event.entityType;
  }

  // ── Deduplication ──────────────────────────────────────────────

  private async findRecentDecision(event: DomainEvent) {
    // Skip if we already made a decision for this exact event + entity in the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);

    return this.prisma.agentDecision.findFirst({
      where: {
        agentType: 'triage',
        triggerEventType: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        createdAt: { gte: thirtyMinutesAgo },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Prompt building ────────────────────────────────────────────

  private buildPrompt(event: DomainEvent, context: Record<string, unknown>): LlmMessage[] {
    const userMessage = `## Event
Type: ${event.type}
Time: ${event.timestamp}
Entity: ${event.entityType} / ${event.entityId}

## Event Payload
${JSON.stringify(event.payload, null, 2)}

## Context
${JSON.stringify(context, null, 2)}

Based on this event and context, what action should be taken?`;

    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];
  }

  // ── Response parsing ───────────────────────────────────────────

  private parseDecision(content: string): TriageDecision {
    // Strip any markdown code fences if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);

      return {
        summary: String(parsed.summary || 'No summary provided'),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        actionType: ['create_issue', 'escalate_issue', 'no_action'].includes(parsed.actionType)
          ? parsed.actionType
          : 'no_action',
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
        issuePriority: ['low', 'medium', 'high', 'critical'].includes(parsed.issuePriority)
          ? parsed.issuePriority
          : 'medium',
        issueCategory: parsed.issueCategory || 'exception',
        issueTitle: parsed.issueTitle || undefined,
        escalateIssueId: parsed.escalateIssueId || undefined,
        escalateReason: parsed.escalateReason || undefined,
      };
    } catch {
      // If parsing fails, default to no_action and log the raw response
      console.warn('[TriageAgent] Failed to parse LLM response as JSON, defaulting to no_action');
      return {
        summary: 'LLM response could not be parsed',
        reasoning: `Raw response: ${content.substring(0, 500)}`,
        actionType: 'no_action',
        confidence: 0,
      };
    }
  }

  // ── Action execution ───────────────────────────────────────────

  private async executeAction(
    event: DomainEvent,
    decision: TriageDecision,
    correlationId: string,
  ): Promise<{ actionEntityType?: string; actionEntityId?: string; actionPayload?: Record<string, unknown> }> {
    if (decision.actionType === 'no_action') {
      return {};
    }

    if (decision.actionType === 'create_issue') {
      const result = await this.commandBus.dispatch({
        type: CREATE_ISSUE,
        orgId: event.orgId,
        actorId: 'system:triage-agent',
        payload: {
          title: decision.issueTitle || decision.summary,
          description: decision.reasoning,
          priority: decision.issuePriority || 'medium',
          category: decision.issueCategory || 'exception',
          sourceEntityType: event.entityType,
          sourceEntityId: event.entityId,
          sourceEventId: event.id,
        },
        metadata: { correlationId, source: 'system' },
      });

      if (result.success) {
        return {
          actionEntityType: 'issue',
          actionEntityId: (result.data as { id: string })?.id,
          actionPayload: {
            issueTitle: decision.issueTitle || decision.summary,
            issuePriority: decision.issuePriority,
            issueCategory: decision.issueCategory,
          },
        };
      }

      console.warn(`[TriageAgent] Failed to create issue: ${result.error}`);
      return {};
    }

    if (decision.actionType === 'escalate_issue' && decision.escalateIssueId) {
      const result = await this.commandBus.dispatch({
        type: ESCALATE_ISSUE,
        orgId: event.orgId,
        actorId: 'system:triage-agent',
        payload: {
          id: decision.escalateIssueId,
          escalatedTo: 'operations-manager',
          reason: decision.escalateReason || decision.reasoning,
        },
        metadata: { correlationId, source: 'system' },
      });

      if (result.success) {
        return {
          actionEntityType: 'issue',
          actionEntityId: decision.escalateIssueId,
          actionPayload: {
            escalateReason: decision.escalateReason,
            previousIssueId: decision.escalateIssueId,
          },
        };
      }

      console.warn(`[TriageAgent] Failed to escalate issue: ${result.error}`);
      return {};
    }

    return {};
  }

  // ── Decision logging ───────────────────────────────────────────

  private async logDecision(
    event: DomainEvent,
    context: Record<string, unknown>,
    decision: TriageDecision,
    messages: LlmMessage[],
    llmResponse: { provider: string; model: string; usage?: { inputTokens: number; outputTokens: number } },
    actionResult: { actionEntityType?: string; actionEntityId?: string; actionPayload?: Record<string, unknown> },
    correlationId: string,
  ): Promise<void> {
    await this.commandBus.dispatch({
      type: CREATE_AGENT_DECISION,
      orgId: event.orgId,
      actorId: 'system:triage-agent',
      payload: {
        agentType: 'triage',
        modelProvider: llmResponse.provider,
        modelId: llmResponse.model,
        triggerType: 'domain_event',
        triggerEventType: event.type,
        triggerEventId: event.id,
        entityType: event.entityType,
        entityId: event.entityId,
        summary: decision.summary,
        reasoning: decision.reasoning,
        context: {
          ...context,
          llmUsage: llmResponse.usage,
        },
        conversationLog: messages.map((m) => ({ role: m.role, content: m.content })),
        confidence: decision.confidence,
        actionType: decision.actionType,
        actionPayload: actionResult.actionPayload,
        actionEntityType: actionResult.actionEntityType,
        actionEntityId: actionResult.actionEntityId,
      },
      metadata: { correlationId, source: 'system' },
    });
  }
}
