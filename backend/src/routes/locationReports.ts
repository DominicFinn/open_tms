import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function locationReportRoutes(server: FastifyInstance) {
  /**
   * GET /api/v1/reports/locations/activity
   *
   * Returns per-location activity data: inbound/outbound shipment and order counts,
   * plus a breakdown by location type. Supports optional date filtering.
   */
  server.get('/api/v1/reports/locations/activity', {
    schema: {
      description: 'Location activity report — shipment/order counts per location, type breakdown, and upcoming arrivals/departures.',
      tags: ['Reports', 'Locations'],
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date (YYYY-MM-DD)', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          to: { type: 'string', description: 'End date (YYYY-MM-DD)', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          locationType: { type: 'string', description: 'Filter by location type' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { from, to, locationType } = req.query as {
      from?: string;
      to?: string;
      locationType?: string;
    };

    const dateFrom = from ? new Date(from + 'T00:00:00Z') : undefined;
    const dateTo = to ? new Date(to + 'T23:59:59Z') : undefined;

    const dateFilter: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) (dateFilter.createdAt as any).gte = dateFrom;
      if (dateTo) (dateFilter.createdAt as any).lte = dateTo;
    }

    // Fetch active locations with optional type filter
    const locationWhere: Record<string, unknown> = { archived: false };
    if (locationType) locationWhere.locationType = locationType;

    const locations = await server.prisma.location.findMany({
      where: locationWhere,
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        country: true,
        locationType: true,
        appointmentRequired: true,
      },
      orderBy: { name: 'asc' },
      take: 10000,
    });

    const locationIds = locations.map(l => l.id);

    // Count shipments per origin and destination location
    const shipmentOriginFilter: Record<string, unknown> = {
      originId: { in: locationIds },
      archived: false,
    };
    const shipmentDestFilter: Record<string, unknown> = {
      destinationId: { in: locationIds },
      archived: false,
    };
    if (dateFrom || dateTo) {
      const createdAt: Record<string, unknown> = {};
      if (dateFrom) createdAt.gte = dateFrom;
      if (dateTo) createdAt.lte = dateTo;
      shipmentOriginFilter.createdAt = createdAt;
      shipmentDestFilter.createdAt = { ...createdAt };
    }

    const [outboundCounts, inboundCounts] = await Promise.all([
      server.prisma.shipment.groupBy({
        by: ['originId'],
        where: shipmentOriginFilter,
        _count: { id: true },
      }),
      server.prisma.shipment.groupBy({
        by: ['destinationId'],
        where: shipmentDestFilter,
        _count: { id: true },
      }),
    ]);

    // Count orders per origin and destination location
    const orderOriginFilter: Record<string, unknown> = {
      originId: { in: locationIds },
      archived: false,
    };
    const orderDestFilter: Record<string, unknown> = {
      destinationId: { in: locationIds },
      archived: false,
    };
    if (dateFrom || dateTo) {
      const createdAt: Record<string, unknown> = {};
      if (dateFrom) createdAt.gte = dateFrom;
      if (dateTo) createdAt.lte = dateTo;
      orderOriginFilter.createdAt = createdAt;
      orderDestFilter.createdAt = { ...createdAt };
    }

    const [orderOutboundCounts, orderInboundCounts] = await Promise.all([
      server.prisma.order.groupBy({
        by: ['originId'],
        where: orderOriginFilter,
        _count: { id: true },
      }),
      server.prisma.order.groupBy({
        by: ['destinationId'],
        where: orderDestFilter,
        _count: { id: true },
      }),
    ]);

    // Count shipments currently in transit to each destination
    const inTransitCounts = await server.prisma.shipment.groupBy({
      by: ['destinationId'],
      where: {
        destinationId: { in: locationIds },
        status: 'in_transit',
        archived: false,
      },
      _count: { id: true },
    });

    // Build lookup maps
    const outMap = new Map(outboundCounts.map(r => [r.originId, r._count.id]));
    const inMap = new Map(inboundCounts.map(r => [r.destinationId, r._count.id]));
    const orderOutMap = new Map(orderOutboundCounts.map(r => [r.originId, r._count.id]));
    const orderInMap = new Map(orderInboundCounts.map(r => [r.destinationId, r._count.id]));
    const transitMap = new Map(inTransitCounts.map(r => [r.destinationId, r._count.id]));

    // Build per-location activity rows
    const locationActivity = locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      city: loc.city,
      state: loc.state,
      country: loc.country,
      locationType: loc.locationType,
      appointmentRequired: loc.appointmentRequired,
      shipmentsOutbound: outMap.get(loc.id) || 0,
      shipmentsInbound: inMap.get(loc.id) || 0,
      ordersOutbound: orderOutMap.get(loc.id) || 0,
      ordersInbound: orderInMap.get(loc.id) || 0,
      shipmentsInTransitTo: transitMap.get(loc.id) || 0,
    }));

    // Build type breakdown
    const typeBreakdown: Record<string, { count: number; shipmentsInbound: number; shipmentsOutbound: number; ordersInbound: number; ordersOutbound: number }> = {};
    for (const loc of locationActivity) {
      const t = loc.locationType || 'unclassified';
      if (!typeBreakdown[t]) {
        typeBreakdown[t] = { count: 0, shipmentsInbound: 0, shipmentsOutbound: 0, ordersInbound: 0, ordersOutbound: 0 };
      }
      typeBreakdown[t].count++;
      typeBreakdown[t].shipmentsInbound += loc.shipmentsInbound;
      typeBreakdown[t].shipmentsOutbound += loc.shipmentsOutbound;
      typeBreakdown[t].ordersInbound += loc.ordersInbound;
      typeBreakdown[t].ordersOutbound += loc.ordersOutbound;
    }

    // Summary totals
    const summary = {
      totalLocations: locations.length,
      totalShipmentsInbound: locationActivity.reduce((s, l) => s + l.shipmentsInbound, 0),
      totalShipmentsOutbound: locationActivity.reduce((s, l) => s + l.shipmentsOutbound, 0),
      totalOrdersInbound: locationActivity.reduce((s, l) => s + l.ordersInbound, 0),
      totalOrdersOutbound: locationActivity.reduce((s, l) => s + l.ordersOutbound, 0),
      totalInTransit: locationActivity.reduce((s, l) => s + l.shipmentsInTransitTo, 0),
    };

    return {
      data: {
        summary,
        typeBreakdown,
        locations: locationActivity,
      },
      error: null,
    };
  });
}
