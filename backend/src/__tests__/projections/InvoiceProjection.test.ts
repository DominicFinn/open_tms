import { InvoiceProjection } from '../../events/projections/InvoiceProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const now = new Date();
const futureDueDate = new Date(Date.now() + 30 * 86400000); // 30 days from now

const mockInvoice = {
  id: 'inv-1',
  orgId: 'test-org',
  invoiceNumber: 'INV-20260412-0001',
  customerId: 'cust-1',
  status: 'draft',
  totalCents: 150000,
  paidCents: 0,
  balanceCents: 150000,
  currency: 'USD',
  issueDate: new Date('2026-04-01'),
  dueDate: futureDueDate,
  createdAt: now,
  updatedAt: now,
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
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_APPROVED);
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_SENT);
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_PAYMENT_RECEIVED);
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_PAID);
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_OVERDUE);
      expect(projection.eventPatterns).toContain(EVENT_TYPES.INVOICE_VOIDED);
    });
  });

  describe('handleCreated', () => {
    it('creates InvoiceReadModel with denormalized data', async () => {
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

      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv-1' } })
      );
      expect(mockPrisma.invoiceReadModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          create: expect.objectContaining({
            id: 'inv-1',
            orgId: 'test-org',
            invoiceNumber: 'INV-20260412-0001',
            customerId: 'cust-1',
            customerName: 'Acme Corp',
            status: 'draft',
            totalCents: 150000,
            paidCents: 0,
            balanceCents: 150000,
            currency: 'USD',
            daysPastDue: 0,
            shipmentCount: 1,
            lineItemCount: 3,
            issueDate: mockInvoice.issueDate,
            dueDate: mockInvoice.dueDate,
          }),
          update: expect.objectContaining({
            status: 'draft',
            totalCents: 150000,
            balanceCents: 150000,
          }),
        })
      );
    });

    it('skips gracefully when invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(null);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_CREATED, 'invoice', 'nonexistent',
        {
          invoiceId: 'nonexistent',
          invoiceNumber: 'INV-9999',
          customerId: 'cust-1',
          customerName: 'Ghost Inc',
          totalCents: 100000,
          currency: 'USD',
          shipmentCount: 1,
          lineItemCount: 1,
        }
      );

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handleUpdated', () => {
    it('updates status and daysPastDue on overdue invoices', async () => {
      const pastDueDate = new Date(Date.now() - 45 * 86400000); // 45 days ago
      const overdueInvoice = {
        ...mockInvoice,
        status: 'sent',
        dueDate: pastDueDate,
        paidCents: 0,
        balanceCents: 150000,
      };
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(overdueInvoice);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_OVERDUE, 'invoice', 'inv-1', {}
      );

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            status: 'sent',
            paidCents: 0,
            balanceCents: 150000,
            daysPastDue: expect.any(Number),
          }),
        })
      );

      // Verify daysPastDue is approximately 45 days
      const updateCall = mockPrisma.invoiceReadModel.update.mock.calls[0][0];
      expect(updateCall.data.daysPastDue).toBeGreaterThanOrEqual(44);
      expect(updateCall.data.daysPastDue).toBeLessThanOrEqual(46);
    });

    it('sets daysPastDue to 0 for paid invoices even if past due', async () => {
      const pastDueDate = new Date(Date.now() - 10 * 86400000); // 10 days ago
      const paidInvoice = {
        ...mockInvoice,
        status: 'paid',
        dueDate: pastDueDate,
        paidCents: 150000,
        balanceCents: 0,
      };
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(paidInvoice);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_PAID, 'invoice', 'inv-1', {}
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

    it('sets daysPastDue to 0 for voided invoices even if past due', async () => {
      const pastDueDate = new Date(Date.now() - 5 * 86400000);
      const voidedInvoice = {
        ...mockInvoice,
        status: 'void',
        dueDate: pastDueDate,
        paidCents: 0,
        balanceCents: 150000,
      };
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(voidedInvoice);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_VOIDED, 'invoice', 'inv-1', {}
      );

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'void',
            daysPastDue: 0,
          }),
        })
      );
    });

    it('updates partial payment amounts on PAYMENT_RECEIVED', async () => {
      const partiallyPaid = {
        ...mockInvoice,
        status: 'sent',
        paidCents: 75000,
        balanceCents: 75000,
      };
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(partiallyPaid);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_PAYMENT_RECEIVED, 'invoice', 'inv-1', {}
      );

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paidCents: 75000,
            balanceCents: 75000,
          }),
        })
      );
    });

    it('skips gracefully when invoice not found on update', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValueOnce(null);

      const event = createTestEvent(
        EVENT_TYPES.INVOICE_APPROVED, 'invoice', 'nonexistent', {}
      );

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.update).not.toHaveBeenCalled();
    });
  });

  describe('unknown event types', () => {
    it('ignores events it does not handle', async () => {
      const event = createTestEvent('invoice.some_future_event', 'invoice', 'inv-1', {});

      await projection.handle(event);

      expect(mockPrisma.invoiceReadModel.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.invoiceReadModel.update).not.toHaveBeenCalled();
    });
  });
});
