import { EDI214ParseService } from '../services/EDI214ParseService.js';

describe('EDI214ParseService', () => {
  const parser = new EDI214ParseService();

  const VALID_214 = [
    'ISA*00*          *00*          *ZZ*CARRIER        *ZZ*OPENTMS        *260411*1430*U*00401*000000001*0*P*:~',
    'GS*QM*CARRIER*OPENTMS*20260411*1430*1*X*004010~',
    'ST*214*0001~',
    'B10*SHP-001*ABCD*PRO123~',
    'L11*REF-456*SI~',
    'AT7*AF***  *20260411*0800*LT~',
    'MS1*CHICAGO*IL*US~',
    'AT8*G*L*15000*10~',
    'SE*8*0001~',
    'GE*1*1~',
    'IEA*1*000000001~',
  ].join('\n');

  it('should parse a valid 214 with B10, AT7, MS1, AT8', () => {
    const result = parser.parseEDI214(VALID_214);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.shipmentReference).toBe('SHP-001');
    expect(result.carrierScac).toBe('ABCD');
    expect(result.proNumber).toBe('PRO123');
    expect(result.statusDetails).toHaveLength(1);
    expect(result.statusDetails[0].statusCode).toBe('AF');
    expect(result.statusDetails[0].city).toBe('CHICAGO');
    expect(result.statusDetails[0].state).toBe('IL');
    expect(result.statusDetails[0].country).toBe('US');
    expect(result.statusDetails[0].date).toBe('20260411');
    expect(result.statusDetails[0].time).toBe('0800');
    expect(result.referenceNumbers).toHaveLength(1);
    expect(result.referenceNumbers[0]).toEqual({ qualifier: 'SI', number: 'REF-456' });
    expect(result.weight).toEqual({ weight: 15000, qualifier: 'G', ladingQuantity: 10 });
  });

  it('should parse 214 with multiple AT7 status details', () => {
    const multiStatus = [
      'ST*214*0001~',
      'B10*SHP-002*WXYZ*PRO789~',
      'AT7*AF****20260410*0900*LT~',
      'MS1*LOS ANGELES*CA*US~',
      'AT7*X6****20260411*1400*LT~',
      'AT7*D1****20260412*0800*LT~',
      'MS1*NEW YORK*NY*US~',
      'SE*7*0001~',
    ].join('\n');

    const result = parser.parseEDI214(multiStatus);

    expect(result.success).toBe(true);
    expect(result.statusDetails).toHaveLength(3);

    // First AT7+MS1 pair
    expect(result.statusDetails[0].statusCode).toBe('AF');
    expect(result.statusDetails[0].city).toBe('LOS ANGELES');
    expect(result.statusDetails[0].state).toBe('CA');

    // Second AT7 without MS1 (flushed when third AT7 arrives)
    expect(result.statusDetails[1].statusCode).toBe('X6');
    expect(result.statusDetails[1].city).toBe('');

    // Third AT7+MS1 pair
    expect(result.statusDetails[2].statusCode).toBe('D1');
    expect(result.statusDetails[2].city).toBe('NEW YORK');
    expect(result.statusDetails[2].state).toBe('NY');
  });

  it('should fail gracefully when B10 is missing', () => {
    const noB10 = [
      'ST*214*0001~',
      'AT7*AF****20260411*0800*LT~',
      'MS1*CHICAGO*IL*US~',
      'SE*3*0001~',
    ].join('\n');

    const result = parser.parseEDI214(noB10);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Missing carrier SCAC code in B10 segment');
    expect(result.errors).toContain('Missing shipment reference and pro number in B10 segment');
  });

  it('should fail when no AT7 status details are found', () => {
    const noAT7 = [
      'ST*214*0001~',
      'B10*SHP-003*ABCD*PRO456~',
      'SE*2*0001~',
    ].join('\n');

    const result = parser.parseEDI214(noAT7);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('No AT7 status details found');
  });

  it('should error when transaction set is not 214', () => {
    const wrong = [
      'ST*850*0001~',
      'B10*SHP-003*ABCD*PRO456~',
      'AT7*AF****20260411*0800*LT~',
      'SE*3*0001~',
    ].join('\n');

    const result = parser.parseEDI214(wrong);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Transaction set is not 214');
  });

  it('should handle SCAC fallback from MS3 segment', () => {
    const ms3Fallback = [
      'ST*214*0001~',
      'B10*SHP-004**PRO789~',
      'MS3*ZZZZ~',
      'AT7*X1****20260411*1200*LT~',
      'MS1*DALLAS*TX*US~',
      'SE*5*0001~',
    ].join('\n');

    const result = parser.parseEDI214(ms3Fallback);

    expect(result.success).toBe(true);
    expect(result.carrierScac).toBe('ZZZZ');
  });

  it('should handle Windows-style line endings', () => {
    const windowsContent = 'ST*214*0001~\r\nB10*SHP-005*ABCD*PRO111~\r\nAT7*D1****20260411*1600*LT~\r\nMS1*MIAMI*FL*US~\r\nSE*4*0001~\r\n';

    const result = parser.parseEDI214(windowsContent);

    expect(result.success).toBe(true);
    expect(result.statusDetails[0].statusCode).toBe('D1');
    expect(result.statusDetails[0].city).toBe('MIAMI');
  });

  it('should always preserve rawContent', () => {
    const result = parser.parseEDI214(VALID_214);
    expect(result.rawContent).toBe(VALID_214);
  });

  it('should handle AT7 without following MS1', () => {
    const noMs1 = [
      'ST*214*0001~',
      'B10*SHP-006*ABCD*PRO222~',
      'AT7*OA****20260411*0700*LT~',
      'SE*3*0001~',
    ].join('\n');

    const result = parser.parseEDI214(noMs1);

    expect(result.success).toBe(true);
    expect(result.statusDetails).toHaveLength(1);
    expect(result.statusDetails[0].statusCode).toBe('OA');
    expect(result.statusDetails[0].city).toBe('');
    expect(result.statusDetails[0].state).toBe('');
  });
});
