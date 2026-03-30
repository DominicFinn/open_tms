/**
 * Unit of Measure conversion utilities.
 *
 * Backend always stores canonical values (metric):
 *   - Weight: kg
 *   - Dimensions: cm
 *   - Temperature: Celsius
 *   - Distance: km
 *
 * Conversion happens at display time based on user/org preferences.
 */

export interface UnitPreferences {
  weightUnit: 'kg' | 'lb';
  dimUnit: 'cm' | 'in';
  temperatureUnit: 'C' | 'F';
  distanceUnit: 'km' | 'mi';
}

// Conversion factors
const KG_TO_LB = 2.20462;
const CM_TO_IN = 0.393701;
const KM_TO_MI = 0.621371;

export function convertWeight(valueKg: number, to: 'kg' | 'lb'): number {
  if (to === 'lb') return round(valueKg * KG_TO_LB, 2);
  return round(valueKg, 2);
}

export function convertWeightToCanonical(value: number, from: 'kg' | 'lb'): number {
  if (from === 'lb') return round(value / KG_TO_LB, 4);
  return value;
}

export function convertDimension(valueCm: number, to: 'cm' | 'in'): number {
  if (to === 'in') return round(valueCm * CM_TO_IN, 2);
  return round(valueCm, 2);
}

export function convertDimensionToCanonical(value: number, from: 'cm' | 'in'): number {
  if (from === 'in') return round(value / CM_TO_IN, 4);
  return value;
}

export function convertTemperature(valueCelsius: number, to: 'C' | 'F'): number {
  if (to === 'F') return round((valueCelsius * 9) / 5 + 32, 1);
  return round(valueCelsius, 1);
}

export function convertTemperatureToCanonical(value: number, from: 'C' | 'F'): number {
  if (from === 'F') return round(((value - 32) * 5) / 9, 2);
  return value;
}

export function convertDistance(valueKm: number, to: 'km' | 'mi'): number {
  if (to === 'mi') return round(valueKm * KM_TO_MI, 2);
  return round(valueKm, 2);
}

export function convertDistanceToCanonical(value: number, from: 'km' | 'mi'): number {
  if (from === 'mi') return round(value / KM_TO_MI, 4);
  return value;
}

/**
 * Resolve effective unit preferences: user overrides take precedence over org defaults.
 */
export function resolvePreferences(
  orgDefaults: Partial<UnitPreferences>,
  userOverrides?: Partial<UnitPreferences>,
): UnitPreferences {
  return {
    weightUnit: (userOverrides?.weightUnit || orgDefaults.weightUnit || 'kg') as 'kg' | 'lb',
    dimUnit: (userOverrides?.dimUnit || orgDefaults.dimUnit || 'cm') as 'cm' | 'in',
    temperatureUnit: (userOverrides?.temperatureUnit || orgDefaults.temperatureUnit || 'C') as 'C' | 'F',
    distanceUnit: (userOverrides?.distanceUnit || orgDefaults.distanceUnit || 'km') as 'km' | 'mi',
  };
}

/** Get unit label for display */
export function getUnitLabel(type: keyof UnitPreferences, value: string): string {
  const labels: Record<string, Record<string, string>> = {
    weightUnit: { kg: 'kg', lb: 'lb' },
    dimUnit: { cm: 'cm', in: 'in' },
    temperatureUnit: { C: '°C', F: '°F' },
    distanceUnit: { km: 'km', mi: 'mi' },
  };
  return labels[type]?.[value] ?? value;
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
