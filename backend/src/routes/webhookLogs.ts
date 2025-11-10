import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export async function webhookLogRoutes(server: FastifyInstance) {
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

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.apiKeyId) where.apiKeyId = query.apiKeyId;
    if (query.shipmentId) where.shipmentId = query.shipmentId;
    if (query.deviceName) where.deviceName = { contains: query.deviceName, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      where.receivedAt = {};
      if (query.startDate) where.receivedAt.gte = new Date(query.startDate);
      if (query.endDate) where.receivedAt.lte = new Date(query.endDate);
    }

    const [logs, total] = await Promise.all([
      server.prisma.webhookLog.findMany({
        where,
        include: {
          apiKey: {
            select: {
              id: true,
              name: true,
              keyPrefix: true
            }
          }
        },
        orderBy: { receivedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      server.prisma.webhookLog.count({ where })
    ]);

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

    const where: any = {};
    if (query.startDate || query.endDate) {
      where.receivedAt = {};
      if (query.startDate) where.receivedAt.gte = new Date(query.startDate);
      if (query.endDate) where.receivedAt.lte = new Date(query.endDate);
    }

    // Default to last 7 days if no dates provided
    if (!query.startDate && !query.endDate) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      where.receivedAt = {
        gte: startDate,
        lte: endDate
      };
    }

    // Get overall counts
    const [total, success, errors, skipped, notFound, updates] = await Promise.all([
      server.prisma.webhookLog.count({ where }),
      server.prisma.webhookLog.count({ where: { ...where, status: 'success' } }),
      server.prisma.webhookLog.count({ where: { ...where, status: 'error' } }),
      server.prisma.webhookLog.count({ where: { ...where, status: 'skipped' } }),
      server.prisma.webhookLog.count({ where: { ...where, status: 'not_found' } }),
      server.prisma.webhookLog.count({ where: { ...where, shipmentUpdated: true } })
    ]);

    // Get time series data
    const logs = await server.prisma.webhookLog.findMany({
      where,
      select: {
        receivedAt: true,
        status: true,
        shipmentUpdated: true
      },
      orderBy: { receivedAt: 'asc' }
    });

    // Group by time period
    const timeSeries: Record<string, { success: number; error: number; updates: number }> = {};
    
    logs.forEach((log: any) => {
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

    const log = await server.prisma.webhookLog.findUnique({
      where: { id },
      include: {
        apiKey: {
          select: {
            id: true,
            name: true,
            keyPrefix: true
          }
        }
      }
    });

    if (!log) {
      reply.code(404);
      return { data: null, error: 'Webhook log not found' };
    }

    return { data: log, error: null };
  });
}
