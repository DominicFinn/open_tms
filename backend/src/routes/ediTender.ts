import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ITenderRepository } from '../repositories/TenderRepository.js';
import { ITenderService } from '../services/TenderService.js';
import { ITradingPartnerRepository } from '../repositories/TradingPartnerRepository.js';
import { EDI204Service, EDI204ShipmentData } from '../services/EDI204Service.js';
import { EDI990ParseService } from '../services/EDI990ParseService.js';
import { container, TOKENS } from '../di/index.js';
import { PrismaClient } from '@prisma/client';

export async function ediTenderRoutes(server: FastifyInstance) {
  const tenderRepo = container.resolve<ITenderRepository>(TOKENS.ITenderRepository);
  const tenderService = container.resolve<ITenderService>(TOKENS.ITenderService);
  const tradingPartnerRepo = container.resolve<ITradingPartnerRepository>(TOKENS.ITradingPartnerRepository);
  const prisma = container.resolve<PrismaClient>(TOKENS.PrismaClient);
  const edi204Service = new EDI204Service();
  const edi990Parser = new EDI990ParseService();

  // Preview EDI 204 for a tender offer
  server.post('/api/v1/edi/tender/204/preview', {
    schema: {
      tags: ['EDI Tender'],
      summary: 'Preview EDI 204 document for a tender offer',
      body: {
        type: 'object',
        required: ['tenderOfferId'],
        properties: {
          tenderOfferId: { type: 'string' },
          senderId: { type: 'string' },
          receiverId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { tenderOfferId, senderId, receiverId } = z.object({
      tenderOfferId: z.string().min(1),
      senderId: z.string().optional(),
      receiverId: z.string().optional(),
    }).parse((req as any).body);

    const offer = await tenderRepo.findOfferById(tenderOfferId);
    if (!offer) {
      reply.code(404);
      return { data: null, error: 'Tender offer not found' };
    }

    const tender = await tenderRepo.findById((offer as any).tenderId);
    if (!tender) {
      reply.code(404);
      return { data: null, error: 'Tender not found' };
    }

    // Build shipment data for EDI 204
    const shipment: any = await prisma.shipment.findUnique({
      where: { id: tender.shipmentId },
      include: {
        origin: true,
        destination: true,
        stops: { include: { location: true }, orderBy: { sequenceNumber: 'asc' } },
        orderShipments: {
          include: { order: true },
        },
      },
    });

    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    const carrierScac = (offer as any).carrier?.scacCode || 'UNKN';
    const mustRespondBy = offer.expiresAt || new Date(Date.now() + tender.tenderDurationMinutes * 60 * 1000);

    // Calculate total weight
    let totalWeight = 0;
    for (const os of shipment.orderShipments || []) {
      totalWeight += os.order?.totalWeightLbs || os.order?.totalWeightKg || 0;
    }

    const edi204Data: EDI204ShipmentData = {
      shipmentReference: shipment.reference,
      pickupDate: shipment.pickupDate,
      deliveryDate: shipment.deliveryDate,
      origin: {
        name: shipment.origin.name,
        address1: shipment.origin.address1,
        address2: shipment.origin.address2,
        city: shipment.origin.city,
        state: shipment.origin.state,
        postalCode: shipment.origin.postalCode,
        country: shipment.origin.country,
      },
      destination: {
        name: shipment.destination.name,
        address1: shipment.destination.address1,
        address2: shipment.destination.address2,
        city: shipment.destination.city,
        state: shipment.destination.state,
        postalCode: shipment.destination.postalCode,
        country: shipment.destination.country,
      },
      stops: (shipment.stops || [])
        .filter((s: any) => s.stopType !== 'pickup' || s.sequenceNumber > 1)
        .map((s: any) => ({
          sequenceNumber: s.sequenceNumber,
          stopType: s.stopType,
          location: {
            name: s.location.name,
            address1: s.location.address1,
            city: s.location.city,
            state: s.location.state,
            postalCode: s.location.postalCode,
            country: s.location.country,
          },
        })),
      carrierScac,
      mustRespondBy,
      equipmentType: tender.equipmentType || undefined,
      specialInstructions: tender.specialInstructions || undefined,
      totalWeight: totalWeight || undefined,
    };

    const ediContent = edi204Service.generateEDI204(edi204Data, {
      senderId: senderId,
      receiverId: receiverId || carrierScac,
    });

    return { data: { ediContent, tenderReference: tender.reference }, error: null };
  });

  // Receive inbound EDI 990
  server.post('/api/v1/edi/tender/990', {
    schema: {
      tags: ['EDI Tender'],
      summary: 'Receive inbound EDI 990 (Response to Load Tender)',
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { content, partnerId, fileName } = z.object({
      content: z.string().min(1),
      partnerId: z.string().optional(),
      fileName: z.string().optional(),
    }).parse((req as any).body);

    // Create transaction log entry
    const logEntry = await tradingPartnerRepo.createLog({
      partnerId: partnerId || null,
      transactionType: '990',
      direction: 'inbound',
      fileName: fileName || 'edi990_inbound.edi',
      fileSize: content.length,
      fileContent: content,
      transport: 'api',
      status: 'processing',
      source: partnerId ? 'sftp' : 'api',
    });

    const result = edi990Parser.parseEDI990(content);

    if (!result.success) {
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'error',
        errorMessage: result.errors.join('; '),
        processedAt: new Date(),
      });
      reply.code(400);
      return { data: null, error: `EDI 990 parse failed: ${result.errors.join('; ')}` };
    }

    // Find matching tender offer by shipment reference and carrier SCAC
    const tenders = await tenderRepo.findAll({ status: 'open' });
    let matchedOffer: any = null;
    let matchedTender: any = null;

    for (const tender of tenders) {
      if (tender.shipment.reference === result.shipmentReference) {
        const offer = tender.offers.find(o =>
          (o.carrier as any).scacCode === result.carrierScac &&
          ['sent', 'viewed'].includes(o.status)
        );
        if (offer) {
          matchedOffer = offer;
          matchedTender = tender;
          break;
        }
      }
    }

    if (!matchedOffer || !matchedTender) {
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'error',
        errorMessage: `No matching open tender offer found for shipment ${result.shipmentReference} / carrier ${result.carrierScac}`,
        shipmentReference: result.shipmentReference,
        processedAt: new Date(),
      });
      reply.code(404);
      return {
        data: null,
        error: `No matching open tender offer found for shipment ${result.shipmentReference} / carrier ${result.carrierScac}`,
      };
    }

    // Process response
    if (result.responseCode === 'A') {
      // Accept - create a bid at the target rate
      const bid = await tenderService.submitBid({
        tenderOfferId: matchedOffer.id,
        carrierId: matchedOffer.carrierId,
        rate: matchedTender.targetRate || 0,
        sourceType: 'edi_990',
        edi990Content: content,
      });
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'success',
        tenderId: matchedTender.id,
        shipmentReference: result.shipmentReference,
        processedAt: new Date(),
        entitiesCreated: 1,
        entityIds: [bid.id],
      });
      return {
        data: {
          action: 'accepted',
          bidId: bid.id,
          tenderReference: matchedTender.reference,
          carrierScac: result.carrierScac,
          logId: logEntry.id,
        },
        error: null,
      };
    } else if (result.responseCode === 'D') {
      // Decline - mark offer as expired and progress waterfall
      await tenderService.declineTenderOffer(matchedOffer.id, matchedOffer.carrierId);
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'success',
        tenderId: matchedTender.id,
        shipmentReference: result.shipmentReference,
        processedAt: new Date(),
      });
      return {
        data: {
          action: 'declined',
          tenderReference: matchedTender.reference,
          carrierScac: result.carrierScac,
          logId: logEntry.id,
        },
        error: null,
      };
    } else {
      await tradingPartnerRepo.updateLog(logEntry.id, {
        status: 'error',
        errorMessage: `Unknown response code: ${result.responseCode}`,
        processedAt: new Date(),
      });
      reply.code(400);
      return { data: null, error: `Unknown response code: ${result.responseCode}` };
    }
  });
}
