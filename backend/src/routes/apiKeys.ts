import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';

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
  // Get all API keys
  server.get('/api/v1/api-keys', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const apiKeys = await server.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        active: true,
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
      name: z.string().min(1).max(100)
    }).parse((req as any).body);

    const { key, keyHash, keyPrefix } = generateApiKey();

    const apiKey = await server.prisma.apiKey.create({
      data: {
        name: body.name,
        keyHash,
        keyPrefix,
        active: true
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        active: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Return the full key only once (for display)
    reply.code(201);
    return {
      data: {
        ...apiKey,
        key // Only returned on creation
      },
      error: null
    };
  });

  // Update API key (name, active status)
  server.put('/api/v1/api-keys/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      active: z.boolean().optional()
    }).parse((req as any).body);

    const apiKey = await server.prisma.apiKey.findUnique({
      where: { id }
    });

    if (!apiKey) {
      reply.code(404);
      return { data: null, error: 'API key not found' };
    }

    const updated = await server.prisma.apiKey.update({
      where: { id },
      data: body,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        active: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return { data: updated, error: null };
  });

  // Delete API key
  server.delete('/api/v1/api-keys/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const apiKey = await server.prisma.apiKey.findUnique({
      where: { id }
    });

    if (!apiKey) {
      reply.code(404);
      return { data: null, error: 'API key not found' };
    }

    await server.prisma.apiKey.delete({
      where: { id }
    });

    return { data: { success: true }, error: null };
  });

  // Helper endpoint to validate API key (for middleware)
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

    // Update last used
    await server.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    });

    return { data: { valid: true, apiKey }, error: null };
  });
}
