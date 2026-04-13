import { EDI850ParseService } from '../../services/EDI850ParseService';

describe('EDI850ParseService', () => {
  const service = new EDI850ParseService();

  // Minimal valid 850 - node-x12 requires proper ISA/GS/ST structure
  const sampleEDI850 = [
    'ISA*00*          *00*          *ZZ*CUSTOMER       *ZZ*OPENTMS        *260410*1200*U*00501*000000001*0*P*>~',
    'GS*PO*CUSTOMER*OPENTMS*20260410*1200*1*X*005010~',
    'ST*850*0001~',
    'BEG*00*NE*PO-2026-001**20260410~',
    'DTM*002*20260415~',
    'DTM*010*20260412~',
    'N1*ST*Destination Store*92*DEST001~',
    'N3*456 Oak Ave~',
    'N4*Detroit*MI*48201*US~',
    'N1*SF*Origin Warehouse*92*ORIG001~',
    'N3*123 Main St~',
    'N4*Chicago*IL*60601*US~',
    'N1*BY*Acme Corp*92*ACME~',
    'PO1*001*10*EA*25.00*PE*VN*SKU-001~',
    'PID*F****Widget Type A~',
    'PO1*002*5*EA*50.00*PE*VN*SKU-002~',
    'PID*F****Widget Type B~',
    'CTT*2~',
    'SE*16*0001~',
    'GE*1*1~',
    'IEA*1*000000001~',
  ].join('\n');

  it('parses a valid 850 document', () => {
    const result = service.parse(sampleEDI850);

    expect(result.success).toBe(true);
    expect(result.transactionType).toBe('850');
    expect(result.transactionCount).toBe(1);
    expect(result.orders).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('extracts order number from BEG segment', () => {
    const result = service.parse(sampleEDI850);
    expect(result.orders[0].orderNumber).toBe('PO-2026-001');
    expect(result.orders[0].poNumber).toBe('PO-2026-001');
  });

  it('extracts delivery and pickup dates from DTM segments', () => {
    const result = service.parse(sampleEDI850);
    const order = result.orders[0];
    expect(order.requestedDeliveryDate).toBeDefined();
    expect(order.requestedPickupDate).toBeDefined();
  });

  it('extracts destination from N1*ST + N3 + N4', () => {
    const result = service.parse(sampleEDI850);
    const dest = result.orders[0].destination;
    expect(dest).toBeDefined();
    expect(dest!.name).toBe('Destination Store');
    expect(dest!.city).toBe('Detroit');
    expect(dest!.state).toBe('MI');
  });

  it('extracts origin from N1*SF + N3 + N4', () => {
    const result = service.parse(sampleEDI850);
    const origin = result.orders[0].origin;
    expect(origin).toBeDefined();
    expect(origin!.name).toBe('Origin Warehouse');
    expect(origin!.city).toBe('Chicago');
  });

  it('extracts buyer name from N1*BY', () => {
    const result = service.parse(sampleEDI850);
    expect(result.orders[0].buyerName).toBe('Acme Corp');
  });

  it('extracts line items from PO1 segments', () => {
    const result = service.parse(sampleEDI850);
    const items = result.orders[0].lineItems;
    expect(items).toHaveLength(2);
    expect(items[0].sku).toBe('SKU-001');
    expect(items[0].quantity).toBe(10);
    expect(items[1].sku).toBe('SKU-002');
    expect(items[1].quantity).toBe(5);
  });

  it('returns error for empty content', () => {
    const result = service.parse('');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for non-850 content', () => {
    const edi214 = [
      'ISA*00*          *00*          *ZZ*CARRIER        *ZZ*OPENTMS        *260410*1200*U*00501*000000001*0*P*>~',
      'GS*QM*CARRIER*OPENTMS*20260410*1200*1*X*005010~',
      'ST*214*0001~',
      'B10*REF*SCAC*PRO~',
      'SE*2*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('\n');
    const result = service.parse(edi214);
    expect(result.orders).toHaveLength(0);
  });

  it('preserves raw segments for audit', () => {
    const result = service.parse(sampleEDI850);
    expect(result.orders[0].rawSegments.length).toBeGreaterThan(0);
  });

  it('accepts custom field mapping overrides', () => {
    const result = service.parse(sampleEDI850, {
      shipToEntityCode: 'ST',
      shipFromEntityCode: 'SF',
    });
    expect(result.success).toBe(true);
    expect(result.orders[0].destination?.name).toBe('Destination Store');
  });
});
