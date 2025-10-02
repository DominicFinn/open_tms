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
        dotNumber: z.string().optional()
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
      dotNumber: z.string().optional()
    }).parse((req as any).body);

    const carrier = await carriersRepo.findById(id);
    if (!carrier) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const updated = await carriersRepo.update(id, body);
    return { data: updated, error: null };
  });

  // Delete carrier
  server.delete('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const carrier = await carriersRepo.findById(id);
    if (!carrier) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    await carriersRepo.delete(id);
    reply.code(204);
    return { data: null, error: null };
  });
}
