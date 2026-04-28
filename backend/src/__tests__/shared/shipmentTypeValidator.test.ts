import {
  validateShipmentAgainstType,
  applyShipmentTypeDefaults,
} from '../../shared/shipmentTypeValidator';

describe('validateShipmentAgainstType', () => {
  it('returns no missing fields when type is null', () => {
    const result = validateShipmentAgainstType({ customerId: null }, null);
    expect(result).toEqual({ missing: [], isValid: true });
  });

  it('flags empty string and null and undefined as missing', () => {
    const result = validateShipmentAgainstType(
      { customerId: '', originId: null, destinationId: undefined as any },
      { requiredFields: ['customerId', 'originId', 'destinationId'] }
    );
    expect(result.missing.sort()).toEqual(['customerId', 'destinationId', 'originId']);
    expect(result.isValid).toBe(false);
  });

  it('passes when all required fields are populated', () => {
    const result = validateShipmentAgainstType(
      { customerId: 'c1', originId: 'o1', destinationId: 'd1' },
      { requiredFields: ['customerId', 'originId', 'destinationId'] }
    );
    expect(result).toEqual({ missing: [], isValid: true });
  });

  it('treats whitespace-only strings as missing', () => {
    const result = validateShipmentAgainstType(
      { proNumber: '   ' },
      { requiredFields: ['proNumber'] }
    );
    expect(result.missing).toEqual(['proNumber']);
  });

  it('treats empty arrays as missing', () => {
    const result = validateShipmentAgainstType(
      { items: [] },
      { requiredFields: ['items'] }
    );
    expect(result.missing).toEqual(['items']);
  });

  it('accepts Date values as non-empty', () => {
    const result = validateShipmentAgainstType(
      { pickupDate: new Date('2026-05-01') },
      { requiredFields: ['pickupDate'] }
    );
    expect(result.missing).toEqual([]);
  });

  it('ignores fields not in the required list', () => {
    const result = validateShipmentAgainstType(
      { customerId: 'c1', proNumber: '' },
      { requiredFields: ['customerId'] }
    );
    expect(result.isValid).toBe(true);
  });
});

describe('applyShipmentTypeDefaults', () => {
  it('fills empty fields from defaults', () => {
    const result = applyShipmentTypeDefaults(
      { customerId: '', originId: '' },
      { defaults: { customerId: 'c1', originId: 'o1' } }
    );
    expect(result.customerId).toBe('c1');
    expect(result.originId).toBe('o1');
  });

  it('preserves user input over defaults', () => {
    const result = applyShipmentTypeDefaults(
      { customerId: 'user-choice' },
      { defaults: { customerId: 'template-default' } }
    );
    expect(result.customerId).toBe('user-choice');
  });

  it('returns the shipment unchanged when type is null', () => {
    const shipment = { customerId: 'c1' };
    const result = applyShipmentTypeDefaults(shipment, null);
    expect(result).toEqual(shipment);
  });

  it('does not overwrite with empty defaults', () => {
    const result = applyShipmentTypeDefaults(
      { customerId: 'c1' },
      { defaults: { customerId: '' } }
    );
    expect(result.customerId).toBe('c1');
  });
});
