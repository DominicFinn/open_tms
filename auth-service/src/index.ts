import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import prismaPlugin from './plugins/prisma.js';
import { registerDependencies } from './di/registry.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { roleRoutes } from './routes/roles.js';
import { setupRoutes } from './routes/setup.js';
import { authProviderRoutes } from './routes/authProviders.js';
import { oauthRoutes } from './routes/oauth.js';

const server = Fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: true });
  await server.register(swagger, {
    openapi: {
      info: { title: 'Open TMS Auth Service', version: '0.1.0' },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token from /api/v1/auth/login',
          },
        },
      },
    },
  });
  await server.register(swaggerUI, { routePrefix: '/docs' });
  await server.register(prismaPlugin);

  // Initialize DI
  registerDependencies(server.prisma);

  // Health check
  server.get('/health', async () => ({ status: 'ok', service: 'auth' }));

  // Register routes
  await server.register(authRoutes);
  await server.register(userRoutes);
  await server.register(roleRoutes);
  await server.register(setupRoutes);
  await server.register(authProviderRoutes);
  await server.register(oauthRoutes);

  // Start server
  const preferredPort = Number(process.env.AUTH_PORT || process.env.PORT || 3002);
  let port = preferredPort;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      await server.listen({ port, host: '0.0.0.0' });
      server.log.info(`Auth service running on http://localhost:${port}`);
      if (port !== preferredPort) {
        server.log.warn(`Port ${preferredPort} was unavailable, using port ${port} instead`);
      }
      break;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        port++;
        if (attempts >= maxAttempts) {
          server.log.error(`Could not find available port after ${maxAttempts} attempts`);
          throw err;
        }
        server.log.warn(`Port ${port - 1} is in use, trying ${port}...`);
      } else {
        throw err;
      }
    }
  }
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
