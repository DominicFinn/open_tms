import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { ICarriersRepository } from '../repositories/CarriersRepository.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_CARRIER } from '../commands/carriers/CreateCarrierCommand.js';
import { UPDATE_CARRIER } from '../commands/carriers/UpdateCarrierCommand.js';
import { ARCHIVE_CARRIER } from '../commands/carriers/ArchiveCarrierCommand.js';
import { UNARCHIVE_CARRIER } from '../commands/carriers/UnarchiveCarrierCommand.js';
import { SOFT_DELETE_CARRIER } from '../commands/carriers/SoftDeleteCarrierCommand.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';

// Treat an empty string as "not provided" so a blank optional field (e.g. a
// carrier with no email yet) doesn't fail format validation.
const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema);

export async function carrierRoutes(server: FastifyInstance) {
  const carriersRepo = container.resolve<ICarriersRepository>(TOKENS.ICarriersRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  await registerOrgScope(server);

  // Get all carriers — scoped to the requesting JWT's org.
  server.get('/api/v1/carriers', async (req: FastifyRequest, _reply: FastifyReply) => {
    const orgId = req.orgId!;
    // ?includeArchived=true returns archived carriers too (management list).
    const includeArchived = (req.query as any)?.includeArchived === 'true';
    const carriers = await carriersRepo.all(orgId, { includeArchived });
    return { data: carriers, error: null };
  });

  // Get carrier by ID — 404 (not 403) when the row belongs to another tenant.
  server.get('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const carrier = await carriersRepo.findById(id, orgId);
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
        scacCode: emptyToUndef(z.string().max(4).optional()),
        contactName: z.string().optional(),
        // Optional — a blank email must not fail validation.
        contactEmail: emptyToUndef(z.string().email().optional()),
        contactPhone: z.string().optional(),
        address1: z.string().optional(),
        address2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        paymentTermsDays: z.coerce.number().int().nonnegative().optional(),
        currency: z.string().optional(),
        validationTier: z.string().optional(),
        registrationChecked: z.boolean().optional(),
        insuranceDocReceived: z.boolean().optional(),
        insuranceVerified: z.boolean().optional(),
        identityConfirmed: z.boolean().optional(),
        complianceChecked: z.boolean().optional(),
        validationNotes: z.string().optional(),
        validatedAt: emptyToUndef(z.string().datetime().optional()),
        validatedBy: z.string().optional()
      })
      .parse((req as any).body);

    const orgId = req.orgId!;
    const result = await commandBus.dispatch({
      type: CREATE_CARRIER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { ...body, orgId },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }

    // Fetch full carrier for response (command returns minimal data)
    const created = await carriersRepo.findById((result.data as any).id, orgId);
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
      scacCode: emptyToUndef(z.string().max(4).optional()),
      contactName: z.string().optional(),
      contactEmail: emptyToUndef(z.string().email().optional()),
      contactPhone: z.string().optional(),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      paymentTermsDays: z.coerce.number().int().nonnegative().optional(),
      currency: z.string().optional(),
      validationTier: z.string().optional(),
      registrationChecked: z.boolean().optional(),
      insuranceDocReceived: z.boolean().optional(),
      insuranceVerified: z.boolean().optional(),
      identityConfirmed: z.boolean().optional(),
      complianceChecked: z.boolean().optional(),
      validationNotes: z.string().optional(),
      validatedAt: emptyToUndef(z.string().datetime().optional()),
      validatedBy: z.string().optional()
    }).parse((req as any).body);

    const orgId = req.orgId!;
    // Guard cross-tenant updates: if the row is owned by another org we
    // hide its existence and return 404, never reaching the command bus.
    const existing = await carriersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_CARRIER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    const updated = await carriersRepo.findById(id, orgId);
    return { data: updated, error: null };
  });

  // Archive a carrier — normal-user action. Stops it being selected/used and
  // logs out its portal users, but keeps it available to finance/admin.
  // TODO(auth): gate with requirePermission(CARRIERS_WRITE) once the app
  // frontend attaches JWTs (dev currently runs unauthenticated).
  server.post('/api/v1/carriers/:id/archive', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const existing = await carriersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const result = await commandBus.dispatch({
      type: ARCHIVE_CARRIER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: await carriersRepo.findById(id, orgId), error: null };
  });

  // Unarchive — finance/admin action to bring a carrier back into circulation.
  server.post('/api/v1/carriers/:id/unarchive', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const existing = await carriersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const result = await commandBus.dispatch({
      type: UNARCHIVE_CARRIER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    return { data: await carriersRepo.findById(id, orgId), error: null };
  });

  // Soft-delete a carrier — admin action, for accidental creates / dev cleanup.
  // A carrier assigned to any lane cannot be deleted (only archived); the
  // command enforces this and the error surfaces as a 400.
  // TODO(auth): gate with requirePermission(CARRIERS_DELETE) once the frontend
  // attaches JWTs; for now the UI only shows Delete to admins.
  server.delete('/api/v1/carriers/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const existing = await carriersRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Carrier not found' };
    }

    const result = await commandBus.dispatch({
      type: SOFT_DELETE_CARRIER,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }

    return { data: { id, deleted: true }, error: null };
  });
}
