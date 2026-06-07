import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DistanceService } from '../services/distanceService.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

export async function distanceRoutes(server: FastifyInstance) {
  await registerOrgScope(server);

  // Distance calculation endpoint
  server.post('/api/v1/distance/calculate', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      originId: z.string().uuid(),
      destinationId: z.string().uuid()
    }).parse((req as any).body);

    try {
      // Multi-tenancy: only locations owned by the requesting tenant are
      // visible. Without this, an attacker could probe Location.lat/lng
      // across orgs by guessing UUIDs.
      const orgId = req.orgId!;
      const [origin, destination] = await Promise.all([
        server.prisma.location.findFirst({ where: { id: body.originId, orgId } }),
        server.prisma.location.findFirst({ where: { id: body.destinationId, orgId } })
      ]);

      if (!origin || !destination) {
        reply.code(404);
        return { data: null, error: 'Origin or destination location not found' };
      }

      // Check if both locations have coordinates
      if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
        reply.code(400);
        return {
          data: null,
          error: 'Both locations must have latitude and longitude coordinates for distance calculation'
        };
      }

      // Calculate distance using the service
      const result = await DistanceService.getDistance(origin, destination);

      return { data: result, error: null };
    } catch (error) {
      console.error('Distance calculation error:', error);
      reply.code(500);
      return { data: null, error: 'Failed to calculate distance' };
    }
  });
}
