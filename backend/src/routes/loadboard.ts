import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { optionalAuth } from '../middleware/jwtAuth.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

export async function loadboardRoutes(server: FastifyInstance) {
  // Apply optional auth to all loadboard routes (permissions checked when token present)
  server.addHook('preHandler', optionalAuth);
  // The org-scope hook runs after optionalAuth so it can read the JWT;
  // for unauthed callers it falls through to the first Organization.
  await registerOrgScope(server);

  // Get load board shipments (unassigned to carrier)
  server.get('/api/v1/loadboard', {
    schema: {
      tags: ['Load Board'],
      description: 'List shipments available for carrier assignment (no carrier assigned)',
      querystring: {
        type: 'object',
        properties: {
          customerId: { type: 'string' },
          laneId: { type: 'string' },
          equipmentType: { type: 'string' },
          dateFrom: { type: 'string', format: 'date' },
          dateTo: { type: 'string', format: 'date' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as {
      customerId?: string;
      laneId?: string;
      equipmentType?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    // Multi-tenancy: scope every load-board read to the requesting tenant.
    // Unauthed callers see the default Organization's loadboard (matches
    // legacy single-tenant behaviour) — they can't cross-tenant probe.
    const orgId = req.orgId!;
    const where: any = {
      orgId,
      archived: false,
      carrierId: null,
      status: { in: ['booked', 'confirmed', 'ready', 'pending'] },
    };

    if (query.customerId) where.customerId = query.customerId;
    if (query.laneId) where.laneId = query.laneId;
    if (query.dateFrom || query.dateTo) {
      where.pickupDate = {};
      if (query.dateFrom) where.pickupDate.gte = new Date(query.dateFrom);
      if (query.dateTo) where.pickupDate.lte = new Date(query.dateTo);
    }

    const shipments = await server.prisma.shipment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        origin: { select: { id: true, name: true, city: true, state: true } },
        destination: { select: { id: true, name: true, city: true, state: true } },
        lane: { select: { id: true, name: true } },
        shipmentFinancialSummary: {
          select: {
            expectedRevenueCents: true,
            expectedCostCents: true,
            expectedMarginCents: true,
          },
        },
        tenders: {
          select: { id: true, status: true, strategy: true },
          where: { status: { in: ['draft', 'open', 'evaluating'] } },
        },
      },
      orderBy: [{ pickupDate: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });

    // Strip financial data for unauthenticated users
    const results = req.user
      ? shipments
      : shipments.map(({ shipmentFinancialSummary, ...rest }) => rest);

    return { data: results, error: null };
  });

  // Get matching carriers for a load board shipment
  server.get('/api/v1/loadboard/:shipmentId/matching-carriers', {
    schema: {
      tags: ['Load Board'],
      description: 'Find carriers that can serve a shipment based on lane history and rates',
      params: {
        type: 'object',
        properties: {
          shipmentId: { type: 'string' },
        },
        required: ['shipmentId'],
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };

    // Cross-tenant guard: findFirst so the where clause can include orgId.
    const orgId = req.orgId!;
    const shipment = await server.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId },
      select: {
        id: true,
        laneId: true,
        origin: { select: { id: true, name: true, city: true, state: true } },
        destination: { select: { id: true, name: true, city: true, state: true } },
      },
    });

    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    // Find carriers with rates on the same lane
    let laneCarriers: any[] = [];
    if (shipment.laneId) {
      laneCarriers = await server.prisma.laneCarrier.findMany({
        where: { laneId: shipment.laneId },
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              mcNumber: true,
              contactName: true,
              contactEmail: true,
              contactPhone: true,
              scacCode: true,
              archived: true,
            },
          },
        },
        take: 500,
      });
    }

    // Also find carriers that have previously been assigned to shipments on the same lane
    let historicalCarriers: any[] = [];
    if (shipment.laneId) {
      const historicalShipments = await server.prisma.shipment.findMany({
        where: {
          orgId,
          laneId: shipment.laneId,
          carrierId: { not: null },
          id: { not: shipmentId },
        },
        select: {
          carrierId: true,
          carrier: {
            select: { id: true, name: true, mcNumber: true, contactName: true, contactEmail: true, contactPhone: true, scacCode: true, archived: true },
          },
        },
        distinct: ['carrierId'],
        take: 20,
      });
      historicalCarriers = historicalShipments
        .filter(s => s.carrier && !s.carrier.archived)
        .map(s => s.carrier!);
    }

    // Compute tender acceptance stats per carrier (orgId already resolved above)
    const carrierIds = [
      ...laneCarriers.map(lc => lc.carrierId),
      ...historicalCarriers.map(c => c.id),
    ];
    const uniqueCarrierIds = [...new Set(carrierIds)];

    // Get tender bid stats for these carriers
    const tenderBids = await server.prisma.tenderBid.findMany({
      where: {
        carrierId: { in: uniqueCarrierIds },
      },
      select: {
        carrierId: true,
        status: true,
      },
      take: 500,
    });

    const bidStatsByCarrier: Record<string, { total: number; accepted: number }> = {};
    for (const bid of tenderBids) {
      if (!bidStatsByCarrier[bid.carrierId]) {
        bidStatsByCarrier[bid.carrierId] = { total: 0, accepted: 0 };
      }
      bidStatsByCarrier[bid.carrierId].total++;
      if (bid.status === 'accepted' || bid.status === 'awarded') {
        bidStatsByCarrier[bid.carrierId].accepted++;
      }
    }

    // Build the carrier list with rates and stats
    const carrierMap = new Map<string, any>();

    for (const lc of laneCarriers) {
      if (lc.carrier.archived) continue;
      const stats = bidStatsByCarrier[lc.carrierId] || { total: 0, accepted: 0 };
      carrierMap.set(lc.carrierId, {
        ...lc.carrier,
        laneRate: {
          priceCents: lc.priceCents,
          rateType: lc.rateType,
          fuelSurchargePercent: lc.fuelSurchargePercent,
          serviceLevel: lc.serviceLevel,
          isContractRate: lc.isContractRate,
        },
        tenderStats: {
          totalBids: stats.total,
          acceptedBids: stats.accepted,
          acceptanceRate: stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : null,
        },
        matchSource: 'lane_rate',
      });
    }

    for (const c of historicalCarriers) {
      if (!carrierMap.has(c.id)) {
        const stats = bidStatsByCarrier[c.id] || { total: 0, accepted: 0 };
        carrierMap.set(c.id, {
          ...c,
          laneRate: null,
          tenderStats: {
            totalBids: stats.total,
            acceptedBids: stats.accepted,
            acceptanceRate: stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : null,
          },
          matchSource: 'historical',
        });
      }
    }

    return {
      data: {
        shipmentId,
        laneId: shipment.laneId,
        origin: shipment.origin,
        destination: shipment.destination,
        carriers: Array.from(carrierMap.values()),
      },
      error: null,
    };
  });

  // Quick assign carrier to shipment from load board
  server.post('/api/v1/loadboard/:shipmentId/assign', {
    schema: {
      tags: ['Load Board'],
      description: 'Quick-assign a carrier to a shipment with an agreed cost rate',
      params: {
        type: 'object',
        properties: {
          shipmentId: { type: 'string' },
        },
        required: ['shipmentId'],
      },
      body: {
        type: 'object',
        properties: {
          carrierId: { type: 'string' },
          costRateCents: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['carrierId', 'costRateCents'],
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { shipmentId } = req.params as { shipmentId: string };
    const { carrierId, costRateCents, notes } = z.object({
      carrierId: z.string().uuid(),
      costRateCents: z.number().int().min(0),
      notes: z.string().optional(),
    }).parse(req.body);

    const orgId = req.orgId!;
    const shipment = await server.prisma.shipment.findFirst({
      where: { id: shipmentId, orgId },
      select: { id: true, carrierId: true, status: true, reference: true },
    });

    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    if (shipment.carrierId) {
      reply.code(400);
      return { data: null, error: 'Shipment already has a carrier assigned' };
    }

    const carrier = await server.prisma.carrier.findUnique({
      where: { id: carrierId },
      select: { id: true, name: true, archived: true },
    });

    if (!carrier || carrier.archived) {
      reply.code(400);
      return { data: null, error: 'Carrier not found or archived' };
    }

    // Assign carrier and create cost charge in a transaction
    const result = await server.prisma.$transaction(async (tx) => {
      // Assign carrier to shipment
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: { carrierId },
        include: {
          customer: true,
          origin: true,
          destination: true,
          carrier: true,
          lane: true,
          shipmentFinancialSummary: true,
        },
      });

      // Create cost charge (linehaul)
      await tx.charge.create({
        data: {
          orgId,
          shipmentId,
          chargeType: 'linehaul',
          chargeCategory: 'cost',
          description: `Carrier linehaul - ${carrier.name}`,
          amountCents: costRateCents,
          source: 'manual',
          status: 'approved',
          approvedAt: new Date(),
        },
      });

      // Update or create financial summary
      const existingSummary = await tx.shipmentFinancialSummary.findUnique({
        where: { shipmentId },
      });

      if (existingSummary) {
        await tx.shipmentFinancialSummary.update({
          where: { shipmentId },
          data: {
            expectedCostCents: costRateCents,
            expectedMarginCents: existingSummary.expectedRevenueCents - costRateCents,
            actualCostCents: costRateCents,
            actualMarginCents: existingSummary.actualRevenueCents - costRateCents,
          },
        });
      } else {
        await tx.shipmentFinancialSummary.create({
          data: {
            orgId,
            shipmentId,
            expectedCostCents: costRateCents,
            expectedMarginCents: -costRateCents,
            actualCostCents: costRateCents,
            actualMarginCents: -costRateCents,
          },
        });
      }

      return updated;
    });

    return { data: result, error: null };
  });
}
