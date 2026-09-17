import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { guardWrites } from '../auth/guardWrites.js';
import {
  ASSIGN_DEVICE,
  CREATE_DEVICE,
  UNASSIGN_DEVICE,
  UPDATE_DEVICE,
  statusForDeviceError,
} from '../commands/devices/index.js';
import { IDeviceRepository } from '../repositories/DeviceRepository.js';
import { ISensorReadingRepository } from '../repositories/SensorReadingRepository.js';

const TAGS = ['Devices'];
const DEFAULT_PAGE_SIZE = 500;
const MAX_PAGE_SIZE = 1000;
const DEFAULT_READINGS = 200;
const MAX_READINGS = 1000;

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

export default async function deviceRoutes(server: FastifyInstance) {
  await registerOrgScope(server);
  server.addHook('preHandler', guardWrites('devices'));

  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const devices = container.resolve<IDeviceRepository>(TOKENS.IDeviceRepository);
  const readings = container.resolve<ISensorReadingRepository>(TOKENS.ISensorReadingRepository);

  const dispatch = <T>(req: FastifyRequest, type: string, payload: T) => commandBus.dispatch({
    type,
    orgId: req.orgId!,
    actorId: req.user?.sub ?? null,
    payload,
    metadata: { correlationId: randomUUID(), source: 'api' },
  });

  // X-Total-Count is kept alongside meta for existing clients.
  server.get('/api/v1/devices', {
    schema: {
      tags: TAGS,
      summary: 'List IoT devices',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { limit, offset } = req.query as { limit: number; offset: number };
    const page = await devices.list(req.orgId!, { limit, offset });
    reply.header('X-Total-Count', String(page.total));
    return { data: page.devices, meta: { total: page.total, limit, offset }, error: null };
  });

  server.get('/api/v1/devices/:id', {
    schema: { tags: TAGS, summary: 'Get an IoT device with its assignments and recent activity', params: idParams },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const device = await devices.findDetail(req.orgId!, id);
    if (!device) {
      reply.code(404);
      return { data: null, error: 'Device not found' };
    }
    return { data: device, error: null };
  });

  server.post('/api/v1/devices', {
    schema: {
      tags: TAGS,
      summary: 'Register an IoT device',
      body: {
        type: 'object',
        required: ['externalId', 'name'],
        additionalProperties: false,
        properties: {
          externalId: { type: 'string', minLength: 1, maxLength: 200 },
          name: { type: 'string', minLength: 1, maxLength: 200 },
          displayId: { type: 'string', maxLength: 200 },
          provider: { type: 'string', minLength: 1, maxLength: 100 },
          model: { type: 'string', maxLength: 200 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await dispatch(req, CREATE_DEVICE, req.body);
    if (!result.success) {
      reply.code(statusForDeviceError(result.error));
      return { data: null, error: result.error };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  server.put('/api/v1/devices/:id', {
    schema: {
      tags: TAGS,
      summary: 'Update an IoT device',
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          status: { type: 'string', enum: ['active', 'inactive', 'maintenance'] },
          displayId: { type: 'string', maxLength: 200 },
          model: { type: 'string', maxLength: 200 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await dispatch(req, UPDATE_DEVICE, { id, changes: req.body });
    if (!result.success) {
      reply.code(statusForDeviceError(result.error));
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  server.post('/api/v1/devices/:id/assign', {
    schema: {
      tags: TAGS,
      summary: 'Assign a device to a shipment, order or trackable unit',
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          shipmentId: { type: 'string', format: 'uuid' },
          orderId: { type: 'string', format: 'uuid' },
          trackableUnitId: { type: 'string', format: 'uuid' },
          purpose: { type: 'string', enum: ['cargo_condition', 'security', 'location', 'general'] },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await dispatch(req, ASSIGN_DEVICE, { ...(req.body as object), deviceId: id });
    if (!result.success) {
      reply.code(statusForDeviceError(result.error));
      return { data: null, error: result.error };
    }
    reply.code(201);
    return { data: result.data, error: null };
  });

  server.delete('/api/v1/devices/:id/assign', {
    schema: { tags: TAGS, summary: 'Release a device from its current assignment', params: idParams },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const result = await dispatch(req, UNASSIGN_DEVICE, { deviceId: id });
    if (!result.success) {
      reply.code(statusForDeviceError(result.error));
      return { data: null, error: result.error };
    }
    return { data: result.data, error: null };
  });

  server.get('/api/v1/devices/:id/readings', {
    schema: {
      tags: TAGS,
      summary: 'List sensor readings for a device, newest first',
      params: idParams,
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: MAX_READINGS, default: DEFAULT_READINGS },
          since: { type: 'string', format: 'date-time' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { limit, since } = req.query as { limit: number; since?: string };
    const rows = await readings.listForDevice(req.orgId!, id, {
      limit,
      since: since ? new Date(since) : undefined,
    });
    if (!rows) {
      reply.code(404);
      return { data: null, error: 'Device not found' };
    }
    return { data: rows, error: null };
  });
}
