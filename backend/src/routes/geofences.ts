import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import {
  radiusOutOfBoundsMessage,
  polygonAreaOutOfBoundsMessage,
} from '@open-tms/shared';
import { IGeofenceRepository } from '../repositories/GeofenceRepository.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_GEOFENCE } from '../commands/geofences/CreateGeofenceCommand.js';
import { UPDATE_GEOFENCE } from '../commands/geofences/UpdateGeofenceCommand.js';
import { ARCHIVE_GEOFENCE } from '../commands/geofences/ArchiveGeofenceCommand.js';
import { statusForGeofenceError } from '../commands/geofences/errors.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { guardWrites } from '../auth/guardWrites.js';

const radialGeometrySchema = z
  .object({
    centerLat: z.number(),
    centerLng: z.number(),
    radiusMeters: z.number().positive(),
  })
  .refine((g) => radiusOutOfBoundsMessage(g.radiusMeters) === null, (g) => ({
    message: radiusOutOfBoundsMessage(g.radiusMeters) ?? 'Radius out of bounds',
    path: ['radiusMeters'],
  }));

const polygonGeometrySchema = z
  .object({
    points: z.array(z.object({ lat: z.number(), lng: z.number() })).min(3),
  })
  .refine((g) => polygonAreaOutOfBoundsMessage(g.points) === null, (g) => ({
    message: polygonAreaOutOfBoundsMessage(g.points) ?? 'Polygon area out of bounds',
    path: ['points'],
  }));

// Whitelisted, not freeform (security rule: whitelist allowed values). "location" is the only
// entityType with UI/wiring today; extend this alongside CreateGeofenceCommand's existence check
// when a second entity type is wired in.
const GEOFENCE_ENTITY_TYPES = ['location'] as const;

const createGeofenceBodySchema = z
  .object({
    entityType: z.enum(GEOFENCE_ENTITY_TYPES),
    entityId: z.string().min(1),
    name: z.string().optional(),
    shapeType: z.enum(['radial', 'polygon']),
    geometry: z.union([radialGeometrySchema, polygonGeometrySchema]),
  })
  .refine(
    (b) => (b.shapeType === 'radial' ? 'radiusMeters' in b.geometry : 'points' in b.geometry),
    { message: 'geometry shape must match shapeType', path: ['geometry'] }
  );

const updateGeofenceBodySchema = z
  .object({
    name: z.string().optional(),
    shapeType: z.enum(['radial', 'polygon']).optional(),
    geometry: z.union([radialGeometrySchema, polygonGeometrySchema]).optional(),
  })
  .refine(
    (b) =>
      b.shapeType === undefined ||
      b.geometry === undefined ||
      (b.shapeType === 'radial' ? 'radiusMeters' in b.geometry : 'points' in b.geometry),
    { message: 'geometry shape must match shapeType', path: ['geometry'] }
  );

/**
 * Geofences — polymorphic geometry storage, attachable to any entity type.
 *
 * Currently only "location" has UI/wiring (VNextCreateLocation.tsx), so writes are gated on the
 * `locations` permission resource rather than a standalone `geofences` one: a geofence is part of
 * managing the location it's drawn on, and roles that can edit a location (e.g. broker_admin,
 * broker_agent) should be able to edit its geofence without a separate grant. Revisit this if a
 * second entity type with different write permissions gets wired in.
 *
 * "What counts as being inside a geofence" (arrival/departure detection) is intentionally not
 * implemented here — see ArrivalCriteria / ArrivalCriteriaEvaluationService for that, unrelated.
 */
export async function geofenceRoutes(server: FastifyInstance) {
  await registerOrgScope(server);
  server.addHook('preHandler', guardWrites('locations'));

  const geofenceRepo = container.resolve<IGeofenceRepository>(TOKENS.IGeofenceRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  server.get('/api/v1/geofences', {
    schema: {
      tags: ['Geofences'],
      description: 'List active geofences for an entity',
      querystring: {
        type: 'object',
        required: ['entityType', 'entityId'],
        properties: {
          entityType: { type: 'string' },
          entityId: { type: 'string' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
    if (!entityType || !entityId) {
      reply.code(400);
      return { data: null, error: 'entityType and entityId are required' };
    }

    const orgId = req.orgId!;
    const geofences = await geofenceRepo.findByEntity(entityType, entityId, orgId);
    return { data: geofences, error: null };
  });

  server.post('/api/v1/geofences', {
    schema: {
      tags: ['Geofences'],
      description: 'Create a geofence (radial or polygon) attached to an entity',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createGeofenceBodySchema.safeParse((req as any).body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.message };
    }
    const body = parsed.data;

    const orgId = req.orgId!;
    const result = await commandBus.dispatch({
      type: CREATE_GEOFENCE,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(statusForGeofenceError(result.error));
      return { data: null, error: result.error ?? 'Failed to create geofence' };
    }

    const created = await geofenceRepo.findById((result.data as { id: string }).id, orgId);
    reply.code(201);
    return { data: created, error: null };
  });

  server.put('/api/v1/geofences/:id', {
    schema: {
      tags: ['Geofences'],
      description: 'Update a geofence',
      params: { type: 'object', properties: { id: { type: 'string' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const parsed = updateGeofenceBodySchema.safeParse((req as any).body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.message };
    }
    const body = parsed.data;

    const orgId = req.orgId!;
    const existing = await geofenceRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Geofence not found' };
    }

    const result = await commandBus.dispatch({
      type: UPDATE_GEOFENCE,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { geofenceId: id, ...body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to update geofence' };
    }

    const updated = await geofenceRepo.findById(id, orgId);
    return { data: updated, error: null };
  });

  server.delete('/api/v1/geofences/:id', {
    schema: {
      tags: ['Geofences'],
      description: 'Archive a geofence',
      params: { type: 'object', properties: { id: { type: 'string' } } },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.orgId!;
    const existing = await geofenceRepo.findById(id, orgId);
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'Geofence not found' };
    }

    const result = await commandBus.dispatch({
      type: ARCHIVE_GEOFENCE,
      orgId,
      actorId: req.user?.sub ?? null,
      payload: { geofenceId: id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to archive geofence' };
    }

    return { data: { archived: true }, error: null };
  });
}
