import { PrismaClient, PutawayRule, WarehouseBin } from '@prisma/client';

/**
 * Evaluates putaway rules to determine the target bin for a received unit.
 * Rules are evaluated in priority order (lower = higher priority). First match wins.
 * If no rule matches, falls back to first available bin in default bulk storage zone.
 */

export interface PutawayTarget {
  targetBinId: string;
  targetBinLabel: string;
  ruleId: string | null;    // null if fallback
  ruleName: string | null;
}

export interface UnitAttributes {
  sku: string;
  temperatureRequirement?: string | null;
  hazmat?: boolean;
  customerId?: string | null;
  unitType?: string;
  crossDock?: boolean;
  /** Enable consolidation: prefer bins where this SKU already has inventory */
  consolidate?: boolean;
}

export interface IPutawayRuleEvaluator {
  evaluate(locationId: string, unit: UnitAttributes): Promise<PutawayTarget | null>;
}

export class PutawayRuleEvaluator implements IPutawayRuleEvaluator {
  constructor(private prisma: PrismaClient) {}

  async evaluate(locationId: string, unit: UnitAttributes): Promise<PutawayTarget | null> {
    // Fetch active rules for this location, ordered by priority
    const rules = await this.prisma.putawayRule.findMany({
      where: { locationId, active: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      if (this.matches(rule, unit)) {
        const bin = await this.resolveTarget(rule, unit);
        if (bin) {
          return {
            targetBinId: bin.id,
            targetBinLabel: bin.label,
            ruleId: rule.id,
            ruleName: rule.name,
          };
        }
      }
    }

    // Fallback: first available bin in any bulk_storage zone
    const fallbackBin = await this.prisma.warehouseBin.findFirst({
      where: {
        locationId,
        active: true,
        zone: { zoneType: 'bulk_storage', active: true },
      },
      orderBy: { walkSequence: 'asc' },
    });

    if (fallbackBin) {
      return {
        targetBinId: fallbackBin.id,
        targetBinLabel: fallbackBin.label,
        ruleId: null,
        ruleName: null,
      };
    }

    return null; // No bins available at all
  }

  private matches(rule: PutawayRule, unit: UnitAttributes): boolean {
    // All non-null criteria must match (AND logic)
    if (rule.skuPattern && !this.globMatch(unit.sku, rule.skuPattern)) return false;
    if (rule.temperatureRequirement && unit.temperatureRequirement !== rule.temperatureRequirement) return false;
    if (rule.hazmat !== null && rule.hazmat !== undefined && unit.hazmat !== rule.hazmat) return false;
    if (rule.customerId && unit.customerId !== rule.customerId) return false;
    if (rule.unitType && unit.unitType !== rule.unitType) return false;
    // crossDockSortBy is only relevant if unit is cross-dock
    if (rule.crossDockSortBy && !unit.crossDock) return false;
    return true;
  }

  private globMatch(value: string, pattern: string): boolean {
    // Simple glob: * matches any sequence of characters
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return regex.test(value);
  }

  private async resolveTarget(rule: PutawayRule, unit?: UnitAttributes): Promise<WarehouseBin | null> {
    if (rule.targetType === 'specific_bin' && rule.targetBinId) {
      return this.prisma.warehouseBin.findFirst({
        where: { id: rule.targetBinId, active: true },
      });
    }

    if (rule.targetType === 'zone' && rule.targetZoneId) {
      // Consolidation: prefer a bin where this SKU already has inventory
      if (unit?.consolidate && unit.sku) {
        const consolidatedBin = await this.findConsolidationBin(rule.targetZoneId, unit.sku);
        if (consolidatedBin) return consolidatedBin;
      }
      // First available bin in zone
      return this.prisma.warehouseBin.findFirst({
        where: { zoneId: rule.targetZoneId, active: true },
        orderBy: { walkSequence: 'asc' },
      });
    }

    if (rule.targetType === 'next_available_in_zone' && rule.targetZoneId) {
      // Consolidation: prefer a bin where this SKU already has inventory
      if (unit?.consolidate && unit.sku) {
        const consolidatedBin = await this.findConsolidationBin(rule.targetZoneId, unit.sku);
        if (consolidatedBin) return consolidatedBin;
      }

      // Find bin with available capacity, respecting level preference
      const orderBy: any[] = [];
      if (rule.preferLevel === 'low') orderBy.push({ level: 'asc' });
      else if (rule.preferLevel === 'high') orderBy.push({ level: 'desc' });
      orderBy.push({ walkSequence: 'asc' });

      // Fetch candidate bins and filter for capacity in application code
      const candidates = await this.prisma.warehouseBin.findMany({
        where: { zoneId: rule.targetZoneId, active: true },
        orderBy,
        take: 50,
      });
      // Pick first bin with available capacity
      return candidates.find(b =>
        b.maxPalletPositions === null || b.currentPalletCount < b.maxPalletPositions
      ) ?? null;
    }

    return null;
  }

  /**
   * Find a bin in the zone that already has inventory of the same SKU,
   * with available capacity. This keeps the same products together physically,
   * making picking faster and cycle counting easier.
   */
  private async findConsolidationBin(zoneId: string, sku: string): Promise<WarehouseBin | null> {
    // Find inventory records for this SKU in this zone's bins
    const existingInventory = await this.prisma.inventoryRecord.findMany({
      where: {
        sku,
        bin: { zoneId, active: true },
        quantityOnHand: { gt: 0 },
      },
      include: { bin: true },
      orderBy: { quantityOnHand: 'desc' },
      take: 10,
    });

    // Pick the first bin that has capacity
    for (const inv of existingInventory) {
      if (inv.bin.maxPalletPositions === null || inv.bin.currentPalletCount < inv.bin.maxPalletPositions) {
        return inv.bin;
      }
    }

    return null;
  }
}
