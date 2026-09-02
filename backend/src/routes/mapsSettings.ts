/**
 * Maps & Geocoding Settings Routes — manage the organisation's Google Maps credentials.
 *
 * There are two keys, and they are not interchangeable (#176).
 *
 * The **browser key** is served to the client so the Maps JS API can load. It is public the
 * moment a map renders, so it must carry HTTP referrer restrictions. Those restrictions are also
 * exactly what makes it useless server-side: Google answers a referrer-restricted key on a web
 * service endpoint with "API keys with referer restrictions cannot be used with this API".
 *
 * The **server key** never leaves the backend and is the more capable of the two. It drives
 * Directions, Distance Matrix and Geocoding today, and is what any further server-side Google
 * work (Routes, Roads, Elevation, server-side Places) would use. It should be restricted by IP
 * or by API, never by referrer.
 *
 * GET  /api/v1/maps/settings   — configuration status, both keys masked
 * PUT  /api/v1/maps/settings   — update either or both keys
 * POST /api/v1/maps/test       — validate the server key against the Geocoding API
 * GET  /api/v1/maps/api-key    — the browser key, for the frontend Maps JS loader
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { guardWrites } from '../auth/guardWrites.js';

/** Shown in place of a stored key. Submitting it back means "leave this one alone". */
const MASK = '••••••••••••';

function mask(key: string | null): string | null {
  return key ? key.substring(0, 8) + MASK : null;
}

export async function mapsSettingsRoutes(server: FastifyInstance) {
  // /test validates a key against Google (read-only check).
  server.addHook('preHandler', guardWrites('settings', { readPaths: ['/test'] }));

  server.get('/api/v1/maps/settings', {
    schema: {
      tags: ['Maps'],
      summary: 'Get maps configuration status',
      response: {
        200: {
          type: 'object',
          properties: {
            // Every property must be declared. Fastify serialises against this schema and drops
            // anything undeclared, which is how this endpoint previously returned an empty
            // object for every request and left the app permanently in OSM mode.
            data: {
              type: 'object',
              properties: {
                hasBrowserKey: { type: 'boolean' },
                maskedBrowserKey: { type: 'string', nullable: true },
                hasServerKey: { type: 'boolean' },
                maskedServerKey: { type: 'string', nullable: true },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const org = await server.prisma.organization.findFirst({
      select: { googleMapsBrowserKey: true, googleMapsServerKey: true },
    });

    return {
      data: {
        hasBrowserKey: !!org?.googleMapsBrowserKey,
        maskedBrowserKey: mask(org?.googleMapsBrowserKey ?? null),
        hasServerKey: !!org?.googleMapsServerKey,
        maskedServerKey: mask(org?.googleMapsServerKey ?? null),
      },
      error: null,
    };
  });

  server.put('/api/v1/maps/settings', {
    schema: {
      tags: ['Maps'],
      summary: 'Update the Google Maps browser and server keys',
      description:
        'Send only the keys you want to change. Sending back a masked value leaves that key as it is, and sending null clears it.',
    },
  }, async (req, reply) => {
    const schema = z.object({
      googleMapsBrowserKey: z.string().nullable().optional(),
      googleMapsServerKey: z.string().nullable().optional(),
    });

    const body = schema.parse((req as any).body);

    const org = await server.prisma.organization.findFirst({
      select: { id: true, googleMapsBrowserKey: true, googleMapsServerKey: true },
    });
    if (!org) {
      reply.code(404);
      return { data: null, error: 'Organization not found' };
    }

    // The UI renders masked keys. If one comes back unchanged, the user did not edit that field,
    // so writing it would replace a real key with its own mask.
    const resolve = (submitted: string | null | undefined, current: string | null) => {
      if (submitted === undefined) return current;
      if (submitted && submitted.includes(MASK)) return current;
      return submitted || null;
    };

    const googleMapsBrowserKey = resolve(body.googleMapsBrowserKey, org.googleMapsBrowserKey);
    const googleMapsServerKey = resolve(body.googleMapsServerKey, org.googleMapsServerKey);

    await server.prisma.organization.update({
      where: { id: org.id },
      data: { googleMapsBrowserKey, googleMapsServerKey },
    });

    return {
      data: {
        hasBrowserKey: !!googleMapsBrowserKey,
        maskedBrowserKey: mask(googleMapsBrowserKey),
        hasServerKey: !!googleMapsServerKey,
        maskedServerKey: mask(googleMapsServerKey),
      },
      error: null,
    };
  });

  server.post('/api/v1/maps/test', {
    schema: {
      tags: ['Maps'],
      summary: 'Validate the server key against the Geocoding API',
      description:
        'Tests the server key, not the browser key. A browser key cannot be tested this way: Google rejects referrer-restricted keys on web service endpoints by design.',
    },
  }, async (req, reply) => {
    const org = await server.prisma.organization.findFirst({
      select: { googleMapsServerKey: true },
    });

    if (!org?.googleMapsServerKey) {
      reply.code(400);
      return { data: null, error: 'No Google Maps server key configured' };
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=London,UK&key=${encodeURIComponent(org.googleMapsServerKey)}`;
      const res = await fetch(url);
      const data = await res.json() as { status: string; error_message?: string };

      if (data.status === 'OK') {
        return { data: { valid: true, message: 'Server key is valid. The Geocoding API responded.' }, error: null };
      }
      if (data.status === 'REQUEST_DENIED') {
        // The most likely cause by far is a referrer-restricted key in the server field, so say
        // so rather than making the operator work it out from Google's wording.
        return {
          data: { valid: false },
          error: `Key rejected: ${data.error_message || 'Request denied'}. A key with HTTP referrer restrictions cannot be used server-side — use a key restricted by IP or by API instead.`,
        };
      }
      return { data: { valid: false }, error: `Geocoding API returned status: ${data.status}` };
    } catch (err) {
      reply.code(500);
      return { data: null, error: `Failed to test the server key: ${(err as Error).message}` };
    }
  });

  server.get('/api/v1/maps/api-key', {
    schema: {
      tags: ['Maps'],
      summary: 'Get the Google Maps browser key for frontend map loading',
      description:
        'Returns the browser key only. The server key must never reach a client.',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                apiKey: { type: 'string', nullable: true },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const org = await server.prisma.organization.findFirst({
      select: { googleMapsBrowserKey: true },
    });

    return {
      data: { apiKey: org?.googleMapsBrowserKey || null },
      error: null,
    };
  });
}
