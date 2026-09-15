/**
 * Reference catalogue of major US national LTL carriers, seeded on demand into
 * the Carrier table when an org clicks "Load national LTL carriers" in the
 * admin UI (same on-demand pattern as STANDARD_PACKAGING_TYPES).
 *
 * IMPORTANT — verify before relying on this for production EDI: SCAC codes and
 * PRO number shapes here are public reference data, not confirmed against each
 * carrier's own EDI implementation guide. proNumberMinLength/MaxLength are
 * deliberately loose (a shared range true of LTL PRO numbers generally, not a
 * verified per-carrier exact), and no check-digit algorithm is included —
 * several national carriers do use one, but it's carrier-specific and we don't
 * have a confirmed source for each. Treat every row as a starting point: an
 * admin can edit scacCode/proNumber* on the carrier's own edit page at any
 * time, which is the "extensible later" half of this feature.
 */
export interface StandardLtlCarrierSpec {
  scacCode: string;
  name: string;
  proNumberMinLength: number;
  proNumberMaxLength: number;
  proNumberNumericOnly: boolean;
  notes: string;
}

const VERIFY_NOTE =
  'Public reference data — verify SCAC and PRO number format against this carrier\'s own EDI implementation guide before relying on it for production EDI/tendering.';

export const STANDARD_NATIONAL_LTL_CARRIERS: StandardLtlCarrierSpec[] = [
  { scacCode: 'ODFL', name: 'Old Dominion Freight Line', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'EXLA', name: 'Estes Express Lines', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'ABFS', name: 'ABF Freight (ArcBest)', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'SAIA', name: 'Saia LTL Freight', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'XPOL', name: 'XPO, Inc.', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'FXFE', name: 'FedEx Freight', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'RLCA', name: 'R+L Carriers', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'SEFL', name: 'Southeastern Freight Lines', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'AVRT', name: 'Averitt Express', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
  { scacCode: 'UPGF', name: 'TForce Freight', proNumberMinLength: 7, proNumberMaxLength: 10, proNumberNumericOnly: true, notes: VERIFY_NOTE },
];
