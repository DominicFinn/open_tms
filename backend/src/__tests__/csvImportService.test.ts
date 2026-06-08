import { CSVImportService, CSV_COLUMNS } from '../services/CSVImportService';
import { ModeRulesService } from '../services/orderLineItem/ModeRulesService';
import { CREATE_ORDER } from '../commands/orders/CreateOrderCommand';

function makeService(overrides: {
  customers?: any[];
  locations?: any[];
  packagingTypes?: any[];
  dispatch?: jest.Mock;
} = {}) {
  const customers = overrides.customers ?? [{ id: 'cust-1', name: 'Acme Corp', orgId: 'org-1' }];
  const locations = overrides.locations ?? [];
  const packagingTypes = overrides.packagingTypes ?? [
    { id: 'pt-eur1', code: 'EUR1', kind: 'pallet' },
    { id: 'pt-carton-m', code: 'CARTON_M', kind: 'carton' },
  ];
  const dispatch = overrides.dispatch ?? jest.fn().mockImplementation(async ({ payload }: any) => ({
    success: true,
    data: { id: `order-${payload.orderData.orderNumber}`, orderNumber: payload.orderData.orderNumber },
    events: [],
  }));

  const prisma = {
    packagingType: { findMany: jest.fn().mockResolvedValue(packagingTypes) },
  } as any;
  const customersRepo = { all: jest.fn().mockResolvedValue(customers) } as any;
  const locationsRepo = { all: jest.fn().mockResolvedValue(locations) } as any;
  const commandBus = { dispatch } as any;
  const modeRules = new ModeRulesService();
  const svc = new CSVImportService(prisma, customersRepo, locationsRepo, commandBus, modeRules);

  return { svc, dispatch, prisma, customersRepo, locationsRepo };
}

describe('CSVImportService.parseCSV', () => {
  const { svc } = makeService();

  it('parses a header row + a single data row, returning row numbers', () => {
    const csv = 'orderNumber,sku,quantity\nORD-001,SKU-A,10';
    const rows = svc.parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[0].cells.orderNumber).toBe('ORD-001');
    expect(rows[0].cells.sku).toBe('SKU-A');
    expect(rows[0].cells.quantity).toBe('10');
  });

  it('tolerates case-insensitive header names and common aliases', () => {
    const csv = [
      'Order Number,Customer Name,Service Level,SKU,Qty,UoM,Weight',
      'ORD-A,Acme Corp,FTL,SKU-1,5,pieces,10',
    ].join('\n');
    const rows = svc.parseCSV(csv);
    expect(rows[0].cells.orderNumber).toBe('ORD-A');
    expect(rows[0].cells.customerName).toBe('Acme Corp');
    expect(rows[0].cells.serviceLevel).toBe('FTL');
    expect(rows[0].cells.quantity).toBe('5');
    expect(rows[0].cells.unitOfMeasure).toBe('pieces');
  });

  it('preserves source row numbers across blank lines', () => {
    const csv = ['orderNumber,sku,quantity', '', 'ORD-A,SKU-1,1', '', 'ORD-A,SKU-2,1'].join('\n');
    const rows = svc.parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].rowNumber).toBe(3);
    expect(rows[1].rowNumber).toBe(5);
  });

  it('respects quoted commas inside fields', () => {
    const csv = 'orderNumber,sku,description,quantity\nORD-A,SKU-1,"Heavy, oversized box",2';
    const rows = svc.parseCSV(csv);
    expect(rows[0].cells.description).toBe('Heavy, oversized box');
  });

  it('throws when no recognised headers are present', () => {
    expect(() => svc.parseCSV('foo,bar,baz\nx,y,z')).toThrow(/recognised column headers/);
  });

  it('throws on empty input', () => {
    expect(() => svc.parseCSV('')).toThrow(/empty/i);
  });
});

describe('CSVImportService.buildTemplate', () => {
  it('emits a CSV with every canonical column', () => {
    const { svc } = makeService();
    const template = svc.buildTemplate();
    const header = template.trim().split(',');
    expect(header).toEqual([...CSV_COLUMNS]);
  });

  it('includes the Phase 1 logistics columns', () => {
    const { svc } = makeService();
    const header = svc.buildTemplate().trim().split(',');
    for (const c of ['unitOfMeasure', 'freightClass', 'nmfcCode', 'unNumber', 'hazmatClass', 'packingGroup', 'properShippingName', 'hsCode', 'countryOfOrigin', 'tempMinC', 'tempMaxC']) {
      expect(header).toContain(c);
    }
  });

  it('includes the Phase 1 packing-summary + Phase 2 handling-unit columns', () => {
    const { svc } = makeService();
    const header = svc.buildTemplate().trim().split(',');
    for (const c of ['packagingTypeCode', 'packingUnitCount', 'packingStackable', 'unitId', 'unitPackagingTypeCode', 'unitWeight', 'unitLength', 'unitStackable']) {
      expect(header).toContain(c);
    }
  });
});

describe('CSVImportService.importOrders', () => {
  it('dispatches one CREATE_ORDER per order in the CSV', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      'ORD-1,Acme Corp,FTL,SKU-A,Widget,3,pieces,10',
      'ORD-2,Acme Corp,FTL,SKU-B,Gadget,1,pieces,20',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });

    expect(result.success).toBe(true);
    expect(result.ordersCreated).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0].type).toBe(CREATE_ORDER);
    expect(dispatch.mock.calls[0][0].orgId).toBe('org-1');
  });

  it('rejects an entire order when any line fails mode-rules validation, with row-level errors', async () => {
    const { svc, dispatch } = makeService();
    // ORD-1: FTL + hazmat → each line must carry UN/class/PG/PSN. Line 3 is missing them so the whole order is rejected.
    // ORD-2: a simple FTL order with no hazmat — should succeed and pass through to dispatch.
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight,length,width,height,itemHazmat,unNumber,hazmatClass,packingGroup,properShippingName,freightClass',
      'ORD-1,Acme Corp,FTL,SKU-A,Flammable,1,pieces,10,10,10,10,true,UN1203,3,II,Gasoline,85',
      'ORD-1,Acme Corp,FTL,SKU-B,Flammable,1,pieces,10,10,10,10,true,,,,,',
      'ORD-2,Acme Corp,FTL,SKU-C,Widget,1,pieces,5,,,,,,,,,',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });

    expect(result.success).toBe(false);
    expect(result.ordersCreated).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
    expect(result.errors[0].orderNumber).toBe('ORD-1');
    expect(result.errors[0].message).toMatch(/missing required fields/i);

    // ORD-2 went through.
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload.orderData.orderNumber).toBe('ORD-2');
  });

  it('forces customerId to options.forceCustomerId (customer portal flow)', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      'ORD-1,FTL,SKU-A,Widget,1,pieces,10',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1', forceCustomerId: 'cust-portal-X' });

    expect(result.success).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload.orderData.customerId).toBe('cust-portal-X');
  });

  it('rejects rows where customerId in the CSV does not match the forced customer', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerId,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      'ORD-1,cust-other,FTL,SKU-A,Widget,1,pieces,10',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1', forceCustomerId: 'cust-portal-X' });

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toMatch(/does not match the authenticated customer/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('resolves customerName to customerId via the customers repo', async () => {
    const { svc, dispatch } = makeService({
      customers: [{ id: 'cust-99', name: 'Globex' }],
    });
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      'ORD-1,Globex,FTL,SKU-A,Widget,1,pieces,10',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });

    expect(result.success).toBe(true);
    expect(dispatch.mock.calls[0][0].payload.orderData.customerId).toBe('cust-99');
  });

  it('reports an unknown customer name as a row-level error and skips dispatch', async () => {
    const { svc, dispatch } = makeService({ customers: [] });
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      'ORD-1,NoSuchCustomer,FTL,SKU-A,Widget,1,pieces,10',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toMatch(/Customer "NoSuchCustomer" not found/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('groups rows with the same unitId into a single trackable unit', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight,unitId,unitType',
      'ORD-1,Acme Corp,FTL,SKU-A,Widget,1,pieces,10,UNIT-1,pallet',
      'ORD-1,Acme Corp,FTL,SKU-B,Sprocket,1,pieces,10,UNIT-1,pallet',
      'ORD-1,Acme Corp,FTL,SKU-C,Gizmo,1,pieces,10,UNIT-2,pallet',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });

    expect(result.success).toBe(true);
    const units = dispatch.mock.calls[0][0].payload.orderData.trackableUnits;
    expect(units).toHaveLength(2);
    expect(units[0].identifier).toBe('UNIT-1');
    expect(units[0].lineItems).toHaveLength(2);
    expect(units[1].identifier).toBe('UNIT-2');
    expect(units[1].lineItems).toHaveLength(1);
  });

  it('falls back to flat lineItems when no unitId is present (previously dropped LEGACY rows)', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      'ORD-1,Acme Corp,FTL,SKU-A,Widget,2,pieces,10',
    ].join('\n');

    await svc.importOrders(csv, { orgId: 'org-1' });

    const payload = dispatch.mock.calls[0][0].payload.orderData;
    expect(payload.trackableUnits).toBeUndefined();
    expect(payload.lineItems).toHaveLength(1);
    expect(payload.lineItems[0].sku).toBe('SKU-A');
    expect(payload.lineItems[0].unitOfMeasure).toBe('pieces');
  });

  it('resolves packagingTypeCode to packagingTypeId for the packing summary', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight,packagingTypeCode,packingUnitCount,packingStackable',
      'ORD-1,Acme Corp,FTL,SKU-A,Widget,1,pieces,10,EUR1,6,true',
    ].join('\n');

    await svc.importOrders(csv, { orgId: 'org-1' });

    const summary = dispatch.mock.calls[0][0].payload.orderData.packingSummary;
    expect(summary).toEqual({ packagingTypeId: 'pt-eur1', unitCount: 6, stackable: true, notes: undefined });
  });

  it('rejects an unknown packagingTypeCode with a row-level error', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight,packagingTypeCode,packingUnitCount',
      'ORD-1,Acme Corp,FTL,SKU-A,Widget,1,pieces,10,UNKNOWN_CODE,3',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });

    expect(result.success).toBe(false);
    expect(result.errors[0].message).toMatch(/Unknown packagingTypeCode "UNKNOWN_CODE"/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('passes Phase 1 line-level fields (hazmat detail, customs, temp range) through to CREATE_ORDER', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight,length,width,height,itemHazmat,unNumber,hazmatClass,packingGroup,properShippingName,hsCode,countryOfOrigin,tempMinC,tempMaxC,freightClass',
      'ORD-1,Acme Corp,FTL,SKU-A,Flammable,1,pieces,10,10,10,10,yes,UN1203,3,II,Gasoline,2710.12,US,-10,30,85',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });
    expect(result.success).toBe(true);

    const line = dispatch.mock.calls[0][0].payload.orderData.lineItems[0];
    expect(line).toEqual(expect.objectContaining({
      sku: 'SKU-A', quantity: 1, unitOfMeasure: 'pieces', weight: 10,
      hazmat: true, unNumber: 'UN1203', hazmatClass: '3', packingGroup: 'II', properShippingName: 'Gasoline',
      hsCode: '2710.12', countryOfOrigin: 'US', tempMinC: -10, tempMaxC: 30, freightClass: '85',
    }));
  });

  it('reports rows missing orderNumber as row-level errors', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      ',Acme Corp,FTL,SKU-A,Widget,1,pieces,10',
      'ORD-A,Acme Corp,FTL,SKU-B,Gadget,1,pieces,10',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].message).toMatch(/Missing orderNumber/);
    expect(result.ordersCreated).toBe(1);
  });

  it('captures CREATE_ORDER dispatch failures and reports per order', async () => {
    const dispatch = jest.fn().mockResolvedValueOnce({ success: false, error: 'orderNumber already exists', events: [] });
    const { svc } = makeService({ dispatch });
    const csv = [
      'orderNumber,customerName,serviceLevel,sku,description,quantity,unitOfMeasure,weight',
      'ORD-DUP,Acme Corp,FTL,SKU-A,Widget,1,pieces,10',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toBe('orderNumber already exists');
    expect(result.errors[0].orderNumber).toBe('ORD-DUP');
    expect(result.ordersCreated).toBe(0);
  });

  it('marks the order as international when origin and destination countries differ (forces HS/CoO)', async () => {
    const { svc, dispatch } = makeService();
    const csv = [
      'orderNumber,customerName,serviceLevel,originCity,originCountry,destinationCity,destinationCountry,sku,description,quantity,unitOfMeasure,weight',
      'ORD-XB,Acme Corp,FTL,Chicago,US,Toronto,CA,SKU-A,Widget,1,pieces,10',
    ].join('\n');

    const result = await svc.importOrders(csv, { orgId: 'org-1' });
    // HS code + country of origin are now required on the line but missing → rejection.
    expect(result.success).toBe(false);
    expect(result.errors[0].message).toMatch(/hsCode/);
    expect(result.errors[0].message).toMatch(/countryOfOrigin/);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
