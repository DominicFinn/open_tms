/**
 * OrderCartonizationService — derive cube, density, suggested freight class,
 * pallet positions, linear feet, and rolled-up unit class from raw line + pack
 * input. Customers never enter density or linear feet; they enter pieces +
 * packaging + dims, and we compute the rest.
 *
 * Distinct from the WMS-side CartonizationService (which picks the smallest
 * shipping carton from a CartonCatalog). This one is rating-focused.
 */

import { LtlRatingService } from '../LtlRatingService.js';

const ratingService = new LtlRatingService();

export type DimUnit = 'cm' | 'in' | 'mm';
export type WeightUnit = 'kg' | 'lb' | 'g';

export interface CartonizationLineInput {
  quantity: number;
  weight?: number | null;        // per-piece weight, in `weightUnit`
  weightUnit?: WeightUnit;
  length?: number | null;        // per-piece length, in `dimUnit`
  width?: number | null;
  height?: number | null;
  dimUnit?: DimUnit;
  freightClass?: string | null;  // if customer pre-classifies, we keep theirs as a hint
}

export interface CartonizationLineResult {
  totalWeightLbs: number;       // weight × qty, normalised to lbs
  totalCubeFt: number;          // L × W × H × qty, normalised to ft³
  densityLbsPerCubeFt: number | null;
  suggestedFreightClass: string | null;  // from density (NMFC standard); null when dims absent
  warnings: string[];
}

export interface PackingSummaryInput {
  /** Number of handling units (pallets/cartons/etc.). */
  unitCount: number;
  /** External dims per unit (the packaging footprint). */
  unitLengthMm?: number | null;
  unitWidthMm?: number | null;
  unitHeightMm?: number | null;
  stackable?: boolean;
}

export interface OrderCartonizationResult {
  lines: CartonizationLineResult[];
  /** Heaviest class across all lines (LTL carriers bill the highest class on a handling unit). */
  rolledUpFreightClass: string | null;
  totalWeightLbs: number;
  totalCubeFt: number;
  /** Standard floor positions on a 53' trailer: 26 pallets at 48×40 (2 wide); halved if not stackable. */
  palletPositions: number | null;
  /** Linear feet a non-stackable / floor-loaded summary would occupy on a 53' trailer. */
  linearFeet: number | null;
}

// Unit conversions
const KG_TO_LB = 2.20462;
const G_TO_LB = 0.00220462;
const IN_TO_FT = 1 / 12;
const CM_TO_IN = 1 / 2.54;
const MM_TO_IN = 1 / 25.4;

function toLbs(weight: number, unit: WeightUnit): number {
  switch (unit) {
    case 'lb': return weight;
    case 'kg': return weight * KG_TO_LB;
    case 'g':  return weight * G_TO_LB;
  }
}

function toInches(value: number, unit: DimUnit): number {
  switch (unit) {
    case 'in': return value;
    case 'cm': return value * CM_TO_IN;
    case 'mm': return value * MM_TO_IN;
  }
}

/**
 * Compare two NMFC class codes. Returns the "higher" (more expensive) one.
 * Class strings are numeric strings like "50", "77.5", "100", "500".
 */
export function maxClass(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return parseFloat(a) >= parseFloat(b) ? a : b;
}

/**
 * Phase 2: explicit handling-unit modelling. Each unit has its own dims/weight/
 * stackable plus a list of line items assigned to it. When the unit's weight
 * or dims are set, they override the sum of the contained line items.
 */
export interface CartonizationUnitInput {
  id?: string;
  packagingTypeLengthMm?: number | null;
  packagingTypeWidthMm?: number | null;
  packagingTypeHeightMm?: number | null;
  weight?: number | null;
  weightUnit?: WeightUnit;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimUnit?: DimUnit;
  stackable?: boolean;
  lines: CartonizationLineInput[];
}

export interface CartonizationUnitResult {
  id?: string;
  totalWeightLbs: number;
  totalCubeFt: number;
  densityLbsPerCubeFt: number | null;
  rolledUpFreightClass: string | null;
  linearFeetContribution: number;
  stackable: boolean;
  weightSource: 'override' | 'lines' | 'empty';
  dimsSource: 'override' | 'packagingType' | 'lines' | 'empty';
}

export interface OrderCartonizationFromUnitsResult {
  units: CartonizationUnitResult[];
  rolledUpFreightClass: string | null;
  totalWeightLbs: number;
  totalCubeFt: number;
  unitCount: number;
  palletPositions: number;
  linearFeet: number;
}

export interface IOrderCartonizationService {
  computeLine(line: CartonizationLineInput): CartonizationLineResult;
  computeOrder(lines: CartonizationLineInput[], packingSummary?: PackingSummaryInput | null): OrderCartonizationResult;
  computeOrderFromUnits(units: CartonizationUnitInput[]): OrderCartonizationFromUnitsResult;
}

export class OrderCartonizationService implements IOrderCartonizationService {
  computeLine(line: CartonizationLineInput): CartonizationLineResult {
    const warnings: string[] = [];
    const qty = Math.max(0, Math.floor(line.quantity || 0));
    const weightUnit: WeightUnit = line.weightUnit ?? 'kg';
    const dimUnit: DimUnit = line.dimUnit ?? 'cm';

    const perPieceWeightLbs = (line.weight != null && line.weight > 0) ? toLbs(line.weight, weightUnit) : 0;
    const totalWeightLbs = perPieceWeightLbs * qty;

    const hasDims = (line.length ?? 0) > 0 && (line.width ?? 0) > 0 && (line.height ?? 0) > 0;
    let totalCubeFt = 0;
    let densityLbsPerCubeFt: number | null = null;
    let suggestedFreightClass: string | null = null;

    if (hasDims) {
      const Lin = toInches(line.length!, dimUnit);
      const Win = toInches(line.width!, dimUnit);
      const Hin = toInches(line.height!, dimUnit);
      const perPieceCubeFt = (Lin * Win * Hin) / 1728;
      totalCubeFt = perPieceCubeFt * qty;

      if (totalCubeFt > 0 && totalWeightLbs > 0) {
        densityLbsPerCubeFt = totalWeightLbs / totalCubeFt;
        suggestedFreightClass = ratingService.calculateDensityClass(perPieceWeightLbs, Lin, Win, Hin);
      } else if (totalWeightLbs <= 0) {
        warnings.push('Weight is required to compute density and suggested freight class.');
      }
    } else if (qty > 0) {
      warnings.push('Dimensions are required to compute cube, density, and suggested freight class.');
    }

    return {
      totalWeightLbs: Number(totalWeightLbs.toFixed(2)),
      totalCubeFt: Number(totalCubeFt.toFixed(4)),
      densityLbsPerCubeFt: densityLbsPerCubeFt != null ? Number(densityLbsPerCubeFt.toFixed(2)) : null,
      suggestedFreightClass,
      warnings,
    };
  }

  computeOrder(lines: CartonizationLineInput[], packingSummary?: PackingSummaryInput | null): OrderCartonizationResult {
    const lineResults = lines.map(l => this.computeLine(l));

    const totalWeightLbs = lineResults.reduce((s, r) => s + r.totalWeightLbs, 0);
    const totalCubeFt    = lineResults.reduce((s, r) => s + r.totalCubeFt, 0);

    // Rolled-up class: the highest class across lines that have one (either
    // customer-supplied or density-derived). When neither, this stays null.
    let rolledUp: string | null = null;
    for (let i = 0; i < lines.length; i++) {
      const userClass = lines[i].freightClass ?? null;
      const suggested = lineResults[i].suggestedFreightClass;
      rolledUp = maxClass(rolledUp, maxClass(userClass, suggested));
    }

    let palletPositions: number | null = null;
    let linearFeet: number | null = null;

    if (packingSummary && packingSummary.unitCount > 0) {
      palletPositions = packingSummary.stackable === false
        ? packingSummary.unitCount
        : Math.ceil(packingSummary.unitCount / 2);

      // Linear feet on a 53' (636 in) trailer, 100" wide (2 pallets across at
      // 48"×40"). One pallet is 48" deep => 4 linear feet. Halve when
      // stackable so 2 pallets share a floor position.
      const unitLengthIn = packingSummary.unitLengthMm
        ? toInches(packingSummary.unitLengthMm, 'mm')
        : 48; // sensible GMA default
      const unitDepthFt = unitLengthIn * IN_TO_FT;
      const positions = packingSummary.stackable === false
        ? packingSummary.unitCount
        : Math.ceil(packingSummary.unitCount / 2);
      linearFeet = Number((positions * unitDepthFt).toFixed(2));
    }

    return {
      lines: lineResults,
      rolledUpFreightClass: rolledUp,
      totalWeightLbs: Number(totalWeightLbs.toFixed(2)),
      totalCubeFt: Number(totalCubeFt.toFixed(4)),
      palletPositions,
      linearFeet,
    };
  }

  /**
   * Phase 2: compute cartonization from explicit handling units. Each unit's
   * weight/dims override the sum of its contained line items; when neither
   * override nor lines are present, the packagingType's external dims are the
   * fallback. Rolled-up class on a unit is the max of its line classes.
   */
  computeOrderFromUnits(units: CartonizationUnitInput[]): OrderCartonizationFromUnitsResult {
    const unitResults: CartonizationUnitResult[] = units.map(u => this.computeUnit(u));

    const totalWeightLbs = unitResults.reduce((s, r) => s + r.totalWeightLbs, 0);
    const totalCubeFt    = unitResults.reduce((s, r) => s + r.totalCubeFt, 0);

    let rolledUp: string | null = null;
    for (const r of unitResults) rolledUp = maxClass(rolledUp, r.rolledUpFreightClass);

    // Pallet positions: stackable units share floor space (2-deep), unstackable
    // ones each take their own. Compute the partition then sum.
    const stackableCount = unitResults.filter(r => r.stackable).length;
    const unstackableCount = unitResults.length - stackableCount;
    const palletPositions = Math.ceil(stackableCount / 2) + unstackableCount;

    const linearFeet = unitResults.reduce((s, r) => s + r.linearFeetContribution, 0);

    return {
      units: unitResults,
      rolledUpFreightClass: rolledUp,
      totalWeightLbs: Number(totalWeightLbs.toFixed(2)),
      totalCubeFt: Number(totalCubeFt.toFixed(4)),
      unitCount: unitResults.length,
      palletPositions,
      linearFeet: Number(linearFeet.toFixed(2)),
    };
  }

  private computeUnit(unit: CartonizationUnitInput): CartonizationUnitResult {
    const stackable = unit.stackable !== false;
    const lineResults = unit.lines.map(l => this.computeLine(l));
    const linesTotalWeightLbs = lineResults.reduce((s, r) => s + r.totalWeightLbs, 0);
    const linesTotalCubeFt    = lineResults.reduce((s, r) => s + r.totalCubeFt, 0);

    // Weight: override wins over sum of lines.
    let totalWeightLbs = linesTotalWeightLbs;
    let weightSource: CartonizationUnitResult['weightSource'] = linesTotalWeightLbs > 0 ? 'lines' : 'empty';
    if (unit.weight != null && unit.weight > 0) {
      totalWeightLbs = toLbs(unit.weight, unit.weightUnit ?? 'kg');
      weightSource = 'override';
    }

    // Dimensions: explicit override > packagingType external dims > sum of lines.
    let totalCubeFt = linesTotalCubeFt;
    let dimsSource: CartonizationUnitResult['dimsSource'] = linesTotalCubeFt > 0 ? 'lines' : 'empty';
    let unitLengthIn: number | null = null;
    const hasOverrideDims = (unit.length ?? 0) > 0 && (unit.width ?? 0) > 0 && (unit.height ?? 0) > 0;
    if (hasOverrideDims) {
      const dimUnit: DimUnit = unit.dimUnit ?? 'cm';
      const Lin = toInches(unit.length!, dimUnit);
      const Win = toInches(unit.width!, dimUnit);
      const Hin = toInches(unit.height!, dimUnit);
      totalCubeFt = (Lin * Win * Hin) / 1728;
      unitLengthIn = Lin;
      dimsSource = 'override';
    } else if (unit.packagingTypeLengthMm && unit.packagingTypeWidthMm && unit.packagingTypeHeightMm) {
      const Lin = toInches(unit.packagingTypeLengthMm, 'mm');
      const Win = toInches(unit.packagingTypeWidthMm, 'mm');
      const Hin = toInches(unit.packagingTypeHeightMm, 'mm');
      totalCubeFt = (Lin * Win * Hin) / 1728;
      unitLengthIn = Lin;
      dimsSource = 'packagingType';
    }

    const densityLbsPerCubeFt = (totalCubeFt > 0 && totalWeightLbs > 0)
      ? Number((totalWeightLbs / totalCubeFt).toFixed(2))
      : null;

    // Rolled-up class for this unit = highest class across its lines (user-supplied
    // or density-derived). For unit-level density-based class we'd need the
    // packaging-type density, which we don't compute here; defer to lines.
    let rolledUp: string | null = null;
    for (let i = 0; i < unit.lines.length; i++) {
      const userClass = unit.lines[i].freightClass ?? null;
      const suggested = lineResults[i].suggestedFreightClass;
      rolledUp = maxClass(rolledUp, maxClass(userClass, suggested));
    }

    // Linear feet contribution. If stackable, this unit shares a floor
    // position; we model that by halving its depth contribution. If we don't
    // know the unit length, fall back to 4 ft (48" GMA depth).
    const depthFt = (unitLengthIn ?? 48) * IN_TO_FT;
    const linearFeetContribution = stackable ? depthFt / 2 : depthFt;

    return {
      id: unit.id,
      totalWeightLbs: Number(totalWeightLbs.toFixed(2)),
      totalCubeFt: Number(totalCubeFt.toFixed(4)),
      densityLbsPerCubeFt,
      rolledUpFreightClass: rolledUp,
      linearFeetContribution: Number(linearFeetContribution.toFixed(2)),
      stackable,
      weightSource,
      dimsSource,
    };
  }
}
