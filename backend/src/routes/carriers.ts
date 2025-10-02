import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ICarriersRepository } from '../repositories/CarriersRepository.js';
import { container, TOKENS } from '../di/index.js';

export async function carrierRoutes(server: FastifyInstance) {
  const carriersRepo = container.resolve<ICarriersRepository>(TOKENS.ICarriersRepository);

  // Get all carriers
  server.get('/api/v1/carriers', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const carriers = await carriersRepo.all();
    return { data: carriers, error: null };
  });

  // Get carrier by ID
  server.get('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const carrier = await carriersRepo.findById(id);
    if (!carrier) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }
    return { data: carrier, error: null };
  });

  // Create carrier
  server.post('/api/v1/carriers', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z
      .object({
        name: z.string().min(1),
        mcNumber: z.string().optional(),
        dotNumber: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        address1: z.string().optional(),
        address2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional()
      })
      .parse((req as any).body);
    const created = await carriersRepo.create(body);
    reply.code(201);
    return { data: created, error: null };
  });

  // Update carrier
  server.put('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      mcNumber: z.string().optional(),
      dotNumber: z.string().optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    }).parse((req as any).body);

    const carrier = await carriersRepo.findById(id);
    if (!carrier) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const updated = await carriersRepo.update(id, body);
    return { data: updated, error: null };
  });

  // Delete (archive) carrier
  server.delete('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const carrier = await carriersRepo.findById(id);
    if (!carrier) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const archived = await carriersRepo.archive(id);
    return { data: archived, error: null };
  });
}
