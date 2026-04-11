import { EDI214Service } from '../services/EDI214Service.js';

describe('EDI214Service', () => {
  const service = new EDI214Service();

  it('should generate a valid EDI 214 document', () => {
    const ediContent = service.generateEDI214({
      shipmentReference: 'SHP-001',
      proNumber: 'PRO123',
      carrierScac: 'ABCD',
      statusCode: 'AF',
      city: 'CHICAGO',
      state: 'IL',
      country: 'US',
      statusDate: new Date('2026-04-11T08:00:00Z'),
      weight: 15000,
      weightUnit: 'L',
      ladingQuantity: 10,
    }, {
      senderId: 'OPENTMS',
      receiverId: 'ABCD',
      interchangeControlNumber: '000000001',
    });

    const segments = ediContent.split('\n').map(s => s.replace(/~$/, ''));

    // ISA
    expect(segments[0]).toMatch(/^ISA\*/);
    expect(segments[0]).toContain('OPENTMS');

    // GS — must be QM for Shipment Status
    expect(segments[1]).toMatch(/^GS\*QM\*/);
    expect(segments[1]).toContain('004010');

    // ST — must be 214
    expect(segments[2]).toBe('ST*214*0001');

    // B10 — Shipment identification
    expect(segments[3]).toBe('B10*SHP-001*ABCD*PRO123');

    // L11 — Reference number
    expect(segments[4]).toBe('L11*SHP-001*SI');

    // AT7 — Status detail
    const at7 = segments[5];
    expect(at7).toMatch(/^AT7\*AF\*/);
    expect(at7).toContain('20260411');
    expect(at7).toContain('0800');
    expect(at7).toContain('LT');

    // MS1 — Location
    expect(segments[6]).toBe('MS1*CHICAGO*IL*US');

    // AT8 — Weight
    expect(segments[7]).toBe('AT8*G*L*15000*10');

    // SE — Segment count (ST through AT8 = 6, plus SE itself)
    expect(segments[8]).toMatch(/^SE\*7\*0001$/);

    // GE
    expect(segments[9]).toMatch(/^GE\*1\*/);

    // IEA
    expect(segments[10]).toMatch(/^IEA\*1\*/);
  });

  it('should use QM functional identifier in GS segment', () => {
    const ediContent = service.generateEDI214({
      shipmentReference: 'TEST-1',
      carrierScac: 'WXYZ',
      statusCode: 'D1',
      city: 'NEW YORK',
      state: 'NY',
      statusDate: new Date(),
    });

    expect(ediContent).toContain('GS*QM*');
  });

  it('should generate valid segment count in SE', () => {
    // Without optional AT8 segment
    const ediContent = service.generateEDI214({
      shipmentReference: 'TEST-2',
      carrierScac: 'ABCD',
      statusCode: 'X1',
      city: 'DALLAS',
      state: 'TX',
      statusDate: new Date(),
    });

    const segments = ediContent.split('\n').map(s => s.replace(/~$/, ''));
    const seSegment = segments.find(s => s.startsWith('SE*'));
    expect(seSegment).toBeDefined();

    // Count segments from ST to AT8 (no AT8 here) + SE = ST, B10, L11, AT7, MS1, SE = 6
    expect(seSegment).toMatch(/^SE\*6\*0001$/);
  });

  it('should omit AT8 when no weight provided', () => {
    const ediContent = service.generateEDI214({
      shipmentReference: 'TEST-3',
      carrierScac: 'ABCD',
      statusCode: 'OA',
      city: 'HOUSTON',
      state: 'TX',
      statusDate: new Date(),
    });

    expect(ediContent).not.toContain('AT8*');
  });

  it('should include additional reference numbers in L11 segments', () => {
    const ediContent = service.generateEDI214({
      shipmentReference: 'TEST-4',
      carrierScac: 'ABCD',
      statusCode: 'AF',
      city: 'PHOENIX',
      state: 'AZ',
      statusDate: new Date(),
      referenceNumbers: [
        { qualifier: 'BM', number: 'BOL-001' },
        { qualifier: 'PO', number: 'PO-999' },
      ],
    });

    expect(ediContent).toContain('L11*TEST-4*SI');
    expect(ediContent).toContain('L11*BOL-001*BM');
    expect(ediContent).toContain('L11*PO-999*PO');
  });

  it('should sanitize special characters from reference fields', () => {
    const ediContent = service.generateEDI214({
      shipmentReference: 'SHP*001~test',
      carrierScac: 'ABCD',
      statusCode: 'AF',
      city: 'City*With~Chars',
      state: 'CA',
      statusDate: new Date(),
    });

    // Should not have raw * or ~ inside segment values
    const b10 = ediContent.split('\n').find(s => s.startsWith('B10'));
    expect(b10).not.toContain('SHP*001');
    expect(b10).toContain('SHP 001 test');
  });

  it('should default country to US when not specified', () => {
    const ediContent = service.generateEDI214({
      shipmentReference: 'TEST-5',
      carrierScac: 'ABCD',
      statusCode: 'D1',
      city: 'SEATTLE',
      state: 'WA',
      statusDate: new Date(),
    });

    expect(ediContent).toContain('MS1*SEATTLE*WA*US');
  });

  it('should handle proNumber fallback to shipmentReference', () => {
    const ediContent = service.generateEDI214({
      shipmentReference: 'TEST-6',
      carrierScac: 'ABCD',
      statusCode: 'AF',
      city: 'DENVER',
      state: 'CO',
      statusDate: new Date(),
    });

    // B10 should use shipmentReference as pro number fallback
    expect(ediContent).toContain('B10*TEST-6*ABCD*TEST-6');
  });
});
