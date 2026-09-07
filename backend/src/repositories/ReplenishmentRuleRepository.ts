/**
 * Replenishment rule reads (#220).
 *
 * Module: wms. The list was filtered on a client-supplied locationId alone, and the update and
 * delete handlers reached rows by bare id, so one tenant could edit or delete another's rules.
 */

import { PrismaClient, ReplenishmentRule } from '@prisma/client';

const MAX_RULES = 500;

export interface IReplenishmentRuleRepository {
  findByLocation(orgId: string, locationId: string): Promise<ReplenishmentRule[]>;
  findById(orgId: string, id: string): Promise<ReplenishmentRule | null>;
}

export class ReplenishmentRuleRepository implements IReplenishmentRuleRepository {
  constructor(private prisma: PrismaClient) {}

  async findByLocation(orgId: string, locationId: string): Promise<ReplenishmentRule[]> {
    return this.prisma.replenishmentRule.findMany({
      where: { orgId, locationId },
      orderBy: { sku: 'asc' },
      take: MAX_RULES,
    });
  }

  async findById(orgId: string, id: string): Promise<ReplenishmentRule | null> {
    return this.prisma.replenishmentRule.findFirst({ where: { id, orgId } });
  }
}
