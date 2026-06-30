/**
 * IoT vendor settings — per-org on/off switches for IoT tracking vendors.
 *
 * System Loco is vendor #1. When a vendor is disabled, its inbound webhooks are
 * skipped (see SystemLocoAdapter) and the shipment form hides the IoT section.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { registerOrgScope } from '../auth/orgScopeMiddleware.js';
import { requirePermission } from '../middleware/jwtAuth.js';

/** Vendors the platform knows about. Auto-seeded per org on first read. */
const KNOWN_VENDORS: Array<{ vendorKey: string; name: string }> = [
  { vendorKey: 'system_loco', name: 'System Loco' },
];

export async function iotVendorRoutes(server: FastifyInstance) {
  await registerOrgScope(server);

  // List IoT vendors for the org (auto-seeds known vendors). Readable by any
  // authenticated user — the shipment form uses it to decide whether to show
  // the IoT devices section.
  server.get('/api/v1/settings/iot-vendors', {
    schema: {
      tags: ['Settings'],
      summary: 'List IoT vendors and their enabled state',
    },
  }, async (req: FastifyRequest) => {
    const orgId = req.orgId!;

    // Ensure every known vendor has a row for this org (default enabled).
    for (const v of KNOWN_VENDORS) {
      await server.prisma.iotVendor.upsert({
        where: { orgId_vendorKey: { orgId, vendorKey: v.vendorKey } },
        update: {},
        create: { orgId, vendorKey: v.vendorKey, name: v.name, enabled: true },
      });
    }

    const rows = await server.prisma.iotVendor.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
      select: { vendorKey: true, name: true, enabled: true, webhookSecret: true },
    });
    // Never return the raw secret — only whether one is configured.
    const vendors = rows.map(({ webhookSecret, ...v }) => ({ ...v, hasWebhookSecret: !!webhookSecret }));
    return { data: vendors, error: null };
  });

  // Toggle a vendor on/off. Admin-only (settings:write).
  server.put('/api/v1/settings/iot-vendors/:vendorKey', {
    preHandler: requirePermission('settings:write'),
    schema: {
      tags: ['Settings'],
      summary: 'Enable or disable an IoT vendor',
      params: { type: 'object', properties: { vendorKey: { type: 'string' } }, required: ['vendorKey'] },
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          // null/empty string clears the secret; a value sets it.
          webhookSecret: { type: 'string', nullable: true },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { vendorKey } = req.params as { vendorKey: string };
    const { enabled, webhookSecret } = z.object({
      enabled: z.boolean().optional(),
      webhookSecret: z.string().nullable().optional(),
    }).parse((req as any).body);
    const orgId = req.orgId!;

    const known = KNOWN_VENDORS.find(v => v.vendorKey === vendorKey);
    if (!known) {
      reply.code(404);
      return { data: null, error: 'Unknown IoT vendor' };
    }

    const update: Record<string, unknown> = {};
    if (enabled !== undefined) update.enabled = enabled;
    if (webhookSecret !== undefined) update.webhookSecret = webhookSecret ? webhookSecret : null;

    const vendor = await server.prisma.iotVendor.upsert({
      where: { orgId_vendorKey: { orgId, vendorKey } },
      update,
      create: { orgId, vendorKey, name: known.name, enabled: enabled ?? true, webhookSecret: webhookSecret || null },
      select: { vendorKey: true, name: true, enabled: true, webhookSecret: true },
    });
    return { data: { vendorKey: vendor.vendorKey, name: vendor.name, enabled: vendor.enabled, hasWebhookSecret: !!vendor.webhookSecret }, error: null };
  });
}
