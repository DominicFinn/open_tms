import { parseCSV, computeHeaderChecksum, applyMapping } from '../../services/ManifestIngestionService';

describe('ManifestIngestionService', () => {

  describe('parseCSV', () => {
    it('parses standard CSV with headers and rows', () => {
      const csv = `SKU,Quantity,Description,Lot
SKU-001,50,Widget A,LOT-001
SKU-002,30,Widget B,LOT-002
SKU-003,10,Widget C,`;

      const result = parseCSV(csv);

      expect(result.headers).toEqual(['SKU', 'Quantity', 'Description', 'Lot']);
      expect(result.totalRows).toBe(3);
      expect(result.rows[0]).toEqual({ SKU: 'SKU-001', Quantity: '50', Description: 'Widget A', Lot: 'LOT-001' });
      expect(result.rows[2].Lot).toBe('');
    });

    it('handles quoted values', () => {
      const csv = `"Product Code","Qty","Notes"
"SKU-001","25","Contains, comma"`;

      const result = parseCSV(csv);

      expect(result.headers).toEqual(['Product Code', 'Qty', 'Notes']);
      expect(result.rows[0]['Product Code']).toBe('SKU-001');
    });

    it('handles tab-delimited', () => {
      const csv = `SKU\tQty\tLot
SKU-001\t50\tL1`;

      const result = parseCSV(csv, '\t');

      expect(result.headers).toEqual(['SKU', 'Qty', 'Lot']);
      expect(result.rows[0].Qty).toBe('50');
    });

    it('returns empty for empty input', () => {
      const result = parseCSV('');
      expect(result.headers).toEqual([]);
      expect(result.totalRows).toBe(0);
    });

    it('handles Windows line endings', () => {
      const csv = "SKU,Qty\r\nSKU-001,10\r\nSKU-002,20\r\n";
      const result = parseCSV(csv);
      expect(result.totalRows).toBe(2);
    });
  });

  describe('computeHeaderChecksum', () => {
    it('produces consistent checksums regardless of order', () => {
      const cs1 = computeHeaderChecksum(['SKU', 'Quantity', 'Lot']);
      const cs2 = computeHeaderChecksum(['Lot', 'SKU', 'Quantity']);
      expect(cs1).toBe(cs2);
    });

    it('is case-insensitive', () => {
      const cs1 = computeHeaderChecksum(['SKU', 'Quantity']);
      const cs2 = computeHeaderChecksum(['sku', 'quantity']);
      expect(cs1).toBe(cs2);
    });

    it('trims whitespace', () => {
      const cs1 = computeHeaderChecksum(['SKU', 'Quantity']);
      const cs2 = computeHeaderChecksum([' SKU ', ' Quantity ']);
      expect(cs1).toBe(cs2);
    });

    it('produces different checksums for different headers', () => {
      const cs1 = computeHeaderChecksum(['SKU', 'Quantity']);
      const cs2 = computeHeaderChecksum(['Product', 'Qty', 'Lot']);
      expect(cs1).not.toBe(cs2);
    });
  });

  describe('applyMapping', () => {
    it('maps columns to receiving lines', () => {
      const rows = [
        { 'Product Code': 'SKU-001', 'Qty': '50', 'Batch': 'LOT-A' },
        { 'Product Code': 'SKU-002', 'Qty': '30', 'Batch': '' },
      ];
      const mapping = { sku: 'Product Code', quantity: 'Qty', lotNumber: 'Batch' };

      const result = applyMapping(rows, mapping);

      expect(result.processedRows).toBe(2);
      expect(result.errorRows).toBe(0);
      expect(result.lines[0]).toEqual({
        sku: 'SKU-001', expectedQuantity: 50, uomCode: 'EA', lotNumber: 'LOT-A', expiryDate: null,
      });
      expect(result.lines[1].lotNumber).toBeNull(); // empty string -> null
    });

    it('reports errors for missing SKU', () => {
      const rows = [
        { 'Product': '', 'Qty': '50' },
        { 'Product': 'SKU-001', 'Qty': '10' },
      ];
      const mapping = { sku: 'Product', quantity: 'Qty' };

      const result = applyMapping(rows, mapping);

      expect(result.processedRows).toBe(1);
      expect(result.errorRows).toBe(1);
      expect(result.errors[0].field).toBe('sku');
    });

    it('reports errors for invalid quantity', () => {
      const rows = [
        { 'SKU': 'A', 'Qty': 'abc' },
        { 'SKU': 'B', 'Qty': '0' },
        { 'SKU': 'C', 'Qty': '5' },
      ];
      const mapping = { sku: 'SKU', quantity: 'Qty' };

      const result = applyMapping(rows, mapping);

      expect(result.processedRows).toBe(1);
      expect(result.errorRows).toBe(2);
    });

    it('handles unmapped optional fields gracefully', () => {
      const rows = [{ 'SKU': 'A', 'Qty': '10' }];
      const mapping = { sku: 'SKU', quantity: 'Qty' };

      const result = applyMapping(rows, mapping);

      expect(result.lines[0].lotNumber).toBeNull();
      expect(result.lines[0].expiryDate).toBeNull();
      expect(result.lines[0].uomCode).toBe('EA');
    });
  });
});
