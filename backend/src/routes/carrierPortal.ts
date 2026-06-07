import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ICarrierAuthService } from '../services/CarrierAuthService.js';
import { ITenderService } from '../services/TenderService.js';
import { ITenderRepository } from '../repositories/TenderRepository.js';
import { authenticateCarrierJWT } from '../middleware/jwtAuth.js';
import { container, TOKENS } from '../di/index.js';
import { attachOrgScopeFromCarrierUserHook } from '../auth/orgScopeMiddleware.js';

export async function carrierPortalRoutes(server: FastifyInstance) {
  const authService = container.resolve<ICarrierAuthService>(TOKENS.ICarrierAuthService);
  const tenderService = container.resolve<ITenderService>(TOKENS.ITenderService);
  const tenderRepo = container.resolve<ITenderRepository>(TOKENS.ITenderRepository);

  // Multi-tenancy: resolve req.orgId by walking carrierUser.carrierId →
  // Carrier.orgId. Runs after authenticateCarrierJWT (declared per-route
  // in preHandler), so req.carrierUser is populated when this fires.
  server.addHook('preHandler', attachOrgScopeFromCarrierUserHook(server.prisma));

  // ── Auth (no middleware needed) ──

  server.post('/api/v1/carrier-portal/login', {
    schema: {
      tags: ['Carrier Portal'],
      summary: 'Carrier user login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse((req as any).body);

    try {
      const result = await authService.login(email, password);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(401);
      return { data: null, error: err.message };
    }
  });

  // ── Protected routes (carrier JWT required) ──

  // Get profile
  server.get('/api/v1/carrier-portal/profile', {
    schema: { tags: ['Carrier Portal'], summary: 'Get carrier user profile' },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const carrier = (req as any).carrierUser;
    return {
      data: {
        id: carrier.sub,
        email: carrier.email,
        carrierId: carrier.carrierId,
        carrierName: carrier.carrierName,
        role: carrier.role,
      },
      error: null,
    };
  });

  // Change password
  server.post('/api/v1/carrier-portal/change-password', {
    schema: {
      tags: ['Carrier Portal'],
      summary: 'Change own password',
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = (req as any).carrierUser.sub;
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse((req as any).body);

    try {
      await authService.changePassword(userId, currentPassword, newPassword);
      return { data: { changed: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // List active tenders for this carrier
  server.get('/api/v1/carrier-portal/tenders', {
    schema: { tags: ['Carrier Portal'], summary: 'List active tenders for this carrier' },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const carrierId = (req as any).carrierUser.carrierId;
    const offers = await tenderService.getActiveTendersForCarrier(carrierId);
    return { data: offers, error: null };
  });

  // View tender details (marks as viewed)
  server.get('/api/v1/carrier-portal/tenders/:id', {
    schema: { tags: ['Carrier Portal'], summary: 'View tender details' },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const carrierId = (req as any).carrierUser.carrierId;
    try {
      const result = await tenderService.getTenderForCarrier(id, carrierId);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(404);
      return { data: null, error: err.message };
    }
  });

  // Submit a bid
  server.post('/api/v1/carrier-portal/tenders/:id/bid', {
    schema: {
      tags: ['Carrier Portal'],
      summary: 'Submit a bid on a tender',
      body: {
        type: 'object',
        required: ['rate'],
        properties: {
          rate: { type: 'number', minimum: 0 },
          currency: { type: 'string' },
          transitDays: { type: 'number', minimum: 1 },
          equipmentType: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: tenderId } = req.params as { id: string };
    const carrierUser = (req as any).carrierUser;
    const body = z.object({
      rate: z.number().positive(),
      currency: z.string().optional(),
      transitDays: z.number().int().positive().optional(),
      equipmentType: z.string().optional(),
      notes: z.string().optional(),
    }).parse((req as any).body);

    try {
      // Find the offer for this carrier on this tender
      const tender = await tenderRepo.findById(tenderId);
      if (!tender) {
        reply.code(404);
        return { data: null, error: 'Tender not found' };
      }
      const offer = tender.offers.find(o => o.carrierId === carrierUser.carrierId);
      if (!offer) {
        reply.code(403);
        return { data: null, error: 'No tender offer for this carrier' };
      }

      const bid = await tenderService.submitBid({
        tenderOfferId: offer.id,
        carrierId: carrierUser.carrierId,
        rate: body.rate,
        currency: body.currency,
        transitDays: body.transitDays,
        equipmentType: body.equipmentType,
        notes: body.notes,
        submittedById: carrierUser.sub,
        sourceType: 'portal',
      });

      reply.code(201);
      return { data: bid, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // Decline a tender
  server.post('/api/v1/carrier-portal/tenders/:id/decline', {
    schema: { tags: ['Carrier Portal'], summary: 'Decline a tender offer' },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id: tenderId } = req.params as { id: string };
    const carrierId = (req as any).carrierUser.carrierId;

    try {
      const tender = await tenderRepo.findById(tenderId);
      if (!tender) {
        reply.code(404);
        return { data: null, error: 'Tender not found' };
      }
      const offer = tender.offers.find(o => o.carrierId === carrierId);
      if (!offer) {
        reply.code(403);
        return { data: null, error: 'No tender offer for this carrier' };
      }

      await tenderService.declineTenderOffer(offer.id, carrierId);
      return { data: { declined: true }, error: null };
    } catch (err: any) {
      reply.code(400);
      return { data: null, error: err.message };
    }
  });

  // View my bid history
  server.get('/api/v1/carrier-portal/bids', {
    schema: { tags: ['Carrier Portal'], summary: 'View my bid history' },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const carrierId = (req as any).carrierUser.carrierId;
    const bids = await tenderRepo.findBidsByCarrierId(carrierId);
    return { data: bids, error: null };
  });

  // View all tender offers (full history: won, lost, expired, declined, etc.)
  server.get('/api/v1/carrier-portal/history', {
    schema: { tags: ['Carrier Portal'], summary: 'View full tender history for this carrier' },
    preHandler: [authenticateCarrierJWT],
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const carrierId = (req as any).carrierUser.carrierId;
    const offers = await tenderRepo.findAllOffersForCarrier(carrierId);

    // Enrich each offer with an outcome label
    const history = offers.map((offer: any) => {
      let outcome: string;
      const bid = offer.bids?.[0];
      if (bid?.status === 'accepted') outcome = 'won';
      else if (bid?.status === 'rejected') outcome = 'lost';
      else if (bid?.status === 'submitted') outcome = 'pending';
      else if (offer.status === 'expired') outcome = 'expired';
      else if (offer.status === 'cancelled') outcome = 'cancelled';
      else if (offer.status === 'sent' || offer.status === 'viewed') outcome = 'active';
      else outcome = offer.status;

      return {
        ...offer,
        outcome,
        bidRate: bid?.rate ?? null,
        bidStatus: bid?.status ?? null,
        tenderStatus: offer.tender?.status,
        tenderReference: offer.tender?.reference,
        route: offer.tender?.shipment
          ? `${offer.tender.shipment.origin.city}${offer.tender.shipment.origin.state ? ', ' + offer.tender.shipment.origin.state : ''} → ${offer.tender.shipment.destination.city}${offer.tender.shipment.destination.state ? ', ' + offer.tender.shipment.destination.state : ''}`
          : null,
        customerName: offer.tender?.shipment?.customer?.name ?? null,
      };
    });

    return { data: history, error: null };
  });
}
