/**
 * Consolidations (#329): one truck run carrying several shipments. Writes go through the
 * consolidation commands; reads come from ConsolidationRepository. Writes need `shipments:write`,
 * since building a run is shipment planning.
 *
 * Response schemas use `data: {}` so fast-json-stringify passes the payload through untouched.
 */

import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyReply } from 'fastify';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CommandResult, commandFailureStatus } from '../commands/types.js';
import { IConsolidationRepository } from '../repositories/ConsolidationRepository.js';
import {
  CREATE_CONSOLIDATION,
  UPDATE_CONSOLIDATION,
  ADD_SHIPMENTS_TO_CONSOLIDATION,
  REMOVE_SHIPMENT_FROM_CONSOLIDATION,
  ARCHIVE_CONSOLIDATION,
  TRANSITION_CONSOLIDATION_STATUS,
  REORDER_CONSOLIDATION_STOPS,
} from '../commands/consolidations/index.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { guardWrites } from '../auth/guardWrites.js';

const MAX_PER_PAGE = 100;
const TAGS = ['Consolidations'];
const envelope = { type: 'object' as const, properties: { data: {}, error: { type: ['string', 'null'] as const } } };
const listEnvelope = { type: 'object' as const, properties: { data: {}, meta: {}, error: { type: ['string', 'null'] as const } } };
const idParams = { type: 'object' as const, required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } };
const shipmentIds = { type: 'array' as const, minItems: 1, maxItems: 50, items: { type: 'string', format: 'uuid' } };
const nullableId = { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] };
const nullableNotes = { anyOf: [{ type: 'string', maxLength: 2000 }, { type: 'null' }] };
const devices = {
  type: 'array' as const,
  maxItems: 10,
  items: {
    type: 'object' as const,
    required: ['name', 'externalId'],
    additionalProperties: false,
    properties: { name: { type: 'string', minLength: 1, maxLength: 100 }, externalId: { type: 'string', minLength: 1, maxLength: 100 } },
  },
};

function send(reply: FastifyReply, result: CommandResult, okStatus = 200) {
  if (!result.success) {
    reply.code(commandFailureStatus(result.error));
    return { data: null, error: result.error ?? 'Request failed' };
  }
  reply.code(okStatus);
  return { data: result.data, error: null };
}

export async function consolidationRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const repo = container.resolve<IConsolidationRepository>(TOKENS.IConsolidationRepository);

  await registerOrgScope(server);
  server.addHook('preHandler', guardWrites('shipments'));

  server.get('/api/v1/consolidations', {
    schema: {
      tags: TAGS,
      summary: 'List consolidations',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          perPage: { type: 'integer', minimum: 1, maximum: MAX_PER_PAGE, default: 25 },
          archived: { type: 'boolean', default: false },
        },
      },
      response: { 200: listEnvelope },
    },
  }, async (req) => {
    const { page, perPage, archived } = req.query as { page: number; perPage: number; archived: boolean };
    const { items, total } = await repo.list(req.orgId!, { archived, limit: perPage, offset: (page - 1) * perPage });
    return { data: items, meta: { page, perPage, total }, error: null };
  });

  server.get('/api/v1/consolidations/candidates', {
    schema: {
      tags: TAGS,
      summary: 'Shipments that can join a consolidation',
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', maxLength: 100 },
          perPage: { type: 'integer', minimum: 1, maximum: MAX_PER_PAGE, default: 25 },
        },
      },
      response: { 200: envelope },
    },
  }, async (req) => {
    const { search, perPage } = req.query as { search?: string; perPage: number };
    return { data: await repo.listCandidates(req.orgId!, search?.trim() || undefined, perPage), error: null };
  });

  server.get('/api/v1/consolidations/:id', {
    schema: { tags: TAGS, summary: 'Get a consolidation with its stops and shipments', params: idParams, response: { 200: envelope, 404: envelope } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const consolidation = await repo.findDetail(req.orgId!, id);
    if (!consolidation) {
      reply.code(404);
      return { data: null, error: 'Consolidation not found' };
    }
    return { data: consolidation, error: null };
  });

  server.post('/api/v1/consolidations', {
    schema: {
      tags: TAGS,
      summary: 'Create a consolidation from shipments',
      body: {
        type: 'object',
        required: ['shipmentIds'],
        additionalProperties: false,
        properties: { shipmentIds, carrierId: nullableId, notes: nullableNotes },
      },
      response: { 201: envelope, 400: envelope, 404: envelope },
    },
  }, async (req, reply) => {
    const result = await commandBus.dispatch({
      type: CREATE_CONSOLIDATION,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      metadata: { correlationId: randomUUID(), source: 'api' },
      payload: req.body as { shipmentIds: string[]; carrierId?: string | null; notes?: string | null },
    });
    return send(reply, result, 201);
  });

  server.patch('/api/v1/consolidations/:id', {
    schema: {
      tags: TAGS,
      summary: 'Update a consolidation',
      params: idParams,
      body: { type: 'object', additionalProperties: false, properties: { carrierId: nullableId, notes: nullableNotes, devices } },
      response: { 200: envelope, 400: envelope, 404: envelope },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await commandBus.dispatch({
      type: UPDATE_CONSOLIDATION,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      metadata: { correlationId: randomUUID(), source: 'api' },
      payload: { id, ...(req.body as { carrierId?: string | null; notes?: string | null; devices?: Array<{ name: string; externalId: string }> }) },
    });
    return send(reply, result);
  });

  server.post('/api/v1/consolidations/:id/shipments', {
    schema: {
      tags: TAGS,
      summary: 'Add shipments to a draft consolidation',
      params: idParams,
      body: { type: 'object', required: ['shipmentIds'], additionalProperties: false, properties: { shipmentIds } },
      response: { 200: envelope, 400: envelope, 404: envelope },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await commandBus.dispatch({
      type: ADD_SHIPMENTS_TO_CONSOLIDATION,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      metadata: { correlationId: randomUUID(), source: 'api' },
      payload: { id, shipmentIds: (req.body as { shipmentIds: string[] }).shipmentIds },
    });
    return send(reply, result);
  });

  // A POST, not a DELETE: taking a shipment off a draft plan is an edit, so it needs
  // shipments:write rather than shipments:delete.
  server.post('/api/v1/consolidations/:id/shipments/:shipmentId/remove', {
    schema: {
      tags: TAGS,
      summary: 'Remove a shipment from a draft consolidation',
      params: {
        type: 'object',
        required: ['id', 'shipmentId'],
        properties: { id: { type: 'string', format: 'uuid' }, shipmentId: { type: 'string', format: 'uuid' } },
      },
      response: { 200: envelope, 400: envelope, 404: envelope },
    },
  }, async (req, reply) => {
    const { id, shipmentId } = req.params as { id: string; shipmentId: string };
    const result = await commandBus.dispatch({
      type: REMOVE_SHIPMENT_FROM_CONSOLIDATION,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      metadata: { correlationId: randomUUID(), source: 'api' },
      payload: { id, shipmentId },
    });
    return send(reply, result);
  });

  server.post('/api/v1/consolidations/:id/status', {
    schema: {
      tags: TAGS,
      summary: 'Mark a consolidation ready, or move it back to draft',
      params: idParams,
      body: { type: 'object', required: ['to'], additionalProperties: false, properties: { to: { type: 'string', enum: ['draft', 'ready'] } } },
      response: { 200: envelope, 400: envelope, 404: envelope },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await commandBus.dispatch({
      type: TRANSITION_CONSOLIDATION_STATUS,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      metadata: { correlationId: randomUUID(), source: 'api' },
      payload: { id, to: (req.body as { to: 'draft' | 'ready' }).to },
    });
    return send(reply, result);
  });

  server.post('/api/v1/consolidations/:id/stops/order', {
    schema: {
      tags: TAGS,
      summary: 'Set the order a draft consolidation visits its stops',
      params: idParams,
      body: {
        type: 'object',
        required: ['stopIds'],
        additionalProperties: false,
        properties: { stopIds: { type: 'array', minItems: 1, maxItems: 200, items: { type: 'string', format: 'uuid' } } },
      },
      response: { 200: envelope, 400: envelope, 404: envelope },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await commandBus.dispatch({
      type: REORDER_CONSOLIDATION_STOPS,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      metadata: { correlationId: randomUUID(), source: 'api' },
      payload: { id, stopIds: (req.body as { stopIds: string[] }).stopIds },
    });
    return send(reply, result);
  });

  server.post('/api/v1/consolidations/:id/archive', {
    schema: { tags: TAGS, summary: 'Archive a consolidation', params: idParams, response: { 200: envelope, 400: envelope, 404: envelope } },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await commandBus.dispatch({
      type: ARCHIVE_CONSOLIDATION,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      metadata: { correlationId: randomUUID(), source: 'api' },
      payload: { id },
    });
    return send(reply, result);
  });
}
