import { PalletType } from '@prisma/client';

export interface CartonSpec {
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
}

export interface PalletizationResult {
  palletTypeCode: string;
  palletTypeName: string;
  cartonsPerLayer: number;
  layers: number;
  totalCartons: number;
  stackedHeightMm: number;        // pallet deck + all layers
  totalWeightGrams: number;       // tare + cartons
  weightUtilizationPercent: number;
  heightUtilizationPercent: number | null; // vs maxStackHeightMm, null if no limit
  fits: boolean;                  // true if within both weight and height limits
  warnings: string[];
}

/**
 * Compute how many cartons of a given spec fit on a single pallet.
 *
 * Layer calculation: compare the two possible orientations of a carton on the
 * deck. Pick the orientation that yields more cartons per layer.
 *
 * Height calculation: stack layers until we hit either maxStackHeightMm
 * (including the pallet deck) or maxLoadGrams, whichever comes first.
 *
 * This is a simple homogeneous stacker - no mixing, no interlocking patterns.
 * Good enough for an operator-facing planning estimate.
 */
export function planHomogeneousPallet(pallet: PalletType, carton: CartonSpec): PalletizationResult {
  const warnings: string[] = [];

  if (carton.lengthMm <= 0 || carton.widthMm <= 0 || carton.heightMm <= 0 || carton.weightGrams <= 0) {
    throw new Error('Carton dimensions and weight must all be positive');
  }

  // Try both orientations
  const orientA = Math.floor(pallet.lengthMm / carton.lengthMm) * Math.floor(pallet.widthMm / carton.widthMm);
  const orientB = Math.floor(pallet.lengthMm / carton.widthMm) * Math.floor(pallet.widthMm / carton.lengthMm);
  const cartonsPerLayer = Math.max(orientA, orientB);

  if (cartonsPerLayer === 0) {
    return {
      palletTypeCode: pallet.code,
      palletTypeName: pallet.name,
      cartonsPerLayer: 0,
      layers: 0,
      totalCartons: 0,
      stackedHeightMm: pallet.heightMm,
      totalWeightGrams: pallet.tareWeightGrams,
      weightUtilizationPercent: 0,
      heightUtilizationPercent: pallet.maxStackHeightMm ? (pallet.heightMm / pallet.maxStackHeightMm) * 100 : null,
      fits: false,
      warnings: ['Carton does not fit on the pallet deck in either orientation'],
    };
  }

  // How many layers fit under the height limit
  let maxLayersByHeight = Infinity;
  if (pallet.maxStackHeightMm) {
    const usableHeight = pallet.maxStackHeightMm - pallet.heightMm;
    if (usableHeight <= 0) {
      warnings.push('Max stack height is less than the pallet deck height');
      return {
        palletTypeCode: pallet.code,
        palletTypeName: pallet.name,
        cartonsPerLayer,
        layers: 0,
        totalCartons: 0,
        stackedHeightMm: pallet.heightMm,
        totalWeightGrams: pallet.tareWeightGrams,
        weightUtilizationPercent: 0,
        heightUtilizationPercent: 100,
        fits: false,
        warnings,
      };
    }
    maxLayersByHeight = Math.floor(usableHeight / carton.heightMm);
  }

  // How many layers fit under the weight limit
  const usableWeight = pallet.maxLoadGrams;
  const weightPerLayer = carton.weightGrams * cartonsPerLayer;
  const maxLayersByWeight = weightPerLayer > 0 ? Math.floor(usableWeight / weightPerLayer) : Infinity;

  const layers = Math.max(0, Math.min(maxLayersByHeight, maxLayersByWeight));
  if (maxLayersByWeight < maxLayersByHeight) warnings.push('Weight limit reached before height limit');
  if (maxLayersByHeight < maxLayersByWeight && Number.isFinite(maxLayersByHeight)) warnings.push('Height limit reached before weight limit');

  const totalCartons = cartonsPerLayer * layers;
  const cargoWeight = totalCartons * carton.weightGrams;
  const totalWeightGrams = pallet.tareWeightGrams + cargoWeight;
  const stackedHeightMm = pallet.heightMm + layers * carton.heightMm;

  const weightUtilizationPercent = Number(((cargoWeight / pallet.maxLoadGrams) * 100).toFixed(1));
  const heightUtilizationPercent = pallet.maxStackHeightMm
    ? Number(((stackedHeightMm / pallet.maxStackHeightMm) * 100).toFixed(1))
    : null;

  return {
    palletTypeCode: pallet.code,
    palletTypeName: pallet.name,
    cartonsPerLayer,
    layers,
    totalCartons,
    stackedHeightMm,
    totalWeightGrams,
    weightUtilizationPercent,
    heightUtilizationPercent,
    fits: totalCartons > 0,
    warnings,
  };
}

/**
 * Recommend the best pallet type from a list for a given homogeneous carton
 * load. Ranks by cartons-per-pallet (desc), then weight utilization (desc).
 */
export function recommendPalletType(
  palletTypes: PalletType[],
  carton: CartonSpec,
): { best: PalletizationResult | null; all: PalletizationResult[] } {
  const results = palletTypes
    .filter(p => p.active)
    .map(p => planHomogeneousPallet(p, carton));

  const viable = results.filter(r => r.fits);
  viable.sort((a, b) => {
    if (b.totalCartons !== a.totalCartons) return b.totalCartons - a.totalCartons;
    return b.weightUtilizationPercent - a.weightUtilizationPercent;
  });
  return { best: viable[0] ?? null, all: results };
}
