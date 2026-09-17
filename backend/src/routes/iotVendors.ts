/**
 * IoT vendor settings: per-org on/off switches for IoT tracking vendors. When a vendor is disabled,
 * its inbound webhooks are skipped and the shipment form hides the IoT section.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { requirePermission } from '../middleware/jwtAuth.js';
import { IIotVendorSettingsService } from '../services/iot/IotVendorSettingsService.js';
import {
  UNKNOWN_IOT_VENDOR,
  UPDATE_IOT_VENDOR_SETTINGS,
  UpdateIotVendorSettingsPayload,
} from '../commands/iotVendors/UpdateIotVendorSettingsCommand.js';

export async function iotVendorRoutes(server: FastifyInstance) {
  await registerOrgScope(server);
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);
  const settings = container.resolve<IIotVendorSettingsService>(TOKENS.IIotVendorSettingsService);

  // Readable by any authenticated user: the shipment form uses it to decide whether to show the
  // IoT devices section.
  server.get('/api/v1/settings/iot-vendors', {
    schema: {
      tags: ['Settings'],
      summary: 'List IoT vendors and their enabled state',
    },
  }, async (req: FastifyRequest) => {
    return { data: await settings.list(req.orgId!), error: null };
  });

  server.put('/api/v1/settings/iot-vendors/:vendorKey', {
    preHandler: requirePermission('settings:write'),
    schema: {
      tags: ['Settings'],
      summary: 'Enable or disable an IoT vendor, or set its webhook secret',
      params: {
        type: 'object',
        required: ['vendorKey'],
        properties: { vendorKey: { type: 'string', minLength: 1, maxLength: 100 } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: { type: 'boolean' },
          // null or empty string clears the secret; a value sets it.
          webhookSecret: { type: 'string', nullable: true, maxLength: 500 },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { vendorKey } = req.params as { vendorKey: string };
    const body = req.body as Omit<UpdateIotVendorSettingsPayload, 'vendorKey'>;
    const result = await commandBus.dispatch({
      type: UPDATE_IOT_VENDOR_SETTINGS,
      orgId: req.orgId!,
      actorId: req.user?.sub ?? null,
      payload: { ...body, vendorKey },
      metadata: { correlationId: randomUUID(), source: 'api' },
    });
    if (!result.success) {
      reply.code(result.error === UNKNOWN_IOT_VENDOR ? 404 : 400);
      return { data: null, error: result.error === UNKNOWN_IOT_VENDOR ? 'Unknown IoT vendor' : result.error };
    }
    return { data: result.data, error: null };
  });
}
