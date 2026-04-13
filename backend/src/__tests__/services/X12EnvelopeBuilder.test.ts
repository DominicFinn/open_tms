import { X12EnvelopeBuilder } from '../../services/edi/X12EnvelopeBuilder';
import { X12EnvelopeConfig } from '../../services/edi/types';

describe('X12EnvelopeBuilder', () => {
  let builder: X12EnvelopeBuilder;

  beforeEach(() => {
    builder = new X12EnvelopeBuilder();
  });

  const baseConfig: X12EnvelopeConfig = {
    senderId: 'OPENTMS',
    receiverId: 'CARRIER1',
    functionalIdentifier: 'QM',
    transactionType: '214',
    controlNumber: '000000001',
    date: new Date('2026-03-15T14:30:00Z'),
  };

  describe('buildISA', () => {
    it('generates ISA with correct fixed-width padding', () => {
      const isa = builder.buildISA(baseConfig, '000000001', baseConfig.date);

      const elements = isa.split('*');
      expect(elements[0]).toBe('ISA');
      expect(elements[1]).toBe('00');           // Auth qualifier (2 chars)
      expect(elements[2]).toBe(' '.repeat(10)); // Auth info (10 chars)
      expect(elements[3]).toBe('00');           // Security qualifier (2 chars)
      expect(elements[4]).toBe(' '.repeat(10)); // Security info (10 chars)
      expect(elements[5]).toBe('ZZ');           // Sender qualifier
      expect(elements[6]).toBe('OPENTMS'.padEnd(15)); // Sender ID (15 chars)
      expect(elements[6].length).toBe(15);
      expect(elements[7]).toBe('ZZ');           // Receiver qualifier
      expect(elements[8]).toBe('CARRIER1'.padEnd(15)); // Receiver ID (15 chars)
      expect(elements[8].length).toBe(15);
      expect(elements[12]).toBe('00401');       // Version
      expect(elements[13]).toBe('000000001');   // Control number (9 digits)
      expect(elements[14]).toBe('0');           // Ack requested
      expect(elements[15]).toBe('P');           // Usage indicator
      expect(elements[16]).toBe(':');           // Sub-element separator
    });

    it('pads short sender/receiver IDs to 15 characters', () => {
      const isa = builder.buildISA(baseConfig, '000000001');
      const elements = isa.split('*');
      expect(elements[6]).toBe('OPENTMS        ');
      expect(elements[8]).toBe('CARRIER1       ');
    });

    it('formats ISA date as YYMMDD', () => {
      const isa = builder.buildISA(baseConfig, '000000001', new Date('2026-03-15T14:30:00Z'));
      const elements = isa.split('*');
      expect(elements[9]).toBe('260315');
    });

    it('formats ISA time as HHMM', () => {
      const isa = builder.buildISA(baseConfig, '000000001', new Date('2026-03-15T14:30:00Z'));
      const elements = isa.split('*');
      expect(elements[10]).toBe('1430');
    });

    it('respects custom sender/receiver qualifiers', () => {
      const config = { ...baseConfig, senderQualifier: '01', receiverQualifier: '14' };
      const isa = builder.buildISA(config, '000000001');
      const elements = isa.split('*');
      expect(elements[5]).toBe('01');
      expect(elements[7]).toBe('14');
    });
  });

  describe('buildGS', () => {
    it('generates GS with correct functional identifier', () => {
      const gs = builder.buildGS(baseConfig, '000000001', baseConfig.date);
      const elements = gs.split('*');

      expect(elements[0]).toBe('GS');
      expect(elements[1]).toBe('QM');         // Functional ID
      expect(elements[2]).toBe('OPENTMS');
      expect(elements[3]).toBe('CARRIER1');
      expect(elements[7]).toBe('X');          // Responsible agency
      expect(elements[8]).toBe('004010');     // Version
    });

    it('formats GS date as CCYYMMDD', () => {
      const gs = builder.buildGS(baseConfig, '000000001', new Date('2026-03-15T14:30:00Z'));
      const elements = gs.split('*');
      expect(elements[4]).toBe('20260315');
    });

    it('looks up GS code from transaction type if not specified', () => {
      const config = { ...baseConfig, functionalIdentifier: '' };
      // Should fall back to TRANSACTION_TO_GS['214'] = 'QM'
      const gs = builder.buildGS(config, '000000001');
      const elements = gs.split('*');
      // Empty string is falsy, so it falls back
      expect(elements[1]).toBe('QM');
    });
  });

  describe('wrap', () => {
    it('wraps body segments with full ISA/GS/ST/SE/GE/IEA envelope', () => {
      const body = ['B10*REF123*ABCD*PRO456', 'AT7*AF****20260315*1430*LT'];
      const result = builder.wrap(body, baseConfig);

      const lines = result.split('\n');
      expect(lines.length).toBe(8); // ISA, GS, ST, 2 body, SE, GE, IEA

      // Check segment order
      expect(lines[0]).toMatch(/^ISA\*/);
      expect(lines[1]).toMatch(/^GS\*/);
      expect(lines[2]).toMatch(/^ST\*214\*/);
      expect(lines[3]).toBe('B10*REF123*ABCD*PRO456~');
      expect(lines[4]).toBe('AT7*AF****20260315*1430*LT~');
      expect(lines[5]).toMatch(/^SE\*/);
      expect(lines[6]).toMatch(/^GE\*/);
      expect(lines[7]).toMatch(/^IEA\*/);

      // All lines end with segment terminator
      for (const line of lines) {
        expect(line.endsWith('~')).toBe(true);
      }
    });

    it('calculates correct SE segment count (ST + body + SE)', () => {
      const body = ['B10*REF*SCAC*PRO', 'L11*REF*SI', 'AT7*AF****20260315*1430'];
      const result = builder.wrap(body, baseConfig);

      const lines = result.split('\n');
      const seLine = lines.find(l => l.startsWith('SE*'));
      const seElements = seLine!.replace('~', '').split('*');
      // ST + 3 body + SE = 5
      expect(seElements[1]).toBe('5');
    });

    it('uses control number from config', () => {
      const result = builder.wrap(['B10*REF*SCAC'], baseConfig);
      const lines = result.split('\n');

      const geLine = lines.find(l => l.startsWith('GE*'));
      expect(geLine).toContain('000000001');

      const ieaLine = lines.find(l => l.startsWith('IEA*'));
      expect(ieaLine).toContain('000000001');
    });
  });

  describe('sanitize', () => {
    it('removes * ~ : characters', () => {
      expect(builder.sanitize('Hello*World~Test:Value')).toBe('Hello World Test Value');
    });

    it('trims whitespace', () => {
      expect(builder.sanitize('  Hello  ')).toBe('Hello');
    });

    it('returns empty string for null/undefined', () => {
      expect(builder.sanitize(null)).toBe('');
      expect(builder.sanitize(undefined)).toBe('');
    });

    it('truncates to maxLength', () => {
      expect(builder.sanitize('A very long string that exceeds the limit', 10)).toBe('A very lon');
    });
  });

  describe('formatDateShort', () => {
    it('formats as YYMMDD', () => {
      expect(builder.formatDateShort(new Date('2026-01-05'))).toBe('260105');
    });
  });

  describe('formatDateLong', () => {
    it('formats as CCYYMMDD', () => {
      expect(builder.formatDateLong(new Date('2026-01-05'))).toBe('20260105');
    });
  });

  describe('formatTime', () => {
    it('formats as HHMM', () => {
      expect(builder.formatTime(new Date('2026-01-05T09:05:00Z'))).toBe('0905');
    });
  });

  describe('generateControlNumber', () => {
    it('returns a 9-digit string', () => {
      const cn = builder.generateControlNumber();
      expect(cn.length).toBe(9);
      expect(/^\d{9}$/.test(cn)).toBe(true);
    });
  });
});
