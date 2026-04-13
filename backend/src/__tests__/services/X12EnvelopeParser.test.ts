import { X12EnvelopeParser } from '../../services/edi/X12EnvelopeParser';
import { X12EnvelopeBuilder } from '../../services/edi/X12EnvelopeBuilder';

describe('X12EnvelopeParser', () => {
  let parser: X12EnvelopeParser;
  let builder: X12EnvelopeBuilder;

  beforeEach(() => {
    parser = new X12EnvelopeParser();
    builder = new X12EnvelopeBuilder();
  });

  // Helper: generate a valid 214 document for testing
  function validEdi214(): string {
    return builder.wrap(
      ['B10*SHIP001*ABCD*PRO123', 'AT7*AF****20260315*1430*LT', 'MS1*CHICAGO*IL*US'],
      {
        senderId: 'SENDER01',
        receiverId: 'RECEIVER1',
        functionalIdentifier: 'QM',
        transactionType: '214',
        controlNumber: '000000042',
        date: new Date('2026-03-15T14:30:00Z'),
      },
    );
  }

  describe('parse - valid documents', () => {
    it('parses a valid X12 document and extracts envelope fields', () => {
      const result = parser.parse(validEdi214());

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.envelope).toBeDefined();

      const env = result.envelope!;
      expect(env.transactionType).toBe('214');
      expect(env.senderId).toBe('SENDER01');
      expect(env.receiverId).toBe('RECEIVER1');
      expect(env.functionalIdentifier).toBe('QM');
      expect(env.interchangeControlNumber).toBe('000000042');
      expect(env.groupControlNumber).toBe('000000042');
    });

    it('extracts body segments (between ST and SE)', () => {
      const result = parser.parse(validEdi214());

      expect(result.envelope!.segments).toHaveLength(3);
      expect(result.envelope!.segments[0].id).toBe('B10');
      expect(result.envelope!.segments[1].id).toBe('AT7');
      expect(result.envelope!.segments[2].id).toBe('MS1');
    });

    it('extracts control numbers for 997 generation', () => {
      const result = parser.parse(validEdi214());
      const cn = result.envelope!.controlNumbers;

      expect(cn.isa).toBe('000000042');
      expect(cn.gs).toBe('000000042');
      expect(cn.st).toBe('0001');
    });

    it('parses segment elements correctly', () => {
      const result = parser.parse(validEdi214());
      const b10 = result.envelope!.segments[0];

      expect(b10.id).toBe('B10');
      expect(b10.elements[1]).toBe('SHIP001');
      expect(b10.elements[2]).toBe('ABCD');
      expect(b10.elements[3]).toBe('PRO123');
    });
  });

  describe('parse - line ending handling', () => {
    it('handles Windows CRLF line endings', () => {
      const edi = validEdi214().replace(/\n/g, '\r\n');
      const result = parser.parse(edi);
      expect(result.success).toBe(true);
      expect(result.envelope!.transactionType).toBe('214');
    });

    it('handles old Mac CR-only line endings', () => {
      const edi = validEdi214().replace(/\n/g, '\r');
      const result = parser.parse(edi);
      expect(result.success).toBe(true);
    });

    it('handles segments without newlines (all on one line)', () => {
      // Build a simple EDI with no newlines, just ~ separators
      const edi = [
        'ISA*00*          *00*          *ZZ*SENDER01       *ZZ*RECEIVER1      *260315*1430*U*00401*000000042*0*P*:~',
        'GS*QM*SENDER01*RECEIVER1*20260315*1430*000000042*X*004010~',
        'ST*214*0001~',
        'B10*REF*SCAC*PRO~',
        'SE*2*0001~',
        'GE*1*000000042~',
        'IEA*1*000000042~',
      ].join('');

      const result = parser.parse(edi);
      expect(result.success).toBe(true);
      expect(result.envelope!.transactionType).toBe('214');
      expect(result.envelope!.segments).toHaveLength(1);
      expect(result.envelope!.segments[0].id).toBe('B10');
    });
  });

  describe('parse - missing envelope segments', () => {
    it('returns error when content is empty', () => {
      const result = parser.parse('');
      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/empty/i);
    });

    it('returns error when no ST segment exists', () => {
      const result = parser.parse('ISA*00*stuff~GS*QM*more*stuff~GE*1*1~IEA*1*1~');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('No ST (Transaction Set Header) segment found');
    });

    it('warns but still parses when ISA is missing', () => {
      const edi = 'ST*214*0001~B10*REF*SCAC*PRO~SE*2*0001~';
      const result = parser.parse(edi);

      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('No ISA segment'))).toBe(true);
      expect(result.envelope!.transactionType).toBe('214');
    });

    it('warns but still parses when GS is missing', () => {
      const edi = [
        'ISA*00*          *00*          *ZZ*SENDER01       *ZZ*RECEIVER1      *260315*1430*U*00401*000000042*0*P*:~',
        'ST*214*0001~',
        'B10*REF*SCAC*PRO~',
        'SE*2*0001~',
        'IEA*1*000000042~',
      ].join('\n');

      const result = parser.parse(edi);
      expect(result.success).toBe(true);
      expect(result.warnings.some(w => w.includes('No GS segment'))).toBe(true);
    });
  });

  describe('parse - SE segment count validation', () => {
    it('warns on SE segment count mismatch', () => {
      const edi = [
        'ISA*00*          *00*          *ZZ*SENDER01       *ZZ*RECEIVER1      *260315*1430*U*00401*000000042*0*P*:~',
        'GS*QM*SENDER01*RECEIVER1*20260315*1430*000000042*X*004010~',
        'ST*214*0001~',
        'B10*REF*SCAC*PRO~',
        'AT7*AF****20260315*1430*LT~',
        'SE*99*0001~',  // Wrong count: should be 4, claims 99
        'GE*1*000000042~',
        'IEA*1*000000042~',
      ].join('\n');

      const result = parser.parse(edi);
      expect(result.success).toBe(true); // Still parses, just warns
      expect(result.warnings.some(w => w.includes('SE segment count mismatch'))).toBe(true);
    });
  });

  describe('validateISA', () => {
    it('reports errors for ISA with wrong number of elements', () => {
      const errors = parser.validateISA({
        id: 'ISA',
        elements: ['ISA', '00', '          ', '00'],
        raw: 'ISA*00*          *00',
      });
      expect(errors.some(e => e.includes('Expected 17 elements'))).toBe(true);
    });

    it('reports errors for wrong-length fixed fields', () => {
      // Build an ISA with short sender ID
      const elements = [
        'ISA', '00', '          ', '00', '          ',
        'ZZ', 'SHORT',  // Should be 15 chars
        'ZZ', 'ALSONOTFIFTEEN',  // Should be 15 chars
        '260315', '1430', 'U', '00401', '000000001', '0', 'P', ':',
      ];
      const errors = parser.validateISA({ id: 'ISA', elements, raw: elements.join('*') });
      expect(errors.some(e => e.includes('ISA06'))).toBe(true);
      expect(errors.some(e => e.includes('ISA08'))).toBe(true);
    });
  });

  describe('validateGS', () => {
    it('reports errors for GS with too few elements', () => {
      const errors = parser.validateGS({
        id: 'GS',
        elements: ['GS', 'QM'],
        raw: 'GS*QM',
      });
      expect(errors.some(e => e.includes('Expected 9 elements'))).toBe(true);
    });
  });

  describe('detectSeparators', () => {
    it('detects standard * element separator and ~ segment terminator', () => {
      const edi = 'ISA*00*          *00*          *ZZ*SENDER01       *ZZ*RECEIVER1      *260315*1430*U*00401*000000042*0*P*:~';
      const { elementSep, segmentTerm } = parser.detectSeparators(edi);
      expect(elementSep).toBe('*');
      expect(segmentTerm).toBe('~');
    });

    it('falls back to defaults when ISA is not found', () => {
      const { elementSep, segmentTerm } = parser.detectSeparators('ST*214*0001~B10*REF~');
      expect(elementSep).toBe('*');
      expect(segmentTerm).toBe('~');
    });
  });

  describe('detectTransactionType', () => {
    it('detects type from ST segment', () => {
      expect(parser.detectTransactionType('ISA*stuff~GS*QM*stuff~ST*214*0001~')).toBe('214');
      expect(parser.detectTransactionType('ST*850*0001~')).toBe('850');
      expect(parser.detectTransactionType('ST*997*0001~')).toBe('997');
    });

    it('falls back to GS functional identifier', () => {
      expect(parser.detectTransactionType('ISA*stuff~GS*SM*stuff~')).toBe('204');
      expect(parser.detectTransactionType('GS*PO*stuff~')).toBe('850');
      expect(parser.detectTransactionType('GS*IM*stuff~')).toBe('210');
    });

    it('returns null for unknown content', () => {
      expect(parser.detectTransactionType('random garbage')).toBeNull();
      expect(parser.detectTransactionType('')).toBeNull();
    });
  });

  describe('roundtrip: builder -> parser', () => {
    it('builder output can be parsed back by parser', () => {
      const body = ['B2**ABCD*SHIP001**PP', 'B2A*00', 'L11*SHIP001*SI'];
      const config = {
        senderId: 'TESTSEND',
        receiverId: 'TESTRECV',
        functionalIdentifier: 'SM',
        transactionType: '204',
        controlNumber: '000012345',
        date: new Date('2026-06-15T10:00:00Z'),
      };

      const edi = builder.wrap(body, config);
      const result = parser.parse(edi);

      expect(result.success).toBe(true);
      expect(result.envelope!.transactionType).toBe('204');
      expect(result.envelope!.senderId).toBe('TESTSEND');
      expect(result.envelope!.receiverId).toBe('TESTRECV');
      expect(result.envelope!.functionalIdentifier).toBe('SM');
      expect(result.envelope!.segments).toHaveLength(3);
      expect(result.envelope!.segments[0].elements[1]).toBe('');
      expect(result.envelope!.segments[0].elements[2]).toBe('ABCD');
    });
  });
});
