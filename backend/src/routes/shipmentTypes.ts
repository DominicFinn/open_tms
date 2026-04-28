import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { IShipmentTypesRepository } from '../repositories/ShipmentTypesRepository.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_SHIPMENT_TYPE } from '../commands/shipmentTypes/CreateShipmentTypeCommand.js';
import { UPDATE_SHIPMENT_TYPE } from '../commands/shipmentTypes/UpdateShipmentTypeCommand.js';
import { ARCHIVE_SHIPMENT_TYPE } from '../commands/shipmentTypes/ArchiveShipmentTypeCommand.js';

const shipmentTypeSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    icon: { type: 'string' },
    color: { type: 'string' },
    description: { type: 'string', nullable: true },
    defaults: { type: 'object', additionalProperties: true },
    requiredFields: { type: 'array', items: { type: 'string' } },
    isBuiltIn: { type: 'boolean' },
    archived: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const createBody = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  defaults: z.record(z.unknown()).optional(),
  requiredFields: z.array(z.string()).optional(),
});

const updateBody = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().nullable().optional(),
  defaults: z.record(z.unknown()).optional(),
  requiredFields: z.array(z.string()).optional(),
});

export async function shipmentTypeRoutes(server: FastifyInstance) {
  const repo = container.resolve<IShipmentTypesRepository>(TOKENS.IShipmentTypesRepository);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  const getOrgId = async () => {
    const org = await server.prisma.organization.findFirst({ select: { id: true } });
    return org?.id || 'default';
  };

  server.get('/api/v1/shipment-types', {
    schema: {
      tags: ['Shipment Types'],
      description: 'List all non-archived shipment types',
      response: { 200: { type: 'object', properties: { data: { type: 'array', items: shipmentTypeSchema }, error: { type: 'string', nullable: true } } } },
    },
  }, async () => {
    const data = await repo.all();
    return { data, error: null };
  });

  server.get('/api/v1/shipment-types/:id', {
    schema: {
      tags: ['Shipment Types'],
      description: 'Fetch a single shipment type by id',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const found = await repo.findById(id);
    if (!found) {
      reply.code(404);
      return { data: null, error: 'Shipment type not found' };
    }
    return { data: found, error: null };
  });

  server.post('/api/v1/shipment-types', {
    schema: {
      tags: ['Shipment Types'],
      description: 'Create a shipment type (template)',
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createBody.parse((req as any).body);
    const result = await commandBus.dispatch({
      type: CREATE_SHIPMENT_TYPE,
      orgId: await getOrgId(),
      actorId: null,
      payload: body,
      metadata: { correlationId: randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error };
    }
    const created = await repo.findById((result.data as any).id);
    reply.code(201);
    return { data: created, error: null };
  });

  server.put('/api/v1/shipment-types/:id', {
    schema: {
      tags: ['Shipment Types'],
      description: 'Update a shipment type',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = updateBody.parse((req as any).body);
    const result = await commandBus.dispatch({
      type: UPDATE_SHIPMENT_TYPE,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id, data: body },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }
    const updated = await repo.findById(id);
    return { data: updated, error: null };
  });

  server.delete('/api/v1/shipment-types/:id', {
    schema: {
      tags: ['Shipment Types'],
      description: 'Archive a shipment type (built-in types cannot be archived)',
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await commandBus.dispatch({
      type: ARCHIVE_SHIPMENT_TYPE,
      orgId: await getOrgId(),
      actorId: null,
      payload: { id },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(result.error?.includes('not found') ? 404 : 400);
      return { data: null, error: result.error };
    }
    return { data: { id, archived: true }, error: null };
  });
}
