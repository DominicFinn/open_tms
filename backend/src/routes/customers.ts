import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ICustomersRepository } from '../repositories/CustomersRepository.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CUSTOMER } from '../commands/customers/CreateCustomerCommand.js';
import { UPDATE_CUSTOMER } from '../commands/customers/UpdateCustomerCommand.js';
import { ARCHIVE_CUSTOMER } from '../commands/customers/ArchiveCustomerCommand.js';

export async function customerRoutes(server: FastifyInstance) {
  const customersRepo = container.resolve<ICustomersRepository>(TOKENS.ICustomersRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

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

    const result = await commandBus.dispatch({
      type: CREATE_CUSTOMER,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const created = await customersRepo.findById((result.data as any).id);
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

    const result = await commandBus.dispatch({
      type: UPDATE_CUSTOMER,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await customersRepo.findById(id);
    return { data: updated, error: null };
  });

  // Delete (archive) customer
  server.delete('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const result = await commandBus.dispatch({
      type: ARCHIVE_CUSTOMER,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(404);
      return { data: null, error: result.error };
    }

    const archived = await customersRepo.findById(id);
    return { data: archived, error: null };
  });
}
