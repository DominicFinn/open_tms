import {
  convertWeight,
  convertWeightToCanonical,
  convertDimension,
  convertDimensionToCanonical,
  convertTemperature,
  convertTemperatureToCanonical,
  convertDistance,
  convertDistanceToCanonical,
  resolvePreferences,
  getUnitLabel,
} from '../services/unitConversion';

describe('unitConversion', () => {
  describe('convertWeight', () => {
    it('converts kg to lb', () => {
      expect(convertWeight(1, 'lb')).toBeCloseTo(2.20, 1);
    });

    it('returns kg unchanged', () => {
      expect(convertWeight(10, 'kg')).toBe(10);
    });

    it('handles zero', () => {
      expect(convertWeight(0, 'lb')).toBe(0);
    });
  });

  describe('convertWeightToCanonical', () => {
    it('converts lb to kg', () => {
      expect(convertWeightToCanonical(2.20462, 'lb')).toBeCloseTo(1, 2);
    });

    it('returns kg unchanged', () => {
      expect(convertWeightToCanonical(5, 'kg')).toBe(5);
    });
  });

  describe('convertDimension', () => {
    it('converts cm to inches', () => {
      expect(convertDimension(2.54, 'in')).toBeCloseTo(1, 0);
    });

    it('returns cm unchanged', () => {
      expect(convertDimension(100, 'cm')).toBe(100);
    });
  });

  describe('convertDimensionToCanonical', () => {
    it('converts in to cm', () => {
      expect(convertDimensionToCanonical(1, 'in')).toBeCloseTo(2.54, 1);
    });

    it('returns cm unchanged', () => {
      expect(convertDimensionToCanonical(50, 'cm')).toBe(50);
    });
  });

  describe('convertTemperature', () => {
    it('converts Celsius to Fahrenheit', () => {
      expect(convertTemperature(0, 'F')).toBe(32);
      expect(convertTemperature(100, 'F')).toBe(212);
    });

    it('returns Celsius unchanged', () => {
      expect(convertTemperature(37, 'C')).toBe(37);
    });
  });

  describe('convertTemperatureToCanonical', () => {
    it('converts Fahrenheit to Celsius', () => {
      expect(convertTemperatureToCanonical(32, 'F')).toBe(0);
      expect(convertTemperatureToCanonical(212, 'F')).toBe(100);
    });

    it('returns Celsius unchanged', () => {
      expect(convertTemperatureToCanonical(25, 'C')).toBe(25);
    });
  });

  describe('convertDistance', () => {
    it('converts km to miles', () => {
      expect(convertDistance(1, 'mi')).toBeCloseTo(0.62, 1);
    });

    it('returns km unchanged', () => {
      expect(convertDistance(100, 'km')).toBe(100);
    });
  });

  describe('convertDistanceToCanonical', () => {
    it('converts miles to km', () => {
      expect(convertDistanceToCanonical(1, 'mi')).toBeCloseTo(1.609, 2);
    });

    it('returns km unchanged', () => {
      expect(convertDistanceToCanonical(50, 'km')).toBe(50);
    });
  });

  describe('resolvePreferences', () => {
    it('uses org defaults when no user overrides', () => {
      const prefs = resolvePreferences({ weightUnit: 'lb', dimUnit: 'in' });
      expect(prefs.weightUnit).toBe('lb');
      expect(prefs.dimUnit).toBe('in');
      expect(prefs.temperatureUnit).toBe('C');
      expect(prefs.distanceUnit).toBe('km');
    });

    it('user overrides take precedence', () => {
      const prefs = resolvePreferences(
        { weightUnit: 'kg' },
        { weightUnit: 'lb' }
      );
      expect(prefs.weightUnit).toBe('lb');
    });

    it('falls back to metric defaults when nothing specified', () => {
      const prefs = resolvePreferences({});
      expect(prefs.weightUnit).toBe('kg');
      expect(prefs.dimUnit).toBe('cm');
      expect(prefs.temperatureUnit).toBe('C');
      expect(prefs.distanceUnit).toBe('km');
    });
  });

  describe('getUnitLabel', () => {
    it('returns display labels', () => {
      expect(getUnitLabel('weightUnit', 'kg')).toBe('kg');
      expect(getUnitLabel('weightUnit', 'lb')).toBe('lb');
      expect(getUnitLabel('temperatureUnit', 'C')).toBe('°C');
      expect(getUnitLabel('temperatureUnit', 'F')).toBe('°F');
      expect(getUnitLabel('dimUnit', 'cm')).toBe('cm');
      expect(getUnitLabel('dimUnit', 'in')).toBe('in');
      expect(getUnitLabel('distanceUnit', 'km')).toBe('km');
      expect(getUnitLabel('distanceUnit', 'mi')).toBe('mi');
    });

    it('returns value as fallback for unknown types', () => {
      expect(getUnitLabel('weightUnit' as any, 'unknown')).toBe('unknown');
    });
  });
});
