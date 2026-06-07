import { InvoicingService } from '../../services/InvoicingService';

const customer = {
  id: 'cust-1',
  name: 'Acme',
  paymentTermsDays: 30,
  currency: 'USD',
};

function buildCharge(overrides: any = {}) {
  return {
    id: overrides.id ?? `chg-${Math.random()}`,
    shipmentId: overrides.shipmentId ?? null,
    orderId: overrides.orderId ?? null,
    chargeType: 'linehaul',
    description: 'linehaul',
    amountCents: overrides.amountCents ?? 10000,
    currency: 'USD',
    freightClass: null,
    status: 'approved',
    chargeCategory: 'revenue',
    ...overrides,
  };
}

describe('InvoicingService — batching', () => {
  describe('generateFromShipments', () => {
    it('fetches charges in a single batch query for all shipments', async () => {
      const charges = [
        buildCharge({ id: 'c1', shipmentId: 's1', amountCents: 10000 }),
        buildCharge({ id: 'c2', shipmentId: 's2', amountCents: 5000 }),
        buildCharge({ id: 'c3', shipmentId: 's3', amountCents: 7500 }),
      ];

      const chargeRepo: any = {
        findAll: jest.fn().mockResolvedValue(charges),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        update: jest.fn(),
      };
      const invoiceRepo: any = {
        getNextInvoiceNumber: jest.fn().mockResolvedValue('INV-001'),
        create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
        addLineItems: jest.fn(),
        findById: jest.fn().mockResolvedValue({ id: 'inv-1', lineItems: [] }),
      };
      const prisma: any = {
        customer: { findUnique: jest.fn().mockResolvedValue(customer) },
        shipmentFinancialSummary: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      };

      const svc = new InvoicingService(invoiceRepo, chargeRepo, prisma);
      await svc.generateFromShipments({
        orgId: 'org-1',
        customerId: 'cust-1',
        shipmentIds: ['s1', 's2', 's3'],
      });

      // Critical: one batched findAll call, not three (one per shipment)
      expect(chargeRepo.findAll).toHaveBeenCalledTimes(1);
      expect(chargeRepo.findAll).toHaveBeenCalledWith({
        shipmentIds: ['s1', 's2', 's3'],
        chargeCategory: 'revenue',
        status: 'approved',
      });

      // updateMany batches the status flip rather than calling update() per charge
      expect(chargeRepo.update).not.toHaveBeenCalled();
      expect(chargeRepo.updateMany).toHaveBeenCalledWith(['c1', 'c2', 'c3'], { status: 'invoiced' });

      // ShipmentFinancialSummary update is also batched via `in:`
      expect(prisma.shipmentFinancialSummary.updateMany).toHaveBeenCalledTimes(1);
      const where = prisma.shipmentFinancialSummary.updateMany.mock.calls[0][0].where;
      expect(where.shipmentId.in).toEqual(['s1', 's2', 's3']);
    });

    it('throws if no approved revenue charges exist', async () => {
      const chargeRepo: any = {
        findAll: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        update: jest.fn(),
      };
      const invoiceRepo: any = {};
      const prisma: any = {
        customer: { findUnique: jest.fn().mockResolvedValue(customer) },
      };

      const svc = new InvoicingService(invoiceRepo, chargeRepo, prisma);
      await expect(
        svc.generateFromShipments({ orgId: 'org-1', customerId: 'cust-1', shipmentIds: ['s1'] })
      ).rejects.toThrow(/No approved revenue charges/);
    });
  });

  describe('findReadyToInvoice', () => {
    it('uses one batch charge query for all candidate shipments', async () => {
      const summaries = [
        { shipmentId: 's1' },
        { shipmentId: 's2' },
        { shipmentId: 's3' },
      ];
      const shipments = [
        { id: 's1', reference: 'SH-1', customerId: 'cust-1', deliveryDate: null, customer: { name: 'Acme' } },
        { id: 's2', reference: 'SH-2', customerId: 'cust-1', deliveryDate: null, customer: { name: 'Acme' } },
        { id: 's3', reference: 'SH-3', customerId: 'cust-1', deliveryDate: null, customer: { name: 'Acme' } },
      ];
      const charges = [
        buildCharge({ id: 'c1', shipmentId: 's1', amountCents: 100 }),
        buildCharge({ id: 'c2', shipmentId: 's1', amountCents: 50 }),
        buildCharge({ id: 'c3', shipmentId: 's2', amountCents: 200 }),
        // s3 has no charges
      ];

      const chargeRepo: any = {
        findAll: jest.fn().mockResolvedValue(charges),
      };
      const invoiceRepo: any = {};
      const prisma: any = {
        shipmentFinancialSummary: { findMany: jest.fn().mockResolvedValue(summaries) },
        shipment: { findMany: jest.fn().mockResolvedValue(shipments) },
      };

      const svc = new InvoicingService(invoiceRepo, chargeRepo, prisma);
      const result = await svc.findReadyToInvoice('org-1');

      expect(chargeRepo.findAll).toHaveBeenCalledTimes(1);
      expect(chargeRepo.findAll).toHaveBeenCalledWith({
        shipmentIds: ['s1', 's2', 's3'],
        chargeCategory: 'revenue',
        status: 'approved',
      });

      // s1 -> 150, s2 -> 200, s3 -> excluded (no charges)
      expect(result).toHaveLength(2);
      const s1 = result.find((r) => r.shipmentId === 's1')!;
      expect(s1.totalRevenueCents).toBe(150);
      expect(s1.chargeCount).toBe(2);
      const s2 = result.find((r) => r.shipmentId === 's2')!;
      expect(s2.totalRevenueCents).toBe(200);
      expect(result.find((r) => r.shipmentId === 's3')).toBeUndefined();
    });

    it('returns empty array when nothing is ready to invoice', async () => {
      const chargeRepo: any = { findAll: jest.fn() };
      const invoiceRepo: any = {};
      const prisma: any = {
        shipmentFinancialSummary: { findMany: jest.fn().mockResolvedValue([]) },
        shipment: { findMany: jest.fn() },
      };

      const svc = new InvoicingService(invoiceRepo, chargeRepo, prisma);
      const result = await svc.findReadyToInvoice('org-1');

      expect(result).toEqual([]);
      expect(prisma.shipment.findMany).not.toHaveBeenCalled();
      expect(chargeRepo.findAll).not.toHaveBeenCalled();
    });
  });
});
