import { TrackableUnitHandlingSource } from '../../services/fulfilment/TrackableUnitHandlingSource';

describe('TrackableUnitHandlingSource', () => {
  it('reads the unit through its order, so another org cannot see it', async () => {
    const prisma = { trackableUnit: { findFirst: jest.fn().mockResolvedValue(null) } } as any;

    const snapshot = await new TrackableUnitHandlingSource(prisma).getSnapshot('org-a', 'tu-1');

    expect(snapshot).toBeNull();
    expect(prisma.trackableUnit.findFirst.mock.calls[0][0].where).toEqual({ id: 'tu-1', order: { orgId: 'org-a' } });
  });

  it('flattens the unit and its packed lines into the snapshot', async () => {
    const prisma = {
      trackableUnit: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tu-1', orderId: 'order-1', identifier: 'PLT-1', unitType: 'pallet', customTypeName: null, barcode: 'BC-1',
          lineItems: [{ id: 'li-1', sku: 'SKU-1', description: null, quantity: 4, weight: 2.5, hazmat: true, temperature: 'frozen' }],
        }),
      },
    } as any;

    const snapshot = await new TrackableUnitHandlingSource(prisma).getSnapshot('org-a', 'tu-1');

    expect(snapshot).toEqual({
      orgId: 'org-a', sourceType: 'tms_trackable_unit', sourceId: 'tu-1', sourceOrderId: 'order-1',
      identifier: 'PLT-1', unitType: 'pallet', customTypeName: null, barcode: 'BC-1',
      lines: [{ sourceLineId: 'li-1', sku: 'SKU-1', description: null, quantity: 4, weight: 2.5, hazmat: true, temperature: 'frozen' }],
    });
  });

  it('lists an order’s units within the org', async () => {
    const prisma = { trackableUnit: { findMany: jest.fn().mockResolvedValue([{ id: 'tu-1' }, { id: 'tu-2' }]) } } as any;

    const ids = await new TrackableUnitHandlingSource(prisma).listSourceIdsForOrder('org-a', 'order-1');

    expect(ids).toEqual(['tu-1', 'tu-2']);
    expect(prisma.trackableUnit.findMany.mock.calls[0][0].where).toEqual({ orderId: 'order-1', order: { orgId: 'org-a' } });
  });
});
