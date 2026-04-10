import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ICarriersRepository } from '../repositories/CarriersRepository.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CARRIER } from '../commands/carriers/CreateCarrierCommand.js';
import { UPDATE_CARRIER } from '../commands/carriers/UpdateCarrierCommand.js';
import { ARCHIVE_CARRIER } from '../commands/carriers/ArchiveCarrierCommand.js';

export async function carrierRoutes(server: FastifyInstance) {
  const carriersRepo = container.resolve<ICarriersRepository>(TOKENS.ICarriersRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // Resolve org ID once
  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

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
        scacCode: z.string().max(4).optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        address1: z.string().optional(),
        address2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        validationTier: z.string().optional(),
        registrationChecked: z.boolean().optional(),
        insuranceDocReceived: z.boolean().optional(),
        insuranceVerified: z.boolean().optional(),
        identityConfirmed: z.boolean().optional(),
        complianceChecked: z.boolean().optional(),
        validationNotes: z.string().optional(),
        validatedAt: z.string().datetime().optional(),
        validatedBy: z.string().optional()
      })
      .parse((req as any).body);

    const result = await commandBus.dispatch({
      type: CREATE_CARRIER,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    // Fetch full carrier for response (command returns minimal data)
    const created = await carriersRepo.findById((result.data as any).id);
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
      scacCode: z.string().max(4).optional(),
      contactName: z.string().optional(),
      contactEmail: z.string().email().optional(),
      contactPhone: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      validationTier: z.string().optional(),
      registrationChecked: z.boolean().optional(),
      insuranceDocReceived: z.boolean().optional(),
      insuranceVerified: z.boolean().optional(),
      identityConfirmed: z.boolean().optional(),
      complianceChecked: z.boolean().optional(),
      validationNotes: z.string().optional(),
      validatedAt: z.string().datetime().optional(),
      validatedBy: z.string().optional()
    }).parse((req as any).body);

    const result = await commandBus.dispatch({
      type: UPDATE_CARRIER,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await carriersRepo.findById(id);
    return { data: updated, error: null };
  });

  // Delete (archive) carrier
  server.delete('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const result = await commandBus.dispatch({
      type: ARCHIVE_CARRIER,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(404);
      return { data: null, error: result.error };
    }

    const archived = await carriersRepo.findById(id);
    return { data: archived, error: null };
  });
}
