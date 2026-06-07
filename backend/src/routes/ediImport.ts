import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IEdiImportService } from '../services/EdiImportService.js';
import { IEDI855Service, EDI855Data } from '../services/EDI855Service.js';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { container, TOKENS } from '../di/index.js';
import { PrismaClient } from '@prisma/client';

import { registerOrgScopeForEdi } from '../auth/orgScopeMiddleware.js';

export async function ediImportRoutes(server: FastifyInstance) {
  const ediImportService = container.resolve<IEdiImportService>(TOKENS.IEdiImportService);
  const edi855Service = container.resolve<IEDI855Service>(TOKENS.IEDI855Service);
  const tradingPartnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);

  await registerOrgScopeForEdi(server);

  // Import EDI content — creates orders
  server.post('/api/v1/orders/import/edi', async (req: FastifyRequest, reply: FastifyReply) => {
    const rawBody = (req as any).body;
    const body = z.object({
      ediContent: z.string().min(1, 'EDI content is required'),
      partnerId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      fileName: z.string().optional(),
      source: z.enum(['manual', 'sftp', 'api']).default('manual'),
      autoAssign: z.boolean().default(false)
    }).parse({
      ...rawBody,
      // Accept "content" as alias for "ediContent" (universal endpoint compat)
      ediContent: rawBody.ediContent || rawBody.content,
    });

    try {
      const result = await ediImportService.importEdi(body.ediContent, {
        partnerId: body.partnerId,
        customerId: body.customerId,
        fileName: body.fileName,
        source: body.source,
        autoAssign: body.autoAssign
      });

      if (!result.success && result.ordersCreated === 0) {
        reply.code(400);
        return { data: result, error: result.errors.join('; ') };
      }

      reply.code(201);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'EDI import failed' };
    }
  });

  // Preview EDI content — parse only, no order creation
  server.post('/api/v1/orders/import/edi/preview', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      ediContent: z.string().min(1, 'EDI content is required'),
      partnerId: z.string().uuid().optional()
    }).parse((req as any).body);

    try {
      const result = await ediImportService.previewEdi(body.ediContent, {
        partnerId: body.partnerId
      });

      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'EDI preview failed' };
    }
  });

  // Generate EDI 855 (PO Acknowledgment) for an order
  server.post('/api/v1/edi/855/generate', {
    schema: {
      tags: ['EDI'],
      summary: 'Generate EDI 855 (Purchase Order Acknowledgment) for an order',
      body: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string' },
          ackType: { type: 'string', enum: ['AC', 'AD', 'RD'], default: 'AC' },
          senderId: { type: 'string' },
          receiverId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      orderId: z.string().min(1),
      ackType: z.enum(['AC', 'AD', 'RD']).default('AC'),
      senderId: z.string().optional(),
      receiverId: z.string().optional(),
    }).parse((req as any).body);

    // Load order with customer and line items
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      include: {
        customer: true,
        trackableUnits: { include: { lineItems: true } },
      },
    });

    if (!order) {
      reply.code(404);
      return { data: null, error: 'Order not found' };
    }

    // Build line items from trackable units
    const lineItems = (order.trackableUnits || []).flatMap((tu: any, tuIdx: number) =>
      (tu.lineItems || []).map((li: any, liIdx: number) => ({
        lineNumber: tuIdx * 100 + liIdx + 1,
        quantityOrdered: li.quantity || 1,
        quantityAcknowledged: li.quantity || 1,
        unitPrice: 0,
        sku: li.sku || `ITEM-${liIdx + 1}`,
        description: li.description || undefined,
        ackStatus: 'IA' as const,
      }))
    );

    // Fallback: if no trackable units, create a single acknowledgment line
    if (lineItems.length === 0) {
      lineItems.push({
        lineNumber: 1,
        quantityOrdered: 1,
        quantityAcknowledged: 1,
        unitPrice: 0,
        sku: 'ORDER',
        description: `Order ${order.orderNumber}`,
        ackStatus: 'IA' as const,
      });
    }

    const edi855Data: EDI855Data = {
      poNumber: order.poNumber || order.orderNumber,
      poDate: order.orderDate || order.createdAt,
      ackDate: new Date(),
      ackType: body.ackType,
      seller: { name: 'Open TMS', id: body.senderId },
      buyer: { name: order.customer.name, id: order.customer.id },
      lineItems,
    };

    const result = edi855Service.validateAndGenerate(edi855Data, {
      senderId: body.senderId,
      receiverId: body.receiverId,
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.errors.join('; ') };
    }

    // Log the generation
    await tradingPartnerRepo.createLog({
      orgId: req.orgId!,
      transactionType: '855',
      direction: 'outbound',
      fileName: `855_${order.orderNumber}_${Date.now()}.edi`,
      fileSize: result.data!.length,
      fileContent: result.data,
      transport: 'api',
      status: 'success',
      source: 'api',
      orderId: order.id,
      processedAt: new Date(),
    });

    return { data: { ediContent: result.data, orderNumber: order.orderNumber }, error: null };
  });
}
