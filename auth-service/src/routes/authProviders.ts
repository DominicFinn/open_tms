import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IAuthProviderRepository } from '../repositories/AuthProviderRepository.js';
import { authenticate, requirePermission } from '../middleware/authenticate.js';

const updateProviderSchema = z.object({
  displayName: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tenantId: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  autoCreateUsers: z.boolean().optional(),
  defaultRoleId: z.string().uuid().optional(),
});

export async function authProviderRoutes(server: FastifyInstance) {
  const providerRepo = container.resolve<IAuthProviderRepository>(TOKENS.IAuthProviderRepository);

  // GET /api/v1/auth/providers — Public: returns enabled providers (no secrets)
  // Frontend uses this to decide which login buttons to show
  server.get('/api/v1/auth/providers', async () => {
    const enabled = await providerRepo.allEnabled();
    const providers = enabled.map(p => ({
      provider: p.provider,
      displayName: p.displayName,
    }));
    return { data: providers, error: null };
  });

  // GET /api/v1/admin/auth-providers — Admin: returns all providers with config (secrets masked)
  server.get('/api/v1/admin/auth-providers', {
    preHandler: [authenticate, requirePermission('auth:admin')],
  }, async () => {
    const all = await providerRepo.all();
    const providers = all.map(p => ({
      ...p,
      clientSecret: p.clientSecret ? '••••••••' : null,
    }));
    return { data: providers, error: null };
  });

  // GET /api/v1/admin/auth-providers/:id — Admin: get single provider
  server.get('/api/v1/admin/auth-providers/:id', {
    preHandler: [authenticate, requirePermission('auth:admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const provider = await providerRepo.findById(id);
    if (!provider) {
      reply.code(404);
      return { data: null, error: 'Provider not found' };
    }
    return {
      data: { ...provider, clientSecret: provider.clientSecret ? '••••••••' : null },
      error: null,
    };
  });

  // PUT /api/v1/admin/auth-providers/:id — Admin: update provider config
  server.put('/api/v1/admin/auth-providers/:id', {
    preHandler: [authenticate, requirePermission('auth:admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateProviderSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { data: null, error: parsed.error.issues.map(i => i.message).join('. ') };
    }

    const provider = await providerRepo.findById(id);
    if (!provider) {
      reply.code(404);
      return { data: null, error: 'Provider not found' };
    }

    // If enabling, validate that clientId and clientSecret are set
    if (parsed.data.enabled) {
      const clientId = parsed.data.clientId ?? provider.clientId;
      const clientSecret = parsed.data.clientSecret ?? provider.clientSecret;
      if (!clientId || !clientSecret) {
        reply.code(400);
        return { data: null, error: 'Client ID and Client Secret are required to enable a provider' };
      }
    }

    // Don't overwrite secret with the masked placeholder
    const updateData = { ...parsed.data };
    if (updateData.clientSecret === '••••••••') {
      delete updateData.clientSecret;
    }

    const updated = await providerRepo.update(id, updateData);
    return {
      data: { ...updated, clientSecret: updated.clientSecret ? '••••••••' : null },
      error: null,
    };
  });

  // POST /api/v1/admin/auth-providers/:id/toggle — Admin: quick enable/disable
  server.post('/api/v1/admin/auth-providers/:id/toggle', {
    preHandler: [authenticate, requirePermission('auth:admin')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const provider = await providerRepo.findById(id);
    if (!provider) {
      reply.code(404);
      return { data: null, error: 'Provider not found' };
    }

    // Can't enable without credentials
    if (!provider.enabled && (!provider.clientId || !provider.clientSecret)) {
      reply.code(400);
      return { data: null, error: 'Configure Client ID and Secret before enabling' };
    }

    const updated = await providerRepo.update(id, { enabled: !provider.enabled });
    return {
      data: {
        provider: updated.provider,
        enabled: updated.enabled,
        message: updated.enabled ? `${updated.displayName} sign-in enabled` : `${updated.displayName} sign-in disabled`,
      },
      error: null,
    };
  });
}
