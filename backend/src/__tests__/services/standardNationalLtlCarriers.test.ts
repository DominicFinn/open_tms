import { STANDARD_NATIONAL_LTL_CARRIERS } from '../../services/carriers/standardNationalLtlCarriers.js';

describe('STANDARD_NATIONAL_LTL_CARRIERS', () => {
  it('has no duplicate SCAC codes (the seed-standards route dedups on this)', () => {
    const scacs = STANDARD_NATIONAL_LTL_CARRIERS.map(c => c.scacCode);
    expect(new Set(scacs).size).toBe(scacs.length);
  });

  it('every entry has a non-empty name, a plausible SCAC, and a verification note', () => {
    for (const carrier of STANDARD_NATIONAL_LTL_CARRIERS) {
      expect(carrier.name.trim().length).toBeGreaterThan(0);
      expect(carrier.scacCode).toMatch(/^[A-Z]{2,4}$/);
      expect(carrier.notes.length).toBeGreaterThan(0);
      expect(carrier.proNumberMinLength).toBeLessThanOrEqual(carrier.proNumberMaxLength);
    }
  });
});
