import {
  validateShipmentAgainstType,
  applyShipmentTypeDefaults,
  validateShipmentReadiness,
  canTransition,
  allowedTransitions,
} from '@open-tms/shared';

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

describe('validateShipmentReadiness', () => {
  const complete = {
    reference: 'REF-1',
    customerId: 'c1',
    originId: 'o1',
    destinationId: 'd1',
    carrierId: 'carrier-1',
    pickupDate: new Date('2026-07-01'),
    deliveryDate: new Date('2026-07-03'),
  };

  it('passes when all mandatory fields are present (origin+destination route)', () => {
    expect(validateShipmentReadiness(complete, { requiredFields: [] })).toEqual({ missing: [], isValid: true });
  });

  it('accepts a lane in place of origin+destination', () => {
    const viaLane = {
      reference: 'REF-1', customerId: 'c1', laneId: 'lane-1', carrierId: 'carrier-1',
      pickupDate: new Date('2026-07-01'), deliveryDate: new Date('2026-07-03'),
    };
    expect(validateShipmentReadiness(viaLane, null).isValid).toBe(true);
  });

  it('flags route as missing when neither lane nor origin+destination provided', () => {
    const { originId, destinationId, ...rest } = complete;
    const result = validateShipmentReadiness(rest, null);
    expect(result.missing).toContain('route');
    expect(result.isValid).toBe(false);
  });

  it('flags each individual mandatory field', () => {
    const result = validateShipmentReadiness({ originId: 'o1', destinationId: 'd1' }, null);
    expect(result.missing).toEqual(expect.arrayContaining(['reference', 'customerId', 'carrierId', 'pickupDate', 'deliveryDate']));
  });

  it('merges in shipment-type required fields', () => {
    const result = validateShipmentReadiness(complete, { requiredFields: ['proNumber'] });
    expect(result.missing).toEqual(['proNumber']);
  });
});

describe('canTransition / allowedTransitions', () => {
  it('allows one step forward', () => {
    expect(canTransition('draft', 'ready')).toBe(true);
    expect(canTransition('ready', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'complete')).toBe(true);
  });

  it('allows one step back', () => {
    expect(canTransition('complete', 'in_progress')).toBe(true);
    expect(canTransition('ready', 'draft')).toBe(true);
  });

  it('rejects skipping steps', () => {
    expect(canTransition('draft', 'in_progress')).toBe(false);
    expect(canTransition('draft', 'complete')).toBe(false);
    expect(canTransition('ready', 'complete')).toBe(false);
  });

  it('rejects unknown statuses and no-op moves', () => {
    expect(canTransition('draft', 'shipped')).toBe(false);
    expect(canTransition('draft', 'draft')).toBe(false);
  });

  it('lists adjacent transitions only', () => {
    expect(allowedTransitions('draft')).toEqual(['ready']);
    expect(allowedTransitions('ready').sort()).toEqual(['draft', 'in_progress']);
    expect(allowedTransitions('complete')).toEqual(['in_progress']);
  });
});
