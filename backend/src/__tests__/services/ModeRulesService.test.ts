import { ModeRulesService } from '../../services/orderLineItem/ModeRulesService';

const svc = new ModeRulesService();

describe('ModeRulesService.getRules', () => {
  it('FTL with no flags: only description/qty/UoM/weight required, dims and customs recommended', () => {
    const rules = svc.getRules('ftl', {});
    expect(rules.required.sort()).toEqual(['description', 'quantity', 'unitOfMeasure', 'weight'].sort());
    // dims are recommended for FTL
    expect(rules.recommended).toEqual(expect.arrayContaining(['length', 'width', 'height']));
    expect(rules.recommended).toEqual(expect.arrayContaining(['hsCode', 'countryOfOrigin']));
    expect(rules.required).not.toContain('freightClass');
    expect(rules.required).not.toContain('unNumber');
  });

  it('LTL adds dims + freightClass + nmfcCode + stackable to required', () => {
    const rules = svc.getRules('ltl', {});
    expect(rules.required).toEqual(expect.arrayContaining(['length', 'width', 'height', 'freightClass', 'nmfcCode', 'stackable']));
    expect(rules.required).not.toContain('unNumber');
  });

  it('Parcel adds dims to required but NOT freight class', () => {
    const rules = svc.getRules('parcel', {});
    expect(rules.required).toEqual(expect.arrayContaining(['length', 'width', 'height']));
    expect(rules.required).not.toContain('freightClass');
    expect(rules.required).not.toContain('stackable');
  });

  it('Hazmat flag adds UN/class/PG/PSN regardless of mode', () => {
    const ftlHaz = svc.getRules('ftl', { hazmat: true });
    expect(ftlHaz.required).toEqual(expect.arrayContaining(['unNumber', 'hazmatClass', 'packingGroup', 'properShippingName']));
    expect(ftlHaz.required).toEqual(expect.arrayContaining(['length', 'width', 'height', 'freightClass']));

    const parcelHaz = svc.getRules('parcel', { hazmat: true });
    expect(parcelHaz.required).toEqual(expect.arrayContaining(['unNumber', 'hazmatClass', 'packingGroup', 'properShippingName']));
    // Parcel hazmat does NOT require freight class
    expect(parcelHaz.required).not.toContain('freightClass');
  });

  it('international flag promotes hsCode/countryOfOrigin to required', () => {
    const intl = svc.getRules('ftl', { international: true });
    expect(intl.required).toEqual(expect.arrayContaining(['hsCode', 'countryOfOrigin']));
    expect(intl.recommended).not.toEqual(expect.arrayContaining(['hsCode', 'countryOfOrigin']));
  });

  it('temperature-controlled promotes tempMinC/tempMaxC to required', () => {
    const tc = svc.getRules('ltl', { temperatureControlled: true });
    expect(tc.required).toEqual(expect.arrayContaining(['tempMinC', 'tempMaxC']));
  });

  it('overrides.required force-includes fields', () => {
    const rules = svc.getRules('ftl', {}, { required: ['declaredValue'] });
    expect(rules.required).toContain('declaredValue');
    expect(rules.recommended).not.toContain('declaredValue');
  });

  it('overrides.hidden remove fields from both required and recommended', () => {
    const rules = svc.getRules('ltl', { hazmat: true }, { hidden: ['nmfcCode', 'hsCode'] });
    expect(rules.required).not.toContain('nmfcCode');
    expect(rules.recommended).not.toContain('hsCode');
    expect(rules.hidden).toEqual(expect.arrayContaining(['nmfcCode', 'hsCode']));
    // sanity: other LTL required fields still there
    expect(rules.required).toEqual(expect.arrayContaining(['freightClass']));
  });

  it('does not list the same field as both required and recommended', () => {
    const rules = svc.getRules('ltl', { hazmat: true, international: true, temperatureControlled: true });
    const overlap = rules.required.filter(f => rules.recommended.includes(f));
    expect(overlap).toEqual([]);
  });
});

describe('ModeRulesService.validate', () => {
  it('reports missing required fields', () => {
    const result = svc.validate('ltl', {}, { description: 'Box', quantity: 5 });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining(['weight', 'length', 'width', 'height', 'freightClass', 'nmfcCode', 'stackable', 'unitOfMeasure']));
  });

  it('treats empty string as missing', () => {
    const result = svc.validate('ltl', {}, {
      description: 'Box', quantity: 5, unitOfMeasure: 'pieces', weight: 100,
      length: 10, width: 10, height: 10,
      freightClass: '   ', nmfcCode: '12345', stackable: false,
    });
    expect(result.missing).toContain('freightClass');
  });

  it('passes when all required are present', () => {
    const line = {
      description: 'Pallet of widgets',
      quantity: 10,
      unitOfMeasure: 'pieces',
      weight: 500,
      length: 48, width: 40, height: 50,
      freightClass: '70',
      nmfcCode: '12345',
      stackable: true,
    };
    const result = svc.validate('ltl', {}, line);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('treats stackable=false as present (boolean false is valid)', () => {
    const line = {
      description: 'Pallet', quantity: 1, unitOfMeasure: 'pallets', weight: 100,
      length: 48, width: 40, height: 50,
      freightClass: '70', nmfcCode: '12345', stackable: false,
    };
    expect(svc.validate('ltl', {}, line).ok).toBe(true);
  });

  it('hazmat: missing UN data is reported', () => {
    const line = {
      description: 'Flammable', quantity: 1, unitOfMeasure: 'pieces', weight: 100,
      length: 48, width: 40, height: 50,
      freightClass: '85',
    };
    const result = svc.validate('ftl', { hazmat: true }, line);
    expect(result.missing).toEqual(expect.arrayContaining(['unNumber', 'hazmatClass', 'packingGroup', 'properShippingName']));
  });
});
