import { LtlRatingService } from '../../services/LtlRatingService';

describe('LtlRatingService', () => {
  const service = new LtlRatingService();

  const sampleRateMatrix = {
    '100': { 'M': 8500, '500': 7200, '1000': 6000, '2000': 4800, '5000': 3600 },
    '85':  { 'M': 7000, '500': 5800, '1000': 4900, '2000': 3800, '5000': 2900 },
    '150': { 'M': 12000, '500': 10000, '1000': 8500, '2000': 7000, '5000': 5500 },
  };

  describe('calculateLtlRate', () => {
    it('calculates rate for a single item at the correct weight break', () => {
      const result = service.calculateLtlRate({
        items: [{ weight: 750, freightClass: '100', quantity: 1 }],
        ltlRateMatrix: sampleRateMatrix,
      });

      // 750 lbs at class 100 -> hits 500lb break ($72.00/cwt)
      // 7.5 CWT * 7200 cents = 54000 cents = $540
      expect(result.linehaulCents).toBe(54000);
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].ratePerCwt).toBe(7200);
      expect(result.lineItems[0].freightClass).toBe('100');
    });

    it('applies deficit weight when cheaper', () => {
      // 450 lbs at class 100:
      // At M break: 4.5 CWT * 8500 = 38250 cents
      // At 500 break: 5.0 CWT * 7200 = 36000 cents (cheaper!)
      // Should use deficit weight of 500 lbs
      const result = service.calculateLtlRate({
        items: [{ weight: 450, freightClass: '100', quantity: 1 }],
        ltlRateMatrix: sampleRateMatrix,
      });

      expect(result.deficitWeightApplied).toBe(true);
      expect(result.lineItems[0].ratedWeight).toBe(500);
      expect(result.lineItems[0].ratePerCwt).toBe(7200);
      expect(result.linehaulCents).toBe(36000);
    });

    it('handles FAK (Freight All Kinds) override', () => {
      // Item declared as class 150, but FAK overrides to class 85
      const result = service.calculateLtlRate({
        items: [{ weight: 1000, freightClass: '150', quantity: 1 }],
        ltlRateMatrix: sampleRateMatrix,
        fakClass: '85',
      });

      // Should use class 85 rates, not class 150
      expect(result.lineItems[0].freightClass).toBe('85');
      expect(result.lineItems[0].ratePerCwt).toBe(4900); // 1000lb break for class 85
    });

    it('applies minimum charge when below threshold', () => {
      const result = service.calculateLtlRate({
        items: [{ weight: 50, freightClass: '100', quantity: 1 }],
        ltlRateMatrix: sampleRateMatrix,
        minimumChargeCents: 10000, // $100 minimum
      });

      // 0.5 CWT * 8500 = 4250, which is below $100 minimum
      expect(result.linehaulCents).toBe(10000);
    });

    it('calculates accessorials', () => {
      const result = service.calculateLtlRate({
        items: [{ weight: 500, freightClass: '100', quantity: 1 }],
        ltlRateMatrix: sampleRateMatrix,
        requestedAccessorials: ['liftgate_delivery', 'residential_delivery'],
        accessorialRates: { liftgate_delivery: 75, residential_delivery: 50 },
      });

      // Accessorials: $75 + $50 = $125 = 12500 cents
      expect(result.accessorialsCents).toBe(12500);
      expect(result.lineItems.filter(l => l.chargeType === 'accessorial')).toHaveLength(2);
    });

    it('handles multiple items', () => {
      const result = service.calculateLtlRate({
        items: [
          { weight: 500, freightClass: '100', quantity: 1 },
          { weight: 300, freightClass: '85', quantity: 2 },
        ],
        ltlRateMatrix: sampleRateMatrix,
      });

      expect(result.lineItems.filter(l => l.chargeType === 'linehaul')).toHaveLength(2);
      expect(result.totalWeight).toBe(1100); // 500 + 300*2
    });

    it('returns zero when no rate matrix provided', () => {
      const result = service.calculateLtlRate({
        items: [{ weight: 500, freightClass: '100', quantity: 1 }],
      });

      expect(result.totalCents).toBe(0);
    });
  });

  describe('calculateDensityClass', () => {
    it('returns class 50 for very dense freight (50+ lbs/cuft)', () => {
      // 500 lbs in a 10x10x10 box (0.579 cuft) = 863 density
      expect(service.calculateDensityClass(500, 10, 10, 10)).toBe('50');
    });

    it('returns class 100 for ~9 lbs/cuft density', () => {
      // 100 lbs in a 24x24x12 box (4 cuft) = 25 lbs/cuft -> class 65
      expect(service.calculateDensityClass(100, 24, 24, 12)).toBe('65');
    });

    it('returns class 500 for very light freight (<1 lb/cuft)', () => {
      // 10 lbs in a 48x48x48 (64 cuft) = 0.15 density
      expect(service.calculateDensityClass(10, 48, 48, 48)).toBe('500');
    });

    it('returns class 100 for zero dimensions', () => {
      expect(service.calculateDensityClass(100, 0, 0, 0)).toBe('100');
    });
  });
});
