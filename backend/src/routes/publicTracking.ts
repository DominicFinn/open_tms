/**
 * Public Tracking - shareable shipment tracking page.
 * No authentication required. Accessed via a tracking token or shipment reference.
 * Shows limited shipment info: status, origin/destination (city/state only), stops, and events.
 * Does NOT expose customer names, carrier details, or financial data.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHmac } from 'crypto';

const TRACKING_SECRET = process.env.TRACKING_LINK_SECRET || 'open-tms-tracking-secret';

/** Generate a HMAC-based tracking token for a shipment ID */
export function generateTrackingToken(shipmentId: string): string {
  const hmac = createHmac('sha256', TRACKING_SECRET).update(shipmentId).digest('hex').slice(0, 16);
  return `${Buffer.from(shipmentId).toString('base64url')}.${hmac}`;
}

/** Verify and decode a tracking token */
function verifyTrackingToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [idB64, hmac] = parts;
  try {
    const shipmentId = Buffer.from(idB64, 'base64url').toString();
    const expected = createHmac('sha256', TRACKING_SECRET).update(shipmentId).digest('hex').slice(0, 16);
    if (hmac !== expected) return null;
    return shipmentId;
  } catch {
    return null;
  }
}

export async function publicTrackingRoutes(server: FastifyInstance) {

  // Generate a tracking link for a shipment (internal use)
  server.post('/api/v1/shipments/:id/tracking-link', {
    schema: {
      tags: ['Public Tracking'],
      summary: 'Generate a shareable tracking link for a shipment',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const shipment = await server.prisma.shipment.findUnique({
      where: { id },
      select: { id: true, reference: true },
    });

    if (!shipment) { reply.code(404); return { data: null, error: 'Shipment not found' }; }

    const token = generateTrackingToken(shipment.id);
    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
    const trackingUrl = `${baseUrl}/track/${token}`;

    return {
      data: {
        token,
        url: trackingUrl,
        shipmentReference: shipment.reference,
      },
      error: null,
    };
  });

  // Public tracking page data (no auth required)
  server.get('/api/v1/track/:token', {
    schema: {
      tags: ['Public Tracking'],
      summary: 'Get shipment tracking info from a tracking token (no authentication required)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };

    const shipmentId = verifyTrackingToken(token);
    if (!shipmentId) {
      reply.code(404);
      return { data: null, error: 'Invalid or expired tracking link' };
    }

    const shipment = await server.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        origin: true,
        destination: true,
        stops: {
          include: { location: true },
          orderBy: { sequenceNumber: 'asc' },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!shipment) {
      reply.code(404);
      return { data: null, error: 'Shipment not found' };
    }

    // Return limited info - no customer name, carrier details, or financial data
    return {
      data: {
        reference: shipment.reference,
        status: shipment.status,
        pickupDate: shipment.pickupDate,
        deliveryDate: shipment.deliveryDate,
        proNumber: shipment.proNumber,
        origin: shipment.origin ? { city: shipment.origin.city, state: shipment.origin.state } : null,
        destination: shipment.destination ? { city: shipment.destination.city, state: shipment.destination.state } : null,
        stops: shipment.stops.map(s => ({
          sequenceNumber: s.sequenceNumber,
          stopType: s.stopType,
          status: s.status,
          arrivedAt: s.actualArrival,
          completedAt: s.actualDeparture,
          location: s.location ? { name: s.location.name, city: s.location.city, state: s.location.state } : null,
        })),
        events: shipment.events.map(e => ({
          eventType: e.eventType,
          description: e.address || e.locationSummary || e.eventType,
          createdAt: e.createdAt,
        })),
        currentLocation: (shipment as any).currentLat ? { lat: (shipment as any).currentLat, lng: (shipment as any).currentLng, asOf: (shipment as any).lastLocationAt } : null,
      },
      error: null,
    };
  });
}
