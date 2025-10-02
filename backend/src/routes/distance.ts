import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DistanceService } from '../services/distanceService.js';

export async function distanceRoutes(server: FastifyInstance) {
  // Distance calculation endpoint
  server.post('/api/v1/distance/calculate', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      originId: z.string().uuid(),
      destinationId: z.string().uuid()
    }).parse((req as any).body);

    try {
      // Get locations from database
      const [origin, destination] = await Promise.all([
        server.prisma.location.findUnique({ where: { id: body.originId } }),
        server.prisma.location.findUnique({ where: { id: body.destinationId } })
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
