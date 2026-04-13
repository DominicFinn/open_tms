import { EdiRouterService } from '../../services/EdiRouterService';
import { X12EnvelopeBuilder } from '../../services/edi/X12EnvelopeBuilder';

describe('EdiRouterService', () => {
  const service = new EdiRouterService();
  const builder = new X12EnvelopeBuilder();

  describe('detectTransactionType', () => {
    it('detects 850 from ST segment', () => {
      const edi = builder.wrap(['BEG*00*NE*PO-001'], {
        senderId: 'S', receiverId: 'R', functionalIdentifier: 'PO', transactionType: '850',
      });
      expect(service.detectTransactionType(edi)).toBe('850');
    });

    it('detects 214 from ST segment', () => {
      const edi = 'ISA*stuff~GS*QM*stuff~ST*214*0001~B10*REF~SE*2*0001~';
      expect(service.detectTransactionType(edi)).toBe('214');
    });

    it('detects 990 from ST segment', () => {
      expect(service.detectTransactionType('ST*990*0001~B1*SCAC~')).toBe('990');
    });

    it('detects 210 from ST segment', () => {
      expect(service.detectTransactionType('ST*210*0001~B3*stuff~')).toBe('210');
    });

    it('detects 820 from ST segment', () => {
      expect(service.detectTransactionType('ST*820*0001~BPR*stuff~')).toBe('820');
    });

    it('detects 997 from ST segment', () => {
      expect(service.detectTransactionType('ST*997*0001~AK1*QM~')).toBe('997');
    });

    it('falls back to GS functional identifier when no ST found', () => {
      expect(service.detectTransactionType('ISA*stuff~GS*PO*stuff~')).toBe('850');
      expect(service.detectTransactionType('GS*SM*stuff~')).toBe('204');
      expect(service.detectTransactionType('GS*IM*stuff~')).toBe('210');
      expect(service.detectTransactionType('GS*FA*stuff~')).toBe('997');
    });

    it('returns null for unrecognized content', () => {
      expect(service.detectTransactionType('random garbage')).toBeNull();
      expect(service.detectTransactionType('')).toBeNull();
    });
  });

  describe('getRouteForTransaction', () => {
    it('returns route for 850', () => {
      const route = service.getRouteForTransaction('850');
      expect(route).not.toBeNull();
      expect(route!.transactionType).toBe('850');
      expect(route!.endpoint).toBe('/api/v1/orders/import/edi');
    });

    it('returns route for 214', () => {
      const route = service.getRouteForTransaction('214');
      expect(route!.endpoint).toBe('/api/v1/edi/214/inbound');
    });

    it('returns route for 997', () => {
      const route = service.getRouteForTransaction('997');
      expect(route!.endpoint).toBe('/api/v1/edi/997/inbound');
    });

    it('returns route for 210', () => {
      const route = service.getRouteForTransaction('210');
      expect(route!.endpoint).toBe('/api/v1/edi/210/inbound');
    });

    it('returns route for 820', () => {
      const route = service.getRouteForTransaction('820');
      expect(route!.endpoint).toBe('/api/v1/edi/820/inbound');
    });

    it('returns null for unsupported type', () => {
      expect(service.getRouteForTransaction('999')).toBeNull();
      expect(service.getRouteForTransaction('856')).toBeNull(); // 856 is outbound only
    });
  });

  describe('getSupportedTransactionTypes', () => {
    it('returns all supported inbound types', () => {
      const types = service.getSupportedTransactionTypes();
      expect(types.length).toBeGreaterThanOrEqual(6);

      const codes = types.map((t: any) => t.transactionType);
      expect(codes).toContain('850');
      expect(codes).toContain('990');
      expect(codes).toContain('997');
      expect(codes).toContain('214');
      expect(codes).toContain('210');
      expect(codes).toContain('820');
    });
  });
});
