import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { IArrivalCriteriaRepository } from '../repositories/ArrivalCriteriaRepository.js';
import { ILocationResolutionService } from '../services/LocationResolutionService.js';
import { container, TOKENS } from '../di/index.js';
import { IEventBus, EVENT_TYPES, createEvent } from '../events/index.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { guardWrites } from '../auth/guardWrites.js';

export async function locationRoutes(server: FastifyInstance) {
  const locationsRepo = container.resolve<ILocationsRepository>(TOKENS.ILocationsRepository);
  const arrivalCriteriaRepo = container.resolve<IArrivalCriteriaRepository>(TOKENS.IArrivalCriteriaRepository);
  const locationResolutionService = container.resolve<ILocationResolutionService>(TOKENS.ILocationResolutionService);

  await registerOrgScope(server);
  server.addHook('preHandler', guardWrites('locations'));

  /** Publish a location domain event (best-effort, non-blocking) */
  async function publishLocationEvent(
    type: string,
    locationId: string,
    payload: Record<string, unknown>,
    orgId: string,
    actorId?: string,
  ) {
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      await eventBus.publish(createEvent({
        type,
        orgId,
        actorId: actorId ?? null,
        entityType: 'location',
        entityId: locationId,
        payload,
        source: 'api',
      }));
    } catch (err) {
      server.log.warn('Failed to publish location event: ' + (err as Error).message);
    }
  }

  // Get all locations (with arrival criteria count). Defaults to 500 for
  // backwards compatibility with callers that don't paginate; explicit
  // `limit` and `offset` query params let clients page through larger sets.
  // X-Total-Count surfaces the unpaged total without changing the data shape.
  server.get('/api/v1/locations', async (req: FastifyRequest, reply: FastifyReply) => {
    const q = req.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(Number(q.limit) || 500, 1), 1000);
    const offset = Math.max(Number(q.offset) || 0, 0);
    // Multi-tenancy: scope to the requesting tenant.
    const orgId = req.orgId!;
    const where: any = { archived: false, orgId };
    const [locations, total] = await Promise.all([
      server.prisma.location.findMany({
        where,
        include: {
          arrivalCriteria: { where: { active: true }, select: { id: true, criteriaType: true } },
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      server.prisma.location.count({ where }),
    ]);
    reply.header('X-Total-Count', String(total));
    return { data: locations, error: null };
  });

  // Valid location types
  const LOCATION_TYPES = ['warehouse', 'distribution_centre', 'cross_dock', 'terminal', 'port', 'rail_yard', 'customer', 'store', 'manufacturing'] as const;

  // Shared schema for location metadata fields
  const locationMetadataSchema = {
    locationType: z.enum(LOCATION_TYPES).optional(),
    facilityCapabilities: z.record(z.boolean()).optional(),
    operatingHours: z.record(z.object({ open: z.string(), close: z.string() })).optional(),
    appointmentRequired: z.boolean().optional(),
    dockCount: z.number().int().min(0).optional(),
    maxTrailerLengthFt: z.number().int().min(0).optional(),
    contactName: z.string().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
  };

  // Create location — always creates a default geofence arrival criteria
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
        lng: z.number().optional(),
        ...locationMetadataSchema,
      })
      .parse((req as any).body);

    const orgId = req.orgId!;
    // Use resolution service to create with default arrival criteria.
    // The service emits LOCATION_CREATED for new locations automatically.
    // For existing locations (resolved, not created), publish LOCATION_UPDATED.
    const result = await locationResolutionService.resolveOrCreate({ ...body, orgId }, req.user?.sub);

    if (!result.created) {
      await publishLocationEvent(
        EVENT_TYPES.LOCATION_UPDATED,
        result.location.id,
        { locationName: result.location.name, source: 'manual', created: false },
        orgId,
        req.user?.sub,
      );
    }

    reply.code(result.created ? 201 : 200);
    // Fetch with arrival criteria, scoped to this tenant.
    const full = await server.prisma.location.findFirst({
      where: { id: result.location.id, orgId },
      include: { arrivalCriteria: { where: { active: true } } },
    });
    return { data: full, error: null };
  });

  // Get location by ID (with arrival criteria)
  server.get('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const orgId = req.orgId!;
    const location = await server.prisma.location.findFirst({
      where: { id, archived: false, orgId },
      include: { arrivalCriteria: { where: { active: true } } },
    });
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
      lng: z.number().optional(),
      ...locationMetadataSchema,
    }).parse((req as any).body);

    const orgId = req.orgId!;
    const location = await locationsRepo.findById(id, orgId);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }

    const updated = await locationsRepo.update(id, body);

    // Ensure arrival criteria exist after edit
    await locationResolutionService.ensureArrivalCriteria(id);

    // Build change tracking
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(body) as (keyof typeof body)[]) {
      if (body[key] !== undefined && (location as any)[key] !== body[key]) {
        changes[key] = { before: (location as any)[key], after: body[key] };
      }
    }

    await publishLocationEvent(EVENT_TYPES.LOCATION_UPDATED, id, {
      locationName: updated.name,
      changes,
    }, orgId, req.user?.sub);

    return { data: updated, error: null };
  });

  // Location search endpoint
  server.get('/api/v1/locations/search', async (req: FastifyRequest, reply: FastifyReply) => {
    const { q } = req.query as { q?: string };

    if (!q || q.trim().length < 2) {
      return { data: [], error: null };
    }

    const orgId = req.orgId!;
    const locations = await locationsRepo.search(q, orgId);
    return { data: locations, error: null };
  });

  // Delete (archive) location — no command handler for archive yet,
  // use repo directly (location archival is rare and doesn't need events)
  server.delete('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.orgId!;
    const location = await locationsRepo.findById(id, orgId);
    if (!location) {
      reply.code(404);
      return { data: null, error: 'Location not found' };
    }

    const archived = await locationsRepo.archive(id);

    await publishLocationEvent(EVENT_TYPES.LOCATION_ARCHIVED, id, {
      locationName: location.name,
    }, orgId, req.user?.sub);

    return { data: archived, error: null };
  });
}
