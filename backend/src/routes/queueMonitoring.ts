import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IQueueAdapter } from '../queue/IQueueAdapter.js';
import { QUEUES } from '../queue/events.js';
import { PgBossQueueAdapter } from '../queue/PgBossQueueAdapter.js';

export async function queueMonitoringRoutes(server: FastifyInstance) {
  // Get stats for all queues
  server.get('/api/v1/queues/stats', async (_req: FastifyRequest, _reply: FastifyReply) => {
    try {
      const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
      const stats = await queue.getAllQueueStats();
      return { data: stats, error: null };
    } catch (err: any) {
      return { data: [], error: 'Queue monitoring unavailable: ' + err.message };
    }
  });

  // Get stats for a specific queue
  server.get('/api/v1/queues/:name/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const { name } = req.params as { name: string };

    // Validate queue name
    const validQueues = Object.values(QUEUES);
    if (!validQueues.includes(name as any)) {
      reply.code(404);
      return { data: null, error: `Queue "${name}" not found. Valid queues: ${validQueues.join(', ')}` };
    }

    try {
      const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
      const stats = await queue.getQueueStats(name);
      return { data: stats, error: null };
    } catch (err: any) {
      return { data: null, error: 'Queue monitoring unavailable: ' + err.message };
    }
  });

  // Peek at jobs in a queue (without consuming them)
  server.get('/api/v1/queues/:name/jobs', async (req: FastifyRequest, reply: FastifyReply) => {
    const { name } = req.params as { name: string };
    const { state = 'queued', limit = '20' } = req.query as { state?: string; limit?: string };

    const validQueues = Object.values(QUEUES);
    if (!validQueues.includes(name as any)) {
      reply.code(404);
      return { data: null, error: `Queue "${name}" not found` };
    }

    const validStates = ['queued', 'active', 'failed'];
    if (!validStates.includes(state)) {
      reply.code(400);
      return { data: null, error: `Invalid state "${state}". Valid: ${validStates.join(', ')}` };
    }

    try {
      const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
      // Use peekJobsDirect if available (PgBossQueueAdapter-specific)
      let jobs;
      if ('peekJobsDirect' in queue) {
        jobs = await (queue as PgBossQueueAdapter).peekJobsDirect(name, state as any, parseInt(limit));
      } else {
        jobs = await queue.peekJobs(name, state as any, parseInt(limit));
      }
      return { data: jobs, error: null };
    } catch (err: any) {
      return { data: [], error: 'Failed to peek jobs: ' + err.message };
    }
  });

  // Purge dead letter queue
  server.post('/api/v1/queues/:name/purge-dlq', async (req: FastifyRequest, reply: FastifyReply) => {
    const { name } = req.params as { name: string };

    const validQueues = Object.values(QUEUES);
    if (!validQueues.includes(name as any)) {
      reply.code(404);
      return { data: null, error: `Queue "${name}" not found` };
    }

    try {
      const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
      const purged = await queue.purgeQueue(name);
      return { data: { purged, queue: name }, error: null };
    } catch (err: any) {
      return { data: null, error: 'Failed to purge DLQ: ' + err.message };
    }
  });

  // Retry failed jobs (move from DLQ back to main queue)
  server.post('/api/v1/queues/:name/retry-failed', async (req: FastifyRequest, reply: FastifyReply) => {
    const { name } = req.params as { name: string };

    const validQueues = Object.values(QUEUES);
    if (!validQueues.includes(name as any)) {
      reply.code(404);
      return { data: null, error: `Queue "${name}" not found` };
    }

    try {
      const queue = container.resolve<IQueueAdapter>(TOKENS.IQueueAdapter);
      const retried = await queue.retryFailedJobs(name);
      return { data: { retried, queue: name }, error: null };
    } catch (err: any) {
      return { data: null, error: 'Failed to retry failed jobs: ' + err.message };
    }
  });

  // Get recent activity for charts (aggregated from outbound + webhook logs)
  server.get('/api/v1/queues/activity', async (req: FastifyRequest, _reply: FastifyReply) => {
    const { hours = '24' } = req.query as { hours?: string };
    const hoursNum = Math.min(parseInt(hours) || 24, 168); // Max 7 days
    const since = new Date(Date.now() - hoursNum * 60 * 60 * 1000);

    try {
      // Get outbound integration log activity
      const outboundLogs = await server.prisma.outboundIntegrationLog.findMany({
        where: { sentAt: { gte: since } },
        select: { sentAt: true, status: true },
        orderBy: { sentAt: 'asc' },
      });

      // Get webhook log activity
      const webhookLogs = await server.prisma.webhookLog.findMany({
        where: { receivedAt: { gte: since } },
        select: { receivedAt: true, status: true },
        orderBy: { receivedAt: 'asc' },
      });

      // Bucket into hourly intervals
      const buckets: Record<string, { hour: string; outboundSuccess: number; outboundError: number; inboundSuccess: number; inboundError: number }> = {};

      for (let h = 0; h < hoursNum; h++) {
        const bucketTime = new Date(since.getTime() + h * 60 * 60 * 1000);
        const key = bucketTime.toISOString().substring(0, 13); // YYYY-MM-DDTHH
        buckets[key] = { hour: key, outboundSuccess: 0, outboundError: 0, inboundSuccess: 0, inboundError: 0 };
      }

      for (const log of outboundLogs) {
        const key = log.sentAt.toISOString().substring(0, 13);
        if (buckets[key]) {
          if (log.status === 'success') buckets[key].outboundSuccess++;
          else if (log.status === 'error') buckets[key].outboundError++;
        }
      }

      for (const log of webhookLogs) {
        const key = log.receivedAt.toISOString().substring(0, 13);
        if (buckets[key]) {
          if (log.status === 'success') buckets[key].inboundSuccess++;
          else if (log.status === 'error') buckets[key].inboundError++;
        }
      }

      const activity = Object.values(buckets).sort((a, b) => a.hour.localeCompare(b.hour));

      return { data: activity, error: null };
    } catch (err: any) {
      return { data: [], error: 'Failed to load activity: ' + err.message };
    }
  });
}
