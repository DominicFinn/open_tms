import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { EDI210ParseService } from '../services/EDI210ParseService.js';
import { EDI810Service, EDI810InvoiceData } from '../services/EDI810Service.js';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { RECEIVE_CARRIER_INVOICE, ReceiveCarrierInvoicePayload } from '../commands/carrierInvoices/ReceiveCarrierInvoiceCommand.js';
import { PrismaClient } from '@prisma/client';

import { registerOrgScopeForEdi } from '../auth/orgScopeMiddleware.js';

export async function edi210Routes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const tradingPartnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const edi210ParseService = new EDI210ParseService();
  const edi810Service = new EDI810Service();

  await registerOrgScopeForEdi(server);

  // Inbound EDI 210 — parse carrier freight invoice and create carrier invoice
  server.post('/api/v1/edi/210/inbound', {
    schema: {
      tags: ['EDI - Financial'],
      summary: 'Process inbound EDI 210 (Freight Invoice) from carrier — parses and creates carrier invoice with three-way match',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Raw EDI 210 content' },
          partnerId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      content: z.string().min(10),
      partnerId: z.string().optional(),
      fileName: z.string().optional(),
    }).parse((req as any).body);

    // Create transaction log entry
    const logEntry = await tradingPartnerRepo.createLog({
      orgId: req.orgId!,
      partnerId: body.partnerId || null,
      transactionType: '210',
      direction: 'inbound',
      fileName: body.fileName || 'edi210_inbound.edi',
      fileSize: body.content.length,
      fileContent: body.content,
      transport: 'api',
      status: 'processing',
      source: body.partnerId ? 'sftp' : 'api',
    });

    // Parse the EDI 210
    const parsed = edi210ParseService.parseEDI210(body.content);

    if (!parsed.success) {
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'error',
        errorMessage: parsed.errors.join('; '),
        processedAt: new Date(),
      });
      reply.code(400);
      return { data: null, error: `EDI 210 parse failed: ${parsed.errors.join('; ')}` };
    }

    // Find the carrier by SCAC code
    const carrier = await prisma.carrier.findFirst({
      where: {
        scacCode: parsed.carrierScac,
        archived: false,
      },
      select: { id: true, name: true },
    });

    if (!carrier) {
      reply.code(400);
      return { data: null, error: `Carrier not found for SCAC code "${parsed.carrierScac}"` };
    }

    // Find the shipment by reference
    let shipmentId: string | undefined;
    if (parsed.shipmentReference) {
      const shipment = await prisma.shipment.findFirst({
        where: { reference: parsed.shipmentReference },
        select: { id: true },
      });
      shipmentId = shipment?.id;
    }

    // Also check N9 reference numbers for shipment references
    if (!shipmentId) {
      for (const ref of parsed.referenceNumbers) {
        if (['SI', 'BM', 'CN'].includes(ref.qualifier)) {
          const shipment = await prisma.shipment.findFirst({
            where: { reference: ref.number },
            select: { id: true },
          });
          if (shipment) {
            shipmentId = shipment.id;
            break;
          }
        }
      }
    }

    // Map parsed line items to carrier invoice line items
    const lineItems = parsed.lineItems.map(item => ({
      shipmentId,
      chargeType: item.chargeType,
      description: item.description || `${item.chargeType} — ${item.freightClass ? `Class ${item.freightClass}` : 'freight'}`,
      amountCents: item.chargeAmountCents,
      freightClass: item.freightClass || undefined,
      billedWeight: item.billedWeight || undefined,
    }));

    // If no line items parsed but we have a total, create a single linehaul item
    if (lineItems.length === 0 && parsed.totalChargesCents > 0) {
      lineItems.push({
        shipmentId,
        chargeType: 'linehaul',
        description: `Freight charges — invoice ${parsed.invoiceNumber}`,
        amountCents: parsed.totalChargesCents,
        freightClass: undefined,
        billedWeight: parsed.totalWeight || undefined,
      });
    }

    try {
      const result = await commandBus.dispatch<ReceiveCarrierInvoicePayload, { id: string; matchStatus: string; autoApproved: boolean }>({
        type: RECEIVE_CARRIER_INVOICE,
        orgId: (req as any).orgId ?? '',
        actorId: (req as any).user?.sub ?? null,
        payload: {
          carrierId: carrier.id,
          invoiceNumber: parsed.invoiceNumber,
          totalCents: parsed.totalChargesCents,
          lineItems,
          edi210Content: body.content,
        },
        metadata: { correlationId: crypto.randomUUID(), source: 'edi' },
      });

      if (!result.success) {
        await tradingPartnerRepo.updateLog(logEntry.id, {
          status: 'error',
          errorMessage: result.error,
          shipmentReference: parsed.shipmentReference,
          invoiceNumber: parsed.invoiceNumber,
          processedAt: new Date(),
        });
        reply.code(400);
        return { data: null, error: result.error };
      }

      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'success',
        shipmentId: shipmentId || null,
        shipmentReference: parsed.shipmentReference,
        invoiceNumber: parsed.invoiceNumber,
        entitiesCreated: 1,
        entityIds: [result.data?.id],
        processedAt: new Date(),
      });

      reply.code(201);
      return {
        data: {
          ...result.data,
          logId: logEntry.id,
          parsed: {
            invoiceNumber: parsed.invoiceNumber,
            carrierScac: parsed.carrierScac,
            shipmentReference: parsed.shipmentReference,
            totalChargesCents: parsed.totalChargesCents,
            lineItemCount: lineItems.length,
          },
        },
        error: null,
      };
    } catch (err: any) {
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'error',
        errorMessage: err.message,
        processedAt: new Date(),
      });
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Preview EDI 210 (parse without creating)
  server.post('/api/v1/edi/210/preview', {
    schema: {
      tags: ['EDI - Financial'],
      summary: 'Preview EDI 210 parse result without creating a carrier invoice',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const body = z.object({
      content: z.string().min(10),
    }).parse((req as any).body);

    const parsed = edi210ParseService.parseEDI210(body.content);
    return { data: parsed, error: null };
  });

  // Generate EDI 810 (outbound invoice to customer)
  server.post('/api/v1/edi/810/generate', {
    schema: {
      tags: ['EDI - Financial'],
      summary: 'Generate EDI 810 (Invoice) for a customer invoice — returns raw X12 content',
      body: {
        type: 'object',
        required: ['invoiceId'],
        properties: {
          invoiceId: { type: 'string' },
          senderId: { type: 'string' },
          receiverId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      invoiceId: z.string().min(1),
      senderId: z.string().optional(),
      receiverId: z.string().optional(),
    }).parse((req as any).body);

    // Load the invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: body.invoiceId },
      include: {
        customer: true,
        lineItems: true,
      },
    });

    if (!invoice) {
      reply.code(404);
      return { data: null, error: 'Invoice not found' };
    }

    // Collect shipment references from line items
    const shipmentIds = [...new Set(invoice.lineItems.map(li => li.shipmentId).filter(Boolean) as string[])];
    const shipments = shipmentIds.length > 0
      ? await prisma.shipment.findMany({
          where: { id: { in: shipmentIds } },
          select: { id: true, reference: true, carrierId: true, carrier: { select: { name: true, scacCode: true } } },
        })
      : [];

    const shipmentRefMap = new Map(shipments.map(s => [s.id, s.reference]));
    const carrier = shipments.find(s => s.carrier)?.carrier;

    // Build EDI 810 data
    const edi810Data: EDI810InvoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paymentTermsDays: invoice.paymentTermsDays,
      currency: invoice.currency,
      seller: {
        name: 'Open TMS', // Could be pulled from Organization
        id: body.senderId,
      },
      buyer: {
        name: invoice.customer.name,
        id: invoice.customer.id,
      },
      lineItems: invoice.lineItems.map((li, idx) => ({
        lineNumber: idx + 1,
        description: li.description,
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
        totalCents: li.totalCents,
        chargeType: li.chargeType,
        shipmentReference: li.shipmentId ? shipmentRefMap.get(li.shipmentId) : undefined,
        freightClass: li.freightClass ?? undefined,
      })),
      subtotalCents: invoice.subtotalCents,
      taxCents: invoice.taxCents,
      totalCents: invoice.totalCents,
      carrier: carrier ? { name: carrier.name, scacCode: carrier.scacCode ?? undefined } : undefined,
      shipmentReferences: shipments.map(s => s.reference),
    };

    const ediContent = edi810Service.generateEDI810(edi810Data, {
      senderId: body.senderId,
      receiverId: body.receiverId,
    });

    // Log the outbound generation
    await tradingPartnerRepo.createLog({
      orgId: req.orgId!,
      partnerId: null,
      transactionType: '810',
      direction: 'outbound',
      fileName: `810_${invoice.invoiceNumber}_${Date.now()}.edi`,
      fileSize: ediContent.length,
      fileContent: ediContent,
      transport: 'api',
      status: 'success',
      source: 'api',
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      processedAt: new Date(),
    });

    return { data: { ediContent, invoiceNumber: invoice.invoiceNumber }, error: null };
  });
}
