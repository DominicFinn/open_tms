/**
 * Maps & Geocoding Settings Routes — manage Google Maps API key from Admin.
 *
 * GET  /api/v1/maps/settings   — get current maps config (masked key)
 * PUT  /api/v1/maps/settings   — update Google Maps API key
 * POST /api/v1/maps/test       — validate the API key against Google Geocoding API
 * GET  /api/v1/maps/api-key    — return raw key for frontend Google Maps JS loader
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function mapsSettingsRoutes(server: FastifyInstance) {
  // Get maps settings (masked key)
  server.get('/api/v1/maps/settings', {
    schema: {
      tags: ['Maps'],
      summary: 'Get maps configuration status',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const org = await server.prisma.organization.findFirst({
      select: { googleMapsApiKey: true },
    });

    if (!org) {
      return { data: { hasKey: false, maskedKey: null }, error: null };
    }

    const key = org.googleMapsApiKey;
    return {
      data: {
        hasKey: !!key,
        maskedKey: key ? key.substring(0, 8) + '••••••••••••' : null,
      },
      error: null,
    };
  });

  // Update maps settings
  server.put('/api/v1/maps/settings', {
    schema: {
      tags: ['Maps'],
      summary: 'Update Google Maps API key',
    },
  }, async (req, reply) => {
    const schema = z.object({
      googleMapsApiKey: z.string().nullable().optional(),
    });

    const body = schema.parse((req as any).body);

    const org = await server.prisma.organization.findFirst();
    if (!org) {
      reply.code(404);
      return { data: null, error: 'Organization not found' };
    }

    // Don't overwrite with the masked value
    if (body.googleMapsApiKey && body.googleMapsApiKey.includes('••••')) {
      return {
        data: { hasKey: !!org.googleMapsApiKey },
        error: null,
      };
    }

    await server.prisma.organization.update({
      where: { id: org.id },
      data: { googleMapsApiKey: body.googleMapsApiKey || null },
    });

    const hasKey = !!body.googleMapsApiKey;
    return {
      data: {
        hasKey,
        maskedKey: body.googleMapsApiKey
          ? body.googleMapsApiKey.substring(0, 8) + '••••••••••••'
          : null,
      },
      error: null,
    };
  });

  // Test Google Maps API key
  server.post('/api/v1/maps/test', {
    schema: {
      tags: ['Maps'],
      summary: 'Validate Google Maps API key by making a test geocoding request',
    },
  }, async (req, reply) => {
    const org = await server.prisma.organization.findFirst({
      select: { googleMapsApiKey: true },
    });

    if (!org?.googleMapsApiKey) {
      reply.code(400);
      return { data: null, error: 'No Google Maps API key configured' };
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=London,UK&key=${encodeURIComponent(org.googleMapsApiKey)}`;
      const res = await fetch(url);
      const data = await res.json() as { status: string; error_message?: string };

      if (data.status === 'OK') {
        return { data: { valid: true, message: 'API key is valid. Geocoding API is working.' }, error: null };
      } else if (data.status === 'REQUEST_DENIED') {
        return { data: { valid: false }, error: `API key rejected: ${data.error_message || 'Request denied'}` };
      } else {
        return { data: { valid: false }, error: `Geocoding API returned status: ${data.status}` };
      }
    } catch (err) {
      reply.code(500);
      return { data: null, error: `Failed to test API key: ${(err as Error).message}` };
    }
  });

  // Get raw API key (for frontend Google Maps JS loader)
  server.get('/api/v1/maps/api-key', {
    schema: {
      tags: ['Maps'],
      summary: 'Get Google Maps API key for frontend map loading',
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const org = await server.prisma.organization.findFirst({
      select: { googleMapsApiKey: true },
    });

    return {
      data: { apiKey: org?.googleMapsApiKey || null },
      error: null,
    };
  });
}
