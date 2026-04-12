/**
 * AgentDecisionRepository — data access for AI agent decision logging.
 *
 * Provides CRUD + filtered queries for the AgentDecision write model
 * and denormalized AgentDecisionReadModel for list views.
 */

import { PrismaClient, AgentDecision, AgentDecisionReadModel } from '@prisma/client';

// ── DTOs ──────────────────────────────────────────────────────────

export interface CreateAgentDecisionDTO {
  orgId: string;
  agentType: string;
  modelProvider?: string;
  modelId?: string;
  triggerType: string;
  triggerEventType?: string;
  triggerEventId?: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  reasoning: string;
  context: Record<string, unknown>;
  conversationLog?: Array<{ role: string; content: string }>;
  confidence?: number;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  actionEntityType?: string;
  actionEntityId?: string;
}

export interface AgentDecisionFilters {
  orgId?: string;
  agentType?: string;
  triggerType?: string;
  entityType?: string;
  entityId?: string;
  actionType?: string;
  outcomeStatus?: string;
  triggerEventType?: string;
  promotedToAutomation?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AgentDecisionStats {
  totalDecisions: number;
  byAgentType: Array<{ agentType: string; count: number }>;
  byActionType: Array<{ actionType: string; count: number }>;
  byOutcomeStatus: Array<{ outcomeStatus: string; count: number }>;
  averageConfidence: number | null;
  promotedCount: number;
  pendingReviewCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  averageDurationMs: number | null;
}

export interface DailyUsage {
  date: string;
  invocations: number;
  inputTokens: number;
  outputTokens: number;
}

// ── Interface ─────────────────────────────────────────────────────

export interface IAgentDecisionRepository {
  findById(id: string): Promise<AgentDecision | null>;
  findAll(filters: AgentDecisionFilters): Promise<{ items: AgentDecisionReadModel[]; total: number }>;
  getStats(orgId: string): Promise<AgentDecisionStats>;
  getDailyUsage(orgId: string, days?: number): Promise<DailyUsage[]>;
}

// ── Implementation ────────────────────────────────────────────────

export class AgentDecisionRepository implements IAgentDecisionRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<AgentDecision | null> {
    return this.prisma.agentDecision.findUnique({ where: { id } });
  }

  async findAll(filters: AgentDecisionFilters): Promise<{ items: AgentDecisionReadModel[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filters.orgId) where.orgId = filters.orgId;
    if (filters.agentType) where.agentType = filters.agentType;
    if (filters.triggerType) where.triggerType = filters.triggerType;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.outcomeStatus) where.outcomeStatus = filters.outcomeStatus;
    if (filters.triggerEventType) where.triggerEventType = filters.triggerEventType;
    if (filters.promotedToAutomation !== undefined) where.promotedToAutomation = filters.promotedToAutomation;

    if (filters.dateFrom || filters.dateTo) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
      where.createdAt = createdAt;
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const [items, total] = await Promise.all([
      this.prisma.agentDecisionReadModel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.agentDecisionReadModel.count({ where }),
    ]);

    return { items, total };
  }

  async getStats(orgId: string): Promise<AgentDecisionStats> {
    const baseWhere = { orgId };

    const [
      totalDecisions,
      byAgentTypeRaw,
      byActionTypeRaw,
      byOutcomeStatusRaw,
      avgResult,
      tokenResult,
      promotedCount,
      pendingReviewCount,
    ] = await Promise.all([
      this.prisma.agentDecision.count({ where: baseWhere }),
      this.prisma.agentDecision.groupBy({ by: ['agentType'], where: baseWhere, _count: true }),
      this.prisma.agentDecision.groupBy({ by: ['actionType'], where: baseWhere, _count: true }),
      this.prisma.agentDecision.groupBy({ by: ['outcomeStatus'], where: baseWhere, _count: true }),
      this.prisma.agentDecision.aggregate({ where: baseWhere, _avg: { confidence: true } }),
      this.prisma.agentDecision.aggregate({ where: baseWhere, _sum: { inputTokens: true, outputTokens: true }, _avg: { durationMs: true } }),
      this.prisma.agentDecision.count({ where: { ...baseWhere, promotedToAutomation: true } }),
      this.prisma.agentDecision.count({ where: { ...baseWhere, outcomeStatus: 'pending' } }),
    ]);

    const totalInput = tokenResult._sum.inputTokens || 0;
    const totalOutput = tokenResult._sum.outputTokens || 0;

    return {
      totalDecisions,
      byAgentType: byAgentTypeRaw.map((r) => ({ agentType: r.agentType, count: r._count })),
      byActionType: byActionTypeRaw.map((r) => ({ actionType: r.actionType, count: r._count })),
      byOutcomeStatus: byOutcomeStatusRaw.map((r) => ({ outcomeStatus: r.outcomeStatus, count: r._count })),
      averageConfidence: avgResult._avg.confidence,
      promotedCount,
      pendingReviewCount,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalTokens: totalInput + totalOutput,
      averageDurationMs: tokenResult._avg.durationMs,
    };
  }

  async getDailyUsage(orgId: string, days = 30): Promise<DailyUsage[]> {
    const since = new Date(Date.now() - days * 86400000);

    // Use raw query for date grouping (Prisma groupBy doesn't support date truncation)
    const rows = await this.prisma.$queryRaw<Array<{
      date: Date;
      invocations: bigint;
      input_tokens: bigint;
      output_tokens: bigint;
    }>>`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        COUNT(*)::bigint AS invocations,
        COALESCE(SUM("inputTokens"), 0)::bigint AS input_tokens,
        COALESCE(SUM("outputTokens"), 0)::bigint AS output_tokens
      FROM "AgentDecision"
      WHERE "orgId" = ${orgId} AND "createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: new Date(r.date).toISOString().split('T')[0],
      invocations: Number(r.invocations),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
    }));
  }
}
