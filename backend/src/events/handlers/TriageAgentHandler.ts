/**
 * TriageAgentHandler — AI-powered event handler that triages shipment issues.
 *
 * Subscribes broadly to exception-related events and filters against the
 * org's AgentConfig to determine which events to process. Uses a configurable
 * system prompt (with template variables) from the database, falling back
 * to a hardcoded default if no config exists.
 *
 * Every decision is logged via the AgentDecision system for compliance and
 * automation discovery, with a link to the prompt version that produced it.
 */

import { PrismaClient } from '@prisma/client';
import { DomainEvent } from '../DomainEvent.js';
import { IEventHandler } from '../IEventHandler.js';
import { ILlmProvider, LlmMessage } from '../../services/llm/ILlmProvider.js';
import { ICommandBus } from '../../commands/CommandBus.js';
import { CREATE_AGENT_DECISION } from '../../commands/agentDecisions/CreateAgentDecisionCommand.js';
import { CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand.js';
import { ESCALATE_ISSUE } from '../../commands/issues/EscalateIssueCommand.js';
import { randomUUID } from 'crypto';

/** Unified condition format shared between agent decisions and automation rules */
export interface RuleCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'in' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'exists' | 'notExists';
  value?: unknown;
}

/** Structured response expected from the LLM */
interface TriageDecision {
  summary: string;
  reasoning: string;
  conditions: RuleCondition[];
  actionType: 'create_issue' | 'escalate_issue' | 'no_action';
  confidence: number;
  issuePriority?: 'low' | 'medium' | 'high' | 'critical';
  issueCategory?: string;
  issueTitle?: string;
  escalateIssueId?: string;
  escalateReason?: string;
}

/** Cached config loaded from DB */
interface LoadedConfig {
  id: string;
  activeVersionId: string | null;
  systemPrompt: string;
  subscribedEvents: string[] | null;
  temperature: number;
  maxTokens: number;
  confidenceThreshold: number;
  deduplicationWindowMinutes: number;
  enabled: boolean;
  loadedAt: number;
}

/** Default events the triage agent subscribes to */
export const DEFAULT_TRIAGE_EVENTS = [
  'shipment.exception',
  'sla.breached',
  'cargo.misdrop_detected',
  'cargo.missing_at_stop',
  'cargo.left_on_vehicle',
  'cold_chain.excursion_detected',
];

/** Default system prompt — used when no AgentConfig exists or as seed for version 1 */
export const DEFAULT_TRIAGE_PROMPT = `You are a triage agent for a Transportation Management System (TMS). Your job is to analyze shipment events and decide what action to take.

You will receive an event describing something that happened (a delay, SLA breach, cargo issue, temperature excursion, etc.) along with context about the shipment, any existing issues, and SLA status.

You must respond with ONLY a JSON object (no markdown, no explanation outside the JSON) with these fields:

{
  "summary": "One-line human-readable summary of your decision",
  "reasoning": "2-3 sentences explaining WHY you made this decision",
  "conditions": [
    { "field": "event.type", "operator": "equals", "value": "the.event.type" },
    { "field": "payload.fieldName", "operator": "greaterThan", "value": 123 }
  ],
  "actionType": "create_issue" | "escalate_issue" | "no_action",
  "confidence": 0.0-1.0,
  "issuePriority": "low" | "medium" | "high" | "critical",
  "issueCategory": "exception" | "delay" | "damage" | "compliance" | "other",
  "issueTitle": "Title for the new issue (if creating one)",
  "escalateIssueId": "ID of existing issue to escalate (if escalating)",
  "escalateReason": "Reason for escalation (if escalating)"
}

The "conditions" array is critical. It describes the specific conditions you matched to make this decision, in a structured format that can later be turned into a deterministic automation rule. Use these operators: equals, notEquals, contains, in, greaterThan, lessThan, greaterThanOrEqual, lessThanOrEqual, exists, notExists. Fields can reference: event.type, event.entityType, payload.* (any event payload field), context.shipment.* (shipment fields), context.openIssues.length (issue count).

Guidelines:
- If there's already an open issue for this exact problem, choose "no_action" to avoid duplicates
- If there's an open issue but the situation has worsened, choose "escalate_issue"
- For new problems with no existing issue, choose "create_issue"
- Set priority based on business impact: critical = customer SLA breach or safety, high = significant delay, medium = minor delay, low = informational
- Be conservative with critical priority - only use it for genuine emergencies
- Always explain your reasoning clearly - this will be reviewed by humans
- Always include specific, accurate conditions that describe what you matched`;

const CONFIG_CACHE_TTL_MS = 60_000; // 60 seconds

export class TriageAgentHandler implements IEventHandler {
  readonly name = 'agent.triage';
  // Subscribe broadly — filter against config in handle()
  readonly eventPatterns = [
    'shipment.*',
    'sla.*',
    'cargo.*',
    'cold_chain.*',
  ];
  readonly options = {
    concurrency: 2,
    retryLimit: 2,
    expireInSeconds: 180,
    priority: 1,
  };

  private configCache: LoadedConfig | null = null;

  constructor(
    private prisma: PrismaClient,
    private llm: ILlmProvider,
    private commandBus: ICommandBus,
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    // 0. Load config (cached, 60s TTL)
    const config = await this.loadConfig(event.orgId);

    // Check if agent is enabled
    if (!config.enabled) return;

    // Check if this event type is in the subscribed list
    const subscribedEvents = config.subscribedEvents || DEFAULT_TRIAGE_EVENTS;
    if (!subscribedEvents.includes(event.type)) return;

    const correlationId = randomUUID();

    try {
      // 1. Gather context
      const context = await this.gatherContext(event);

      // 2. Check for recent duplicate decisions (debounce)
      const deduplicationWindow = config.deduplicationWindowMinutes;
      const recentDecision = await this.findRecentDecision(event, deduplicationWindow);
      if (recentDecision) {
        console.log(`[TriageAgent] Skipping ${event.type} for ${event.entityId} — recent decision exists (${recentDecision.id})`);
        return;
      }

      // 3. Build prompt (with template variable replacement) and call LLM
      const messages = this.buildPrompt(config.systemPrompt, event, context);
      const llmStart = Date.now();
      const llmResponse = await this.llm.complete({
        messages,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      });
      const durationMs = Date.now() - llmStart;

      // 4. Parse the structured response
      let decision = this.parseDecision(llmResponse.content);

      // 5. Apply confidence threshold
      if (config.confidenceThreshold > 0 && decision.confidence < config.confidenceThreshold && decision.actionType !== 'no_action') {
        console.log(`[TriageAgent] Confidence ${decision.confidence} below threshold ${config.confidenceThreshold}, overriding to no_action`);
        decision = {
          ...decision,
          actionType: 'no_action',
          summary: `${decision.summary} (below confidence threshold ${config.confidenceThreshold})`,
        };
      }

      // 6. Execute the action
      const actionResult = await this.executeAction(event, decision, correlationId);

      // 7. Log the decision (with config traceability)
      await this.logDecision(event, context, decision, messages, llmResponse, actionResult, correlationId, durationMs, config);

      console.log(`[TriageAgent] ${event.type} on ${event.entityType}/${event.entityId} — ${decision.actionType} (confidence: ${decision.confidence})`);
    } catch (err) {
      console.error(`[TriageAgent] Error processing ${event.type} for ${event.entityId}:`, (err as Error).message);
      throw err;
    }
  }

  // ── Config loading (with cache) ────────────────────────────────

  private async loadConfig(orgId: string): Promise<LoadedConfig> {
    if (this.configCache && (Date.now() - this.configCache.loadedAt) < CONFIG_CACHE_TTL_MS) {
      return this.configCache;
    }

    const config = await this.prisma.agentConfig.findFirst({
      where: { orgId, agentType: 'triage' },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (config) {
      // Find the active version (use activeVersionId, or latest)
      let systemPrompt = DEFAULT_TRIAGE_PROMPT;
      let activeVersionId = config.activeVersionId;

      if (activeVersionId) {
        const version = await this.prisma.agentConfigVersion.findUnique({
          where: { id: activeVersionId },
          select: { systemPrompt: true },
        });
        if (version) systemPrompt = version.systemPrompt;
      } else if (config.versions.length > 0) {
        systemPrompt = config.versions[0].systemPrompt;
        activeVersionId = config.versions[0].id;
      }

      this.configCache = {
        id: config.id,
        activeVersionId,
        systemPrompt,
        subscribedEvents: config.subscribedEvents as string[] | null,
        temperature: config.temperature ?? 0.2,
        maxTokens: config.maxTokens ?? 512,
        confidenceThreshold: config.confidenceThreshold ?? 0,
        deduplicationWindowMinutes: config.deduplicationWindowMinutes ?? 30,
        enabled: config.enabled,
        loadedAt: Date.now(),
      };
    } else {
      // No config in DB — use defaults
      this.configCache = {
        id: '',
        activeVersionId: null,
        systemPrompt: DEFAULT_TRIAGE_PROMPT,
        subscribedEvents: null,
        temperature: 0.2,
        maxTokens: 512,
        confidenceThreshold: 0,
        deduplicationWindowMinutes: 30,
        enabled: true,
        loadedAt: Date.now(),
      };
    }

    return this.configCache;
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

  private resolveEntityId(event: DomainEvent): string | null {
    if (event.entityType === 'shipment') return event.entityId;
    const payload = event.payload as Record<string, unknown>;
    if (payload.shipmentId && typeof payload.shipmentId === 'string') return payload.shipmentId;
    if (payload.entityId && typeof payload.entityId === 'string') return payload.entityId;
    return event.entityId;
  }

  private resolveEntityType(event: DomainEvent): string {
    if (event.entityType === 'shipment') return 'shipment';
    const payload = event.payload as Record<string, unknown>;
    if (payload.entityType === 'shipment') return 'shipment';
    if (payload.shipmentId) return 'shipment';
    return event.entityType;
  }

  // ── Deduplication ──────────────────────────────────────────────

  private async findRecentDecision(event: DomainEvent, windowMinutes: number) {
    const cutoff = new Date(Date.now() - windowMinutes * 60_000);

    return this.prisma.agentDecision.findFirst({
      where: {
        agentType: 'triage',
        triggerEventType: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        createdAt: { gte: cutoff },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Prompt building (with template variable replacement) ───────

  private buildPrompt(systemPrompt: string, event: DomainEvent, context: Record<string, unknown>): LlmMessage[] {
    // Replace template variables in the system prompt
    const resolvedPrompt = systemPrompt
      .replace(/\{\{event\}\}/g, JSON.stringify(context.event, null, 2))
      .replace(/\{\{shipment\}\}/g, JSON.stringify(context.shipment ?? 'No shipment data available', null, 2))
      .replace(/\{\{issues\}\}/g, JSON.stringify(context.openIssues ?? [], null, 2))
      .replace(/\{\{sla_status\}\}/g, JSON.stringify(context.slaStatus ?? [], null, 2));

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
      { role: 'system', content: resolvedPrompt },
      { role: 'user', content: userMessage },
    ];
  }

  // ── Response parsing ───────────────────────────────────────────

  private parseDecision(content: string): TriageDecision {
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);

      // Parse conditions (validate structure)
      const conditions: RuleCondition[] = Array.isArray(parsed.conditions)
        ? parsed.conditions.filter((c: unknown) => {
            if (!c || typeof c !== 'object') return false;
            const cond = c as Record<string, unknown>;
            return typeof cond.field === 'string' && typeof cond.operator === 'string';
          })
        : [];

      return {
        summary: String(parsed.summary || 'No summary provided'),
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        conditions,
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
      console.warn('[TriageAgent] Failed to parse LLM response as JSON, defaulting to no_action');
      return {
        summary: 'LLM response could not be parsed',
        reasoning: `Raw response: ${content.substring(0, 500)}`,
        conditions: [],
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
    durationMs?: number,
    config?: LoadedConfig,
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
        context,
        conversationLog: messages.map((m) => ({ role: m.role, content: m.content })),
        confidence: decision.confidence,
        actionType: decision.actionType,
        actionPayload: actionResult.actionPayload,
        actionEntityType: actionResult.actionEntityType,
        actionEntityId: actionResult.actionEntityId,
        inputTokens: llmResponse.usage?.inputTokens,
        outputTokens: llmResponse.usage?.outputTokens,
        durationMs,
        agentConfigId: config?.id || undefined,
        promptVersionId: config?.activeVersionId || undefined,
        matchedConditions: decision.conditions.length > 0 ? decision.conditions : undefined,
      },
      metadata: { correlationId, source: 'system' },
    });
  }
}
