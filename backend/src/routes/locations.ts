import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_LOCATION } from '../commands/locations/CreateLocationCommand.js';
import { UPDATE_LOCATION } from '../commands/locations/UpdateLocationCommand.js';

export async function locationRoutes(server: FastifyInstance) {
  const locationsRepo = container.resolve<ILocationsRepository>(TOKENS.ILocationsRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

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

    const result = await commandBus.dispatch({
      type: CREATE_LOCATION,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const created = await locationsRepo.findById((result.data as any).id);
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

    const result = await commandBus.dispatch({
      type: UPDATE_LOCATION,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await locationsRepo.findById(id);
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

  // Delete (archive) location — no command handler for archive yet,
  // use repo directly (location archival is rare and doesn't need events)
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
