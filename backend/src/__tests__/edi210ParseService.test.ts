import { EDI210ParseService } from '../services/EDI210ParseService';

describe('EDI210ParseService', () => {
  const service = new EDI210ParseService();

  const sampleEDI210 = [
    'ISA*00*          *00*          *ZZ*CARRIER        *ZZ*OPENTMS        *260410*1200*U*00401*000000123*0*P*>~',
    'GS*IN*CARRIER*OPENTMS*20260410*1200*123*X*004010~',
    'ST*210*0001~',
    'B3**CINV-2026-001*SHIP-REF-001*1500.00*PP*20260409~',
    'N1*CA*Fast Freight LLC*2*FAST~',
    'N1*SH*Origin Warehouse~',
    'N1*CN*Destination Store~',
    'N9*SI*SHIP-REF-001~',
    'N9*BM*BOL-12345~',
    'LX*1~',
    'L5*1*General freight*50*NMFC*100~',
    'L0*1**EA*1200*L***10~',
    'L1*1*72.00*CW*864.00~',
    'LX*2~',
    'L5*2*Fuel surcharge~',
    'L0*2~',
    'L1*2***270.00****FSC~',
    'LX*3~',
    'L5*3*Liftgate delivery~',
    'L0*3~',
    'L1*3***75.00****LFT~',
    'L3*1200*L**1209.00~',
    'SE*20*0001~',
    'GE*1*123~',
    'IEA*1*000000123~',
  ].join('\n');

  it('parses a complete EDI 210 document', () => {
    const result = service.parseEDI210(sampleEDI210);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBe('CINV-2026-001');
    expect(result.shipmentReference).toBe('SHIP-REF-001');
    expect(result.carrierScac).toBe('FAST');
    expect(result.netAmountCents).toBe(150000); // $1500.00
    expect(result.deliveryDate).toBe('20260409');
    expect(result.paymentMethod).toBe('PP');
  });

  it('extracts line items with charge types', () => {
    const result = service.parseEDI210(sampleEDI210);

    expect(result.lineItems).toHaveLength(3);

    // Line 1: linehaul
    expect(result.lineItems[0].lineNumber).toBe(1);
    expect(result.lineItems[0].chargeType).toBe('linehaul');
    expect(result.lineItems[0].chargeAmountCents).toBe(86400); // $864.00
    expect(result.lineItems[0].freightClass).toBe('100');
    expect(result.lineItems[0].billedWeight).toBe(1200);

    // Line 2: fuel surcharge (FSC code)
    expect(result.lineItems[1].lineNumber).toBe(2);
    expect(result.lineItems[1].chargeType).toBe('fuel_surcharge');
    expect(result.lineItems[1].chargeAmountCents).toBe(27000); // $270.00

    // Line 3: accessorial (LFT code = liftgate)
    expect(result.lineItems[2].lineNumber).toBe(3);
    expect(result.lineItems[2].chargeType).toBe('accessorial');
    expect(result.lineItems[2].chargeAmountCents).toBe(7500); // $75.00
  });

  it('extracts reference numbers', () => {
    const result = service.parseEDI210(sampleEDI210);

    expect(result.referenceNumbers).toHaveLength(2);
    expect(result.referenceNumbers[0]).toEqual({ qualifier: 'SI', number: 'SHIP-REF-001' });
    expect(result.referenceNumbers[1]).toEqual({ qualifier: 'BM', number: 'BOL-12345' });
  });

  it('extracts L3 totals', () => {
    const result = service.parseEDI210(sampleEDI210);

    expect(result.totalWeight).toBe(1200);
    expect(result.totalChargesCents).toBe(120900); // $1209.00
  });

  it('fails for non-210 content', () => {
    const result = service.parseEDI210('ST*850*0001~B1*test~SE*2*0001~');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles minimal 210 with just B3 and L3', () => {
    const minimal = [
      'ST*210*0001~',
      'B3**INV-001*REF-001*500.00*PP*20260401~',
      'N1*CA*Simple Carrier*2*SIMP~',
      'L3*500*L**500.00~',
      'SE*4*0001~',
    ].join('\n');

    const result = service.parseEDI210(minimal);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBe('INV-001');
    expect(result.carrierScac).toBe('SIMP');
    expect(result.totalChargesCents).toBe(50000);
  });
});
