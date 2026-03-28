import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'crypto';

// Helper to hash API keys
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export interface AuthResult {
  apiKeyId: string | null;
  customerId: string | null;
  error: string | null;
}

// API Key authentication middleware
export async function authenticateApiKey(server: FastifyInstance, req: FastifyRequest, reply: FastifyReply): Promise<AuthResult> {
  const apiKeyHeader = (req.headers['x-api-key'] as string) ||
                       (req.headers['authorization'] as string)?.replace('Bearer ', '');

  if (!apiKeyHeader) {
    reply.code(401);
    return { apiKeyId: null, customerId: null, error: 'API key required. Please provide x-api-key header or Authorization Bearer token.' };
  }

  const keyHash = hashApiKey(apiKeyHeader);
  const apiKey = await server.prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      active: true,
      customerId: true
    }
  });

  if (!apiKey || !apiKey.active) {
    reply.code(403);
    return { apiKeyId: null, customerId: null, error: 'Invalid or inactive API key.' };
  }

  // Update last used
  await server.prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });

  return { apiKeyId: apiKey.id, customerId: apiKey.customerId, error: null };
}

// Helper to redact API key from headers
export function redactApiKey(headers: any): any {
  const redacted = { ...headers };
  if (redacted['x-api-key']) {
    redacted['x-api-key'] = '[REDACTED]';
  }
  if (redacted['authorization']) {
    redacted['authorization'] = redacted['authorization'].replace(/Bearer .+/, 'Bearer [REDACTED]');
  }
  return redacted;
}

// Simple in-memory rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = requestCounts.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}
