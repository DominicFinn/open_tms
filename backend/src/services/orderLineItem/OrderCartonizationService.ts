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

export interface IOrderCartonizationService {
  computeLine(line: CartonizationLineInput): CartonizationLineResult;
  computeOrder(lines: CartonizationLineInput[], packingSummary?: PackingSummaryInput | null): OrderCartonizationResult;
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
}
