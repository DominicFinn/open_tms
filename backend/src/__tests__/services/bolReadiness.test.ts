import { PrismaClient } from '@prisma/client';
import { evaluateBolReadiness } from '../../services/bolReadiness.js';

/** Build a prisma mock whose shipment.findFirst resolves to `shipment`. */
function mockPrisma(shipment: any): PrismaClient {
  return {
    shipment: { findFirst: jest.fn().mockResolvedValue(shipment) },
  } as unknown as PrismaClient;
}

const completeLine = { description: 'Widgets', quantity: 10, weight: 5 };

describe('evaluateBolReadiness', () => {
  it('returns null when the shipment does not exist', async () => {
    const result = await evaluateBolReadiness(mockPrisma(null), 'org-1', 'missing-id');
    expect(result).toBeNull();
  });

  it('is ready when shipper/consignee are set and every line item is complete', async () => {
    const result = await evaluateBolReadiness(
      mockPrisma({
        id: 's1',
        originId: 'o1',
        destinationId: 'd1',
        orderShipments: [{ order: { lineItems: [completeLine, { ...completeLine, sku: 'x' }] } }],
      }),
      'org-1',
      's1',
    );
    expect(result).toEqual({ ready: true, missing: [], orderCount: 1, lineItemCount: 2 });
  });

  it('flags a missing origin and destination', async () => {
    const result = await evaluateBolReadiness(
      mockPrisma({
        id: 's1',
        originId: null,
        destinationId: null,
        orderShipments: [{ order: { lineItems: [completeLine] } }],
      }),
      'org-1',
      's1',
    );
    expect(result!.ready).toBe(false);
    expect(result!.missing).toEqual(
      expect.arrayContaining([
        'Shipment origin (shipper) is not set',
        'Shipment destination (consignee) is not set',
      ]),
    );
  });

  it('flags a shipment with no attached orders', async () => {
    const result = await evaluateBolReadiness(
      mockPrisma({ id: 's1', originId: 'o1', destinationId: 'd1', orderShipments: [] }),
      'org-1',
      's1',
    );
    expect(result!.ready).toBe(false);
    expect(result!.missing).toContain('No orders are attached to the shipment');
    expect(result!.orderCount).toBe(0);
  });

  it('flags attached orders that have no line items', async () => {
    const result = await evaluateBolReadiness(
      mockPrisma({
        id: 's1',
        originId: 'o1',
        destinationId: 'd1',
        orderShipments: [{ order: { lineItems: [] } }],
      }),
      'org-1',
      's1',
    );
    expect(result!.ready).toBe(false);
    expect(result!.missing).toContain('The attached orders have no line items (no goods to describe)');
  });

  it('counts line items missing a description, quantity, or weight', async () => {
    const result = await evaluateBolReadiness(
      mockPrisma({
        id: 's1',
        originId: 'o1',
        destinationId: 'd1',
        orderShipments: [
          {
            order: {
              lineItems: [
                completeLine,
                { description: '', quantity: 1, weight: 2 }, // no description
                { description: 'A', quantity: 0, weight: 2 }, // no quantity
                { description: 'B', quantity: 1, weight: null }, // no weight
                { description: 'C', quantity: 1, weight: 0 }, // zero weight
              ],
            },
          },
        ],
      }),
      'org-1',
      's1',
    );
    expect(result!.ready).toBe(false);
    expect(result!.missing).toEqual(
      expect.arrayContaining([
        '1 line item(s) missing a goods description',
        '1 line item(s) missing a quantity',
        '2 line item(s) missing a weight',
      ]),
    );
    expect(result!.lineItemCount).toBe(5);
  });
});

describe('evaluateBolReadiness tenancy (#294)', () => {
  it('looks the shipment up by id and orgId, so another tenant\'s shipment reads as missing', async () => {
    const prisma = mockPrisma(null);
    const result = await evaluateBolReadiness(prisma, 'org-a', 'ship-of-org-b');
    expect(result).toBeNull();
    const call = (prisma.shipment.findFirst as jest.Mock).mock.calls[0][0];
    expect(call.where).toEqual({ id: 'ship-of-org-b', orgId: 'org-a' });
  });
});
