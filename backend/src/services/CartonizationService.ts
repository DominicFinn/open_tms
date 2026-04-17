import { PrismaClient } from '@prisma/client';

/**
 * CartonizationService recommends the smallest viable carton for a set of items.
 *
 * Algorithm: First-Fit-Decreasing by volume.
 * 1. Look up dimensions for each item (ProductUom first, then OrderLineItem fallback)
 * 2. Calculate total volume and weight of all items
 * 3. Sort available cartons by volume ascending
 * 4. Pick the smallest carton that fits both volume and weight
 * 5. Return recommendation with utilization percentage and fallback options
 */

export interface ItemDimensions {
  sku: string;
  quantity: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightGrams: number;
}

export interface CartonRecommendation {
  cartonId: string;
  cartonName: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  maxWeightGrams: number;
  unitCostCents: number | null;
  volumeUtilization: number;    // 0-100%
  weightUtilization: number;    // 0-100%
  fits: boolean;
}

export interface CartonizationResult {
  recommended: CartonRecommendation | null;
  alternatives: CartonRecommendation[];
  totalItemVolumeMm3: number;
  totalItemWeightGrams: number;
  itemsMissingDimensions: string[];   // SKUs without dimension data
}

export interface ICartonizationService {
  recommend(locationId: string, orgId: string, items: Array<{ sku: string; quantity: number; orderLineItemId?: string }>): Promise<CartonizationResult>;
}

export class CartonizationService implements ICartonizationService {
  constructor(private prisma: PrismaClient) {}

  async recommend(
    locationId: string,
    orgId: string,
    items: Array<{ sku: string; quantity: number; orderLineItemId?: string }>
  ): Promise<CartonizationResult> {
    // 1. Look up dimensions for each item
    const itemDims: ItemDimensions[] = [];
    const missingDims: string[] = [];

    for (const item of items) {
      const dims = await this.lookupDimensions(orgId, item.sku, item.orderLineItemId);
      if (dims) {
        itemDims.push({
          sku: item.sku,
          quantity: item.quantity,
          lengthMm: dims.lengthMm,
          widthMm: dims.widthMm,
          heightMm: dims.heightMm,
          weightGrams: dims.weightGrams,
        });
      } else {
        missingDims.push(item.sku);
      }
    }

    // 2. Calculate totals
    // Simple volume estimate: sum of individual item volumes * quantity
    // (not true 3D bin packing, but a reasonable first approximation)
    let totalVolumeMm3 = 0;
    let totalWeightGrams = 0;

    for (const dim of itemDims) {
      const itemVolume = dim.lengthMm * dim.widthMm * dim.heightMm;
      totalVolumeMm3 += itemVolume * dim.quantity;
      totalWeightGrams += dim.weightGrams * dim.quantity;
    }

    // 3. Get available cartons, sorted by volume
    const cartons = await this.prisma.cartonCatalogue.findMany({
      where: { locationId, active: true },
      orderBy: [{ lengthMm: 'asc' }],
    });

    if (cartons.length === 0 || totalVolumeMm3 === 0) {
      return {
        recommended: null,
        alternatives: [],
        totalItemVolumeMm3: totalVolumeMm3,
        totalItemWeightGrams: totalWeightGrams,
        itemsMissingDimensions: missingDims,
      };
    }

    // 4. Score each carton
    const scored: CartonRecommendation[] = cartons.map(c => {
      const cartonVolume = c.lengthMm * c.widthMm * c.heightMm;
      const volumeUtil = (totalVolumeMm3 / cartonVolume) * 100;
      const weightUtil = (totalWeightGrams / c.maxWeightGrams) * 100;
      const fits = volumeUtil <= 100 && weightUtil <= 100;

      return {
        cartonId: c.id,
        cartonName: c.name,
        lengthMm: c.lengthMm,
        widthMm: c.widthMm,
        heightMm: c.heightMm,
        maxWeightGrams: c.maxWeightGrams,
        unitCostCents: c.unitCostCents,
        volumeUtilization: Math.round(volumeUtil * 10) / 10,
        weightUtilization: Math.round(weightUtil * 10) / 10,
        fits,
      };
    });

    // 5. Pick smallest that fits (highest utilization that's still <= 100%)
    const fittingCartons = scored.filter(c => c.fits).sort((a, b) => {
      // Prefer highest volume utilization (smallest box that fits)
      return b.volumeUtilization - a.volumeUtilization;
    });

    const recommended = fittingCartons[0] ?? null;
    const alternatives = fittingCartons.slice(1, 4); // Next 3 options

    return {
      recommended,
      alternatives,
      totalItemVolumeMm3: totalVolumeMm3,
      totalItemWeightGrams: totalWeightGrams,
      itemsMissingDimensions: missingDims,
    };
  }

  private async lookupDimensions(
    orgId: string, sku: string, orderLineItemId?: string
  ): Promise<{ lengthMm: number; widthMm: number; heightMm: number; weightGrams: number } | null> {
    // Try ProductUom first (default UOM)
    const productUom = await this.prisma.productUom.findFirst({
      where: { orgId, sku },
      orderBy: { isDefault: 'desc' },
    });

    if (productUom?.lengthMm && productUom?.widthMm && productUom?.heightMm && productUom?.weightGrams) {
      return {
        lengthMm: productUom.lengthMm,
        widthMm: productUom.widthMm,
        heightMm: productUom.heightMm,
        weightGrams: productUom.weightGrams,
      };
    }

    // Fall back to OrderLineItem dimensions
    if (orderLineItemId) {
      const lineItem = await this.prisma.orderLineItem.findUnique({
        where: { id: orderLineItemId },
      });

      if (lineItem?.length && lineItem?.width && lineItem?.height && lineItem?.weight) {
        // Convert from cm/kg to mm/grams
        const dimMultiplier = lineItem.dimUnit === 'cm' ? 10 : lineItem.dimUnit === 'm' ? 1000 : 1;
        const weightMultiplier = lineItem.weightUnit === 'kg' ? 1000 : lineItem.weightUnit === 'lb' ? 453.6 : 1;

        return {
          lengthMm: Math.round(lineItem.length * dimMultiplier),
          widthMm: Math.round(lineItem.width * dimMultiplier),
          heightMm: Math.round(lineItem.height * dimMultiplier),
          weightGrams: Math.round(lineItem.weight * weightMultiplier),
        };
      }
    }

    return null;
  }
}
