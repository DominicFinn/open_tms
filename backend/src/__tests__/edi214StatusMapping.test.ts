import { mapEdi214Status, getDefaultStatusMapping, EDI214_STATUS_MAP } from '../services/edi214StatusMapping.js';

describe('edi214StatusMapping', () => {
  describe('mapEdi214Status', () => {
    it('should map AF (picked up) to in_transit', () => {
      const result = mapEdi214Status('AF');
      expect(result).not.toBeNull();
      expect(result!.shipmentStatus).toBe('in_transit');
      expect(result!.isException).toBe(false);
    });

    it('should map D1 (delivered) to delivered with complete stop action', () => {
      const result = mapEdi214Status('D1');
      expect(result).not.toBeNull();
      expect(result!.shipmentStatus).toBe('delivered');
      expect(result!.stopAction).toBe('complete');
      expect(result!.stopStatus).toBe('completed');
      expect(result!.isException).toBe(false);
    });

    it('should map X1 (arrived at facility) with arrive stop action', () => {
      const result = mapEdi214Status('X1');
      expect(result).not.toBeNull();
      expect(result!.shipmentStatus).toBe('in_transit');
      expect(result!.stopAction).toBe('arrive');
      expect(result!.stopStatus).toBe('arrived');
    });

    it('should map X3 (arrived at destination) with arrive stop action', () => {
      const result = mapEdi214Status('X3');
      expect(result).not.toBeNull();
      expect(result!.stopAction).toBe('arrive');
    });

    it('should map X2 (departed facility) with depart stop action', () => {
      const result = mapEdi214Status('X2');
      expect(result).not.toBeNull();
      expect(result!.stopAction).toBe('depart');
      expect(result!.stopStatus).toBe('completed');
    });

    it('should map A7 (refused) as exception', () => {
      const result = mapEdi214Status('A7');
      expect(result).not.toBeNull();
      expect(result!.shipmentStatus).toBe('exception');
      expect(result!.isException).toBe(true);
      expect(result!.exceptionType).toBe('refused');
    });

    it('should map A9 (damaged) as exception', () => {
      const result = mapEdi214Status('A9');
      expect(result).not.toBeNull();
      expect(result!.isException).toBe(true);
      expect(result!.exceptionType).toBe('damage');
    });

    it('should map AH (attempted delivery) as exception', () => {
      const result = mapEdi214Status('AH');
      expect(result).not.toBeNull();
      expect(result!.isException).toBe(true);
      expect(result!.exceptionType).toBe('delay');
    });

    it('should map AM (carrier delay) as exception', () => {
      const result = mapEdi214Status('AM');
      expect(result).not.toBeNull();
      expect(result!.isException).toBe(true);
      expect(result!.exceptionType).toBe('delay');
    });

    it('should return null for unknown status codes', () => {
      expect(mapEdi214Status('ZZ')).toBeNull();
      expect(mapEdi214Status('XX')).toBeNull();
      expect(mapEdi214Status('')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(mapEdi214Status('af')).not.toBeNull();
      expect(mapEdi214Status('d1')).not.toBeNull();
      expect(mapEdi214Status('a7')).not.toBeNull();
    });

    it('should have eventDescription for every mapped code', () => {
      for (const [code, mapping] of Object.entries(EDI214_STATUS_MAP)) {
        expect(mapping.eventDescription).toBeTruthy();
        expect(mapping.eventDescription.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getDefaultStatusMapping', () => {
    it('should return in_transit status for unknown codes', () => {
      const result = getDefaultStatusMapping('ZZ');
      expect(result.shipmentStatus).toBe('in_transit');
      expect(result.isException).toBe(false);
      expect(result.stopAction).toBeNull();
    });

    it('should include the status code in the description', () => {
      const result = getDefaultStatusMapping('XX');
      expect(result.eventDescription).toContain('XX');
    });
  });
});
