import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { container, TOKENS } from '../di/index.js';

export async function locationRoutes(server: FastifyInstance) {
  const locationsRepo = container.resolve<ILocationsRepository>(TOKENS.ILocationsRepository);

  // Get all locations
  server.get('/api/v1/locations', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const locations = await locationsRepo.all();
    return { data: locations, error: null };
  });

  // Create location
  server.post('/api/v1/locations', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z
      .object({
        name: z.string().min(1),
        address1: z.string().min(1),
        address2: z.string().optional(),
        city: z.string().min(1),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().min(2),
        lat: z.number().optional(),
        lng: z.number().optional()
      })
      .parse((req as any).body);
    const created = await locationsRepo.create(body);
    reply.code(201);
    return { data: created, error: null };
  });

  // Get location by ID
  server.get('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const location = await locationsRepo.findById(id);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }
    return { data: location, error: null };
  });

  // Update location
  server.put('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      address1: z.string().min(1).optional(),
      address2: z.string().optional(),
      city: z.string().min(1).optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().min(2).optional(),
      lat: z.number().optional(),
      lng: z.number().optional()
    }).parse((req as any).body);

    const location = await locationsRepo.findById(id);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }

    const updated = await locationsRepo.update(id, body);
    return { data: updated, error: null };
  });

  // Location search endpoint
  server.get('/api/v1/locations/search', async (req: FastifyRequest, reply: FastifyReply) => {
    const { q } = req.query as { q?: string };

    if (!q || q.trim().length < 2) {
      return { data: [], error: null };
    }

    const locations = await locationsRepo.search(q);
    return { data: locations, error: null };
  });

  // Delete (archive) location
  server.delete('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const location = await locationsRepo.findById(id);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }

    const archived = await locationsRepo.archive(id);
    return { data: archived, error: null };
  });
}
