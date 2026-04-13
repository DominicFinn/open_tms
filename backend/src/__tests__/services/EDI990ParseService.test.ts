import { EDI990ParseService } from '../../services/EDI990ParseService';
import { X12EnvelopeBuilder } from '../../services/edi/X12EnvelopeBuilder';

describe('EDI990ParseService', () => {
  const service = new EDI990ParseService();
  const builder = new X12EnvelopeBuilder();

  function build990(bodySegments: string[]): string {
    return builder.wrap(bodySegments, {
      senderId: 'CARRIER1',
      receiverId: 'OPENTMS',
      functionalIdentifier: 'GF',
      transactionType: '990',
      controlNumber: '000000001',
      date: new Date('2026-04-10T12:00:00Z'),
    });
  }

  it('parses an accepted 990', () => {
    const edi = build990(['B1*FAST*SHIP-001*20260410*A']);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(true);
    expect(result.responseCode).toBe('A');
    expect(result.carrierScac).toBe('FAST');
    expect(result.shipmentReference).toBe('SHIP-001');
    expect(result.responseDate).toBe('20260410');
  });

  it('parses a declined 990', () => {
    const edi = build990(['B1*FAST*SHIP-002*20260410*D']);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(true);
    expect(result.responseCode).toBe('D');
    expect(result.shipmentReference).toBe('SHIP-002');
  });

  it('extracts reference numbers from N9 segments', () => {
    const edi = build990([
      'B1*FAST*SHIP-003*20260410*A',
      'N9*BM*BOL-12345',
      'N9*SI*SHIP-003',
    ]);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(true);
    expect(result.referenceNumbers).toHaveLength(2);
    expect(result.referenceNumbers[0]).toEqual({ qualifier: 'BM', number: 'BOL-12345' });
  });

  it('detects response from N9 AW qualifier when B1 has no code', () => {
    const edi = build990([
      'B1*FAST*SHIP-004*20260410',
      'N9*AW*Accepted',
    ]);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(true);
    expect(result.responseCode).toBe('A');
  });

  it('detects rejection from N9 RD qualifier', () => {
    const edi = build990([
      'B1*FAST*SHIP-005*20260410',
      'N9*RD*Declined',
    ]);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(true);
    expect(result.responseCode).toBe('D');
  });

  it('returns error for missing B1 SCAC', () => {
    const edi = build990(['B1**SHIP-006*20260410*A']);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('SCAC'))).toBe(true);
  });

  it('returns error for missing shipment reference', () => {
    const edi = build990(['B1*FAST**20260410*A']);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('shipment reference'))).toBe(true);
  });

  it('returns error for missing response code', () => {
    const edi = build990(['B1*FAST*SHIP-007*20260410']);
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('response code'))).toBe(true);
  });

  it('returns error for wrong transaction type', () => {
    const edi = builder.wrap(['B10*REF*SCAC*PRO'], {
      senderId: 'SENDER', receiverId: 'RECV',
      functionalIdentifier: 'QM', transactionType: '214',
      controlNumber: '000000001',
    });
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.includes('not 990'))).toBe(true);
  });

  it('includes envelope warnings in result', () => {
    // No ISA - parser should warn
    const edi = 'ST*990*0001~B1*FAST*SHIP-008*20260410*A~SE*2*0001~';
    const result = service.parseEDI990(edi);

    expect(result.success).toBe(true);
    expect(result.warnings.some(w => w.includes('ISA'))).toBe(true);
  });
});
