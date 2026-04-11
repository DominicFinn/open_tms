import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { container, TOKENS } from '../di/index.js';
import { EDI214ParseService } from '../services/EDI214ParseService.js';
import { EDI214Service, EDI214ShipmentData } from '../services/EDI214Service.js';
import { EDI997Service } from '../services/EDI997Service.js';
import { IOutboundEdiDeliveryService } from '../services/OutboundEdiDeliveryService.js';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { PROCESS_INBOUND_214 } from '../commands/shipments/ProcessInbound214Command.js';
import { mapEdi214Status, getDefaultStatusMapping } from '../services/edi214StatusMapping.js';
import { CommandBus } from '../commands/CommandBus.js';
import crypto from 'crypto';

export async function edi214Routes(server: FastifyInstance) {
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const commandBus = container.resolve<CommandBus>(TOKENS.ICommandBus);
  const edi214Parser = new EDI214ParseService();
  const edi214Service = new EDI214Service();
  const edi997Service = container.resolve<EDI997Service>(TOKENS.IEDI997Service);
  const deliveryService = container.resolve<IOutboundEdiDeliveryService>(TOKENS.IOutboundEdiDeliveryService);
  const tradingPartnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);

  /**
   * POST /api/v1/edi/214/inbound — Receive inbound EDI 214 from carrier
   */
  server.post('/api/v1/edi/214/inbound', {
    schema: {
      tags: ['EDI 214'],
      summary: 'Receive inbound EDI 214 (Shipment Status Message)',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
          partnerId: { type: 'string' },
          fileName: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { content, partnerId, fileName } = z.object({
      content: z.string().min(1),
      partnerId: z.string().optional(),
      fileName: z.string().optional(),
    }).parse((req as any).body);

    // 1. Parse EDI 214
    const parseResult = edi214Parser.parseEDI214(content);

    if (!parseResult.success) {
      reply.code(400);
      return { data: null, error: `EDI 214 parse failed: ${parseResult.errors.join('; ')}` };
    }

    // 2. Find matching shipment by reference or pro number
    const shipment = await prisma.shipment.findFirst({
      where: {
        archived: false,
        OR: [
          { reference: parseResult.shipmentReference },
          { proNumber: parseResult.proNumber },
          ...(parseResult.shipmentReference ? [{ proNumber: parseResult.shipmentReference }] : []),
          ...(parseResult.proNumber ? [{ reference: parseResult.proNumber }] : []),
        ],
      },
      include: { carrier: true },
    });

    if (!shipment) {
      reply.code(404);
      return {
        data: null,
        error: `No matching shipment found for reference "${parseResult.shipmentReference}" / pro "${parseResult.proNumber}"`,
      };
    }

    // Use the most recent status detail (last AT7 in the document)
    const latestStatus = parseResult.statusDetails[parseResult.statusDetails.length - 1];

    // 3. Dispatch command to update shipment
    const result = await commandBus.dispatch({
      type: PROCESS_INBOUND_214,
      orgId: shipment.orgId,
      actorId: null,
      payload: {
        shipmentId: shipment.id,
        carrierScac: parseResult.carrierScac,
        proNumber: parseResult.proNumber,
        statusCode: latestStatus.statusCode,
        reasonCode: latestStatus.reasonCode || undefined,
        city: latestStatus.city,
        state: latestStatus.state,
        country: latestStatus.country || undefined,
        statusDate: latestStatus.date
          ? formatEdiDate(latestStatus.date, latestStatus.time)
          : new Date().toISOString(),
        rawEdiContent: content,
        tradingPartnerId: partnerId,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
        source: 'edi_214',
        idempotencyKey: computeFileHash(content),
      },
    });

    if (!result.success) {
      reply.code(500);
      return { data: null, error: result.error };
    }

    // 4. Log to EdiTransactionLog
    await prisma.ediTransactionLog.create({
      data: {
        partnerId: partnerId || undefined,
        transactionType: '214',
        direction: 'inbound',
        fileName: fileName || undefined,
        fileSize: content.length,
        fileContent: content,
        fileHash: computeFileHash(content),
        transport: 'http',
        status: 'success',
        processedAt: new Date(),
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
      },
    });

    // 5. Generate 997 acknowledgment if required
    let ack997Sent = false;
    if (partnerId) {
      const partner = await tradingPartnerRepo.findById(partnerId);
      if (partner) {
        const txn214 = (partner as any).transactions?.find(
          (t: any) => t.transactionType === '214' && t.direction === 'inbound'
        );
        if (txn214?.ack997Required) {
          try {
            const ack997Content = edi997Service.generate997({
              senderId: partner.senderId || 'OPENTMS',
              receiverId: partner.receiverId || parseResult.carrierScac,
              originalTransactionType: '214',
              originalControlNumber: '0001',
              accepted: true,
            });

            await deliveryService.deliver({
              partnerId,
              transactionType: '997',
              ediContent: ack997Content,
              referenceId: shipment.reference,
              shipmentId: shipment.id,
            });
            ack997Sent = true;
          } catch (err) {
            console.error('[EDI 214] Failed to send 997 acknowledgment:', (err as Error).message);
          }
        }
      }
    }

    const mapping = mapEdi214Status(latestStatus.statusCode) || getDefaultStatusMapping(latestStatus.statusCode);

    return {
      data: {
        action: mapping.eventDescription,
        shipmentId: shipment.id,
        shipmentReference: shipment.reference,
        statusCode: latestStatus.statusCode,
        statusApplied: mapping.shipmentStatus,
        ack997Sent,
      },
      error: null,
    };
  });

  /**
   * POST /api/v1/edi/214/generate — Generate and deliver outbound EDI 214
   */
  server.post('/api/v1/edi/214/generate', {
    schema: {
      tags: ['EDI 214'],
      summary: 'Generate and deliver outbound EDI 214 (Shipment Status) to trading partner',
      body: {
        type: 'object',
        required: ['shipmentId', 'statusCode'],
        properties: {
          shipmentId: { type: 'string' },
          statusCode: { type: 'string' },
          partnerId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId, statusCode, partnerId } = z.object({
      shipmentId: z.string().min(1),
      statusCode: z.string().min(1),
      partnerId: z.string().optional(),
    }).parse((req as any).body);

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        carrier: true,
      },
    });

    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const ediData: EDI214ShipmentData = {
      shipmentReference: shipment.reference,
      proNumber: shipment.proNumber || undefined,
      carrierScac: shipment.carrier?.scacCode || 'UNKN',
      statusCode,
      city: shipment.destination?.city || '',
      state: shipment.destination?.state || '',
      country: shipment.destination?.country || 'US',
      statusDate: new Date(),
    };

    // Find partner to deliver to
    let targetPartnerId = partnerId;
    if (!targetPartnerId) {
      // Auto-detect: find customer trading partner with outbound 214
      const partners = await prisma.tradingPartner.findMany({
        where: {
          active: true,
          outboundEnabled: true,
          customerId: shipment.customerId,
          transactions: { some: { transactionType: '214', direction: 'outbound', enabled: true } },
        },
        include: { transactions: true },
      });
      if (partners.length > 0) {
        targetPartnerId = partners[0].id;
      }
    }

    const partner = targetPartnerId ? await tradingPartnerRepo.findById(targetPartnerId) : null;

    const ediContent = edi214Service.generateEDI214(ediData, {
      senderId: partner?.senderId || 'OPENTMS',
      receiverId: partner?.receiverId || ediData.carrierScac,
    });

    let delivered = false;
    let logId: string | undefined;

    if (targetPartnerId) {
      try {
        const deliveryResult = await deliveryService.deliver({
          partnerId: targetPartnerId,
          transactionType: '214',
          ediContent,
          referenceId: shipment.reference,
          shipmentId,
        });
        delivered = deliveryResult?.success ?? false;
        logId = deliveryResult?.logId;
      } catch (err) {
        console.error('[EDI 214] Delivery failed:', (err as Error).message);
      }
    }

    return {
      data: {
        ediContent,
        delivered,
        logId,
        partnerId: targetPartnerId || null,
      },
      error: null,
    };
  });

  /**
   * POST /api/v1/edi/214/preview — Preview outbound EDI 214 without delivering
   */
  server.post('/api/v1/edi/214/preview', {
    schema: {
      tags: ['EDI 214'],
      summary: 'Preview outbound EDI 214 content without delivering',
      body: {
        type: 'object',
        required: ['shipmentId', 'statusCode'],
        properties: {
          shipmentId: { type: 'string' },
          statusCode: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId, statusCode } = z.object({
      shipmentId: z.string().min(1),
      statusCode: z.string().min(1),
    }).parse((req as any).body);

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        carrier: true,
      },
    });

    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const ediContent = edi214Service.generateEDI214({
      shipmentReference: shipment.reference,
      proNumber: shipment.proNumber || undefined,
      carrierScac: shipment.carrier?.scacCode || 'UNKN',
      statusCode,
      city: shipment.destination?.city || '',
      state: shipment.destination?.state || '',
      country: shipment.destination?.country || 'US',
      statusDate: new Date(),
    });

    return {
      data: { ediContent, shipmentReference: shipment.reference },
      error: null,
    };
  });
}

/** Convert EDI date (CCYYMMDD) + time (HHMM) to ISO-8601 */
function formatEdiDate(date: string, time?: string): string {
  if (date.length !== 8) return new Date().toISOString();
  const y = date.substring(0, 4);
  const m = date.substring(4, 6);
  const d = date.substring(6, 8);
  const h = time?.substring(0, 2) || '00';
  const min = time?.substring(2, 4) || '00';
  return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`).toISOString();
}

/** SHA-256 hash for deduplication */
function computeFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
