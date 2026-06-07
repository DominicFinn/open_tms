import { OrderCartonizationService, maxClass } from '../../services/orderLineItem/OrderCartonizationService';

const svc = new OrderCartonizationService();

describe('OrderCartonizationService.computeLine', () => {
  it('normalises kg/cm to lbs/cube ft and computes density', () => {
    // 10 pieces, 10 kg each = 100 kg ≈ 220.46 lbs
    // 50 × 40 × 30 cm = (19.685 × 15.748 × 11.811 in) = 3,661.4 cu in / 1728 ≈ 2.12 cu ft per piece
    // total cube = ~21.2 cu ft; density ≈ 220.46 / 21.2 ≈ 10.4 lbs/cu ft
    const result = svc.computeLine({
      quantity: 10, weight: 10, weightUnit: 'kg',
      length: 50, width: 40, height: 30, dimUnit: 'cm',
    });
    expect(result.totalWeightLbs).toBeCloseTo(220.46, 1);
    expect(result.totalCubeFt).toBeGreaterThan(20);
    expect(result.totalCubeFt).toBeLessThan(22);
    expect(result.densityLbsPerCubeFt).toBeGreaterThan(9);
    expect(result.densityLbsPerCubeFt).toBeLessThan(12);
    // density ~10 → class 92.5 or 100 from the rating service
    expect(result.suggestedFreightClass).not.toBeNull();
    expect(['92.5', '100']).toContain(result.suggestedFreightClass);
  });

  it('handles lbs/in input as-is', () => {
    const result = svc.computeLine({
      quantity: 1, weight: 100, weightUnit: 'lb',
      length: 48, width: 40, height: 36, dimUnit: 'in',
    });
    expect(result.totalWeightLbs).toBeCloseTo(100, 1);
    // 48*40*36 = 69120 / 1728 = 40 cu ft
    expect(result.totalCubeFt).toBeCloseTo(40, 1);
    expect(result.densityLbsPerCubeFt).toBeCloseTo(2.5, 1);
  });

  it('warns when dims are missing', () => {
    const r = svc.computeLine({ quantity: 5, weight: 10, weightUnit: 'kg' });
    expect(r.totalCubeFt).toBe(0);
    expect(r.densityLbsPerCubeFt).toBeNull();
    expect(r.suggestedFreightClass).toBeNull();
    expect(r.warnings.some(w => w.toLowerCase().includes('dimension'))).toBe(true);
  });

  it('warns when weight is missing but dims present', () => {
    const r = svc.computeLine({ quantity: 5, length: 10, width: 10, height: 10, dimUnit: 'in' });
    expect(r.totalCubeFt).toBeGreaterThan(0);
    expect(r.densityLbsPerCubeFt).toBeNull();
    expect(r.warnings.some(w => w.toLowerCase().includes('weight'))).toBe(true);
  });

  it('high density correctly maps to a low (cheap) class', () => {
    // 200 lb in 1 cu ft (12×12×12 in) → density 200 → class 50
    const r = svc.computeLine({
      quantity: 1, weight: 200, weightUnit: 'lb',
      length: 12, width: 12, height: 12, dimUnit: 'in',
    });
    expect(r.suggestedFreightClass).toBe('50');
  });

  it('low density correctly maps to a high (expensive) class', () => {
    // 1 lb across 1 cu ft (very fluffy) → density ~1 → class 400
    const r = svc.computeLine({
      quantity: 1, weight: 1, weightUnit: 'lb',
      length: 12, width: 12, height: 12, dimUnit: 'in',
    });
    expect(['400', '500']).toContain(r.suggestedFreightClass);
  });
});

describe('maxClass', () => {
  it('returns the numerically higher class', () => {
    expect(maxClass('50', '70')).toBe('70');
    expect(maxClass('100', '92.5')).toBe('100');
    expect(maxClass('500', '50')).toBe('500');
  });
  it('handles null on either side', () => {
    expect(maxClass(null, '70')).toBe('70');
    expect(maxClass('70', null)).toBe('70');
    expect(maxClass(null, null)).toBeNull();
  });
});

describe('OrderCartonizationService.computeOrder', () => {
  it('rolls up class from line-derived values (highest wins)', () => {
    const result = svc.computeOrder([
      // density ~200 → class 50
      { quantity: 1, weight: 200, weightUnit: 'lb', length: 12, width: 12, height: 12, dimUnit: 'in' },
      // density ~5 → class 175
      { quantity: 1, weight: 5,   weightUnit: 'lb', length: 12, width: 12, height: 12, dimUnit: 'in' },
    ]);
    expect(parseFloat(result.rolledUpFreightClass!)).toBeGreaterThanOrEqual(175);
  });

  it('user-supplied freightClass participates in roll-up and can dominate', () => {
    const result = svc.computeOrder([
      // density ~200 → suggested class 50, but customer says 250 (e.g. due to fragility)
      { quantity: 1, weight: 200, weightUnit: 'lb', length: 12, width: 12, height: 12, dimUnit: 'in', freightClass: '250' },
    ]);
    expect(result.rolledUpFreightClass).toBe('250');
  });

  it('sums weight and cube across lines', () => {
    const result = svc.computeOrder([
      { quantity: 2, weight: 50, weightUnit: 'lb', length: 12, width: 12, height: 12, dimUnit: 'in' },
      { quantity: 1, weight: 30, weightUnit: 'lb', length: 12, width: 12, height: 12, dimUnit: 'in' },
    ]);
    expect(result.totalWeightLbs).toBeCloseTo(130, 1);
    expect(result.totalCubeFt).toBeCloseTo(3, 1);
  });

  it('computes pallet positions: 6 stackable pallets → 3 positions', () => {
    const result = svc.computeOrder([], { unitCount: 6, stackable: true, unitLengthMm: 1219 });
    expect(result.palletPositions).toBe(3);
  });

  it('computes pallet positions: 6 non-stackable pallets → 6 positions', () => {
    const result = svc.computeOrder([], { unitCount: 6, stackable: false, unitLengthMm: 1219 });
    expect(result.palletPositions).toBe(6);
  });

  it('linear feet: 6 stackable pallets at 48" depth = 3 positions × 4ft = 12 lft', () => {
    const result = svc.computeOrder([], { unitCount: 6, stackable: true, unitLengthMm: 1219 });
    expect(result.linearFeet).toBeGreaterThan(11);
    expect(result.linearFeet).toBeLessThan(13);
  });

  it('returns null pallet positions / linear feet when no packing summary given', () => {
    const result = svc.computeOrder([{ quantity: 1, weight: 1, weightUnit: 'lb', length: 1, width: 1, height: 1, dimUnit: 'in' }]);
    expect(result.palletPositions).toBeNull();
    expect(result.linearFeet).toBeNull();
  });

  it('returns null roll-up class when no line has dims or class', () => {
    const result = svc.computeOrder([{ quantity: 1, weight: 1, weightUnit: 'lb' }]);
    expect(result.rolledUpFreightClass).toBeNull();
  });
});
