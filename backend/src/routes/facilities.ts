/**
 * Facility routes (Phase 2a, #217).
 *
 * The org-scoped WMS replacement for the unfiltered `/api/v1/locations` list the warehouse
 * surfaces read today. Nothing consumes it yet; the frontend migrates in a later chunk.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { IFacilityRepository } from '../repositories/FacilityRepository.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_FACILITY } from '../commands/facilities/CreateFacilityCommand.js';
import { UPDATE_FACILITY } from '../commands/facilities/UpdateFacilityCommand.js';
import { ARCHIVE_FACILITY } from '../commands/facilities/ArchiveFacilityCommand.js';
import { registerWmsGuard } from '../auth/wmsGuard.js';

const MAX_PER_PAGE = 100;
const DEFAULT_PER_PAGE = 50;

const ADDRESS_PROPERTIES = {
  address1: { type: 'string', nullable: true },
  address2: { type: 'string', nullable: true },
  city: { type: 'string', nullable: true },
  state: { type: 'string', nullable: true },
  postalCode: { type: 'string', nullable: true },
  country: { type: 'string', nullable: true },
  timezone: { type: 'string', nullable: true },
} as const;

function toDto(facility: {
  id: string; name: string; code: string | null; sourceLocationId: string | null;
  address1: string | null; address2: string | null; city: string | null; state: string | null;
  postalCode: string | null; country: string | null; timezone: string | null;
  active: boolean; archived: boolean;
}) {
  return {
    id: facility.id,
    name: facility.name,
    code: facility.code,
    sourceLocationId: facility.sourceLocationId,
    address: {
      address1: facility.address1,
      address2: facility.address2,
      city: facility.city,
      state: facility.state,
      postalCode: facility.postalCode,
      country: facility.country,
    },
    timezone: facility.timezone,
    active: facility.active,
    archived: facility.archived,
  };
}

export async function facilityRoutes(server: FastifyInstance) {
  // WMS permission guard (#134): wms:read for reads, wms:write for mutations
  await registerWmsGuard(server);

  const repo = container.resolve<IFacilityRepository>(TOKENS.IFacilityRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  server.get('/api/v1/facilities', {
    schema: {
      tags: ['WMS - Facilities'],
      summary: 'List facilities for the current organisation',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          perPage: { type: 'integer', minimum: 1, maximum: MAX_PER_PAGE, default: DEFAULT_PER_PAGE },
          includeArchived: { type: 'boolean', default: false },
        },
      },
    },
  }, async (req: FastifyRequest) => {
    const { page = 1, perPage = DEFAULT_PER_PAGE, includeArchived = false } =
      req.query as { page?: number; perPage?: number; includeArchived?: boolean };

    const { rows, total } = await repo.findMany({
      orgId: req.orgId!,
      includeArchived,
      page,
      perPage,
    });

    return { data: rows.map(toDto), meta: { page, perPage, total }, error: null };
  });

  server.get<{ Params: { id: string } }>('/api/v1/facilities/:id', {
    schema: {
      tags: ['WMS - Facilities'],
      summary: 'Get a facility',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req, reply: FastifyReply) => {
    // A cross-tenant id misses rather than 403s, so existence stays opaque.
    const facility = await repo.findById(req.orgId!, req.params.id);
    if (!facility) {
      return reply.code(404).send({ data: null, error: 'Facility not found' });
    }
    return { data: toDto(facility), error: null };
  });

  server.post('/api/v1/facilities', {
    schema: {
      tags: ['WMS - Facilities'],
      summary: 'Create a facility',
      body: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          code: { type: 'string', maxLength: 20, nullable: true },
          sourceLocationId: { type: 'string', format: 'uuid', nullable: true },
          ...ADDRESS_PROPERTIES,
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await commandBus.dispatch({
      type: CREATE_FACILITY,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: req.body,
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      return reply.code(400).send({ data: null, error: result.error });
    }
    return reply.code(201).send({ data: result.data, error: null });
  });

  server.put<{ Params: { id: string } }>('/api/v1/facilities/:id', {
    schema: {
      tags: ['WMS - Facilities'],
      summary: 'Update a facility',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          code: { type: 'string', maxLength: 20, nullable: true },
          active: { type: 'boolean' },
          ...ADDRESS_PROPERTIES,
        },
      },
    },
  }, async (req, reply: FastifyReply) => {
    const result = await commandBus.dispatch({
      type: UPDATE_FACILITY,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { facilityId: req.params.id, ...(req.body as Record<string, unknown>) },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const notFound = result.error?.includes('not found');
      return reply.code(notFound ? 404 : 400).send({ data: null, error: result.error });
    }
    return reply.send({ data: result.data, error: null });
  });

  server.post<{ Params: { id: string } }>('/api/v1/facilities/:id/archive', {
    schema: {
      tags: ['WMS - Facilities'],
      summary: 'Archive a facility',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } },
    },
  }, async (req, reply: FastifyReply) => {
    const result = await commandBus.dispatch({
      type: ARCHIVE_FACILITY,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { facilityId: req.params.id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return reply.code(404).send({ data: null, error: result.error });
      }
      // Active zones under the facility is a state conflict, not a malformed request.
      const conflict = result.error?.includes('active zones');
      return reply.code(conflict ? 409 : 400).send({ data: null, error: result.error });
    }
    return reply.send({ data: result.data, error: null });
  });
}
