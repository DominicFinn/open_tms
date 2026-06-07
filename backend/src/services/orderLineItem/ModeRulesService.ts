/**
 * ModeRulesService — given a shipment (mode, flags), returns which fields a
 * customer must provide on an order line item.
 *
 * Phase 1 ships a hardcoded default matrix from the design doc. Orgs can
 * override individual fields via an optional partial config (e.g. an org may
 * require declared value on every LTL line). Same rules are used by the portal
 * form (conditional rendering + client-side enforcement) and by the server
 * (re-validation on order create/update).
 */

export type Mode = 'ftl' | 'ltl' | 'parcel' | 'intermodal' | 'ocean' | 'air';

export interface LineFlags {
  hazmat?: boolean;
  international?: boolean;
  temperatureControlled?: boolean;
}

/**
 * The fields a mode-rules check covers. Keep in sync with the OrderLineItem
 * Prisma model fields that customers can supply (plus the order-level
 * packingSummary fields for handling-unit auto-gen).
 */
export type LineField =
  // commercial
  | 'description'
  | 'quantity'
  | 'unitOfMeasure'
  | 'weight'
  | 'sku'
  | 'declaredValue'
  // dimensional
  | 'length'
  | 'width'
  | 'height'
  // ltl classification
  | 'freightClass'
  | 'nmfcCode'
  | 'stackable'
  // hazmat
  | 'unNumber'
  | 'hazmatClass'
  | 'packingGroup'
  | 'properShippingName'
  // customs
  | 'hsCode'
  | 'countryOfOrigin'
  // temperature
  | 'tempMinC'
  | 'tempMaxC';

export interface ModeRules {
  /** Fields the customer MUST provide (validated server-side, marked required in UI). */
  required: LineField[];
  /**
   * Fields surfaced in the form even though they're not required. Mostly used
   * for the "strongly recommended" tier from the design doc.
   */
  recommended: LineField[];
  /** Fields hidden from the form entirely for this mode/flag combination. */
  hidden: LineField[];
}

/**
 * Default required matrix per the design doc:
 *
 *  | Field               | FTL | LTL | Parcel | Hazmat |
 *  | description, qty,
 *    weight, unitOfMeasure |  Y  |  Y  |   Y    |   Y    |
 *  | dimensions          |  -  |  Y  |   Y    |   Y    |
 *  | freightClass        |  -  |  Y  |   -    |   Y    |
 *  | stackable           |  -  |  Y  |   -    |   Y    |
 *  | UN/class/PG/PSN     |  -  |  -  |   -    |   Y    |
 *  | hsCode/CoO          |  -  |  -  |   -    |   -    |   (international flag adds these)
 */
export const DEFAULT_REQUIRED_ALWAYS: LineField[] = ['description', 'quantity', 'unitOfMeasure', 'weight'];
export const DEFAULT_RECOMMENDED_ALWAYS: LineField[] = ['sku', 'declaredValue'];

const DIMENSIONS: LineField[] = ['length', 'width', 'height'];
const LTL_CLASSIFICATION: LineField[] = ['freightClass', 'nmfcCode', 'stackable'];
const HAZMAT_FIELDS: LineField[] = ['unNumber', 'hazmatClass', 'packingGroup', 'properShippingName'];
const CUSTOMS_FIELDS: LineField[] = ['hsCode', 'countryOfOrigin'];
const TEMPERATURE_FIELDS: LineField[] = ['tempMinC', 'tempMaxC'];

export interface ModeRulesOverrides {
  /** Force these to required regardless of mode. */
  required?: LineField[];
  /** Force these to recommended (visible but optional). */
  recommended?: LineField[];
  /** Hide these from the UI entirely. */
  hidden?: LineField[];
}

export interface IModeRulesService {
  getRules(mode: Mode, flags: LineFlags, overrides?: ModeRulesOverrides): ModeRules;
  /** Validate a line against the rules, returning the list of fields that are missing. */
  validate(mode: Mode, flags: LineFlags, line: Record<string, unknown>, overrides?: ModeRulesOverrides): { ok: boolean; missing: LineField[] };
}

function unique<T>(xs: T[]): T[] { return Array.from(new Set(xs)); }
function without<T>(xs: T[], remove: T[]): T[] { const s = new Set(remove); return xs.filter(x => !s.has(x)); }

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !Number.isNaN(value);
  return true;
}

export class ModeRulesService implements IModeRulesService {
  getRules(mode: Mode, flags: LineFlags, overrides?: ModeRulesOverrides): ModeRules {
    let required: LineField[] = [...DEFAULT_REQUIRED_ALWAYS];
    let recommended: LineField[] = [...DEFAULT_RECOMMENDED_ALWAYS];

    if (mode === 'ltl' || mode === 'parcel') {
      required.push(...DIMENSIONS);
    } else {
      recommended.push(...DIMENSIONS);
    }

    if (mode === 'ltl') {
      required.push(...LTL_CLASSIFICATION);
    }

    if (flags.hazmat) {
      required.push(...HAZMAT_FIELDS);
      // Hazmat almost always needs dimensions and class info even for FTL.
      required.push(...DIMENSIONS);
      if (mode !== 'parcel') {
        required.push('freightClass');
      }
    }

    if (flags.international) {
      required.push(...CUSTOMS_FIELDS);
    } else {
      recommended.push(...CUSTOMS_FIELDS);
    }

    if (flags.temperatureControlled) {
      required.push(...TEMPERATURE_FIELDS);
    } else {
      recommended.push(...TEMPERATURE_FIELDS);
    }

    required = unique(required);
    recommended = without(unique(recommended), required);
    let hidden: LineField[] = [];

    if (overrides) {
      if (overrides.required) required = unique([...required, ...overrides.required]);
      if (overrides.recommended) recommended = unique([...without(recommended, overrides.required ?? []), ...overrides.recommended]);
      if (overrides.hidden) {
        hidden = unique(overrides.hidden);
        required = without(required, hidden);
        recommended = without(recommended, hidden);
      }
    }

    recommended = without(recommended, required);

    return { required, recommended, hidden };
  }

  validate(mode: Mode, flags: LineFlags, line: Record<string, unknown>, overrides?: ModeRulesOverrides): { ok: boolean; missing: LineField[] } {
    const { required } = this.getRules(mode, flags, overrides);
    const missing: LineField[] = required.filter(f => !isPresent(line[f]));
    return { ok: missing.length === 0, missing };
  }
}
