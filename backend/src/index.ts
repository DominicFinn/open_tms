import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import prismaPlugin from './plugins/prisma.js';
import { registerDependencies } from './di/index.js';
import { customerRoutes } from './routes/customers.js';
import { carrierRoutes } from './routes/carriers.js';
import { locationRoutes } from './routes/locations.js';
import { shipmentRoutes } from './routes/shipments.js';
import { laneRoutes } from './routes/lanes.js';
import { seedRoutes } from './routes/seed.js';
import { distanceRoutes } from './routes/distance.js';

const server = Fastify({ logger: true });

async function start() {
  await server.register(cors, { origin: true });
  await server.register(swagger, {
    openapi: {
      info: { title: 'Open TMS API', version: '0.1.0' }
    }
  });
  await server.register(swaggerUI, { routePrefix: '/docs' });
  await server.register(prismaPlugin);

  // Initialize Dependency Injection Container
  registerDependencies(server.prisma);

  // Health check
  server.get('/health', async () => ({ status: 'ok' }));

  // Register route modules
  await server.register(customerRoutes);
  await server.register(carrierRoutes);
  await server.register(locationRoutes);
  await server.register(shipmentRoutes);
  await server.register(laneRoutes);
  await server.register(seedRoutes);
  await server.register(distanceRoutes);

  // Start the server with automatic port retry
  const preferredPort = Number(process.env.PORT || 3001);
  let port = preferredPort;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      await server.listen({ port, host: '0.0.0.0' });
      server.log.info(`API running on http://localhost:${port}`);
      if (port !== preferredPort) {
        server.log.warn(`Port ${preferredPort} was unavailable, using port ${port} instead`);
        server.log.warn(`Update VITE_API_URL in frontend/.env to: http://localhost:${port}`);
      }
      break;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        port++;
        if (attempts < maxAttempts) {
          server.log.warn(`Port ${port - 1} is in use, trying ${port}...`);
        } else {
          server.log.error(`Could not find available port after ${maxAttempts} attempts`);
          throw err;
        }
      } else {
        throw err;
      }
    }
  }
}

// Start the application
start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
