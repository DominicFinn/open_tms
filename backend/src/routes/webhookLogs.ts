import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IWebhookLogRepository, WebhookLogFilters } from '../repositories/WebhookLogRepository.js';

export async function webhookLogRoutes(server: FastifyInstance) {
  const webhookLogRepo = container.resolve<IWebhookLogRepository>(TOKENS.IWebhookLogRepository);

  // Get webhook logs with filtering and pagination
  server.get('/api/v1/webhook-logs', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
      limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
      status: z.enum(['success', 'error', 'skipped', 'not_found']).optional(),
      apiKeyId: z.string().uuid().optional(),
      shipmentId: z.string().uuid().optional(),
      deviceName: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()
    }).parse(req.query);

    const filters: WebhookLogFilters = {
      status: query.status,
      apiKeyId: query.apiKeyId,
      shipmentId: query.shipmentId,
      deviceName: query.deviceName,
      receivedFrom: query.startDate ? new Date(query.startDate) : undefined,
      receivedTo: query.endDate ? new Date(query.endDate) : undefined,
    };
    const { logs, total } = await webhookLogRepo.list(req.orgId!, filters, query.page, query.limit);

    return {
      data: logs,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      },
      error: null
    };
  });

  // Get webhook log statistics for charts
  server.get('/api/v1/webhook-logs/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      groupBy: z.enum(['hour', 'day', 'week']).default('hour')
    }).parse(req.query);

    // Default to the last 7 days if no dates are provided
    const filters: WebhookLogFilters = {
      receivedFrom: query.startDate ? new Date(query.startDate) : undefined,
      receivedTo: query.endDate ? new Date(query.endDate) : undefined,
    };
    if (!query.startDate && !query.endDate) {
      filters.receivedTo = new Date();
      filters.receivedFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const [{ total, success, errors, skipped, notFound, updates }, logs] = await Promise.all([
      webhookLogRepo.totals(req.orgId!, filters),
      webhookLogRepo.activity(req.orgId!, filters),
    ]);

    // Group by time period
    const timeSeries: Record<string, { success: number; error: number; updates: number }> = {};
    
    logs.forEach((log) => {
      const date = new Date(log.receivedAt);
      let key: string;
      
      if (query.groupBy === 'hour') {
        key = date.toISOString().slice(0, 13) + ':00:00Z'; // YYYY-MM-DDTHH:00:00Z
      } else if (query.groupBy === 'day') {
        key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      } else {
        // week
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
      }

      if (!timeSeries[key]) {
        timeSeries[key] = { success: 0, error: 0, updates: 0 };
      }

      if (log.status === 'success') {
        timeSeries[key].success++;
      }
      if (log.status === 'error') {
        timeSeries[key].error++;
      }
      if (log.shipmentUpdated) {
        timeSeries[key].updates++;
      }
    });

    const timeSeriesData = Object.entries(timeSeries)
      .map(([time, counts]) => ({
        time,
        ...counts
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    return {
      data: {
        totals: {
          total,
          success,
          errors,
          skipped,
          notFound,
          updates
        },
        timeSeries: timeSeriesData
      },
      error: null
    };
  });

  // Get single webhook log by ID
  server.get('/api/v1/webhook-logs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const log = await webhookLogRepo.findById(id, req.orgId!);

    if (!log) {
      reply.code(404);
      return { data: null, error: 'Webhook log not found' };
    }

    return { data: log, error: null };
  });
}
