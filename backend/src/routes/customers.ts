import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ICustomersRepository } from '../repositories/CustomersRepository.js';
import { container, TOKENS } from '../di/index.js';

export async function customerRoutes(server: FastifyInstance) {
  const customersRepo = container.resolve<ICustomersRepository>(TOKENS.ICustomersRepository);

  // Get all customers
  server.get('/api/v1/customers', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const customers = await customersRepo.all();
    return { data: customers, error: null };
  });

  // Create customer
  server.post('/api/v1/customers', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().min(1),
      contactEmail: z.string().email().optional()
    }).parse((req as any).body);
    const created = await customersRepo.create(body);
    reply.code(201);
    return { data: created, error: null };
  });

  // Get customer by ID
  server.get('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const customer = await customersRepo.findById(id);
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }
    return { data: customer, error: null };
  });

  // Update customer
  server.put('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).optional(),
      contactEmail: z.string().email().optional()
    }).parse((req as any).body);

    const customer = await customersRepo.findById(id);
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }

    const updated = await customersRepo.update(id, body);
    return { data: updated, error: null };
  });

  // Delete (archive) customer
  server.delete('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const customer = await customersRepo.findById(id);
    if (!customer) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }

    const archived = await customersRepo.archive(id);
    return { data: archived, error: null };
  });
}
