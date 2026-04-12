/**
 * Map API routes — provides bbox-filtered shipment/order/unit data for the map view.
 *
 * Uses ShipmentReadModel for fast queries without joins. Supports bounding-box
 * filtering to only return entities visible in the current viewport, and a zoom
 * parameter to control response density.
 */

import { FastifyPluginAsync } from 'fastify';

export const mapRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/v1/map/shipments — get shipments within a bounding box
  server.get<{
    Querystring: {
      sw_lat?: string;
      sw_lng?: string;
      ne_lat?: string;
      ne_lng?: string;
      zoom?: string;
      status?: string;
      limit?: string;
    };
  }>('/api/v1/map/shipments', {
    schema: {
      tags: ['Map'],
      summary: 'Get shipments within a bounding box for map display',
      querystring: {
        type: 'object',
        properties: {
          sw_lat: { type: 'string', description: 'Southwest latitude' },
          sw_lng: { type: 'string', description: 'Southwest longitude' },
          ne_lat: { type: 'string', description: 'Northeast latitude' },
          ne_lng: { type: 'string', description: 'Northeast longitude' },
          zoom: { type: 'string', description: 'Current map zoom level' },
          status: { type: 'string', description: 'Comma-separated status filter (e.g., in_transit,dispatched)' },
          limit: { type: 'string', description: 'Max results (default 2000)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                features: { type: 'array', items: { type: 'object' } },
                total: { type: 'number' },
                truncated: { type: 'boolean' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '2000', 10), 5000);
    const statusFilter = request.query.status?.split(',').filter(Boolean);

    // Build WHERE clause
    const where: any = {
      currentLat: { not: null },
      currentLng: { not: null },
    };

    // Bounding box filter
    if (request.query.sw_lat && request.query.sw_lng && request.query.ne_lat && request.query.ne_lng) {
      const swLat = parseFloat(request.query.sw_lat);
      const swLng = parseFloat(request.query.sw_lng);
      const neLat = parseFloat(request.query.ne_lat);
      const neLng = parseFloat(request.query.ne_lng);

      where.currentLat = { gte: swLat, lte: neLat };
      // Handle date line wrapping
      if (swLng <= neLng) {
        where.currentLng = { gte: swLng, lte: neLng };
      } else {
        // Crosses the date line
        where.OR = [
          { currentLng: { gte: swLng } },
          { currentLng: { lte: neLng } },
        ];
      }
    }

    if (statusFilter?.length) {
      where.status = { in: statusFilter };
    }

    const [readModels, total] = await Promise.all([
      server.prisma.shipmentReadModel.findMany({
        where,
        select: {
          id: true,
          reference: true,
          status: true,
          customerName: true,
          carrierName: true,
          originName: true,
          originCity: true,
          originState: true,
          destinationName: true,
          destinationCity: true,
          destinationState: true,
          currentLat: true,
          currentLng: true,
          lastLocationAt: true,
          pickupDate: true,
          deliveryDate: true,
        },
        take: limit,
        orderBy: { lastLocationAt: 'desc' },
      }),
      server.prisma.shipmentReadModel.count({ where }),
    ]);

    // Enrich with origin/destination coordinates for route arcs
    const shipmentIds = readModels.map((s) => s.id);
    const routeData = shipmentIds.length > 0
      ? await server.prisma.shipment.findMany({
          where: { id: { in: shipmentIds } },
          select: {
            id: true,
            origin: { select: { lat: true, lng: true } },
            destination: { select: { lat: true, lng: true } },
          },
        })
      : [];
    const routeMap = new Map(routeData.map((r) => [r.id, r]));

    const shipments = readModels.map((s) => {
      const route = routeMap.get(s.id);
      return { ...s, route };
    });

    // Return GeoJSON FeatureCollection for direct use with map libraries
    const features = shipments.map((s) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.currentLng!, s.currentLat!], // GeoJSON is [lng, lat]
      },
      properties: {
        id: s.id,
        reference: s.reference,
        status: s.status,
        customerName: s.customerName,
        carrierName: s.carrierName,
        originName: s.originName,
        originCity: s.originCity,
        originState: s.originState,
        destinationName: s.destinationName,
        destinationCity: s.destinationCity,
        destinationState: s.destinationState,
        lastLocationAt: s.lastLocationAt?.toISOString() ?? null,
        pickupDate: s.pickupDate?.toISOString() ?? null,
        deliveryDate: s.deliveryDate?.toISOString() ?? null,
        // Route coordinates for arc rendering
        originLat: s.route?.origin?.lat ?? null,
        originLng: s.route?.origin?.lng ?? null,
        destLat: s.route?.destination?.lat ?? null,
        destLng: s.route?.destination?.lng ?? null,
      },
    }));

    return {
      data: {
        type: 'FeatureCollection',
        features,
        total,
        truncated: total > limit,
      },
      error: null,
    };
  });

  // GET /api/v1/map/orders — get orders with coordinates for map display
  server.get<{
    Querystring: {
      sw_lat?: string;
      sw_lng?: string;
      ne_lat?: string;
      ne_lng?: string;
      limit?: string;
    };
  }>('/api/v1/map/orders', {
    schema: {
      tags: ['Map'],
      summary: 'Get orders with origin/destination coordinates for map display',
      querystring: {
        type: 'object',
        properties: {
          sw_lat: { type: 'string' },
          sw_lng: { type: 'string' },
          ne_lat: { type: 'string' },
          ne_lng: { type: 'string' },
          limit: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                features: { type: 'array', items: { type: 'object' } },
                total: { type: 'number' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '2000', 10), 5000);

    // Orders use origin/destination location coordinates
    const orders = await server.prisma.order.findMany({
      where: {
        archived: false,
        origin: { lat: { not: null }, lng: { not: null } },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        deliveryStatus: true,
        origin: { select: { id: true, name: true, city: true, state: true, lat: true, lng: true } },
        destination: { select: { id: true, name: true, city: true, state: true, lat: true, lng: true } },
        customer: { select: { name: true } },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Create a feature for each order's origin (primary location point)
    const features = orders
      .filter((o) => o.origin?.lat && o.origin?.lng)
      .map((o) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [o.origin!.lng!, o.origin!.lat!],
        },
        properties: {
          id: o.id,
          reference: o.orderNumber,
          status: o.status,
          deliveryStatus: o.deliveryStatus,
          customerName: o.customer?.name ?? null,
          originName: o.origin?.name ?? null,
          originCity: o.origin?.city ?? null,
          originState: o.origin?.state ?? null,
          destinationName: o.destination?.name ?? null,
          destinationCity: o.destination?.city ?? null,
          destinationState: o.destination?.state ?? null,
          destLat: o.destination?.lat ?? null,
          destLng: o.destination?.lng ?? null,
        },
      }));

    return {
      data: {
        type: 'FeatureCollection',
        features,
        total: features.length,
      },
      error: null,
    };
  });

  // GET /api/v1/map/units — get trackable units with last-known positions
  server.get<{
    Querystring: { limit?: string };
  }>('/api/v1/map/units', {
    schema: {
      tags: ['Map'],
      summary: 'Get trackable units with last scanned coordinates',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                features: { type: 'array', items: { type: 'object' } },
                total: { type: 'number' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '2000', 10), 5000);

    // Get units that have cargo scans with coordinates
    const scans = await server.prisma.cargoScan.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        lat: true,
        lng: true,
        scannedAt: true,
        scanType: true,
        trackableUnit: {
          select: {
            id: true,
            identifier: true,
            unitType: true,
            condition: true,
            order: { select: { orderNumber: true } },
          },
        },
        shipment: { select: { reference: true } },
      },
      orderBy: { scannedAt: 'desc' },
      distinct: ['trackableUnitId'],
      take: limit,
    });

    const features = scans.map((s) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.lng!, s.lat!],
      },
      properties: {
        id: s.trackableUnit.id,
        reference: s.trackableUnit.identifier,
        unitType: s.trackableUnit.unitType,
        condition: s.trackableUnit.condition,
        orderNumber: s.trackableUnit.order?.orderNumber ?? null,
        shipmentReference: s.shipment?.reference ?? null,
        lastScanType: s.scanType,
        lastScannedAt: s.scannedAt.toISOString(),
      },
    }));

    return {
      data: {
        type: 'FeatureCollection',
        features,
        total: features.length,
      },
      error: null,
    };
  });

  // GET /api/v1/map/issues — get open issues and SLA breaches with coordinates
  // Issues inherit coordinates from their linked shipment (via sourceEntityType/sourceEntityId).
  // SLA evaluations are joined to provide breach status.
  server.get<{
    Querystring: {
      status?: string;
      priority?: string;
      slaStatus?: string;
      limit?: string;
    };
  }>('/api/v1/map/issues', {
    schema: {
      tags: ['Map'],
      summary: 'Get issues with shipment coordinates for map overlay',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Issue status filter (comma-separated: open,in_progress)' },
          priority: { type: 'string', description: 'Priority filter (comma-separated: critical,high)' },
          slaStatus: { type: 'string', description: 'SLA evaluation status filter (comma-separated: breached,warning,active)' },
          limit: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                features: { type: 'array', items: { type: 'object' } },
                total: { type: 'number' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const limit = Math.min(parseInt(request.query.limit || '1000', 10), 5000);
    const statusFilter = request.query.status?.split(',').filter(Boolean) || ['open', 'in_progress'];
    const priorityFilter = request.query.priority?.split(',').filter(Boolean);
    const slaStatusFilter = request.query.slaStatus?.split(',').filter(Boolean);

    // Build issue WHERE clause
    const issueWhere: any = {
      status: { in: statusFilter },
      sourceEntityType: 'shipment',
      sourceEntityId: { not: null },
    };
    if (priorityFilter?.length) {
      issueWhere.priority = { in: priorityFilter };
    }

    // Fetch issues linked to shipments
    const issues = await server.prisma.issue.findMany({
      where: issueWhere,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        sourceEntityId: true,
        assigneeName: true,
        createdAt: true,
        resolvedAt: true,
      },
      take: limit,
      orderBy: [
        { priority: 'asc' }, // critical first
        { createdAt: 'desc' },
      ],
    });

    if (issues.length === 0) {
      return { data: { type: 'FeatureCollection', features: [], total: 0 }, error: null };
    }

    // Get shipment coordinates in bulk
    const shipmentIds = [...new Set(issues.map((i) => i.sourceEntityId!))];
    const shipments = await server.prisma.shipmentReadModel.findMany({
      where: {
        id: { in: shipmentIds },
        currentLat: { not: null },
        currentLng: { not: null },
      },
      select: {
        id: true,
        reference: true,
        currentLat: true,
        currentLng: true,
        status: true,
        customerName: true,
      },
    });

    const shipmentMap = new Map(shipments.map((s) => [s.id, s]));

    // Optionally fetch SLA evaluations for these issues
    let slaByIssue = new Map<string, any[]>();
    const issueIds = issues.map((i) => i.id);
    const slaWhere: any = {
      entityType: 'issue',
      entityId: { in: issueIds },
    };
    if (slaStatusFilter?.length) {
      slaWhere.status = { in: slaStatusFilter };
    }

    const slaEvals = await server.prisma.slaEvaluation.findMany({
      where: slaWhere,
      select: {
        id: true,
        entityId: true,
        ruleType: true,
        ruleName: true,
        status: true,
        slaDueAt: true,
        breachedAt: true,
        remainingMinutes: true,
      },
    });

    for (const sla of slaEvals) {
      const existing = slaByIssue.get(sla.entityId) || [];
      existing.push(sla);
      slaByIssue.set(sla.entityId, existing);
    }

    // Also get SLA evaluations directly linked to shipments (e.g., ETA breaches)
    const shipmentSlaWhere: any = {
      entityType: 'shipment',
      entityId: { in: shipmentIds },
      status: { in: slaStatusFilter?.length ? slaStatusFilter : ['breached', 'warning'] },
    };

    const shipmentSlaEvals = await server.prisma.slaEvaluation.findMany({
      where: shipmentSlaWhere,
      select: {
        id: true,
        entityId: true,
        ruleType: true,
        ruleName: true,
        status: true,
        slaDueAt: true,
        breachedAt: true,
        remainingMinutes: true,
      },
    });

    // Build features — one per issue with coordinates from the linked shipment
    const features: any[] = [];

    for (const issue of issues) {
      const shipment = shipmentMap.get(issue.sourceEntityId!);
      if (!shipment) continue; // No coordinates available

      const issueSlas = slaByIssue.get(issue.id) || [];
      const worstSla = issueSlas.length > 0
        ? issueSlas.sort((a: any, b: any) => {
            const order: Record<string, number> = { breached: 0, warning: 1, active: 2, met: 3, cancelled: 4 };
            return (order[a.status] ?? 5) - (order[b.status] ?? 5);
          })[0]
        : null;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [shipment.currentLng!, shipment.currentLat!],
        },
        properties: {
          id: issue.id,
          type: 'issue',
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          category: issue.category,
          assigneeName: issue.assigneeName,
          createdAt: issue.createdAt.toISOString(),
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          shipmentStatus: shipment.status,
          customerName: shipment.customerName,
          slaStatus: worstSla?.status ?? null,
          slaRuleName: worstSla?.ruleName ?? null,
          slaDueAt: worstSla?.slaDueAt?.toISOString() ?? null,
          slaBreachedAt: worstSla?.breachedAt?.toISOString() ?? null,
          slaRemainingMinutes: worstSla?.remainingMinutes ?? null,
        },
      });
    }

    // Also add shipment-level SLA breaches that don't yet have issues
    for (const sla of shipmentSlaEvals) {
      const shipment = shipmentMap.get(sla.entityId);
      if (!shipment) continue;

      // Skip if we already have an issue feature for this shipment
      if (features.some((f: any) => f.properties.shipmentId === sla.entityId)) continue;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [shipment.currentLng!, shipment.currentLat!],
        },
        properties: {
          id: sla.id,
          type: 'sla_breach',
          title: `${sla.ruleName} — ${sla.status}`,
          status: sla.status,
          priority: sla.status === 'breached' ? 'critical' : 'high',
          category: 'compliance',
          assigneeName: null,
          createdAt: sla.breachedAt?.toISOString() ?? null,
          shipmentId: shipment.id,
          shipmentReference: shipment.reference,
          shipmentStatus: shipment.status,
          customerName: shipment.customerName,
          slaStatus: sla.status,
          slaRuleName: sla.ruleName,
          slaDueAt: sla.slaDueAt?.toISOString() ?? null,
          slaBreachedAt: sla.breachedAt?.toISOString() ?? null,
          slaRemainingMinutes: sla.remainingMinutes ?? null,
        },
      });
    }

    return {
      data: {
        type: 'FeatureCollection',
        features,
        total: features.length,
      },
      error: null,
    };
  });
};
