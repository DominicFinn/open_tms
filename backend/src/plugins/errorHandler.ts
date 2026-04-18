import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Global error handler plugin.
 *
 * Catches unhandled exceptions from route handlers and returns safe,
 * consistent { data, error } responses. Prevents internal details
 * (DB errors, stack traces, file paths) from leaking to clients.
 */
export default fp(async (app: FastifyInstance) => {
  app.setErrorHandler((err: Error, req: FastifyRequest, reply: FastifyReply) => {
    // Zod validation errors (thrown by .parse() calls)
    if (err instanceof ZodError) {
      const message = err.issues.map(i => i.message).join('; ');
      return reply.code(400).send({ data: null, error: message });
    }

    // Prisma known errors (constraint violations, not found, etc.)
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      switch (err.code) {
        case 'P2002': // Unique constraint violation
          return reply.code(409).send({ data: null, error: 'A record with that value already exists' });
        case 'P2025': // Record not found
          return reply.code(404).send({ data: null, error: 'Record not found' });
        case 'P2003': // Foreign key constraint violation
          return reply.code(400).send({ data: null, error: 'Referenced record does not exist' });
        default:
          req.log.error(err, 'Unhandled Prisma error');
          return reply.code(500).send({ data: null, error: 'Internal server error' });
      }
    }

    // Fastify validation errors (from JSON Schema validation)
    if ('validation' in err && Array.isArray((err as any).validation)) {
      return reply.code(400).send({ data: null, error: err.message });
    }

    // Everything else: log full error, return generic message
    req.log.error(err, 'Unhandled error');
    const statusCode = (err as any).statusCode || 500;
    return reply.code(statusCode >= 400 ? statusCode : 500).send({
      data: null,
      error: statusCode < 500 ? err.message : 'Internal server error',
    });
  });
});
