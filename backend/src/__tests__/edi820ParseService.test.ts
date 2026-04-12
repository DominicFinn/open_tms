import { EDI820ParseService } from '../services/EDI820ParseService';

describe('EDI820ParseService', () => {
  const service = new EDI820ParseService();

  const sampleEDI820 = [
    'ISA*00*          *00*          *ZZ*BIGRETAIL      *ZZ*OPENTMS        *260412*0800*U*00401*000000456*0*P*>~',
    'GS*RA*BIGRETAIL*OPENTMS*20260412*0800*456*X*004010~',
    'ST*820*0001~',
    'BPR*C*3250.00*C*ACH*CCD*01*123456789*DA*9876543210*01*111222333*DA*4445556667**20260411~',
    'TRN*1*ACH-REF-78901*1234567890~',
    'N1*PR*Big Retailer Inc*92*BIGRET~',
    'N1*PE*Acme Logistics*92*ACME~',
    'ENT*1~',
    'RMR*IV*INV-20260401-0001*PO*1750.00*0.00~',
    'REF*PO*PO-12345~',
    'DTM*003*20260401~',
    'ENT*2~',
    'RMR*IV*INV-20260405-0002*PO*1500.00*250.00~',
    'REF*PO*PO-12346~',
    'SE*13*0001~',
    'GE*1*456~',
    'IEA*1*000000456~',
  ].join('\n');

  it('parses a complete EDI 820 document', () => {
    const result = service.parseEDI820(sampleEDI820);

    expect(result.success).toBe(true);
    expect(result.totalAmountCents).toBe(325000); // $3,250.00
    expect(result.paymentMethod).toBe('ach');
    expect(result.paymentDate).toBe('20260411');
    expect(result.paymentReference).toBe('ACH-REF-78901');
    expect(result.payerName).toBe('Big Retailer Inc');
    expect(result.payerId).toBe('BIGRET');
  });

  it('extracts remittance items with invoice numbers and amounts', () => {
    const result = service.parseEDI820(sampleEDI820);

    expect(result.remittanceItems).toHaveLength(2);

    expect(result.remittanceItems[0].invoiceNumber).toBe('INV-20260401-0001');
    expect(result.remittanceItems[0].amountPaidCents).toBe(175000); // $1,750.00
    expect(result.remittanceItems[0].balanceAfterCents).toBe(0);
    expect(result.remittanceItems[0].references).toEqual([{ qualifier: 'PO', number: 'PO-12345' }]);

    expect(result.remittanceItems[1].invoiceNumber).toBe('INV-20260405-0002');
    expect(result.remittanceItems[1].amountPaidCents).toBe(150000); // $1,500.00
    expect(result.remittanceItems[1].balanceAfterCents).toBe(25000); // $250.00 remaining
  });

  it('maps payment method codes correctly', () => {
    // ACH
    const achResult = service.parseEDI820(sampleEDI820);
    expect(achResult.paymentMethod).toBe('ach');

    // Check
    const checkContent = sampleEDI820.replace('ACH*CCD', 'CHK*');
    const checkResult = service.parseEDI820(checkContent);
    expect(checkResult.paymentMethod).toBe('check');

    // Wire
    const wireContent = sampleEDI820.replace('ACH*CCD', 'FWT*');
    const wireResult = service.parseEDI820(wireContent);
    expect(wireResult.paymentMethod).toBe('wire');
  });

  it('handles single-invoice payment without ENT groups', () => {
    const simple = [
      'ST*820*0001~',
      'BPR*C*500.00*C*CHK****20260410~',
      'TRN*1*CHK-5678~',
      'N1*PR*Small Customer*92*SMLCUST~',
      'RMR*IV*INV-20260408-0003*PO*500.00~',
      'SE*5*0001~',
    ].join('\n');

    const result = service.parseEDI820(simple);

    expect(result.success).toBe(true);
    expect(result.totalAmountCents).toBe(50000);
    expect(result.paymentMethod).toBe('check');
    expect(result.paymentReference).toBe('CHK-5678');
    expect(result.remittanceItems).toHaveLength(1);
    expect(result.remittanceItems[0].invoiceNumber).toBe('INV-20260408-0003');
    expect(result.remittanceItems[0].amountPaidCents).toBe(50000);
  });

  it('fails for non-820 content', () => {
    const result = service.parseEDI820('ST*850*0001~SE*2*0001~');

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('820'))).toBe(true);
  });

  it('fails when no remittance items found', () => {
    const noRemittance = [
      'ST*820*0001~',
      'BPR*C*500.00*C*ACH~',
      'TRN*1*REF-123~',
      'SE*3*0001~',
    ].join('\n');

    const result = service.parseEDI820(noRemittance);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('remittance'))).toBe(true);
  });
});
