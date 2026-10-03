import { CreateInvoiceCommandHandler, CREATE_INVOICE } from '../../commands/invoices/CreateInvoiceCommand';
import { ApproveInvoiceCommandHandler, APPROVE_INVOICE } from '../../commands/invoices/ApproveInvoiceCommand';
import { SendInvoiceCommandHandler, SEND_INVOICE } from '../../commands/invoices/SendInvoiceCommand';
import { RecordPaymentCommandHandler, RECORD_PAYMENT } from '../../commands/invoices/RecordPaymentCommand';
import { VoidInvoiceCommandHandler, VOID_INVOICE } from '../../commands/invoices/VoidInvoiceCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

// Entity lookups are by { id, orgId }; number-sequence lookups carry no id.
const findById = (row: unknown) =>
  jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where?.id ? row : null));

const mockCustomer = {
  id: 'cust-1', name: 'Acme Corp', paymentTermsDays: 30, currency: 'USD',
};

const mockCharge = {
  id: 'charge-1', shipmentId: 'ship-1', orderId: null,
  chargeType: 'linehaul', chargeCategory: 'revenue',
  description: 'Linehaul', amountCents: 150000, currency: 'USD',
  status: 'approved', freightClass: null,
};

const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const mockInvoice = {
  id: 'inv-1', orgId: 'test-org', invoiceNumber: `INV-${todayStr}-0001`,
  customerId: 'cust-1', status: 'draft',
  subtotalCents: 150000, taxCents: 0, totalCents: 150000,
  paidCents: 0, balanceCents: 150000, currency: 'USD',
  paymentTermsDays: 30,
  issueDate: new Date(), dueDate: new Date(Date.now() + 30 * 86400000),
  sentAt: null, paidAt: null,
  customer: { name: 'Acme Corp', contactEmail: 'billing@acme.com', billingEmail: 'billing@acme.com' },
  lineItems: [{ chargeId: 'charge-1', shipmentId: 'ship-1' }],
};

const mockTx = {
  customer: { findFirst: findById(mockCustomer) },
  charge: {
    findMany: jest.fn().mockResolvedValue([mockCharge]),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  invoice: {
    create: jest.fn().mockResolvedValue(mockInvoice),
    findFirst: findById(mockInvoice),
    update: jest.fn().mockResolvedValue(mockInvoice),
  },
  invoiceLineItem: {
    findMany: jest.fn().mockResolvedValue([{ shipmentId: 'ship-1' }]),
  },
  payment: {
    create: jest.fn().mockResolvedValue({ id: 'pay-1', amountCents: 150000 }),
  },
  shipmentFinancialSummary: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Invoice Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('org scoping', () => {
    const txNoInvoice = { ...mockTx, invoice: { ...mockTx.invoice, findFirst: jest.fn().mockResolvedValue(null) } } as any;
    const prismaNoInvoice = {
      $transaction: jest.fn((fn: Function) => fn(txNoInvoice)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    it.each([
      ['approve', ApproveInvoiceCommandHandler, APPROVE_INVOICE, {}],
      ['send', SendInvoiceCommandHandler, SEND_INVOICE, {}],
      ['record payment', RecordPaymentCommandHandler, RECORD_PAYMENT, { amountCents: 100 }],
      ['void', VoidInvoiceCommandHandler, VOID_INVOICE, {}],
    ] as const)('%s looks the invoice up under the command org', async (_name, Handler, type, extra) => {
      const { bus } = mockEventBus();
      const handler = new (Handler as any)(prismaNoInvoice, bus);

      const result = await handler.execute(createTestCommand(type, { invoiceId: 'inv-other-org', ...extra }));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
      expect(txNoInvoice.invoice.findFirst.mock.calls[0][0].where).toEqual({ id: 'inv-other-org', orgId: 'test-org' });
      expect(txNoInvoice.invoice.update).not.toHaveBeenCalled();
    });

    it('only invoices charges from the command org', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateInvoiceCommandHandler(mockPrisma, bus);

      await handler.execute(createTestCommand(CREATE_INVOICE, { customerId: 'cust-1', shipmentIds: ['ship-1'] }));

      expect(mockTx.customer.findFirst.mock.calls[0][0].where).toEqual({ id: 'cust-1', orgId: 'test-org' });
      expect(mockTx.charge.findMany.mock.calls[0][0].where).toMatchObject({ orgId: 'test-org' });
    });
  });

  describe('CreateInvoiceCommandHandler', () => {
    it('creates an invoice from approved charges and emits INVOICE_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_INVOICE, {
          customerId: 'cust-1',
          shipmentIds: ['ship-1'],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.invoiceNumber).toBe(`INV-${todayStr}-0001`);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.INVOICE_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          customerId: 'cust-1',
          customerName: 'Acme Corp',
          totalCents: 150000,
        })
      );
    });

    it('fails when no shipments provided', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_INVOICE, {
          customerId: 'cust-1',
          shipmentIds: [],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one shipment');
    });

    it('fails when no approved charges found', async () => {
      const txNoCharges = {
        ...mockTx,
        charge: { ...mockTx.charge, findMany: jest.fn().mockResolvedValue([]) },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txNoCharges)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new CreateInvoiceCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_INVOICE, {
          customerId: 'cust-1',
          shipmentIds: ['ship-1'],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No approved revenue charges');
    });

    it('marks charges as invoiced and updates shipment billing status', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateInvoiceCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(CREATE_INVOICE, {
          customerId: 'cust-1',
          shipmentIds: ['ship-1'],
        })
      );

      expect(mockTx.charge.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['charge-1'] } },
        data: { status: 'invoiced' },
      });
      expect(mockTx.shipmentFinancialSummary.updateMany).toHaveBeenCalledWith({
        where: { shipmentId: { in: ['ship-1'] }, orgId: 'test-org' },
        data: { billingStatus: 'invoiced' },
      });
    });
  });

  describe('ApproveInvoiceCommandHandler', () => {
    it('approves a draft invoice', async () => {
      const { bus } = mockEventBus();
      const handler = new ApproveInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(APPROVE_INVOICE, { invoiceId: 'inv-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.INVOICE_APPROVED);
    });

    it('fails for non-draft invoices', async () => {
      const txSent = {
        ...mockTx,
        invoice: { ...mockTx.invoice, findFirst: findById({ ...mockInvoice, status: 'sent' }) },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txSent)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ApproveInvoiceCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(APPROVE_INVOICE, { invoiceId: 'inv-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot approve');
    });
  });

  describe('SendInvoiceCommandHandler', () => {
    it('sends an invoice and emits INVOICE_SENT with recipient email', async () => {
      const { bus } = mockEventBus();
      const handler = new SendInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(SEND_INVOICE, { invoiceId: 'inv-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.INVOICE_SENT);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          recipientEmail: 'billing@acme.com',
        })
      );
    });
  });

  describe('RecordPaymentCommandHandler', () => {
    it('records a full payment and emits both PAYMENT_RECEIVED and PAID', async () => {
      const { bus } = mockEventBus();
      const handler = new RecordPaymentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_PAYMENT, {
          invoiceId: 'inv-1',
          amountCents: 150000,
          paymentMethod: 'ach',
          referenceNumber: 'ACH-12345',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.invoiceStatus).toBe('paid');
      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe(EVENT_TYPES.INVOICE_PAYMENT_RECEIVED);
      expect(result.events[1].type).toBe(EVENT_TYPES.INVOICE_PAID);
    });

    it('records a partial payment', async () => {
      const { bus } = mockEventBus();
      const handler = new RecordPaymentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_PAYMENT, {
          invoiceId: 'inv-1',
          amountCents: 50000,
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.invoiceStatus).toBe('partial_paid');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.INVOICE_PAYMENT_RECEIVED);
    });

    it('rejects payment exceeding balance', async () => {
      const { bus } = mockEventBus();
      const handler = new RecordPaymentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_PAYMENT, {
          invoiceId: 'inv-1',
          amountCents: 200000,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds invoice balance');
    });

    it('rejects payment on void invoice', async () => {
      const txVoid = {
        ...mockTx,
        invoice: { ...mockTx.invoice, findFirst: findById({ ...mockInvoice, status: 'void' }) },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txVoid)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new RecordPaymentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_PAYMENT, {
          invoiceId: 'inv-1',
          amountCents: 50000,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot record payment');
    });
  });

  describe('VoidInvoiceCommandHandler', () => {
    it('voids an invoice and reverts charges to approved', async () => {
      const { bus } = mockEventBus();
      const handler = new VoidInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(VOID_INVOICE, { invoiceId: 'inv-1', reason: 'Incorrect charges' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.INVOICE_VOIDED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          reason: 'Incorrect charges',
        })
      );
      // Charges reverted
      expect(mockTx.charge.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['charge-1'] } },
        data: { status: 'approved' },
      });
      // Shipment billing reverted
      expect(mockTx.shipmentFinancialSummary.updateMany).toHaveBeenCalledWith({
        where: { shipmentId: { in: ['ship-1'] }, orgId: 'test-org' },
        data: { billingStatus: 'ready_to_invoice' },
      });
    });

    it('cannot void an invoice with payments', async () => {
      const txWithPayments = {
        ...mockTx,
        invoice: {
          ...mockTx.invoice,
          findFirst: findById({ ...mockInvoice, paidCents: 50000 }),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txWithPayments)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new VoidInvoiceCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(VOID_INVOICE, { invoiceId: 'inv-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot void an invoice that has payments');
    });
  });
});
