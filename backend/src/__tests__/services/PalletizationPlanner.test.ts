import { planHomogeneousPallet, recommendPalletType, CartonSpec } from '../../services/palletization/PalletizationPlanner';
import { STANDARD_PACKAGING_TYPES } from '../../services/palletization/standardPackagingTypes';

// Build a PackagingType-shaped object (Prisma row) from a spec
function mkPallet(code: string, overrides: Partial<any> = {}): any {
  const spec = STANDARD_PACKAGING_TYPES.find(s => s.code === code);
  if (!spec) throw new Error(`Unknown spec ${code}`);
  return {
    id: `p-${code}`, orgId: 'org-1', createdAt: new Date(), updatedAt: new Date(), imageUrl: null,
    ...spec,
    active: true,
    ...overrides,
  };
}

describe('planHomogeneousPallet', () => {
  it('returns 0 cartons when carton is too big to fit in either orientation', () => {
    const eur1 = mkPallet('EUR1'); // 1200×800
    const tooBig: CartonSpec = { lengthMm: 1300, widthMm: 900, heightMm: 200, weightGrams: 5_000 };
    const r = planHomogeneousPallet(eur1, tooBig);
    expect(r.fits).toBe(false);
    expect(r.cartonsPerLayer).toBe(0);
    expect(r.warnings.some(w => w.includes('does not fit'))).toBe(true);
  });

  it('picks the better of two orientations', () => {
    const eur1 = mkPallet('EUR1'); // 1200×800
    // 400×300 carton: orient A = (1200/400)×(800/300) = 3×2 = 6; orient B = (1200/300)×(800/400) = 4×2 = 8
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 200, weightGrams: 5_000 };
    const r = planHomogeneousPallet(eur1, carton);
    expect(r.cartonsPerLayer).toBe(8);
  });

  it('respects the height limit', () => {
    const eur1 = mkPallet('EUR1'); // max stack 2400mm, deck 144mm -> 2256mm usable
    // 400×300×200 → 2256 / 200 = 11 layers
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 200, weightGrams: 1_000 };
    const r = planHomogeneousPallet(eur1, carton);
    expect(r.layers).toBe(11);
    expect(r.totalCartons).toBe(8 * 11);
    expect(r.stackedHeightMm).toBe(144 + 11 * 200);
  });

  it('respects the weight limit when that binds before height', () => {
    const eur1 = mkPallet('EUR1'); // max load 1,500,000 g
    // 8 cartons per layer × 100,000 g = 800,000 g per layer → 1 layer = 800k, 2 layers = 1.6M > 1.5M cap
    // maxLayersByWeight = floor(1.5M / 800k) = 1
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 200, weightGrams: 100_000 };
    const r = planHomogeneousPallet(eur1, carton);
    expect(r.layers).toBe(1);
    expect(r.totalCartons).toBe(8);
    expect(r.warnings.some(w => w.includes('Weight limit'))).toBe(true);
  });

  it('calculates weight utilization correctly', () => {
    const eur1 = mkPallet('EUR1'); // max load 1,500,000 g
    // 8/layer × 50,000 = 400k per layer → max 3 layers by weight (1.5M / 400k)
    // 8/layer × 3 layers × 50,000 = 1,200,000 g cargo → 80% weight utilization
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 500, weightGrams: 50_000 };
    const r = planHomogeneousPallet(eur1, carton);
    expect(r.layers).toBe(3);
    expect(r.weightUtilizationPercent).toBeCloseTo(80, 1);
  });

  it('rejects non-positive dimensions', () => {
    const eur1 = mkPallet('EUR1');
    expect(() => planHomogeneousPallet(eur1, { lengthMm: 0, widthMm: 100, heightMm: 100, weightGrams: 100 })).toThrow();
    expect(() => planHomogeneousPallet(eur1, { lengthMm: 100, widthMm: 100, heightMm: 100, weightGrams: 0 })).toThrow();
  });

  it('handles a pallet with no height limit', () => {
    const noHeightCap = mkPallet('EUR1', { maxStackHeightMm: null });
    // Weight binds before height here
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 100, weightGrams: 10_000 };
    const r = planHomogeneousPallet(noHeightCap, carton);
    expect(r.heightUtilizationPercent).toBeNull();
    // 8/layer × 10k = 80k per layer, 1.5M / 80k = 18 layers → 144 cartons
    expect(r.totalCartons).toBe(8 * 18);
  });
});

describe('recommendPalletType', () => {
  it('recommends the pallet type that carries the most cartons', () => {
    const eur1 = mkPallet('EUR1');      // 1200×800
    const eur2 = mkPallet('EUR2');      // 1200×1000
    const gma = mkPallet('US_GMA');    // 1219×1016
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 200, weightGrams: 5_000 };

    const { best, all } = recommendPalletType([eur1, eur2, gma], carton);
    expect(best).not.toBeNull();
    expect(all).toHaveLength(3);
    // GMA (1219×1016): 3 × 3 = 9 per layer, beats EUR1 (8) and EUR2 (3×3=9 too)
    // Actually EUR2 is 1200×1000 → orient A = 3×3 = 9, orient B = 4×2 = 8 → 9 per layer
    // GMA 1219×1016 → orient A = 3×3 = 9, orient B = 4×2 = 8 → 9 per layer
    expect(best!.cartonsPerLayer).toBeGreaterThanOrEqual(9);
  });

  it('returns null best when no pallet type fits the carton', () => {
    const quarter = mkPallet('QUARTER'); // 600×400
    const huge: CartonSpec = { lengthMm: 700, widthMm: 500, heightMm: 300, weightGrams: 5_000 };
    const { best, all } = recommendPalletType([quarter], huge);
    expect(best).toBeNull();
    expect(all).toHaveLength(1);
    expect(all[0].fits).toBe(false);
  });

  it('ignores inactive pallet types', () => {
    const active = mkPallet('EUR1');
    const inactive = mkPallet('US_GMA', { active: false });
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 200, weightGrams: 5_000 };
    const { all } = recommendPalletType([active, inactive], carton);
    expect(all).toHaveLength(1);
    expect(all[0].palletTypeCode).toBe('EUR1');
  });

  it('breaks ties by weight utilization (higher wins)', () => {
    // Craft two pallets with the same footprint but different max load.
    const a = mkPallet('EUR1', { id: 'a', maxLoadGrams: 1_000_000, code: 'A' });
    const b = mkPallet('EUR1', { id: 'b', maxLoadGrams: 2_000_000, code: 'B' });
    const carton: CartonSpec = { lengthMm: 400, widthMm: 300, heightMm: 200, weightGrams: 5_000 };
    const { best, all } = recommendPalletType([a, b], carton);
    // Both carry the same # of cartons (height-bound, not weight); higher weightUtilizationPercent wins.
    // Pallet A has smaller maxLoadGrams, so utilization is higher → A wins.
    expect(all[0].totalCartons).toBe(all[1].totalCartons);
    expect(best!.palletTypeCode).toBe('A');
  });
});
