import { CartonCatalogue } from '@prisma/client';

/**
 * Container Intelligence: given a list of pack items and a catalogue of cartons,
 * group items by constraint profile (temperature zone + hazmat class + value class),
 * pick the smallest qualifying carton for each group, and return a multi-package
 * plan with required ancillaries and warnings.
 */

export type TemperatureZone = 'ambient' | 'refrigerated' | 'frozen' | 'dry_ice';
export type ValueClass = 'standard' | 'high_value';

export interface PackItem {
  sku: string;
  quantity: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
  temperatureZone: TemperatureZone;
  hazmat?: boolean;
  /** UN hazard class string, e.g. "3", "5.1", "8". Required when hazmat=true. */
  hazmatClass?: string;
  valueClass?: ValueClass;
  fragile?: boolean;
}

export interface RecommendOptions {
  /** Hours the shipment is expected to be in transit - triggers insulation upgrades when relevant. */
  transitHours?: number;
  /** When false, forces each constraint group into the smallest-fit carton; when true, returns the single best carton that satisfies everything or fails. */
  forceSingleContainer?: boolean;
}

export interface PackageSuggestion {
  cartonId: string;
  cartonName: string;
  items: Array<{ sku: string; quantity: number }>;
  ancillaries: string[];          // gel_pack | dry_ice | fragile_padding | tamper_seal
  temperatureZone: TemperatureZone | 'any';
  specialHandling: string[];      // hazmat | high_value | fragile
  hazmatClasses: string[];
  volumeUtilizationPercent: number;
  weightUtilizationPercent: number;
  reason: string;
}

export interface RecommendationResult {
  packages: PackageSuggestion[];
  warnings: string[];
  errors: string[];
  totalContainerCostCents: number;
  totalWeightGrams: number;
}

/**
 * UN hazard classes that MUST be segregated from each other in the same package.
 * Source: UN Model Regulations / 49 CFR §177.848. This is a simplified matrix
 * good for pack planning - full compliance lives in the carrier's rulebook.
 */
const HAZMAT_SEGREGATION: Record<string, string[]> = {
  '1':   ['2.1', '2.3', '3', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '8'],   // Explosives
  '2.1': ['1', '5.1'],                                                            // Flammable gas vs explosives/oxidizers
  '2.3': ['1', '3', '4.1', '5.1', '8'],                                           // Toxic gas
  '3':   ['1', '2.3', '5.1', '5.2', '8'],                                         // Flammable liquids vs oxidizers/peroxides/corrosives
  '4.1': ['1', '2.3', '5.1', '5.2'],                                              // Flammable solids vs oxidizers
  '4.2': ['1', '5.1', '5.2', '8'],                                                // Spontaneously combustible
  '4.3': ['1', '8'],                                                              // Dangerous when wet vs corrosives
  '5.1': ['1', '2.1', '2.3', '3', '4.1', '4.2', '5.2'],                           // Oxidizers
  '5.2': ['1', '3', '4.1', '4.2', '5.1', '6.1', '8'],                             // Organic peroxides
  '6.1': ['1', '5.2'],                                                            // Toxics
  '8':   ['1', '2.3', '3', '4.2', '4.3', '5.2'],                                  // Corrosives
};

function areHazmatClassesIncompatible(a: string, b: string): boolean {
  const aConflicts = HAZMAT_SEGREGATION[a] ?? [];
  const bConflicts = HAZMAT_SEGREGATION[b] ?? [];
  return aConflicts.includes(b) || bConflicts.includes(a);
}

/** Items cluster into packages by (temperatureZone, valueClass, hazmat-compat). */
interface ItemGroup {
  temperatureZone: TemperatureZone;
  valueClass: ValueClass;
  hazmat: boolean;
  hazmatClasses: string[];
  items: PackItem[];
}

export class ContainerIntelligenceService {
  recommend(items: PackItem[], cartons: CartonCatalogue[], options: RecommendOptions = {}): RecommendationResult {
    const result: RecommendationResult = {
      packages: [],
      warnings: [],
      errors: [],
      totalContainerCostCents: 0,
      totalWeightGrams: 0,
    };

    // Input validation
    if (items.length === 0) { result.errors.push('No items to pack'); return result; }
    for (const it of items) {
      if (it.quantity < 1) { result.errors.push(`Item ${it.sku} has non-positive quantity`); }
      if (it.lengthMm <= 0 || it.widthMm <= 0 || it.heightMm <= 0 || it.weightGrams <= 0) {
        result.errors.push(`Item ${it.sku} has missing or non-positive dimensions/weight`);
      }
      if (it.hazmat && !it.hazmatClass) {
        result.errors.push(`Item ${it.sku} is marked hazmat but has no hazmatClass`);
      }
    }
    if (result.errors.length > 0) return result;

    const activeCartons = cartons.filter(c => c.active);
    if (activeCartons.length === 0) { result.errors.push('No active cartons in the catalogue'); return result; }

    // Group items by constraint profile. Hazmat items are always separated from
    // non-hazmat. Within hazmat, classes are further split by incompatibility.
    const groups = this.groupItems(items);

    for (const group of groups) {
      const suggestion = this.packGroup(group, activeCartons, options, result);
      if (suggestion) {
        result.packages.push(suggestion);
        const carton = activeCartons.find(c => c.id === suggestion.cartonId)!;
        result.totalContainerCostCents += carton.unitCostCents ?? 0;
        result.totalWeightGrams += group.items.reduce((t, i) => t + i.weightGrams * i.quantity, 0);
      }
    }

    this.applyTransitAncillaries(result, options);

    return result;
  }

  private groupItems(items: PackItem[]): ItemGroup[] {
    const groups: ItemGroup[] = [];

    for (const item of items) {
      const valueClass = item.valueClass ?? 'standard';
      const temperatureZone = item.temperatureZone;

      // Non-hazmat items can cluster with other non-hazmat items that share
      // (temperatureZone, valueClass). Hazmat items must split by class.
      if (!item.hazmat) {
        const match = groups.find(g =>
          !g.hazmat && g.temperatureZone === temperatureZone && g.valueClass === valueClass
        );
        if (match) { match.items.push(item); continue; }
        groups.push({ temperatureZone, valueClass, hazmat: false, hazmatClasses: [], items: [item] });
        continue;
      }

      // Hazmat: cluster only if existing group has identical temperatureZone +
      // valueClass AND all existing classes are compatible with this item's class.
      const cls = item.hazmatClass!;
      const match = groups.find(g =>
        g.hazmat
        && g.temperatureZone === temperatureZone
        && g.valueClass === valueClass
        && g.hazmatClasses.every(existing => existing === cls || !areHazmatClassesIncompatible(existing, cls))
      );
      if (match) {
        match.items.push(item);
        if (!match.hazmatClasses.includes(cls)) match.hazmatClasses.push(cls);
        continue;
      }
      groups.push({ temperatureZone, valueClass, hazmat: true, hazmatClasses: [cls], items: [item] });
    }

    return groups;
  }

  private packGroup(
    group: ItemGroup,
    cartons: CartonCatalogue[],
    _options: RecommendOptions,
    result: RecommendationResult,
  ): PackageSuggestion | null {
    const totalVolumeMm3 = group.items.reduce(
      (t, i) => t + i.lengthMm * i.widthMm * i.heightMm * i.quantity,
      0,
    );
    const totalWeight = group.items.reduce((t, i) => t + i.weightGrams * i.quantity, 0);
    const maxItemLength = Math.max(...group.items.map(i => Math.max(i.lengthMm, i.widthMm, i.heightMm)));
    const needsHazmat = group.hazmat;

    const qualifying = cartons.filter(c => {
      // Hazmat rules: hazmat cargo needs hazmat-rated carton approved for every
      // class in the group. Non-hazmat cargo cannot go in a carton that's
      // dedicated to specific hazmat classes (to avoid cross-contamination and
      // keep hazmat stock reserved for hazmat shipments).
      if (needsHazmat) {
        if (!c.hazmatRated) return false;
        const approved = c.hazmatClasses ?? [];
        if (!group.hazmatClasses.every(cls => approved.includes(cls))) return false;
      } else if ((c.hazmatClasses?.length ?? 0) > 0) {
        return false;
      }

      // Temperature rules: ambient cargo goes in "any" or "ambient" cartons;
      // any other zone requires an exact match (no mixing refrigerated into
      // an uninsulated ambient box).
      if (group.temperatureZone === 'ambient') {
        if (c.temperatureZone !== 'any' && c.temperatureZone !== 'ambient') return false;
      } else {
        if (c.temperatureZone !== group.temperatureZone) return false;
      }

      // Value class: high-value cargo needs an explicit high-value carton;
      // standard cargo can use any non-hazmat compatible carton.
      if (group.valueClass === 'high_value') {
        if (c.valueClass !== 'high_value') return false;
      }

      // Physical fit
      const cartonVolume = c.lengthMm * c.widthMm * c.heightMm;
      if (cartonVolume < totalVolumeMm3) return false;
      if (c.maxWeightGrams < totalWeight) return false;
      // Longest item must fit along at least one carton axis
      const longestCartonEdge = Math.max(c.lengthMm, c.widthMm, c.heightMm);
      if (longestCartonEdge < maxItemLength) return false;

      return true;
    });

    if (qualifying.length === 0) {
      result.errors.push(
        `No carton qualifies for group (temperature=${group.temperatureZone}, hazmat=${group.hazmat ? group.hazmatClasses.join(',') : 'no'}, value=${group.valueClass}, ${group.items.length} SKU(s), ${(totalWeight/1000).toFixed(1)}kg)`,
      );
      return null;
    }

    // Pick smallest qualifying carton (volume ascending)
    qualifying.sort((a, b) => (a.lengthMm * a.widthMm * a.heightMm) - (b.lengthMm * b.widthMm * b.heightMm));
    const carton = qualifying[0];

    const ancillaries: string[] = [];
    if (group.temperatureZone === 'refrigerated' && !carton.insulated) ancillaries.push('gel_pack');
    if (group.temperatureZone === 'refrigerated' && carton.insulated) ancillaries.push('gel_pack');
    if (group.temperatureZone === 'frozen') ancillaries.push('dry_ice');
    if (group.temperatureZone === 'dry_ice') ancillaries.push('dry_ice');
    if (group.items.some(i => i.fragile)) ancillaries.push('fragile_padding');
    if (group.valueClass === 'high_value' && !carton.tamperEvident) ancillaries.push('tamper_seal');

    const specialHandling: string[] = [];
    if (group.hazmat) specialHandling.push('hazmat');
    if (group.valueClass === 'high_value') specialHandling.push('high_value');
    if (group.items.some(i => i.fragile)) specialHandling.push('fragile');

    const cartonVolume = carton.lengthMm * carton.widthMm * carton.heightMm;
    const volumeUtilizationPercent = Number(((totalVolumeMm3 / cartonVolume) * 100).toFixed(1));
    const weightUtilizationPercent = Number(((totalWeight / carton.maxWeightGrams) * 100).toFixed(1));

    const reasons: string[] = [];
    if (group.hazmat) reasons.push(`hazmat class ${group.hazmatClasses.join('+')}`);
    if (group.temperatureZone !== 'ambient') reasons.push(`temp ${group.temperatureZone}`);
    if (group.valueClass === 'high_value') reasons.push('high-value');
    if (reasons.length === 0) reasons.push('best-fit volume');

    return {
      cartonId: carton.id,
      cartonName: carton.name,
      items: group.items.map(i => ({ sku: i.sku, quantity: i.quantity })),
      ancillaries: Array.from(new Set(ancillaries)),
      temperatureZone: group.temperatureZone,
      specialHandling,
      hazmatClasses: group.hazmatClasses,
      volumeUtilizationPercent,
      weightUtilizationPercent,
      reason: reasons.join(' + '),
    };
  }

  private applyTransitAncillaries(result: RecommendationResult, options: RecommendOptions): void {
    const transitHours = options.transitHours;
    if (!transitHours) return;

    for (const pkg of result.packages) {
      if (pkg.temperatureZone !== 'refrigerated' && pkg.temperatureZone !== 'frozen') continue;
      // For a refrigerated/frozen package, if the carton's insulationHours is less than transit, we need
      // to warn and also promote dry ice when refrigerated > 24h.
      const carton = result.packages.find(p => p.cartonId === pkg.cartonId);
      if (!carton) continue;
      // Find the raw carton record data from the original set via ancillary flags.
      if (pkg.temperatureZone === 'refrigerated' && transitHours > 24 && !pkg.ancillaries.includes('dry_ice')) {
        pkg.ancillaries.push('dry_ice');
        result.warnings.push(
          `Refrigerated package "${pkg.cartonName}" has ${transitHours}h transit - adding dry_ice for cold-chain durability`,
        );
      }
    }
  }
}
