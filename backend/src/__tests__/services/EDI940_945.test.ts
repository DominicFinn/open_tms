import { EDI940ParseService } from '../../services/EDI940ParseService';
import { EDI945Service, EDI945Data } from '../../services/EDI945Service';

const parser = new EDI940ParseService();
const generator = new EDI945Service();

function build940(segments: string[]): string {
  const isa = 'ISA*00*          *00*          *ZZ*DEPOSITOR      *ZZ*OPENTMS        *260420*1200*U*00401*000000001*0*P*>~';
  const gs = 'GS*OW*DEPOSITOR*OPENTMS*20260420*1200*1*X*004010~';
  const st = 'ST*940*0001~';
  const seCount = segments.length + 2; // ST + SE + body
  const se = `SE*${seCount}*0001~`;
  const ge = 'GE*1*1~';
  const iea = 'IEA*1*000000001~';
  return [isa, gs, st, ...segments, se, ge, iea].join('');
}

describe('EDI940ParseService', () => {
  it('parses a minimal 940 with header, addresses, one line, totals', () => {
    const content = build940([
      'W05*N*DEP-ORD-001*PO-123*REF-456~',
      'G62*10*20260425~',
      'N1*ST*Acme Retail*92*ACME001~',
      'N3*123 Main St~',
      'N4*Boston*MA*02101*US~',
      'N1*SF*Contoso Brand*92*CONTOSO~',
      'N1*WH*Our Warehouse*92*WH-01~',
      'LX*1~',
      'W01*10*EA**WIDGET-A~',
      'G69*Blue Widget~',
      'W76*10*1*LB~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.success).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.purposeCode).toBe('N');
    expect(r.depositorOrderNumber).toBe('DEP-ORD-001');
    expect(r.purchaseOrderNumber).toBe('PO-123');
    expect(r.shipperReference).toBe('REF-456');
    expect(r.requestedShipDate).toBe('2026-04-25');
    expect(r.addresses).toHaveLength(3);
    expect(r.addresses.find(a => a.partyQualifier === 'ST')?.name).toBe('Acme Retail');
    expect(r.addresses.find(a => a.partyQualifier === 'ST')?.city).toBe('Boston');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].sku).toBe('WIDGET-A');
    expect(r.lines[0].orderedQuantity).toBe(10);
    expect(r.lines[0].description).toBe('Blue Widget');
  });

  it('parses multiple line items', () => {
    const content = build940([
      'W05*N*ORD-MULTI*~',
      'N1*ST*Ship To*92*ST1~',
      'LX*1~',
      'W01*5*EA**SKU-A~',
      'LX*2~',
      'W01*3*CASE**SKU-B~',
      'LX*3~',
      'W01*1*PALLET**SKU-C~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.success).toBe(true);
    expect(r.lines).toHaveLength(3);
    expect(r.lines.map(l => [l.sku, l.orderedQuantity, l.uomCode])).toEqual([
      ['SKU-A', 5, 'EA'],
      ['SKU-B', 3, 'CASE'],
      ['SKU-C', 1, 'PALLET'],
    ]);
  });

  it('captures line-level lot numbers and customer refs via N9', () => {
    const content = build940([
      'W05*N*ORD-LOT*~',
      'N1*ST*Ship To*92*ST1~',
      'LX*1~',
      'W01*10*EA**SKU-X~',
      'N9*LT*LOT-2026-A~',
      'N9*PD*CUST-LINE-5~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.success).toBe(true);
    expect(r.lines[0].lotNumber).toBe('LOT-2026-A');
    expect(r.lines[0].customerLineRef).toBe('CUST-LINE-5');
  });

  it('extracts carrier SCAC from W66', () => {
    const content = build940([
      'W05*N*ORD-CARRIER*~',
      'W66*GROUND****FDEG~',
      'N1*ST*Ship To*92*ST1~',
      'LX*1~',
      'W01*1*EA**SKU-X~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.success).toBe(true);
    expect(r.carrierScac).toBe('FDEG');
    expect(r.serviceLevel).toBe('GROUND');
  });

  it('concatenates multiple NTE notes with newlines', () => {
    const content = build940([
      'W05*N*ORD-NOTES*~',
      'N1*ST*Ship To*92*ST1~',
      'NTE**Line 1 note~',
      'NTE**Line 2 note~',
      'LX*1~',
      'W01*1*EA**SKU-X~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.notes).toBe('Line 1 note\nLine 2 note');
  });

  it('rejects a non-940 transaction type', () => {
    const wrong = build940([]).replace('ST*940*0001~', 'ST*850*0001~');
    const r = parser.parseEDI940(wrong);
    expect(r.success).toBe(false);
    expect(r.errors.some(e => e.includes('Expected ST*940'))).toBe(true);
  });

  it('reports missing depositor order number', () => {
    const content = build940([
      'W05*N**~',
      'N1*ST*Ship To*92*ST1~',
      'LX*1~',
      'W01*5*EA**SKU-A~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.success).toBe(false);
    expect(r.errors.some(e => e.includes('depositor order number'))).toBe(true);
  });

  it('reports missing lines and invalid quantities', () => {
    const content = build940([
      'W05*N*ORD-BAD*~',
      'N1*ST*Ship To*92*ST1~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.success).toBe(false);
    expect(r.errors.some(e => e.includes('No W01 line'))).toBe(true);
  });

  it('reports missing SKU on a line', () => {
    const content = build940([
      'W05*N*ORD-NOSKU*~',
      'N1*ST*Ship To*92*ST1~',
      'LX*1~',
      'W01*5*EA**~',
    ]);
    const r = parser.parseEDI940(content);
    expect(r.success).toBe(false);
    expect(r.errors.some(e => e.includes('missing SKU'))).toBe(true);
  });
});

describe('EDI945Service', () => {
  const baseData = (): EDI945Data => ({
    depositorOrderNumber: 'DEP-ORD-001',
    shipperId: 'OPENTMS',
    purchaseOrderNumber: 'PO-123',
    shipDate: new Date('2026-04-25T10:00:00Z'),
    addresses: [
      { partyQualifier: 'ST', name: 'Acme Retail', idCode: 'ACME001', address1: '123 Main St', city: 'Boston', state: 'MA', postalCode: '02101', country: 'US' },
      { partyQualifier: 'WH', name: 'Warehouse One', idCode: 'WH-01' },
      { partyQualifier: 'SF', name: 'Contoso Brand', idCode: 'CONTOSO' },
    ],
    lines: [
      { lineNumber: 1, sku: 'WIDGET-A', orderedQuantity: 10, shippedQuantity: 10, uomCode: 'EA', description: 'Blue Widget' },
    ],
    carrier: { scac: 'FDEG', transportationMethodCode: 'M', trackingNumber: 'TRK-0001' },
    totalWeightGrams: 12_500,
    totalPallets: 1,
  });

  it('generates a well-formed 945 envelope with all core segments', () => {
    const result = generator.validateAndGenerate(baseData());
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    const ediContent = result.data!;
    expect(ediContent).toContain('ST*945*');
    expect(ediContent).toContain('GS*SW*');
    expect(ediContent).toContain('W06*N*DEP-ORD-001*');
    expect(ediContent).toContain('N1*ST*Acme Retail');
    expect(ediContent).toContain('N1*WH*Warehouse One');
    expect(ediContent).toContain('N1*SF*Contoso Brand');
    expect(ediContent).toContain('G62*11*20260425');
    expect(ediContent).toContain('W27*M*FDEG');
    expect(ediContent).toContain('W12*CC*10*10*0*EA');
    expect(ediContent).toContain('VP*WIDGET-A');
    expect(ediContent).toContain('G69*Blue Widget');
    expect(ediContent).toContain('W03*10');
  });

  it('emits W12 status code "CC" (complete) when fully shipped', () => {
    const d = baseData();
    d.lines = [{ lineNumber: 1, sku: 'A', orderedQuantity: 5, shippedQuantity: 5, uomCode: 'EA', description: undefined } as any];
    const r = generator.validateAndGenerate(d);
    expect(r.data).toContain('W12*CC*5*5*0*EA');
  });

  it('emits W12 status code "PC" (partial) when some were shipped', () => {
    const d = baseData();
    d.lines = [{ lineNumber: 1, sku: 'A', orderedQuantity: 5, shippedQuantity: 3, uomCode: 'EA', description: undefined } as any];
    const r = generator.validateAndGenerate(d);
    expect(r.data).toContain('W12*PC*5*3*2*EA');
  });

  it('emits W12 status code "CN" (cancelled) when nothing was shipped', () => {
    const d = baseData();
    d.lines = [{ lineNumber: 1, sku: 'A', orderedQuantity: 5, shippedQuantity: 0, uomCode: 'EA', description: undefined } as any];
    const r = generator.validateAndGenerate(d);
    expect(r.data).toContain('W12*CN*5*0*5*EA');
  });

  it('emits lot number via N9*LT when provided', () => {
    const d = baseData();
    d.lines[0].lotNumber = 'LOT-ABC';
    const r = generator.validateAndGenerate(d);
    expect(r.data).toContain('N9*LT*LOT-ABC');
  });

  it('emits tracking number via N9*CN when provided', () => {
    const d = baseData();
    d.lines[0].trackingNumber = 'PKG-001';
    const r = generator.validateAndGenerate(d);
    expect(r.data).toContain('N9*CN*PKG-001');
  });

  it('warns (not errors) when shipped exceeds ordered', () => {
    const d = baseData();
    d.lines[0].shippedQuantity = 15; // ordered 10
    const r = generator.validateAndGenerate(d);
    expect(r.success).toBe(true);
    expect(r.warnings.some(w => w.includes('exceeds ordered'))).toBe(true);
  });

  it('rejects when depositorOrderNumber is missing', () => {
    const d = baseData(); d.depositorOrderNumber = '';
    const r = generator.validateAndGenerate(d);
    expect(r.success).toBe(false);
    expect(r.errors).toContain('depositorOrderNumber is required');
  });

  it('rejects when no ship-to address is provided', () => {
    const d = baseData();
    d.addresses = d.addresses.filter(a => a.partyQualifier !== 'ST');
    const r = generator.validateAndGenerate(d);
    expect(r.success).toBe(false);
    expect(r.errors).toContain('Ship-to (ST) address is required');
  });

  it('rejects when lines are empty', () => {
    const d = baseData(); d.lines = [];
    const r = generator.validateAndGenerate(d);
    expect(r.success).toBe(false);
    expect(r.errors).toContain('At least one line is required');
  });

  it('uses reportingCode "R" when replacement is flagged', () => {
    const d = { ...baseData(), reportingCode: 'R' as const };
    const r = generator.validateAndGenerate(d);
    expect(r.data).toContain('W06*R*DEP-ORD-001*');
  });
});

describe('940 -> 945 roundtrip', () => {
  it('parses a 940 and generates a matching 945 for the same depositor order', () => {
    const content940 = [
      'ISA*00*          *00*          *ZZ*DEPOSITOR      *ZZ*OPENTMS        *260420*1200*U*00401*000000001*0*P*>~',
      'GS*OW*DEPOSITOR*OPENTMS*20260420*1200*1*X*004010~',
      'ST*940*0001~',
      'W05*N*DEP-RT-100*PO-RT*~',
      'N1*ST*Acme Retail*92*ACME001~',
      'N3*123 Main St~',
      'N4*Boston*MA*02101*US~',
      'N1*SF*Contoso Brand*92*CONTOSO~',
      'LX*1~',
      'W01*10*EA**SKU-RT~',
      'G69*Roundtrip Widget~',
      'SE*10*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('');

    const parsed = parser.parseEDI940(content940);
    expect(parsed.success).toBe(true);

    // Simulate picking only 8 of the 10 - 945 reports partial
    const r = generator.validateAndGenerate({
      depositorOrderNumber: parsed.depositorOrderNumber,
      purchaseOrderNumber: parsed.purchaseOrderNumber,
      shipDate: new Date('2026-04-25'),
      addresses: parsed.addresses.map(a => ({
        partyQualifier: a.partyQualifier,
        name: a.name,
        idCode: a.idCode,
        address1: a.address1, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country,
      })),
      lines: parsed.lines.map(l => ({
        lineNumber: l.lineNumber,
        sku: l.sku,
        orderedQuantity: l.orderedQuantity,
        shippedQuantity: 8,
        uomCode: l.uomCode,
        description: l.description,
      })),
    });

    expect(r.success).toBe(true);
    expect(r.data).toContain('W06*N*DEP-RT-100*');
    expect(r.data).toContain('W12*PC*10*8*2*EA');
    expect(r.data).toContain('VP*SKU-RT');
    expect(r.data).toContain('N1*ST*Acme Retail');
  });
});
