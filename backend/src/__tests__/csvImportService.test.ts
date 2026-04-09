import { CSVImportService } from '../services/CSVImportService';

// Create a minimal instance for testing parseCSV (doesn't need real repos)
const service = new CSVImportService(null as any, null as any, null as any, null as any);

describe('CSVImportService', () => {
  describe('parseCSV', () => {
    it('parses a simple CSV with order and line items', () => {
      const csv = [
        'Order Number,Customer Name,SKU,Quantity,Service Level',
        'ORD-001,Acme Corp,SKU-A,10,FTL',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders).toHaveLength(1);
      expect(orders[0].orderNumber).toBe('ORD-001');
      expect(orders[0].customerName).toBe('Acme Corp');
      expect(orders[0].serviceLevel).toBe('FTL');
    });

    it('groups multiple rows into one order by order number', () => {
      const csv = [
        'Order Number,SKU,Quantity,Unit ID,Unit Type',
        'ORD-002,SKU-A,5,UNIT-1,PALLET',
        'ORD-002,SKU-B,3,UNIT-1,PALLET',
        'ORD-002,SKU-C,2,UNIT-2,BOX',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders).toHaveLength(1);
      expect(orders[0].trackableUnits).toHaveLength(2);
      expect(orders[0].trackableUnits[0].identifier).toBe('UNIT-1');
      expect(orders[0].trackableUnits[0].lineItems).toHaveLength(2);
      expect(orders[0].trackableUnits[1].identifier).toBe('UNIT-2');
    });

    it('handles multiple orders in one CSV', () => {
      const csv = [
        'Order Number,SKU,Quantity',
        'ORD-A,SKU-1,1',
        'ORD-B,SKU-2,2',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders).toHaveLength(2);
    });

    it('normalizes service levels', () => {
      const csv = [
        'Order Number,SKU,Quantity,Service Level',
        'ORD-1,A,1,FTL',
        'ORD-2,A,1,Full Truck Load',
        'ORD-3,A,1,LTL',
        'ORD-4,A,1,',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders[0].serviceLevel).toBe('FTL');
      expect(orders[1].serviceLevel).toBe('FTL');
      expect(orders[2].serviceLevel).toBe('LTL');
      expect(orders[3].serviceLevel).toBe('LTL'); // default
    });

    it('normalizes temperature control values', () => {
      const csv = [
        'Order Number,SKU,Quantity,Temperature Control',
        'ORD-1,A,1,refrigerated',
        'ORD-2,A,1,chilled',
        'ORD-3,A,1,frozen',
        'ORD-4,A,1,',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders[0].temperatureControl).toBe('refrigerated');
      expect(orders[1].temperatureControl).toBe('refrigerated');
      expect(orders[2].temperatureControl).toBe('frozen');
      expect(orders[3].temperatureControl).toBe('ambient'); // default
    });

    it('parses hazmat boolean values', () => {
      const csv = [
        'Order Number,SKU,Quantity,Requires Hazmat',
        'ORD-1,A,1,yes',
        'ORD-2,A,1,true',
        'ORD-3,A,1,1',
        'ORD-4,A,1,no',
        'ORD-5,A,1,',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders[0].requiresHazmat).toBe(true);
      expect(orders[1].requiresHazmat).toBe(true);
      expect(orders[2].requiresHazmat).toBe(true);
      expect(orders[3].requiresHazmat).toBe(false);
      expect(orders[4].requiresHazmat).toBe(false);
    });

    it('parses origin and destination address data', () => {
      const csv = [
        'Order Number,SKU,Quantity,Origin Name,Origin City,Origin Country,Destination Name,Destination City',
        'ORD-1,A,1,Dallas Warehouse,Dallas,US,NYC Office,New York',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders[0].originData).toBeDefined();
      expect(orders[0].originData.name).toBe('Dallas Warehouse');
      expect(orders[0].originData.city).toBe('Dallas');
      expect(orders[0].destinationData).toBeDefined();
      expect(orders[0].destinationData.name).toBe('NYC Office');
    });

    it('handles quoted CSV fields with commas', () => {
      const csv = [
        'Order Number,SKU,Description,Quantity',
        'ORD-1,A,"Widget, large size",10',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders).toHaveLength(1);
    });

    it('throws on empty CSV', () => {
      expect(() => service.parseCSV('')).toThrow('CSV file is empty or has no data rows');
    });

    it('throws on header-only CSV', () => {
      expect(() => service.parseCSV('Order Number,SKU')).toThrow('CSV file is empty or has no data rows');
    });

    it('skips empty rows', () => {
      const csv = [
        'Order Number,SKU,Quantity',
        'ORD-1,A,1',
        '',
        '   ',
        'ORD-2,B,2',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders).toHaveLength(2);
    });

    it('is case-insensitive for header matching', () => {
      const csv = [
        'ORDER NUMBER,sku,Quantity',
        'ORD-1,ITEM-A,5',
      ].join('\n');

      const orders = service.parseCSV(csv);
      expect(orders[0].orderNumber).toBe('ORD-1');
    });
  });
});
