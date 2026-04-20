import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_ORDER } from '../commands/orders/CreateOrderCommand.js';
import { IEDI940ParseService } from '../services/EDI940ParseService.js';
import { IEDI945Service, EDI945Data, EDI945LineData, EDI945Address } from '../services/EDI945Service.js';

export async function edi940Routes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const parseService = container.resolve<IEDI940ParseService>(TOKENS.IEDI940ParseService);
  const generateService = container.resolve<IEDI945Service>(TOKENS.IEDI945Service);

  // POST /api/v1/edi/940/inbound — parse a 940 and create an Order
  server.post('/api/v1/edi/940/inbound', {
    schema: {
      tags: ['EDI - Warehouse Shipping (940/945)'],
      summary: 'Process inbound EDI 940 Warehouse Shipping Order',
      description: 'Parses a depositor-sent 940 and creates an order against the depositor customer. The paired 945 will be auto-sent when the shipment ships (see Edi945AutoSendHandler).',
      body: {
        type: 'object', required: ['content'],
        properties: {
          content: { type: 'string', description: 'Raw EDI 940 X12 content' },
          partnerId: { type: 'string', description: 'Trading partner ID (preferred way to resolve customer)' },
          previewOnly: { type: 'boolean', description: 'Parse and report what would be created, do not persist' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      content: z.string().min(1),
      partnerId: z.string().optional(),
      previewOnly: z.boolean().optional(),
    }).parse((req as any).body);

    const parsed = parseService.parseEDI940(body.content);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: `EDI 940 parse failed: ${parsed.errors.join('; ')}`, warnings: parsed.warnings };
    }

    // Resolve customer
    let customerId: string | null = null;
    if (body.partnerId) {
      const partner = await prisma.tradingPartner.findUnique({
        where: { id: body.partnerId },
        select: { customerId: true },
      });
      customerId = partner?.customerId ?? null;
    }
    if (!customerId) {
      // Try the SF (ship-from) address as the depositor
      const sf = parsed.addresses.find(a => a.partyQualifier === 'SF');
      if (sf) {
        const cust = await prisma.customer.findFirst({
          where: { OR: [sf.idCode ? { id: sf.idCode } : {}, { name: sf.name }].filter(v => Object.keys(v).length > 0) },
          select: { id: true },
        });
        customerId = cust?.id ?? null;
      }
    }
    if (!customerId) {
      reply.code(400);
      return { data: null, error: 'Cannot identify depositor customer from partnerId or SF party on 940', parsed };
    }

    if (body.previewOnly) {
      return { data: { parsed, customerId, warnings: parsed.warnings }, error: null };
    }

    // Build destination (ShipTo) location - either match existing or return raw address
    const shipTo = parsed.addresses.find(a => a.partyQualifier === 'ST');
    if (!shipTo) {
      reply.code(400);
      return { data: null, error: 'EDI 940 is missing a ship-to (N1*ST) address', parsed };
    }
    const existingDest = await prisma.location.findFirst({
      where: {
        name: shipTo.name,
        city: shipTo.city ?? undefined,
        postalCode: shipTo.postalCode ?? undefined,
      },
      select: { id: true },
    });

    const orderNumber = parsed.depositorOrderNumber || `940-${Date.now()}`;
    const actorId = (req as any).userId || 'edi-940-inbound';
    const orgId = (req as any).orgId || (await prisma.organization.findFirst({ select: { id: true } }))?.id || 'default-org';

    const orderData: any = {
      orderNumber,
      poNumber: parsed.purchaseOrderNumber || undefined,
      customerId,
      importSource: 'edi_940',
      ediData: {
        depositorOrderNumber: parsed.depositorOrderNumber,
        purposeCode: parsed.purposeCode,
        shipperReference: parsed.shipperReference,
        requestedShipDate: parsed.requestedShipDate,
        cancelIfLateDate: parsed.cancelIfLateDate,
        carrierScac: parsed.carrierScac,
        serviceLevel: parsed.serviceLevel,
      },
      requestedPickupDate: parsed.requestedShipDate ? new Date(parsed.requestedShipDate) : undefined,
      specialInstructions: parsed.notes || undefined,
      lineItems: parsed.lines.map(line => ({
        sku: line.sku,
        description: line.description,
        quantity: line.orderedQuantity,
        unit: line.uomCode,
      })),
    };

    if (existingDest) orderData.destinationId = existingDest.id;
    else orderData.destinationData = {
      name: shipTo.name,
      address1: shipTo.address1,
      city: shipTo.city,
      state: shipTo.state,
      postalCode: shipTo.postalCode,
      country: shipTo.country,
    };

    const result = await commandBus.dispatch({
      type: CREATE_ORDER,
      orgId, actorId,
      payload: { orderData, status: 'pending' },
      metadata: { correlationId: crypto.randomUUID(), source: 'edi-940' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error, parsed };
    }

    reply.code(201);
    return { data: { order: result.data, warnings: parsed.warnings }, error: null };
  });

  // POST /api/v1/edi/940/preview — parse-only view for debugging
  server.post('/api/v1/edi/940/preview', {
    schema: {
      tags: ['EDI - Warehouse Shipping (940/945)'],
      summary: 'Parse an EDI 940 and return structured data without creating anything',
      body: { type: 'object', required: ['content'], properties: { content: { type: 'string' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ content: z.string().min(1) }).parse((req as any).body);
    const parsed = parseService.parseEDI940(body.content);
    if (!parsed.success) { reply.code(400); return { data: null, error: parsed.errors.join('; '), parsed }; }
    return { data: parsed, error: null };
  });

  // POST /api/v1/edi/945/generate — manually generate a 945 for a shipment
  server.post('/api/v1/edi/945/generate', {
    schema: {
      tags: ['EDI - Warehouse Shipping (940/945)'],
      summary: 'Generate an EDI 945 Warehouse Shipping Advice for a shipment',
      body: {
        type: 'object', required: ['shipmentId'],
        properties: {
          shipmentId: { type: 'string', format: 'uuid' },
          senderId: { type: 'string' },
          receiverId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      shipmentId: z.string().uuid(),
      senderId: z.string().optional(),
      receiverId: z.string().optional(),
    }).parse((req as any).body);

    const shipment = await prisma.shipment.findUnique({
      where: { id: body.shipmentId },
      include: {
        origin: true,
        destination: true,
        customer: true,
        carrier: true,
        orderShipments: { include: { order: { include: { lineItems: true, trackableUnits: true } } } },
      },
    });
    if (!shipment) { reply.code(404); return { data: null, error: 'Shipment not found' }; }

    const data = buildEDI945DataFromShipment(shipment);
    const result = generateService.validateAndGenerate(data, {
      senderId: body.senderId,
      receiverId: body.receiverId,
    });
    if (!result.success) { reply.code(400); return { data: null, error: result.errors.join('; '), warnings: result.warnings }; }
    return { data: { content: result.data, warnings: result.warnings }, error: null };
  });
}

/**
 * Assemble EDI945Data from a Shipment + associated Orders. Uses the first order
 * as the authoritative "depositor order" reference; additional orders merge their
 * line items into the same 945.
 */
export function buildEDI945DataFromShipment(shipment: any): EDI945Data {
  const primaryOrder = shipment.orderShipments[0]?.order;
  const depositorOrderNumber = primaryOrder?.ediData?.depositorOrderNumber
    || primaryOrder?.orderNumber
    || shipment.reference;

  const addresses: EDI945Address[] = [];
  if (shipment.destination) {
    addresses.push({
      partyQualifier: 'ST',
      name: shipment.destination.name,
      address1: shipment.destination.address1 ?? undefined,
      city: shipment.destination.city ?? undefined,
      state: shipment.destination.state ?? undefined,
      postalCode: shipment.destination.postalCode ?? undefined,
      country: shipment.destination.country ?? undefined,
    });
  }
  if (shipment.origin) {
    addresses.push({
      partyQualifier: 'WH',
      name: shipment.origin.name,
      address1: shipment.origin.address1 ?? undefined,
      city: shipment.origin.city ?? undefined,
      state: shipment.origin.state ?? undefined,
      postalCode: shipment.origin.postalCode ?? undefined,
      country: shipment.origin.country ?? undefined,
    });
  }
  if (shipment.customer) {
    addresses.push({
      partyQualifier: 'SF',
      name: shipment.customer.name,
      idCode: shipment.customer.id,
    });
  }

  const lines: EDI945LineData[] = [];
  let lineNumber = 1;
  for (const os of shipment.orderShipments) {
    const order = os.order;
    if (!order) continue;
    for (const li of order.lineItems ?? []) {
      lines.push({
        lineNumber: lineNumber++,
        sku: li.sku,
        orderedQuantity: li.quantity,
        shippedQuantity: li.quantity, // assume fully shipped; pack task can refine
        uomCode: li.unit || 'EA',
        description: li.description || undefined,
        trackingNumber: shipment.trackingNumber || undefined,
      });
    }
  }

  return {
    depositorOrderNumber,
    shipDate: shipment.updatedAt instanceof Date ? shipment.updatedAt : new Date(),
    addresses,
    lines,
    reportingCode: 'N',
    carrier: shipment.carrier
      ? {
          scac: shipment.carrier.scacCode ?? undefined,
          transportationMethodCode: 'M',
          trackingNumber: shipment.trackingNumber ?? undefined,
        }
      : undefined,
  };
}
