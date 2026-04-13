import { EDI997Service } from '../../services/EDI997Service';
import { X12EnvelopeBuilder } from '../../services/edi/X12EnvelopeBuilder';

describe('EDI997Service', () => {
  const service = new EDI997Service();
  const builder = new X12EnvelopeBuilder();

  describe('generate997', () => {
    it('generates a valid 997 with AK1 and AK9 segments', () => {
      const result = service.generate997({
        originalTransactionType: '214',
        originalControlNumber: '000000042',
        accepted: true,
      });

      expect(result).toContain('ST*997*');
      expect(result).toContain('AK1*QM*000000042'); // QM = 214 functional ID
      expect(result).toContain('AK9*A*1*1*1'); // A = Accepted
      expect(result).toContain('GS*FA*'); // FA = Functional Acknowledgment
    });

    it('generates rejection 997 with R code', () => {
      const result = service.generate997({
        originalTransactionType: '850',
        originalControlNumber: '000000099',
        accepted: false,
      });

      expect(result).toContain('AK1*PO*000000099'); // PO = 850 functional ID
      expect(result).toContain('AK9*R*1*1*0'); // R = Rejected, 0 accepted
    });

    it('uses custom sender/receiver IDs', () => {
      const result = service.generate997({
        senderId: 'MYSENDER',
        receiverId: 'MYRECVR',
        originalTransactionType: '204',
        originalControlNumber: '123',
        accepted: true,
      });

      expect(result).toContain('MYSENDER');
      expect(result).toContain('MYRECVR');
    });

    it('maps all known transaction types to correct GS codes', () => {
      const mappings: Record<string, string> = {
        '850': 'PO', '856': 'SH', '204': 'SM', '990': 'GF',
        '214': 'QM', '210': 'IM', '810': 'IN',
      };

      for (const [txnType, gsCode] of Object.entries(mappings)) {
        const result = service.generate997({
          originalTransactionType: txnType,
          originalControlNumber: '1',
          accepted: true,
        });
        expect(result).toContain(`AK1*${gsCode}*`);
      }
    });
  });

  describe('validateAndGenerate', () => {
    it('returns error for missing originalTransactionType', () => {
      const result = service.validateAndGenerate({
        originalTransactionType: '',
        originalControlNumber: '123',
        accepted: true,
      });
      expect(result.success).toBe(false);
      expect(result.errors).toContain('originalTransactionType is required');
    });

    it('returns error for missing originalControlNumber', () => {
      const result = service.validateAndGenerate({
        originalTransactionType: '214',
        originalControlNumber: '',
        accepted: true,
      });
      expect(result.success).toBe(false);
      expect(result.errors).toContain('originalControlNumber is required');
    });

    it('returns success with valid input', () => {
      const result = service.validateAndGenerate({
        originalTransactionType: '214',
        originalControlNumber: '42',
        accepted: true,
      });
      expect(result.success).toBe(true);
      expect(result.data).toContain('ST*997*');
    });
  });

  describe('parse997', () => {
    it('parses an accepted 997', () => {
      const edi = builder.wrap(
        ['AK1*QM*000000042', 'AK9*A*1*1*1'],
        { senderId: 'PARTNER', receiverId: 'OPENTMS', functionalIdentifier: 'FA', transactionType: '997' },
      );

      const result = service.parse997(edi);
      expect(result.success).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result.ackCode).toBe('A');
      expect(result.functionalGroupId).toBe('QM');
      expect(result.groupControlNumber).toBe('000000042');
      expect(result.acknowledgedTransactionType).toBe('214');
      expect(result.setsAccepted).toBe(1);
    });

    it('parses a rejected 997', () => {
      const edi = builder.wrap(
        ['AK1*PO*000000099', 'AK9*R*3*3*0'],
        { senderId: 'PARTNER', receiverId: 'OPENTMS', functionalIdentifier: 'FA', transactionType: '997' },
      );

      const result = service.parse997(edi);
      expect(result.success).toBe(true);
      expect(result.accepted).toBe(false);
      expect(result.ackCode).toBe('R');
      expect(result.acknowledgedTransactionType).toBe('850');
      expect(result.setsIncluded).toBe(3);
      expect(result.setsAccepted).toBe(0);
    });

    it('parses accepted-with-errors 997 as accepted', () => {
      const edi = builder.wrap(
        ['AK1*SM*000000005', 'AK9*E*1*1*1'],
        { senderId: 'PARTNER', receiverId: 'OPENTMS', functionalIdentifier: 'FA', transactionType: '997' },
      );

      const result = service.parse997(edi);
      expect(result.success).toBe(true);
      expect(result.accepted).toBe(true);
      expect(result.ackCode).toBe('E');
    });

    it('returns error for missing AK1', () => {
      const edi = builder.wrap(
        ['AK9*A*1*1*1'],
        { senderId: 'P', receiverId: 'R', functionalIdentifier: 'FA', transactionType: '997' },
      );
      const result = service.parse997(edi);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('AK1'))).toBe(true);
    });

    it('returns error for missing AK9', () => {
      const edi = builder.wrap(
        ['AK1*QM*42'],
        { senderId: 'P', receiverId: 'R', functionalIdentifier: 'FA', transactionType: '997' },
      );
      const result = service.parse997(edi);
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('AK9'))).toBe(true);
    });
  });

  describe('extractControlInfo', () => {
    it('extracts GS and ST control numbers from EDI content', () => {
      const edi = builder.wrap(['B10*REF*SCAC*PRO'], {
        senderId: 'S', receiverId: 'R',
        functionalIdentifier: 'QM', transactionType: '214',
        controlNumber: '000000055',
      });

      const info = service.extractControlInfo(edi);
      expect(info).not.toBeNull();
      expect(info!.transactionType).toBe('214');
      expect(info!.gsControlNumber).toBe('000000055');
      expect(info!.stControlNumber).toBe('0001');
    });

    it('returns null for content without ST segment', () => {
      const info = service.extractControlInfo('random garbage');
      expect(info).toBeNull();
    });
  });
});
