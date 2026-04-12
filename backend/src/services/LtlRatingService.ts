/**
 * LtlRatingService — LTL-specific rating logic.
 *
 * Handles class-based rating, weight breaks, deficit weight calculation,
 * FAK (Freight All Kinds) overrides, and minimum charge thresholds.
 */

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface LtlRateRequest {
  items: LtlRateItem[];
  accessorialRates?: Record<string, number>;  // From LaneCarrier.accessorialRates
  ltlRateMatrix?: LtlRateMatrix;             // From LaneCarrier.accessorialRates.ltlRateMatrix
  minimumChargeCents?: number;
  fakClass?: string;  // Freight All Kinds override class
  requestedAccessorials?: string[];  // e.g., ['liftgate_delivery', 'residential_delivery']
}

export interface LtlRateItem {
  weight: number;       // In lbs
  freightClass: string; // e.g., "100", "85", "150"
  quantity: number;
  description?: string;
}

// Rate matrix: { "100": { "M": 8500, "500": 7200, "1000": 6000, ... } }
// Keys = freight class, sub-keys = weight break (lbs), values = cents per CWT
export type LtlRateMatrix = Record<string, Record<string, number>>;

export interface LtlRateBreakdown {
  lineItems: LtlRateLineItem[];
  linehaulCents: number;
  accessorialsCents: number;
  totalCents: number;
  totalWeight: number;
  deficitWeightApplied: boolean;
}

export interface LtlRateLineItem {
  description: string;
  chargeType: string;
  freightClass: string;
  weight: number;
  ratedWeight: number;  // May differ from declared weight (deficit weight)
  ratePerCwt: number;   // In cents
  amountCents: number;
  accessorialCode?: string;
}

// ─── Standard freight classes ───────────────────────────────────────────────

const FREIGHT_CLASSES = [
  '50', '55', '60', '65', '70', '77.5', '85', '92.5',
  '100', '110', '125', '150', '175', '200', '250', '300', '400', '500',
];

const STANDARD_WEIGHT_BREAKS = ['M', '500', '1000', '2000', '5000', '10000', '20000'];

// LTL-specific accessorial codes
const LTL_ACCESSORIALS: Record<string, string> = {
  residential_delivery: 'Residential delivery',
  liftgate_pickup: 'Liftgate at pickup',
  liftgate_delivery: 'Liftgate at delivery',
  inside_delivery: 'Inside delivery',
  notification: 'Delivery notification',
  limited_access: 'Limited access',
  sort_and_segregate: 'Sort and segregate',
};

// ─── Interface ──────────────────────────────────────────────────────────────

export interface ILtlRatingService {
  calculateLtlRate(request: LtlRateRequest): LtlRateBreakdown;
  calculateDensityClass(weightLbs: number, lengthIn: number, widthIn: number, heightIn: number): string;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class LtlRatingService implements ILtlRatingService {

  calculateLtlRate(request: LtlRateRequest): LtlRateBreakdown {
    const lineItems: LtlRateLineItem[] = [];
    let linehaulCents = 0;
    let totalWeight = 0;
    let deficitWeightApplied = false;

    if (!request.ltlRateMatrix) {
      return {
        lineItems: [],
        linehaulCents: 0,
        accessorialsCents: 0,
        totalCents: 0,
        totalWeight: 0,
        deficitWeightApplied: false,
      };
    }

    for (const item of request.items) {
      const effectiveClass = request.fakClass ?? item.freightClass;
      const itemWeight = item.weight * item.quantity;
      totalWeight += itemWeight;

      const classRates = request.ltlRateMatrix[effectiveClass];
      if (!classRates) {
        // No rate for this class — skip
        continue;
      }

      // Find the applicable weight break
      const { ratePerCwt, ratedWeight, isDeficit } = this.findBestRate(
        classRates, itemWeight
      );

      if (isDeficit) deficitWeightApplied = true;

      const cwt = ratedWeight / 100;
      const amount = Math.round(cwt * ratePerCwt);

      linehaulCents += amount;

      lineItems.push({
        description: item.description ?? `${effectiveClass} class freight`,
        chargeType: 'linehaul',
        freightClass: effectiveClass,
        weight: itemWeight,
        ratedWeight,
        ratePerCwt,
        amountCents: amount,
      });
    }

    // Apply minimum charge
    if (request.minimumChargeCents && linehaulCents < request.minimumChargeCents) {
      linehaulCents = request.minimumChargeCents;
      // Adjust the last line item or add a minimum charge line
      if (lineItems.length > 0) {
        const diff = request.minimumChargeCents - lineItems.reduce((s, l) => s + l.amountCents, 0);
        if (diff > 0) {
          lineItems.push({
            description: 'Minimum charge adjustment',
            chargeType: 'linehaul',
            freightClass: '',
            weight: 0,
            ratedWeight: 0,
            ratePerCwt: 0,
            amountCents: diff,
          });
        }
      }
    }

    // Calculate accessorials
    let accessorialsCents = 0;
    if (request.requestedAccessorials && request.accessorialRates) {
      for (const code of request.requestedAccessorials) {
        const rate = request.accessorialRates[code];
        if (rate) {
          const rateCents = Math.round(rate * 100); // stored as dollars in accessorialRates
          accessorialsCents += rateCents;
          lineItems.push({
            description: LTL_ACCESSORIALS[code] ?? code,
            chargeType: 'accessorial',
            freightClass: '',
            weight: 0,
            ratedWeight: 0,
            ratePerCwt: 0,
            amountCents: rateCents,
            accessorialCode: code,
          });
        }
      }
    }

    return {
      lineItems,
      linehaulCents,
      accessorialsCents,
      totalCents: linehaulCents + accessorialsCents,
      totalWeight,
      deficitWeightApplied,
    };
  }

  /**
   * Find the best rate considering deficit weight.
   *
   * Deficit weight: if charging at the next higher weight break (with a
   * lower per-CWT rate) produces a lower total cost, use that weight
   * break instead. The shipper pays for more weight but at a cheaper rate.
   */
  private findBestRate(
    classRates: Record<string, number>,
    actualWeight: number
  ): { ratePerCwt: number; ratedWeight: number; isDeficit: boolean } {
    // Sort weight breaks numerically (M = 0)
    const breaks = Object.keys(classRates)
      .map(k => ({ key: k, weight: k === 'M' ? 0 : parseInt(k, 10) }))
      .sort((a, b) => a.weight - b.weight);

    // Find the applicable break for the actual weight
    let applicableBreak = breaks[0];
    for (const brk of breaks) {
      if (actualWeight >= brk.weight) {
        applicableBreak = brk;
      }
    }

    const baseRate = classRates[applicableBreak.key];
    const baseCost = Math.round((actualWeight / 100) * baseRate);

    // Check deficit weight: would a higher weight break be cheaper?
    let bestRate = baseRate;
    let bestWeight = actualWeight;
    let bestCost = baseCost;
    let isDeficit = false;

    const currentIdx = breaks.indexOf(applicableBreak);
    for (let i = currentIdx + 1; i < breaks.length; i++) {
      const nextBreak = breaks[i];
      const nextRate = classRates[nextBreak.key];
      if (!nextRate) continue;

      const nextCost = Math.round((nextBreak.weight / 100) * nextRate);
      if (nextCost < bestCost) {
        bestRate = nextRate;
        bestWeight = nextBreak.weight;
        bestCost = nextCost;
        isDeficit = true;
      }
    }

    return { ratePerCwt: bestRate, ratedWeight: bestWeight, isDeficit };
  }

  /**
   * Calculate freight class from density (weight / cubic volume).
   * Uses standard NMFC density-based classification.
   */
  calculateDensityClass(
    weightLbs: number,
    lengthIn: number,
    widthIn: number,
    heightIn: number
  ): string {
    const cubicFeet = (lengthIn * widthIn * heightIn) / 1728;
    if (cubicFeet === 0) return '100'; // default

    const density = weightLbs / cubicFeet; // lbs per cubic foot

    // Standard density-to-class mapping
    if (density >= 50) return '50';
    if (density >= 35) return '55';
    if (density >= 30) return '60';
    if (density >= 22.5) return '65';
    if (density >= 15) return '70';
    if (density >= 13.5) return '77.5';
    if (density >= 12) return '85';
    if (density >= 10.5) return '92.5';
    if (density >= 9) return '100';
    if (density >= 8) return '110';
    if (density >= 7) return '125';
    if (density >= 6) return '150';
    if (density >= 5) return '175';
    if (density >= 4) return '200';
    if (density >= 3) return '250';
    if (density >= 2) return '300';
    if (density >= 1) return '400';
    return '500';
  }
}
