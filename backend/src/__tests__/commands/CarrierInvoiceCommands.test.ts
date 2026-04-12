import { ReceiveCarrierInvoiceCommandHandler, RECEIVE_CARRIER_INVOICE } from '../../commands/carrierInvoices/ReceiveCarrierInvoiceCommand';
import { ApproveCarrierInvoiceCommandHandler, APPROVE_CARRIER_INVOICE } from '../../commands/carrierInvoices/ApproveCarrierInvoiceCommand';
import { RecordCarrierPaymentCommandHandler, RECORD_CARRIER_PAYMENT } from '../../commands/carrierInvoices/RecordCarrierPaymentCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockCarrier = {
  id: 'carrier-1', name: 'Fast Freight LLC', paymentTermsDays: 30,
};

const mockExpectedCharge = {
  id: 'charge-1', shipmentId: 'ship-1', chargeCategory: 'cost',
  chargeType: 'linehaul', amountCents: 150000, status: 'approved',
};

const mockCarrierInvoice = {
  id: 'cinv-1', orgId: 'test-org', invoiceNumber: 'FF-2026-001',
  carrierId: 'carrier-1', status: 'received', totalCents: 150000,
  paidCents: 0, currency: 'USD', matchStatus: 'matched',
  lineItems: [{ shipmentId: 'ship-1', chargeId: 'charge-1' }],
};

const mockTx = {
  carrier: { findUnique: jest.fn().mockResolvedValue(mockCarrier) },
  charge: {
    findMany: jest.fn().mockResolvedValue([mockExpectedCharge]),
  },
  carrierInvoice: {
    create: jest.fn().mockResolvedValue(mockCarrierInvoice),
    findUnique: jest.fn().mockResolvedValue(mockCarrierInvoice),
    update: jest.fn().mockResolvedValue(mockCarrierInvoice),
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

describe('Carrier Invoice Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('ReceiveCarrierInvoiceCommandHandler', () => {
    it('receives an invoice and performs three-way match', async () => {
      const { bus } = mockEventBus();
      const handler = new ReceiveCarrierInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECEIVE_CARRIER_INVOICE, {
          carrierId: 'carrier-1',
          invoiceNumber: 'FF-2026-001',
          totalCents: 150000,
          lineItems: [{
            shipmentId: 'ship-1',
            chargeType: 'linehaul',
            description: 'Linehaul Chicago to Dallas',
            amountCents: 150000,
          }],
        })
      );

      expect(result.success).toBe(true);
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_INVOICE_RECEIVED);
    });

    it('auto-approves when within tolerance', async () => {
      // Invoice matches expected charges exactly
      const { bus } = mockEventBus();
      const handler = new ReceiveCarrierInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECEIVE_CARRIER_INVOICE, {
          carrierId: 'carrier-1',
          invoiceNumber: 'FF-2026-002',
          totalCents: 150000,
          lineItems: [{
            shipmentId: 'ship-1',
            chargeType: 'linehaul',
            description: 'Linehaul',
            amountCents: 150000,
          }],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.autoApproved).toBe(true);
      expect(result.data?.matchStatus).toBe('matched');
    });

    it('flags discrepancy when invoiced amount differs significantly', async () => {
      // Carrier invoices 20% more than expected
      const txHighInvoice = {
        ...mockTx,
        charge: {
          findMany: jest.fn().mockResolvedValue([{ ...mockExpectedCharge, amountCents: 100000 }]),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txHighInvoice)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ReceiveCarrierInvoiceCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(RECEIVE_CARRIER_INVOICE, {
          carrierId: 'carrier-1',
          invoiceNumber: 'FF-2026-003',
          totalCents: 120000,
          lineItems: [{
            shipmentId: 'ship-1',
            chargeType: 'linehaul',
            description: 'Linehaul',
            amountCents: 120000,
          }],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.autoApproved).toBe(false);
      expect(result.events.some(e => e.type === EVENT_TYPES.CARRIER_INVOICE_DISCREPANCY)).toBe(true);
    });

    it('marks unmatched when no expected charges exist', async () => {
      const txNoCharges = {
        ...mockTx,
        charge: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txNoCharges)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ReceiveCarrierInvoiceCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(RECEIVE_CARRIER_INVOICE, {
          carrierId: 'carrier-1',
          invoiceNumber: 'FF-2026-004',
          totalCents: 150000,
          lineItems: [{
            shipmentId: 'ship-1',
            chargeType: 'linehaul',
            description: 'Linehaul',
            amountCents: 150000,
          }],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.matchStatus).toBe('mismatch');
      expect(result.data?.autoApproved).toBe(false);
    });
  });

  describe('ApproveCarrierInvoiceCommandHandler', () => {
    it('approves a carrier invoice', async () => {
      const { bus } = mockEventBus();
      const handler = new ApproveCarrierInvoiceCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(APPROVE_CARRIER_INVOICE, { carrierInvoiceId: 'cinv-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_INVOICE_APPROVED);
    });

    it('fails for already paid invoices', async () => {
      const txPaid = {
        ...mockTx,
        carrierInvoice: {
          ...mockTx.carrierInvoice,
          findUnique: jest.fn().mockResolvedValue({ ...mockCarrierInvoice, status: 'paid' }),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txPaid)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new ApproveCarrierInvoiceCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(APPROVE_CARRIER_INVOICE, { carrierInvoiceId: 'cinv-1' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot approve');
    });
  });

  describe('RecordCarrierPaymentCommandHandler', () => {
    it('records payment and updates shipment status', async () => {
      const txApproved = {
        ...mockTx,
        carrierInvoice: {
          ...mockTx.carrierInvoice,
          findUnique: jest.fn().mockResolvedValue({ ...mockCarrierInvoice, status: 'approved' }),
          update: jest.fn().mockResolvedValue({ ...mockCarrierInvoice, status: 'paid' }),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: Function) => fn(txApproved)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new RecordCarrierPaymentCommandHandler(prisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_CARRIER_PAYMENT, {
          carrierInvoiceId: 'cinv-1',
          amountCents: 150000,
          paymentReference: 'CHK-789',
        })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_INVOICE_PAID);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ paymentReference: 'CHK-789' })
      );
    });

    it('fails for non-approved invoices', async () => {
      const { bus } = mockEventBus();
      const handler = new RecordCarrierPaymentCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_CARRIER_PAYMENT, {
          carrierInvoiceId: 'cinv-1',
          amountCents: 150000,
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot record payment');
    });
  });
});
