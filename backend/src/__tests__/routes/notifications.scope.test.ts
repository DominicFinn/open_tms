/**
 * The notification inbox belongs to the signed-in user in their own org (#314). A user id in the
 * request is ignored, and another user's or org's notification behaves like a missing one.
 */

import Fastify, { FastifyInstance } from 'fastify';
import { notificationRoutes } from '../../routes/notifications.js';

function buildPrisma() {
  return {
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'n-1', read: true }),
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

async function buildApp(prisma: ReturnType<typeof buildPrisma>): Promise<FastifyInstance> {
  const app = Fastify();
  app.decorate('prisma', prisma as any);
  app.addHook('preHandler', async (req) => {
    (req as any).orgId = 'org-a';
    (req as any).user = { sub: 'user-a', organizationId: 'org-a' };
  });
  await app.register(notificationRoutes);
  return app;
}

describe('notification routes', () => {
  it('lists the signed-in user inbox and ignores a userId in the query', async () => {
    const prisma = buildPrisma();
    const app = await buildApp(prisma);

    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications?userId=user-b' });

    expect(res.statusCode).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-a', orgId: 'org-a' } }),
    );
  });

  it('counts unread for the signed-in user only', async () => {
    const prisma = buildPrisma();
    const app = await buildApp(prisma);

    await app.inject({ method: 'GET', url: '/api/v1/notifications/unread-count?userId=user-b' });

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-a', orgId: 'org-a', read: false },
    });
  });

  it('returns 404 when the notification is not the caller’s', async () => {
    const prisma = buildPrisma();
    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    const app = await buildApp(prisma);

    const res = await app.inject({ method: 'PATCH', url: '/api/v1/notifications/n-9', payload: { read: true } });

    expect(res.statusCode).toBe(404);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'n-9', userId: 'user-a', orgId: 'org-a' } }),
    );
  });

  it('marks only the signed-in user’s notifications as read', async () => {
    const prisma = buildPrisma();
    const app = await buildApp(prisma);

    const res = await app.inject({ method: 'POST', url: '/api/v1/notifications/read-all', payload: { userId: 'user-b' } });

    expect(res.statusCode).toBe(200);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-a', orgId: 'org-a', read: false } }),
    );
  });
});
