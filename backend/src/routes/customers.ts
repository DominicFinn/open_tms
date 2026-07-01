import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ICustomersRepository } from '../repositories/CustomersRepository.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CUSTOMER } from '../commands/customers/CreateCustomerCommand.js';
import { UPDATE_CUSTOMER } from '../commands/customers/UpdateCustomerCommand.js';
import { ARCHIVE_CUSTOMER } from '../commands/customers/ArchiveCustomerCommand.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { guardWrites } from '../auth/guardWrites.js';

export async function customerRoutes(server: FastifyInstance) {
  const customersRepo = container.resolve<ICustomersRepository>(TOKENS.ICustomersRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // Multi-tenancy: registers a preHandler that populates req.orgId on
  // every request before any handler in this plugin runs.
  await registerOrgScope(server);
  server.addHook('preHandler', guardWrites('customers'));

  // Get all customers — scoped to the requesting JWT's org.
  server.get('/api/v1/customers', async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = req.orgId!;
    const customers = await customersRepo.all(orgId);
    return { data: customers, error: null };
  });

  // Create customer
  server.post('/api/v1/customers', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().min(1),
      contactEmail: z.string().email().optional()
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const result = await commandBus.dispatch({
      type: CREATE_CUSTOMER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { ...body, orgId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    const created = await customersRepo.findById((result.data as any).id, orgId);
    reply.code(201);
    return { data: created, error: null };
  });

  // Get customer by ID — 404 (not 403) when the row exists in another tenant
  server.get('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const customer = await customersRepo.findById(id, orgId);
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

    const orgId = req.orgId!;
    // Guard the update against cross-tenant access too: refuse if the row
    // belongs to a different org. This goes before dispatch so we don't
    // emit an "I tried to update something I can't see" event log.
    const existing = await customersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_CUSTOMER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await customersRepo.findById(id, orgId);
    return { data: updated, error: null };
  });

  // Delete (archive) customer
  server.delete('/api/v1/customers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.orgId!;
    const existing = await customersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Customer not found' };
    }

    const result = await commandBus.dispatch({
      type: ARCHIVE_CUSTOMER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(404);
      return { data: null, error: result.error };
    }

    const archived = await customersRepo.findById(id, orgId);
    return { data: archived, error: null };
  });
}
