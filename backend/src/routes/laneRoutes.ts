/**
 * Lane Route API routes - manage planned routes on lanes for deviation detection.
 *
 * Requires Google Maps API key configured in organization settings.
 * Without a Google Maps API key, route creation and calculation endpoints will return errors.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  GoogleMapsDirectionsService,
  IGoogleMapsDirectionsService,
  decodePolyline,
} from '../services/routing/GoogleMapsDirectionsService.js';
import { RouteDeviationService } from '../services/routing/RouteDeviationService.js';

export async function laneRouteRoutes(server: FastifyInstance) {
  const prisma = server.prisma as PrismaClient;
  const directionsService: IGoogleMapsDirectionsService = new GoogleMapsDirectionsService();
  const deviationService = new RouteDeviationService();

  /**
   * Helper: get the Google Maps API key from organization settings.
   * Returns null if not configured.
   */
  async function getGoogleMapsApiKey(): Promise<string | null> {
    const org = await prisma.organization.findFirst({
      select: { googleMapsApiKey: true },
    });
    return org?.googleMapsApiKey || null;
  }

  // ─── GET /api/v1/lanes/:laneId/route ──────────────────────────────────────
  server.get('/api/v1/lanes/:laneId/route', {
    schema: {
      tags: ['Lane Routes'],
      summary: 'Get the planned route for a lane',
      params: {
        type: 'object',
        properties: { laneId: { type: 'string', format: 'uuid' } },
        required: ['laneId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: ['object', 'null'], additionalProperties: true },
            error: { type: ['string', 'null'] },
          },
        },
      },
    },
  }, async (req: FastifyRequest<{ Params: { laneId: string } }>, reply: FastifyReply) => {
    const { laneId } = req.params;

    const laneRoute = await prisma.laneRoute.findUnique({
      where: { laneId },
    });

    return { data: laneRoute, error: null };
  });

  // ─── POST /api/v1/lanes/:laneId/route/calculate ──────────────────────────
  server.post('/api/v1/lanes/:laneId/route/calculate', {
    schema: {
      tags: ['Lane Routes'],
      summary: 'Calculate a route for a lane using Google Maps Directions API (preview, not saved)',
      params: {
        type: 'object',
        properties: { laneId: { type: 'string', format: 'uuid' } },
        required: ['laneId'],
      },
      body: {
        type: 'object',
        properties: {
          waypoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: { lat: { type: 'number' }, lng: { type: 'number' } },
              required: ['lat', 'lng'],
            },
          },
          avoidTolls: { type: 'boolean' },
          avoidHighways: { type: 'boolean' },
        },
      },
    },
  }, async (req: FastifyRequest<{
    Params: { laneId: string };
    Body: { waypoints?: Array<{ lat: number; lng: number }>; avoidTolls?: boolean; avoidHighways?: boolean };
  }>, reply: FastifyReply) => {
    const apiKey = await getGoogleMapsApiKey();
    if (!apiKey) {
      return reply.status(400).send({
        data: null,
        error: 'Google Maps API key is not configured. Go to Admin > Map Settings to add your API key. Route planning requires Google Maps.',
      });
    }

    const lane = await prisma.lane.findUnique({
      where: { id: req.params.laneId },
      include: {
        origin: true,
        destination: true,
        stops: { include: { location: true }, orderBy: { order: 'asc' } },
      },
    });

    if (!lane) {
      return reply.status(404).send({ data: null, error: 'Lane not found' });
    }

    const originLat = lane.origin?.lat;
    const originLng = lane.origin?.lng;
    const destLat = lane.destination?.lat;
    const destLng = lane.destination?.lng;

    if (!originLat || !originLng || !destLat || !destLng) {
      return reply.status(400).send({
        data: null,
        error: 'Origin and destination locations must have lat/lng coordinates. Update location coordinates first.',
      });
    }

    // Build waypoints: lane stops (hub-and-spoke) + any custom waypoints from the request
    const stopWaypoints = lane.stops
      .filter((s: any) => s.location?.lat && s.location?.lng)
      .map((s: any) => ({ lat: s.location.lat!, lng: s.location.lng! }));

    const customWaypoints = req.body?.waypoints || [];
    const allWaypoints = [...stopWaypoints, ...customWaypoints];

    try {
      const result = await directionsService.computeDirections(apiKey, {
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destLat, lng: destLng },
        waypoints: allWaypoints.length > 0 ? allWaypoints : undefined,
        avoidTolls: req.body?.avoidTolls,
        avoidHighways: req.body?.avoidHighways,
      });

      return {
        data: {
          encodedPolyline: result.encodedPolyline,
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          summary: result.summary,
          waypointCount: result.waypoints.length,
        },
        error: null,
      };
    } catch (err) {
      return reply.status(502).send({
        data: null,
        error: `Google Maps Directions API error: ${(err as Error).message}`,
      });
    }
  });

  // ─── PUT /api/v1/lanes/:laneId/route ──────────────────────────────────────
  server.put('/api/v1/lanes/:laneId/route', {
    schema: {
      tags: ['Lane Routes'],
      summary: 'Save or update the planned route for a lane',
      params: {
        type: 'object',
        properties: { laneId: { type: 'string', format: 'uuid' } },
        required: ['laneId'],
      },
      body: {
        type: 'object',
        properties: {
          encodedPolyline: { type: 'string' },
          distanceMeters: { type: 'integer' },
          durationSeconds: { type: 'integer' },
          summary: { type: 'string' },
          corridorMeters: { type: 'integer', minimum: 100, maximum: 50000 },
          waypoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: { lat: { type: 'number' }, lng: { type: 'number' } },
              required: ['lat', 'lng'],
            },
          },
        },
        required: ['encodedPolyline', 'distanceMeters', 'durationSeconds'],
      },
    },
  }, async (req: FastifyRequest<{
    Params: { laneId: string };
    Body: {
      encodedPolyline: string;
      distanceMeters: number;
      durationSeconds: number;
      summary?: string;
      corridorMeters?: number;
      waypoints?: Array<{ lat: number; lng: number }>;
    };
  }>, reply: FastifyReply) => {
    const { laneId } = req.params;
    const { encodedPolyline, distanceMeters, durationSeconds, summary, corridorMeters, waypoints } = req.body;

    const lane = await prisma.lane.findUnique({ where: { id: laneId } });
    if (!lane) {
      return reply.status(404).send({ data: null, error: 'Lane not found' });
    }

    // Derive orgId from a related entity or default
    const org = await prisma.organization.findFirst({ select: { id: true } });
    const orgId = org?.id || 'default';

    // Decode polyline if waypoints not provided
    const routeWaypoints = waypoints || decodePolyline(encodedPolyline);

    const laneRoute = await prisma.laneRoute.upsert({
      where: { laneId },
      create: {
        id: randomUUID(),
        laneId,
        orgId,
        encodedPolyline,
        waypoints: routeWaypoints as any,
        distanceMeters,
        durationSeconds,
        summary: summary || null,
        corridorMeters: corridorMeters || 5000,
        provider: 'google',
      },
      update: {
        encodedPolyline,
        waypoints: routeWaypoints as any,
        distanceMeters,
        durationSeconds,
        summary: summary || null,
        corridorMeters: corridorMeters ?? undefined,
      },
    });

    // Also update the lane distance (in km for consistency)
    await prisma.lane.update({
      where: { id: laneId },
      data: { distance: Math.round(distanceMeters / 1609.34 * 10) / 10 }, // meters to miles, 1 decimal
    });

    return { data: laneRoute, error: null };
  });

  // ─── DELETE /api/v1/lanes/:laneId/route ───────────────────────────────────
  server.delete('/api/v1/lanes/:laneId/route', {
    schema: {
      tags: ['Lane Routes'],
      summary: 'Delete the planned route for a lane',
      params: {
        type: 'object',
        properties: { laneId: { type: 'string', format: 'uuid' } },
        required: ['laneId'],
      },
    },
  }, async (req: FastifyRequest<{ Params: { laneId: string } }>, reply: FastifyReply) => {
    const { laneId } = req.params;

    const existing = await prisma.laneRoute.findUnique({ where: { laneId } });
    if (!existing) {
      return reply.status(404).send({ data: null, error: 'No route found for this lane' });
    }

    await prisma.laneRoute.delete({ where: { laneId } });

    return { data: { deleted: true }, error: null };
  });

  // ─── POST /api/v1/lanes/:laneId/route/check-deviation ────────────────────
  server.post('/api/v1/lanes/:laneId/route/check-deviation', {
    schema: {
      tags: ['Lane Routes'],
      summary: 'Check if a position deviates from the lane planned route',
      params: {
        type: 'object',
        properties: { laneId: { type: 'string', format: 'uuid' } },
        required: ['laneId'],
      },
      body: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
        required: ['lat', 'lng'],
      },
    },
  }, async (req: FastifyRequest<{
    Params: { laneId: string };
    Body: { lat: number; lng: number };
  }>, reply: FastifyReply) => {
    const laneRoute = await prisma.laneRoute.findUnique({
      where: { laneId: req.params.laneId },
    });

    if (!laneRoute) {
      return reply.status(404).send({ data: null, error: 'No planned route for this lane' });
    }

    const result = deviationService.checkDeviation(
      { lat: req.body.lat, lng: req.body.lng },
      laneRoute.encodedPolyline,
      laneRoute.corridorMeters,
    );

    return { data: result, error: null };
  });

  // ─── GET /api/v1/lanes/:laneId/route/google-maps-status ──────────────────
  server.get('/api/v1/lanes/:laneId/route/google-maps-status', {
    schema: {
      tags: ['Lane Routes'],
      summary: 'Check if Google Maps API key is configured (for frontend feature gating)',
    },
  }, async (_req: FastifyRequest, _reply: FastifyReply) => {
    const apiKey = await getGoogleMapsApiKey();
    return {
      data: {
        configured: Boolean(apiKey),
        message: apiKey
          ? 'Google Maps API key is configured. Route planning is available.'
          : 'Google Maps API key is not configured. Go to Admin > Map Settings to add your API key.',
      },
      error: null,
    };
  });
}
