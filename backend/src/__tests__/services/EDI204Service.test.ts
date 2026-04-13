import { EDI204Service, EDI204ShipmentData } from '../../services/EDI204Service';

describe('EDI204Service', () => {
  const service = new EDI204Service();

  const sampleShipment: EDI204ShipmentData = {
    shipmentReference: 'SHIP-001',
    carrierScac: 'ABCD',
    mustRespondBy: new Date('2026-04-15T18:00:00Z'),
    pickupDate: new Date('2026-04-16T08:00:00Z'),
    deliveryDate: new Date('2026-04-17T14:00:00Z'),
    origin: {
      name: 'Origin Warehouse',
      address1: '123 Main St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
    },
    destination: {
      name: 'Destination DC',
      address1: '456 Oak Ave',
      city: 'Detroit',
      state: 'MI',
      postalCode: '48201',
      country: 'US',
    },
    totalWeight: 15000,
    weightUnit: 'lb',
  };

  it('generates a valid EDI 204 with ISA/GS/ST envelope', () => {
    const result = service.generateEDI204(sampleShipment);

    expect(result).toContain('ISA*');
    expect(result).toContain('GS*SM*'); // SM = Motor Carrier Load Tender
    expect(result).toContain('ST*204*');
    expect(result).toContain('SE*');
    expect(result).toContain('GE*');
    expect(result).toContain('IEA*');
  });

  it('includes B2 with carrier SCAC and shipment reference', () => {
    const result = service.generateEDI204(sampleShipment);
    expect(result).toContain('B2**ABCD*SHIP-001');
  });

  it('includes origin and destination as S5 stops with N1/N3/N4', () => {
    const result = service.generateEDI204(sampleShipment);
    // Origin: S5*1*CL (Complete Load), N1*SH (Shipper)
    expect(result).toContain('S5*1*CL');
    expect(result).toContain('N1*SH*Origin Warehouse');
    expect(result).toContain('N3*123 Main St');
    expect(result).toContain('N4*Chicago*IL*60601*US');

    // Destination: S5*2*CU (Complete Unload), N1*CN (Consignee)
    expect(result).toContain('S5*2*CU');
    expect(result).toContain('N1*CN*Destination DC');
  });

  it('includes AT8 weight segment', () => {
    const result = service.generateEDI204(sampleShipment);
    expect(result).toContain('AT8*G*L*15000');
  });

  it('includes G62 date segments', () => {
    const result = service.generateEDI204(sampleShipment);
    expect(result).toContain('G62*10*'); // Pickup date
    expect(result).toContain('G62*02*'); // Delivery date
    expect(result).toContain('G62*64*'); // Must respond by
  });

  it('includes intermediate stops', () => {
    const withStops: EDI204ShipmentData = {
      ...sampleShipment,
      stops: [{
        sequenceNumber: 1,
        stopType: 'delivery',
        location: { name: 'Midway Stop', address1: '789 Elm St', city: 'Toledo', state: 'OH', postalCode: '43601', country: 'US' },
      }],
    };
    const result = service.generateEDI204(withStops);
    expect(result).toContain('S5*2*CU'); // Intermediate stop
    expect(result).toContain('N1*CN*Midway Stop');
    expect(result).toContain('S5*3*CU'); // Final destination is now stop 3
  });

  it('includes NTE for special instructions', () => {
    const withInstructions = { ...sampleShipment, specialInstructions: 'Handle with care' };
    const result = service.generateEDI204(withInstructions);
    expect(result).toContain('NTE*OTH*Handle with care');
  });

  it('includes equipment type', () => {
    const withEquip = { ...sampleShipment, equipmentType: 'Reefer' };
    const result = service.generateEDI204(withEquip);
    expect(result).toContain('RT'); // Reefer code
  });

  it('uses custom sender/receiver IDs from config', () => {
    const result = service.generateEDI204(sampleShipment, {
      senderId: 'MYSENDER',
      receiverId: 'MYRECVR',
    });
    expect(result).toContain('MYSENDER');
    expect(result).toContain('MYRECVR');
  });

  describe('validateAndGenerate', () => {
    it('returns errors for missing required fields', () => {
      const invalid = { ...sampleShipment, shipmentReference: '', carrierScac: '' };
      const result = service.validateAndGenerate(invalid);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('shipmentReference is required');
      expect(result.errors).toContain('carrierScac is required');
    });

    it('returns success with valid data', () => {
      const result = service.validateAndGenerate(sampleShipment);
      expect(result.success).toBe(true);
      expect(result.data).toContain('ST*204*');
    });

    it('warns on unusual SCAC length', () => {
      const oddScac = { ...sampleShipment, carrierScac: 'X' };
      const result = service.validateAndGenerate(oddScac);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
