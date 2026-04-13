import { EDI855Service, EDI855Data } from '../../services/EDI855Service';

describe('EDI855Service', () => {
  const service = new EDI855Service();

  const sampleData: EDI855Data = {
    poNumber: 'PO-2026-001',
    poDate: new Date('2026-04-10'),
    ackDate: new Date('2026-04-11'),
    ackType: 'AC',
    seller: { name: 'Open TMS', id: 'OPENTMS' },
    buyer: { name: 'Acme Corp', id: 'ACME' },
    lineItems: [
      { lineNumber: 1, quantityOrdered: 10, quantityAcknowledged: 10, unitPrice: 25.00, sku: 'SKU-001', description: 'Widget A', ackStatus: 'IA' },
      { lineNumber: 2, quantityOrdered: 5, quantityAcknowledged: 3, unitPrice: 50.00, sku: 'SKU-002', description: 'Widget B', ackStatus: 'IC' },
    ],
  };

  it('generates valid 855 with ISA/GS/ST envelope', () => {
    const result = service.generateEDI855(sampleData);
    expect(result).toContain('ISA*');
    expect(result).toContain('GS*PR*');  // PR = Purchase Order Acknowledgment
    expect(result).toContain('ST*855*');
    expect(result).toContain('SE*');
    expect(result).toContain('GE*');
    expect(result).toContain('IEA*');
  });

  it('includes BAK segment with PO number and ack type', () => {
    const result = service.generateEDI855(sampleData);
    expect(result).toContain('BAK*AC**PO-2026-001*');
  });

  it('includes N1 seller and buyer segments', () => {
    const result = service.generateEDI855(sampleData);
    expect(result).toContain('N1*SE*Open TMS');
    expect(result).toContain('N1*BY*Acme Corp');
  });

  it('includes PO1 line items with quantities and prices', () => {
    const result = service.generateEDI855(sampleData);
    expect(result).toContain('PO1*1*10*EA*25.00*PE*VN*SKU-001');
    expect(result).toContain('PO1*2*5*EA*50.00*PE*VN*SKU-002');
  });

  it('includes ACK segments with line item status', () => {
    const result = service.generateEDI855(sampleData);
    expect(result).toContain('ACK*IA*10*EA');  // Accepted
    expect(result).toContain('ACK*IC*3*EA');   // Accepted with changes
  });

  it('includes PID description segments', () => {
    const result = service.generateEDI855(sampleData);
    expect(result).toContain('PID*F****Widget A');
    expect(result).toContain('PID*F****Widget B');
  });

  it('includes CTT with line count', () => {
    const result = service.generateEDI855(sampleData);
    expect(result).toContain('CTT*2');
  });

  it('includes DTM for scheduled dates', () => {
    const withDates: EDI855Data = {
      ...sampleData,
      scheduledShipDate: new Date('2026-04-14'),
      scheduledDeliveryDate: new Date('2026-04-16'),
    };
    const result = service.generateEDI855(withDates);
    expect(result).toContain('DTM*010*20260414');
    expect(result).toContain('DTM*002*20260416');
  });

  it('generates rejection acknowledgment', () => {
    const rejected: EDI855Data = {
      ...sampleData,
      ackType: 'RD',
      lineItems: [
        { lineNumber: 1, quantityOrdered: 10, quantityAcknowledged: 0, unitPrice: 25.00, sku: 'SKU-001', ackStatus: 'IR' },
      ],
    };
    const result = service.generateEDI855(rejected);
    expect(result).toContain('BAK*RD**PO-2026-001');
    expect(result).toContain('ACK*IR*0*EA');
  });

  describe('validateAndGenerate', () => {
    it('returns errors for missing required fields', () => {
      const invalid = { ...sampleData, poNumber: '', buyer: { name: '' } };
      const result = service.validateAndGenerate(invalid);
      expect(result.success).toBe(false);
      expect(result.errors).toContain('poNumber is required');
      expect(result.errors).toContain('buyer.name is required');
    });

    it('returns success with valid data', () => {
      const result = service.validateAndGenerate(sampleData);
      expect(result.success).toBe(true);
      expect(result.data).toContain('ST*855*');
    });

    it('returns error for empty line items', () => {
      const noItems = { ...sampleData, lineItems: [] };
      const result = service.validateAndGenerate(noItems);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('line item'))).toBe(true);
    });
  });
});
