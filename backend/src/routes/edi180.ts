import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_RMA } from '../commands/rma/CreateRmaCommand.js';
import { IEDI180ParseService } from '../services/EDI180ParseService.js';
import { IEDI180Service, EDI180Data } from '../services/EDI180Service.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export async function edi180Routes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const parseService = container.resolve<IEDI180ParseService>(TOKENS.IEDI180ParseService);
  const generateService = container.resolve<IEDI180Service>(TOKENS.IEDI180Service);

  // POST /api/v1/edi/180/inbound — Process inbound EDI 180 (customer return request)
  server.post('/api/v1/edi/180/inbound', {
    schema: {
      tags: ['EDI - Returns (180)'],
      summary: 'Process inbound EDI 180 Return Merchandise Authorization request',
      description: 'Parses EDI 180 content from a customer requesting return authorization. Maps to an RMA automatically. Looks up customer and order by external reference.',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', description: 'Raw EDI 180 X12 content' },
          partnerId: { type: 'string', description: 'Trading partner ID (if known, for logging and customer lookup)' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      content: z.string().min(1),
      partnerId: z.string().optional(),
    }).parse((req as any).body);

    const orgId = (req as any).orgId || (await prisma.organization.findFirst({ select: { id: true } }))?.id || 'default-org';
    const actorId = (req as any).userId || 'edi-180-inbound';

    // Parse the EDI content
    const parsed = parseService.parseEDI180(body.content);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: `EDI 180 parse failed: ${parsed.errors.join('; ')}`, warnings: parsed.warnings };
    }

    // Look up customer - prefer partner link, fall back to name/id match
    let customerId: string | null = null;
    if (body.partnerId) {
      const partner = await prisma.tradingPartner.findUnique({ where: { id: body.partnerId }, select: { customerId: true } });
      customerId = partner?.customerId ?? null;
    }
    if (!customerId && parsed.customerId) {
      const cust = await prisma.customer.findFirst({ where: { OR: [{ id: parsed.customerId }, { name: parsed.customerName }] }, select: { id: true } });
      customerId = cust?.id ?? null;
    }

    if (!customerId) {
      reply.code(400);
      return { data: null, error: `Cannot identify customer from EDI 180 (partnerId: ${body.partnerId ?? 'none'}, customerName: ${parsed.customerName})` };
    }

    // Look up the original order by the PO/order number
    const order = await prisma.order.findFirst({
      where: {
        customerId,
        OR: [
          { id: parsed.originalOrderNumber },
          { orderNumber: parsed.originalOrderNumber },
        ],
      },
      include: { lineItems: true },
    });
    if (!order) {
      reply.code(400);
      return { data: null, error: `Order ${parsed.originalOrderNumber} not found for customer` };
    }

    // Match EDI 180 lines to order line items by SKU
    const rmaLines = parsed.lines.map(ediLine => {
      const orderLine = order.lineItems.find(ol => ol.sku === ediLine.sku);
      if (!orderLine) {
        return null;
      }
      return {
        orderLineItemId: orderLine.id,
        sku: ediLine.sku,
        requestedQuantity: ediLine.quantity,
        requestedDisposition: ediLine.requestedDisposition,
        unitPriceCents: ediLine.unitPriceCents,
      };
    }).filter((l): l is NonNullable<typeof l> => l !== null);

    if (rmaLines.length === 0) {
      reply.code(400);
      return { data: null, error: 'No EDI 180 lines matched SKUs on the referenced order' };
    }

    // Create the RMA via command bus
    const result = await commandBus.dispatch({
      type: CREATE_RMA,
      orgId,
      actorId,
      payload: {
        customerId,
        orderId: order.id,
        returnReason: parsed.returnReason || 'other',
        customerNotes: parsed.customerNotes || (parsed.customerRmaNumber ? `Customer RMA reference: ${parsed.customerRmaNumber}` : undefined),
        initiatedVia: 'edi_180',
        lines: rmaLines,
        autoAuthorize: false, // EDI-initiated RMAs still go through CSR review by default
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'edi-180' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error, parsed };
    }

    reply.code(201);
    return { data: { ...result.data, customerRmaNumber: parsed.customerRmaNumber, warnings: parsed.warnings }, error: null };
  });

  // POST /api/v1/edi/180/generate — Generate outbound EDI 180 for an authorized RMA
  server.post('/api/v1/edi/180/generate', {
    schema: {
      tags: ['EDI - Returns (180)'],
      summary: 'Generate outbound EDI 180 return authorization for an RMA',
      description: 'Produces EDI 180 X12 content to send back to the customer confirming the RMA. Typically sent after RMA is authorized.',
      body: {
        type: 'object',
        required: ['rmaId'],
        properties: {
          rmaId: { type: 'string', format: 'uuid' },
          customerRmaNumber: { type: 'string', description: "Customer's original RMA reference to echo back" },
          expectedReturnDate: { type: 'string', format: 'date', description: "Date by which the return must arrive" },
          instructions: { type: 'string', description: "Free-text return instructions for the customer" },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      rmaId: z.string().uuid(),
      customerRmaNumber: z.string().optional(),
      expectedReturnDate: z.string().optional(),
      instructions: z.string().optional(),
    }).parse((req as any).body);

    // Load the RMA with lines, customer, and origin location (for ship-to address)
    const rma = await prisma.rma.findUnique({
      where: { id: body.rmaId },
      include: {
        lines: true,
      },
    });
    if (!rma) {
      reply.code(404);
      return { data: null, error: 'RMA not found' };
    }

    if (rma.status !== 'authorized' && rma.status !== 'in_transit' && rma.status !== 'received') {
      reply.code(400);
      return { data: null, error: `RMA must be authorized before generating EDI 180 (current: ${rma.status})` };
    }

    // Look up customer for sender info
    const customer = await prisma.customer.findUnique({ where: { id: rma.customerId }, select: { id: true, name: true } });
    if (!customer) {
      reply.code(400);
      return { data: null, error: 'Customer not found' };
    }

    // Look up the org / return receiving address
    const org = await prisma.organization.findFirst();

    // Look up original order to find warehouse ship-from (as return ship-to)
    const order = await prisma.order.findUnique({
      where: { id: rma.orderId },
      include: { origin: true },
    });

    const data: EDI180Data = {
      rmaNumber: rma.rmaNumber,
      originalOrderNumber: rma.orderId,
      customerRmaNumber: body.customerRmaNumber,
      authorizationDate: rma.authorizedAt ?? new Date(),
      expectedReturnDate: body.expectedReturnDate ? new Date(body.expectedReturnDate) : undefined,
      transactionPurpose: '11', // Response to customer request
      receiver: {
        name: org?.name ?? 'Open TMS',
        address1: order?.origin?.address1,
        city: order?.origin?.city,
        state: order?.origin?.state ?? undefined,
        postalCode: order?.origin?.postalCode ?? undefined,
        country: order?.origin?.country,
      },
      sender: { name: customer.name },
      lines: rma.lines.map((line, i) => ({
        lineNumber: i + 1,
        sku: line.sku,
        authorizedQuantity: line.requestedQuantity,
        unitPriceCents: line.refundAmountCents > 0 && line.requestedQuantity > 0
          ? Math.round(line.refundAmountCents / line.requestedQuantity)
          : undefined,
        reasonCode: line.requestedDisposition ?? undefined,
      })),
      instructions: body.instructions,
    };

    const result = generateService.validateAndGenerate(data);
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.errors.join('; '), warnings: result.warnings };
    }

    return { data: { content: result.data, rmaNumber: rma.rmaNumber }, error: null };
  });
}
