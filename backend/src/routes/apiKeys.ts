import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { createHash, randomBytes } from 'crypto';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import { CREATE_API_KEY, UPDATE_API_KEY, DELETE_API_KEY, CreateApiKeyResult } from '../commands/apiKeys/index.js';

// Helper to hash API keys
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// Helper to generate a new API key
function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `sk_live_${randomBytes(32).toString('hex')}`;
  const keyHash = hashApiKey(key);
  const keyPrefix = key.substring(0, 12); // "sk_live_xxxx"
  return { key, keyHash, keyPrefix };
}

export async function apiKeyRoutes(server: FastifyInstance) {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // Get all API keys
  server.get('/api/v1/api-keys', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const apiKeys = await server.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        active: true,
        customerId: true,
        customer: {
          select: { id: true, name: true }
        },
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            webhookLogs: true
          }
        }
      }
    });
    return { data: apiKeys, error: null };
  });

  // Create new API key
  server.post('/api/v1/api-keys', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      customerId: z.string().uuid().optional()
    }).parse((req as any).body);

    const { key, keyHash, keyPrefix } = generateApiKey();
    const orgId = req.user?.organizationId ?? 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: CREATE_API_KEY,
      orgId,
      actorId,
      payload: {
        name: body.name,
        customerId: body.customerId || null,
        keyHash,
        keyPrefix,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to create API key' };
    }

    // Hydrate customer relation for the response — the command returns a
    // lean DTO, but the existing API contract included customer.
    const created = result.data as CreateApiKeyResult;
    const customer = created.customerId
      ? await server.prisma.customer.findUnique({
          where: { id: created.customerId },
          select: { id: true, name: true },
        })
      : null;

    reply.code(201);
    return {
      data: {
        ...created,
        customer,
        // Full key is returned ONCE on creation — never logged or persisted.
        key,
      },
      error: null,
    };
  });

  // Update API key (name, active status)
  server.put('/api/v1/api-keys/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      active: z.boolean().optional()
    }).parse((req as any).body);

    const orgId = req.user?.organizationId ?? 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: UPDATE_API_KEY,
      orgId,
      actorId,
      payload: { id, data: body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      // Distinguish "not found" so the route still emits the right status
      // code — the previous implementation returned 404 explicitly.
      if ((result.error || '').includes('not found')) {
        reply.code(404);
        return { data: null, error: 'API key not found' };
      }
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to update API key' };
    }

    return { data: result.data, error: null };
  });

  // Delete API key
  server.delete('/api/v1/api-keys/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const orgId = req.user?.organizationId ?? 'default-org';
    const actorId = req.user?.sub ?? null;

    const result = await commandBus.dispatch({
      type: DELETE_API_KEY,
      orgId,
      actorId,
      payload: { id },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      if ((result.error || '').includes('not found')) {
        reply.code(404);
        return { data: null, error: 'API key not found' };
      }
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to delete API key' };
    }

    return { data: { success: true }, error: null };
  });

  // Helper endpoint to validate API key (for middleware).
  // The lastUsedAt bump is intentionally a direct prisma update — it's a
  // hot-path side effect, not a domain change worth wrapping in a command.
  server.get('/api/v1/api-keys/validate', async (req: FastifyRequest, reply: FastifyReply) => {
    const apiKeyHeader = (req.headers['x-api-key'] as string) ||
                         (req.headers['authorization'] as string)?.replace('Bearer ', '');

    if (!apiKeyHeader) {
      reply.code(401);
      return { data: null, error: 'API key required' };
    }

    const keyHash = hashApiKey(apiKeyHeader);
    const apiKey = await server.prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        name: true,
        active: true
      }
    });

    if (!apiKey || !apiKey.active) {
      reply.code(403);
      return { data: null, error: 'Invalid or inactive API key' };
    }

    await server.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    });

    return { data: { valid: true, apiKey }, error: null };
  });
}
