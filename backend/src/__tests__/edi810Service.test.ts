import { EDI810Service, EDI810InvoiceData } from '../services/EDI810Service';

describe('EDI810Service', () => {
  const service = new EDI810Service();

  const sampleInvoice: EDI810InvoiceData = {
    invoiceNumber: 'INV-20260410-0001',
    invoiceDate: new Date('2026-04-10'),
    dueDate: new Date('2026-05-10'),
    paymentTermsDays: 30,
    currency: 'USD',
    seller: {
      name: 'Acme Logistics',
      id: 'ACME',
      address1: '123 Main St',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
    },
    buyer: {
      name: 'Big Retailer Inc',
      id: 'BIGRET',
      address1: '456 Commerce Blvd',
      city: 'Dallas',
      state: 'TX',
      postalCode: '75201',
      country: 'US',
    },
    lineItems: [
      {
        lineNumber: 1,
        description: 'Linehaul Chicago to Dallas',
        quantity: 1,
        unitPriceCents: 150000,
        totalCents: 150000,
        chargeType: 'linehaul',
        shipmentReference: 'SHP-001',
      },
      {
        lineNumber: 2,
        description: 'Fuel surcharge 18%',
        quantity: 1,
        unitPriceCents: 27000,
        totalCents: 27000,
        chargeType: 'fuel_surcharge',
        shipmentReference: 'SHP-001',
      },
      {
        lineNumber: 3,
        description: 'Liftgate delivery',
        quantity: 1,
        unitPriceCents: 7500,
        totalCents: 7500,
        chargeType: 'accessorial',
        freightClass: '100',
      },
    ],
    subtotalCents: 184500,
    taxCents: 0,
    totalCents: 184500,
    carrier: {
      name: 'Fast Freight LLC',
      scacCode: 'FAST',
    },
    shipmentReferences: ['SHP-001'],
  };

  it('generates valid X12 810 EDI content', () => {
    const content = service.generateEDI810(sampleInvoice);

    // Should contain ISA header
    expect(content).toContain('ISA*');
    // Should contain 810 transaction set
    expect(content).toContain('ST*810*0001~');
    // Should contain BIG with invoice number
    expect(content).toContain('BIG*20260410*INV-20260410-0001');
    // Should contain segment terminators
    expect(content).toContain('~');
  });

  it('includes seller and buyer N1 segments', () => {
    const content = service.generateEDI810(sampleInvoice);

    expect(content).toContain('N1*SE*Acme Logistics*92*ACME~');
    expect(content).toContain('N1*BY*Big Retailer Inc*92*BIGRET~');
  });

  it('includes address segments', () => {
    const content = service.generateEDI810(sampleInvoice);

    expect(content).toContain('N3*123 Main St~');
    expect(content).toContain('N4*Chicago*IL*60601*US~');
    expect(content).toContain('N3*456 Commerce Blvd~');
    expect(content).toContain('N4*Dallas*TX*75201*US~');
  });

  it('includes payment terms', () => {
    const content = service.generateEDI810(sampleInvoice);

    // ITD segment with net 30
    expect(content).toContain('ITD*01*3***30~');
  });

  it('includes line items with correct amounts', () => {
    const content = service.generateEDI810(sampleInvoice);

    // IT1 for linehaul ($1500.00)
    expect(content).toContain('IT1*1*1*EA*1500.00*PE**Linehaul Chicago to Dallas~');
    // IT1 for fuel surcharge ($270.00)
    expect(content).toContain('IT1*2*1*EA*270.00*PE**Fuel surcharge 18%~');
    // IT1 for accessorial ($75.00)
    expect(content).toContain('IT1*3*1*EA*75.00*PE**Liftgate delivery~');
  });

  it('includes shipment references', () => {
    const content = service.generateEDI810(sampleInvoice);

    expect(content).toContain('REF*SI*SHP-001~');
    expect(content).toContain('PID*F****Shipment SHP-001 - linehaul~');
  });

  it('includes freight class for LTL items', () => {
    const content = service.generateEDI810(sampleInvoice);

    // L7 segment for the accessorial with freight class
    expect(content).toContain('L7*3******100~');
  });

  it('includes carrier info', () => {
    const content = service.generateEDI810(sampleInvoice);

    expect(content).toContain('CAD*M****Fast Freight LLC****FAST~');
  });

  it('includes TDS total', () => {
    const content = service.generateEDI810(sampleInvoice);

    // $1845.00
    expect(content).toContain('TDS*1845.00~');
  });

  it('includes CTT with line count', () => {
    const content = service.generateEDI810(sampleInvoice);

    expect(content).toContain('CTT*3~');
  });

  it('includes proper envelope (ISA/IEA, GS/GE, ST/SE)', () => {
    const content = service.generateEDI810(sampleInvoice);

    expect(content).toContain('ISA*');
    expect(content).toContain('GS*IN*');
    expect(content).toContain('ST*810*');
    expect(content).toContain('SE*');
    expect(content).toContain('GE*1*');
    expect(content).toContain('IEA*1*');
  });

  it('uses custom sender/receiver IDs when provided', () => {
    const content = service.generateEDI810(sampleInvoice, {
      senderId: 'MYCOMPANY',
      receiverId: 'THEIRCUST',
    });

    expect(content).toContain('MYCOMPANY');
    expect(content).toContain('THEIRCUST');
  });
});
