/**
 * SlaRepository — CRUD operations for SLA policies, rules, and evaluations.
 */

import { PrismaClient } from '@prisma/client';

export interface ISlaRepository {
  // Policy CRUD
  findPolicies(orgId: string, customerId?: string): Promise<any[]>;
  findPolicyById(id: string): Promise<any | null>;
  findPolicyForEntity(orgId: string, customerId?: string): Promise<any | null>;
  createPolicy(data: any): Promise<any>;
  updatePolicy(id: string, data: any): Promise<any>;
  deactivatePolicy(id: string): Promise<any>;

  // Rule CRUD (managed through policy)
  findRulesByPolicyId(policyId: string): Promise<any[]>;
  findActiveRulesByType(policyId: string, ruleType: string): Promise<any[]>;

  // Evaluation operations
  findEvaluations(filters: EvaluationFilters): Promise<{ items: any[]; total: number }>;
  findEvaluationsByEntity(entityType: string, entityId: string): Promise<any[]>;
  findActiveEvaluationsDueBefore(dueDate: Date): Promise<any[]>;
  findActiveEvaluationsWarningBefore(warningDate: Date): Promise<any[]>;
  createEvaluation(data: any): Promise<any>;
  updateEvaluationStatus(id: string, currentStatus: string, update: any): Promise<any | null>;
  getEvaluationSummary(orgId: string): Promise<EvaluationSummary>;
}

export interface EvaluationFilters {
  orgId?: string;
  status?: string[];
  ruleType?: string[];
  entityType?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

export interface EvaluationSummary {
  active: number;
  warning: number;
  breached: number;
  met: number;
  total: number;
}

export class SlaRepository implements ISlaRepository {
  constructor(private prisma: PrismaClient) {}

  async findPolicies(orgId: string, customerId?: string): Promise<any[]> {
    const where: any = { orgId };
    if (customerId !== undefined) {
      where.customerId = customerId;
    }
    return this.prisma.slaPolicy.findMany({
      where,
      include: { rules: true, customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPolicyById(id: string): Promise<any | null> {
    return this.prisma.slaPolicy.findUnique({
      where: { id },
      include: { rules: true, customer: { select: { id: true, name: true } } },
    });
  }

  /**
   * Resolves the applicable SLA policy for an entity.
   * Customer-specific policy takes precedence over org default.
   */
  async findPolicyForEntity(orgId: string, customerId?: string): Promise<any | null> {
    // Try customer-specific policy first
    if (customerId) {
      const customerPolicy = await this.prisma.slaPolicy.findUnique({
        where: { orgId_customerId: { orgId, customerId } },
        include: { rules: { where: { active: true } } },
      });
      if (customerPolicy?.active) return customerPolicy;
    }

    // Fall back to org-wide default (customerId = null)
    // Prisma unique constraint treats null distinctly, so we query directly
    const orgPolicy = await this.prisma.slaPolicy.findFirst({
      where: { orgId, customerId: null, active: true },
      include: { rules: { where: { active: true } } },
    });
    return orgPolicy;
  }

  async createPolicy(data: any): Promise<any> {
    return this.prisma.slaPolicy.create({
      data: {
        ...data,
        rules: data.rules ? { create: data.rules } : undefined,
      },
      include: { rules: true },
    });
  }

  async updatePolicy(id: string, data: any): Promise<any> {
    const { rules, ...policyData } = data;

    return this.prisma.$transaction(async (tx) => {
      // Update the policy itself
      await tx.slaPolicy.update({
        where: { id },
        data: policyData,
      });

      // If rules are provided, replace them (delete existing, create new)
      if (rules) {
        await tx.slaRule.deleteMany({ where: { policyId: id } });
        for (const rule of rules) {
          await tx.slaRule.create({
            data: { ...rule, policyId: id },
          });
        }
      }

      return tx.slaPolicy.findUnique({
        where: { id },
        include: { rules: true },
      });
    });
  }

  async deactivatePolicy(id: string): Promise<any> {
    return this.prisma.slaPolicy.update({
      where: { id },
      data: { active: false },
    });
  }

  async findRulesByPolicyId(policyId: string): Promise<any[]> {
    return this.prisma.slaRule.findMany({
      where: { policyId },
      orderBy: { ruleType: 'asc' },
    });
  }

  async findActiveRulesByType(policyId: string, ruleType: string): Promise<any[]> {
    return this.prisma.slaRule.findMany({
      where: { policyId, ruleType, active: true },
    });
  }

  // ── Evaluation operations ──

  async findEvaluations(filters: EvaluationFilters): Promise<{ items: any[]; total: number }> {
    const where: any = {};
    if (filters.orgId) where.orgId = filters.orgId;
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.ruleType?.length) where.ruleType = { in: filters.ruleType };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.customerId) where.customerId = filters.customerId;

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const [items, total] = await Promise.all([
      this.prisma.slaEvaluation.findMany({
        where,
        orderBy: { slaDueAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.slaEvaluation.count({ where }),
    ]);

    return { items, total };
  }

  async findEvaluationsByEntity(entityType: string, entityId: string): Promise<any[]> {
    return this.prisma.slaEvaluation.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveEvaluationsDueBefore(dueDate: Date): Promise<any[]> {
    return this.prisma.slaEvaluation.findMany({
      where: {
        status: { in: ['active', 'warning'] },
        slaDueAt: { lte: dueDate },
      },
    });
  }

  async findActiveEvaluationsWarningBefore(warningDate: Date): Promise<any[]> {
    return this.prisma.slaEvaluation.findMany({
      where: {
        status: 'active',
        warningAt: { lte: warningDate },
      },
    });
  }

  async createEvaluation(data: any): Promise<any> {
    return this.prisma.slaEvaluation.create({ data });
  }

  /**
   * Atomically updates evaluation status using optimistic locking.
   * The currentStatus parameter acts as a guard — if the evaluation has already
   * transitioned (e.g., another handler or the cron worker got there first),
   * this returns null instead of making a stale update.
   */
  async updateEvaluationStatus(id: string, currentStatus: string, update: any): Promise<any | null> {
    try {
      return await this.prisma.slaEvaluation.update({
        where: { id, status: currentStatus },
        data: update,
      });
    } catch (err: any) {
      // Prisma P2025 = record not found (status already changed)
      if (err.code === 'P2025') return null;
      throw err;
    }
  }

  async getEvaluationSummary(orgId: string): Promise<EvaluationSummary> {
    const counts = await this.prisma.slaEvaluation.groupBy({
      by: ['status'],
      where: { orgId },
      _count: true,
    });

    const summary: EvaluationSummary = { active: 0, warning: 0, breached: 0, met: 0, total: 0 };
    for (const row of counts) {
      const status = row.status as keyof Omit<EvaluationSummary, 'total'>;
      if (status in summary) {
        summary[status] = row._count;
      }
      summary.total += row._count;
    }
    return summary;
  }
}
