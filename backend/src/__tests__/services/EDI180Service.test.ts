import { EDI180ParseService } from '../../services/EDI180ParseService';
import { EDI180Service } from '../../services/EDI180Service';

describe('EDI180ParseService', () => {
  const service = new EDI180ParseService();

  it('maps X12 reason codes to internal reasons', () => {
    expect(service.mapReasonCode('001')).toBe('damaged');
    expect(service.mapReasonCode('002')).toBe('wrong_item');
    expect(service.mapReasonCode('003')).toBe('defective');
    expect(service.mapReasonCode('UNKNOWN')).toBe('other');
  });

  it('parses a minimal EDI 180 return request', () => {
    const edi = [
      'ISA*00*          *00*          *ZZ*CUSTOMER       *ZZ*OPENTMS        *260419*1200*U*00401*000000001*0*P*>~',
      'GS*RZ*CUSTOMER*OPENTMS*20260419*1200*1*X*004010~',
      'ST*180*0001~',
      'BGN*00*CUST-RMA-123*20260419~',
      'REF*PO*ORDER-5001~',
      'DTM*007*20260419~',
      'N1*SH*Acme Customer*92*ACME001~',
      'LX*1~',
      'LQ*10*001~',
      'SLN*1**I*3*EA*15.00***VP*SKU-A~',
      'MSG*Product arrived damaged in transit~',
      'LX*2~',
      'LQ*10*002~',
      'SLN*2**I*1*EA*25.00***VP*SKU-B~',
      'CTT*2~',
      'SE*14*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('');

    const result = service.parseEDI180(edi);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.transactionPurpose).toBe('00');
    expect(result.customerRmaNumber).toBe('CUST-RMA-123');
    expect(result.originalOrderNumber).toBe('ORDER-5001');
    expect(result.customerName).toBe('Acme Customer');
    expect(result.lines).toHaveLength(2);

    expect(result.lines[0].sku).toBe('SKU-A');
    expect(result.lines[0].quantity).toBe(3);
    expect(result.lines[0].reasonCode).toBe('damaged');
    expect(result.lines[0].unitPriceCents).toBe(1500);
    expect(result.lines[0].conditionNotes).toContain('damaged in transit');

    expect(result.lines[1].sku).toBe('SKU-B');
    expect(result.lines[1].quantity).toBe(1);
    expect(result.lines[1].reasonCode).toBe('wrong_item');

    // Header-level return reason is taken from first LQ
    expect(result.returnReason).toBe('damaged');
  });

  it('rejects non-180 transactions', () => {
    const edi = [
      'ISA*00*          *00*          *ZZ*CUSTOMER       *ZZ*OPENTMS        *260419*1200*U*00401*000000001*0*P*>~',
      'GS*PO*CUSTOMER*OPENTMS*20260419*1200*1*X*004010~',
      'ST*850*0001~',
      'BEG*00*NE*ORDER-123**20260419~',
      'SE*3*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('');

    const result = service.parseEDI180(edi);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('ST*180'))).toBe(true);
  });

  it('reports errors for missing required fields', () => {
    const edi = [
      'ISA*00*          *00*          *ZZ*CUSTOMER       *ZZ*OPENTMS        *260419*1200*U*00401*000000001*0*P*>~',
      'GS*RZ*CUSTOMER*OPENTMS*20260419*1200*1*X*004010~',
      'ST*180*0001~',
      'BGN*00*CUST-RMA-999*20260419~',
      // missing REF*PO
      'LX*1~',
      'SLN*1**I*0*EA*0***VP*~', // empty SKU, zero qty
      'SE*5*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('');

    const result = service.parseEDI180(edi);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('Original order number'))).toBe(true);
    expect(result.errors.some(e => e.includes('missing SKU'))).toBe(true);
    expect(result.errors.some(e => e.includes('invalid quantity'))).toBe(true);
  });

  it('parses using PO1 segment as alternative to LX/SLN', () => {
    const edi = [
      'ISA*00*          *00*          *ZZ*CUSTOMER       *ZZ*OPENTMS        *260419*1200*U*00401*000000001*0*P*>~',
      'GS*RZ*CUSTOMER*OPENTMS*20260419*1200*1*X*004010~',
      'ST*180*0001~',
      'BGN*00*CUST-RMA-456*20260419~',
      'REF*PO*ORDER-7000~',
      'N1*SH*Beta Customer*92*BETA001~',
      'PO1*1*5*EA*10.00*PE*VP*SKU-C~',
      'CTT*1~',
      'SE*7*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('');

    const result = service.parseEDI180(edi);

    expect(result.success).toBe(true);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].sku).toBe('SKU-C');
    expect(result.lines[0].quantity).toBe(5);
    expect(result.lines[0].unitPriceCents).toBe(1000);
  });
});

describe('EDI180Service (generator)', () => {
  const service = new EDI180Service();

  it('generates a valid EDI 180 authorization response', () => {
    const result = service.validateAndGenerate({
      rmaNumber: 'RMA-2026-04-19-001',
      originalOrderNumber: 'ORDER-5001',
      customerRmaNumber: 'CUST-RMA-123',
      authorizationDate: new Date('2026-04-19'),
      transactionPurpose: '11',
      receiver: { name: 'Our Warehouse', address1: '100 Warehouse Way', city: 'Reading', state: 'BRK', postalCode: 'RG1 1AA', country: 'GB' },
      sender: { name: 'Acme Customer', id: 'ACME001' },
      lines: [
        { lineNumber: 1, sku: 'SKU-A', authorizedQuantity: 3, unitPriceCents: 1500, reasonCode: 'damaged' },
        { lineNumber: 2, sku: 'SKU-B', authorizedQuantity: 1, unitPriceCents: 2500 },
      ],
      instructions: 'Ship back in original packaging',
    });

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    const content = result.data!;
    expect(content).toContain('ST*180*');
    expect(content).toContain('BGN*11*RMA-2026-04-19-001');
    expect(content).toContain('REF*PO*ORDER-5001');
    expect(content).toContain('REF*RMA*CUST-RMA-123');
    expect(content).toContain('N1*SF*Acme Customer');
    expect(content).toContain('N1*ST*Our Warehouse');
    expect(content).toContain('SKU-A');
    expect(content).toContain('SKU-B');
    expect(content).toContain('CTT*2');
    expect(content).toContain('GS*RZ*');
  });

  it('rejects invalid input with clear errors', () => {
    const result = service.validateAndGenerate({
      rmaNumber: '',
      originalOrderNumber: '',
      authorizationDate: new Date(),
      transactionPurpose: '11',
      receiver: { name: '' },
      sender: { name: 'Customer' },
      lines: [],
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain('rmaNumber is required');
    expect(result.errors).toContain('originalOrderNumber is required');
    expect(result.errors).toContain('receiver.name is required');
    expect(result.errors).toContain('At least one line is required');
  });

  it('roundtrip: generated output parses back correctly', () => {
    const generator = new EDI180Service();
    const parser = new EDI180ParseService();

    const gen = generator.validateAndGenerate({
      rmaNumber: 'RMA-TEST-001',
      originalOrderNumber: 'ORDER-ROUND',
      authorizationDate: new Date('2026-04-19'),
      transactionPurpose: '11',
      receiver: { name: 'Receiver Inc' },
      sender: { name: 'Sender Ltd', id: 'SND' },
      lines: [
        { lineNumber: 1, sku: 'SKU-X', authorizedQuantity: 2, unitPriceCents: 1000 },
      ],
    });

    expect(gen.success).toBe(true);

    const parsed = parser.parseEDI180(gen.data!);
    expect(parsed.success).toBe(true);
    expect(parsed.customerRmaNumber).toBe('RMA-TEST-001'); // in BGN position
    expect(parsed.originalOrderNumber).toBe('ORDER-ROUND');
    expect(parsed.lines).toHaveLength(1);
    expect(parsed.lines[0].sku).toBe('SKU-X');
    expect(parsed.lines[0].quantity).toBe(2);
    expect(parsed.lines[0].unitPriceCents).toBe(1000);
  });
});
