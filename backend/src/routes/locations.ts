import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ILocationsRepository } from '../repositories/LocationsRepository.js';
import { IArrivalCriteriaRepository } from '../repositories/ArrivalCriteriaRepository.js';
import { ILocationResolutionService } from '../services/LocationResolutionService.js';
import { container, TOKENS } from '../di/index.js';
import { IEventBus, EVENT_TYPES, createEvent } from '../events/index.js';

export async function locationRoutes(server: FastifyInstance) {
  const locationsRepo = container.resolve<ILocationsRepository>(TOKENS.ILocationsRepository);
  const arrivalCriteriaRepo = container.resolve<IArrivalCriteriaRepository>(TOKENS.IArrivalCriteriaRepository);
  const locationResolutionService = container.resolve<ILocationResolutionService>(TOKENS.ILocationResolutionService);

  /** Publish a location domain event (best-effort, non-blocking) */
  async function publishLocationEvent(
    type: string,
    locationId: string,
    payload: Record<string, unknown>,
    actorId?: string,
  ) {
    try {
      const eventBus = container.resolve<IEventBus>(TOKENS.IEventBus);
      const org = await server.prisma.organization.findFirst({ select: { id: true } });
      await eventBus.publish(createEvent({
        type,
        orgId: org?.id || 'default',
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

  // Get all locations (with arrival criteria count)
  server.get('/api/v1/locations', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const locations = await server.prisma.location.findMany({
      where: { archived: false },
      include: {
        arrivalCriteria: { where: { active: true }, select: { id: true, criteriaType: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
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

    // Use resolution service to create with default arrival criteria.
    // The service emits LOCATION_CREATED for new locations automatically.
    // For existing locations (resolved, not created), publish LOCATION_UPDATED.
    const result = await locationResolutionService.resolveOrCreate(body, req.user?.sub);

    if (!result.created) {
      await publishLocationEvent(
        EVENT_TYPES.LOCATION_UPDATED,
        result.location.id,
        { locationName: result.location.name, source: 'manual', created: false },
        req.user?.sub,
      );
    }

    reply.code(result.created ? 201 : 200);
    // Fetch with arrival criteria
    const full = await server.prisma.location.findUnique({
      where: { id: result.location.id },
      include: { arrivalCriteria: { where: { active: true } } },
    });
    return { data: full, error: null };
  });

  // Get location by ID (with arrival criteria)
  server.get('/api/v1/locations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const location = await server.prisma.location.findFirst({
      where: { id, archived: false },
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

    const location = await locationsRepo.findById(id);
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
    }, req.user?.sub);

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

    await publishLocationEvent(EVENT_TYPES.LOCATION_ARCHIVED, id, {
      locationName: location.name,
    }, req.user?.sub);

    return { data: archived, error: null };
  });
}
