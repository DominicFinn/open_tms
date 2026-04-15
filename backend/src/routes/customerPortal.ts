/**
 * Customer Portal API - self-service access for customers to view their
 * shipments, orders, documents, and invoices. All data scoped by customerId
 * from the JWT - no cross-customer access.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICustomerAuthService } from '../services/CustomerAuthService.js';
import { authenticateCustomerJWT } from '../middleware/jwtAuth.js';

export async function customerPortalRoutes(server: FastifyInstance) {
  const authService = container.resolve<ICustomerAuthService>(TOKENS.ICustomerAuthService);

  // ── Public: Login ────────────────────────────────────────────────────

  server.post('/api/v1/customer-portal/login', {
    schema: {
      tags: ['Customer Portal'],
      summary: 'Customer portal login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse((req as any).body);

    try {
      const result = await authService.login(body.email, body.password);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(401);
      return { data: null, error: err.message };
    }
  });

  // ── Protected routes ─────────────────────────────────────────────────

  // Profile
  server.get('/api/v1/customer-portal/profile', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'], summary: 'Get current customer user profile' },
  }, async (req: FastifyRequest) => {
    const user = req.customerUser!;
    return {
      data: {
        id: user.sub,
        email: user.email,
        customerId: user.customerId,
        customerName: user.customerName,
        role: user.role,
      },
      error: null,
    };
  });

  // Change password
  server.post('/api/v1/customer-portal/change-password', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = (req as any).body;
    try {
      await authService.changePassword(req.customerUser!.sub, body.currentPassword, body.newPassword);
      return { data: { success: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Dashboard summary
  server.get('/api/v1/customer-portal/dashboard', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'], summary: 'Customer dashboard summary stats' },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;

    const [activeShipments, recentDeliveries, openIssues, outstandingInvoices] = await Promise.all([
      server.prisma.shipmentReadModel.count({
        where: { customerId, status: { in: ['booked', 'in_transit', 'at_pickup', 'at_delivery'] } },
      }),
      server.prisma.shipmentReadModel.count({
        where: { customerId, status: 'delivered' },
      }),
      server.prisma.issueReadModel.count({
        where: {
          sourceEntityType: 'shipment',
          status: { in: ['open', 'in_progress'] },
        },
      }),
      server.prisma.invoiceReadModel.aggregate({
        where: { customerId, status: { in: ['sent', 'partial_paid', 'overdue'] } },
        _sum: { balanceCents: true },
        _count: true,
      }),
    ]);

    // Recent shipments for activity feed
    const recentShipments = await server.prisma.shipmentReadModel.findMany({
      where: { customerId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true, reference: true, status: true,
        originCity: true, originState: true,
        destinationCity: true, destinationState: true,
        carrierName: true, pickupDate: true, deliveryDate: true,
      },
    });

    return {
      data: {
        stats: {
          activeShipments,
          recentDeliveries,
          openIssues,
          outstandingInvoiceCount: outstandingInvoices._count,
          outstandingBalanceCents: outstandingInvoices._sum.balanceCents || 0,
        },
        recentShipments,
      },
      error: null,
    };
  });

  // Orders
  server.get('/api/v1/customer-portal/orders', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          status: { type: 'string' },
          limit: { type: 'integer', default: 50 },
          offset: { type: 'integer', default: 0 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const query = req.query as { search?: string; status?: string; limit?: number; offset?: number };

    const where: any = { customerId };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { poNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      server.prisma.orderReadModel.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      server.prisma.orderReadModel.count({ where }),
    ]);

    return { data: { orders, total }, error: null };
  });

  // Order detail
  server.get('/api/v1/customer-portal/orders/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const order = await server.prisma.order.findFirst({
      where: { id, customerId },
      include: {
        origin: true,
        destination: true,
        lineItems: true,
        trackableUnits: true,
      },
    });

    if (!order) { reply.code(404); return { data: null, error: 'Order not found' }; }
    return { data: order, error: null };
  });

  // Shipments
  server.get('/api/v1/customer-portal/shipments', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'integer', default: 50 },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;
    const query = req.query as { status?: string; limit?: number };

    const where: any = { customerId };
    if (query.status) where.status = query.status;

    const shipments = await server.prisma.shipmentReadModel.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: query.limit || 50,
    });

    return { data: shipments, error: null };
  });

  // Shipment detail
  server.get('/api/v1/customer-portal/shipments/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const shipment = await server.prisma.shipment.findFirst({
      where: { id, customerId },
      include: {
        origin: true,
        destination: true,
        carrier: { select: { name: true } },
        stops: { include: { location: true }, orderBy: { sequenceNumber: 'asc' } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!shipment) { reply.code(404); return { data: null, error: 'Shipment not found' }; }
    return { data: shipment, error: null };
  });

  // Documents
  server.get('/api/v1/customer-portal/documents', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;

    const documents = await server.prisma.generatedDocument.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, documentType: true, fileName: true,
        mimeType: true, fileSize: true, createdAt: true,
        shipmentId: true,
      },
      take: 100,
    });

    return { data: documents, error: null };
  });

  // Document download
  server.get('/api/v1/customer-portal/documents/:id/download', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const doc = await server.prisma.generatedDocument.findFirst({
      where: { id, customerId },
    });

    if (!doc) { reply.code(404); return { data: null, error: 'Document not found' }; }

    if (doc.fileContent) {
      reply.header('Content-Type', doc.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${doc.fileName}"`);
      return reply.send(doc.fileContent);
    }

    reply.code(404);
    return { data: null, error: 'Document content not available' };
  });

  // Invoices
  server.get('/api/v1/customer-portal/invoices', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest) => {
    const customerId = req.customerUser!.customerId;

    const invoices = await server.prisma.invoiceReadModel.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return { data: invoices, error: null };
  });

  // Invoice detail
  server.get('/api/v1/customer-portal/invoices/:id', {
    preHandler: [authenticateCustomerJWT],
    schema: { tags: ['Customer Portal'] },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;

    const invoice = await server.prisma.invoice.findFirst({
      where: { id, customerId },
      include: { lineItems: true, payments: true },
    });

    if (!invoice) { reply.code(404); return { data: null, error: 'Invoice not found' }; }
    return { data: invoice, error: null };
  });

  // Dispute an invoice
  server.post('/api/v1/customer-portal/invoices/:id/dispute', {
    preHandler: [authenticateCustomerJWT],
    schema: {
      tags: ['Customer Portal'],
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customerId = req.customerUser!.customerId;
    const { reason } = (req as any).body;

    const invoice = await server.prisma.invoice.findFirst({
      where: { id, customerId },
      select: { id: true, invoiceNumber: true, customerId: true },
    });

    if (!invoice) { reply.code(404); return { data: null, error: 'Invoice not found' }; }

    const orgId = (await server.prisma.organization.findFirst({ select: { id: true } }))?.id || '';

    // Create a financial query (dispute)
    const queryCount = await server.prisma.financialQuery.count();
    const query = await server.prisma.financialQuery.create({
      data: {
        orgId,
        queryNumber: `QRY-${String(queryCount + 1).padStart(4, '0')}`,
        queryType: 'customer_dispute',
        status: 'raised',
        invoiceId: invoice.id,
        reason,
        description: `Customer dispute on invoice ${invoice.invoiceNumber}: ${reason}`,
      },
    });

    reply.code(201);
    return { data: { queryId: query.id, queryNumber: (query as any).queryNumber }, error: null };
  });
}
