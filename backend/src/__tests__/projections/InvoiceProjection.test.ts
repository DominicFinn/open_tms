import { InvoiceProjection } from '../../events/projections/InvoiceProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const mockInvoice = {
  id: 'inv-1', invoiceNumber: 'INV-20260412-0001',
  customerId: 'cust-1', status: 'draft',
  totalCents: 150000, paidCents: 0, balanceCents: 150000,
  issueDate: new Date('2026-04-01'), dueDate: new Date('2026-05-01'),
  createdAt: new Date(), updatedAt: new Date(),
};

const mockPrisma = {
  invoice: {
    findUnique: jest.fn().mockResolvedValue(mockInvoice),
  },
  invoiceReadModel: {
    upsert: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
} as any;

describe('InvoiceProjection', () => {
  let projection: InvoiceProjection;

  beforeEach(() => {
    jest.clearAllMocks();
    projection = new InvoiceProjection(mockPrisma);
  });

  describe('handler metadata', () => {
    it('has correct name and subscribes to invoice events', () => {
      expect(projection.name).toBe('projection.invoice');
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_CREATED);
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_PAID);
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_VOIDED);
    });
  });

  describe('onInvoiceCreated', () => {
    it('upserts InvoiceReadModel with denormalized data', async () => {
      const event = createTestEvent(
        EVENT_TYPES.INVOICE_CREATED, 'invoice', 'inv-1',
        {
          invoiceId: 'inv-1',
          invoiceNumber: 'INV-20260412-0001',
          customerId: 'cust-1',
          customerName: 'Acme Corp',
          totalCents: 150000,
          currency: 'USD',
          shipmentCount: 1,
          lineItemCount: 3,
        }
      );

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          create: expect.objectContaining({
            id: 'inv-1',
            invoiceNumber: 'INV-20260412-0001',
            customerName: 'Acme Corp',
            totalCents: 150000,
            shipmentCount: 1,
            lineItemCount: 3,
          }),
        })
      );
    });
  });

  describe('onInvoiceUpdated', () => {
    it('updates status and daysPastDue on payment events', async () => {
      const paidInvoice = { ...mockInvoice, status: 'paid', paidCents: 150000, balanceCents: 0 };
      mockPrisma.invoice.findUnique.mockResolvedValue(paidInvoice);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_PAID, 'invoice', 'inv-1',
        { invoiceId: 'inv-1', invoiceNumber: 'INV-20260412-0001', totalCents: 150000 }
      );

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            status: 'paid',
            paidCents: 150000,
            balanceCents: 0,
            daysPastDue: 0,
          }),
        })
      );
    });

    it('calculates daysPastDue for overdue invoices', async () => {
      const overdueInvoice = {
        ...mockInvoice,
        status: 'overdue',
        dueDate: new Date(Date.now() - 45 * 86400000), // 45 days ago
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(overdueInvoice);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_OVERDUE, 'invoice', 'inv-1',
        { invoiceId: 'inv-1' }
      );

      await projection.handle(event);

      const updateCall = mockPrisma.invoiceReadModel.update.mock.calls[0];
      expect(updateCall[0].data.daysPastDue).toBeGreaterThanOrEqual(44);
      expect(updateCall[0].data.daysPastDue).toBeLessThanOrEqual(46);
    });
  });
});
