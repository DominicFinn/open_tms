import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export async function outboundIntegrationLogRoutes(server: FastifyInstance) {
  // Get outbound integration logs with filtering and pagination
  server.get('/api/v1/outbound-integration-logs', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1),
      limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
      status: z.enum(['success', 'error', 'pending']).optional(),
      integrationId: z.string().uuid().optional(),
      shipmentId: z.string().uuid().optional(),
      shipmentReference: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()
    }).parse(req.query);

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.integrationId) where.integrationId = query.integrationId;
    if (query.shipmentId) where.shipmentId = query.shipmentId;
    if (query.shipmentReference) where.shipmentReference = { contains: query.shipmentReference, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      where.sentAt = {};
      if (query.startDate) where.sentAt.gte = new Date(query.startDate);
      if (query.endDate) where.sentAt.lte = new Date(query.endDate);
    }

    const [logs, total] = await Promise.all([
      server.prisma.outboundIntegrationLog.findMany({
        where,
        include: {
          integration: {
            select: {
              id: true,
              name: true,
              url: true
            }
          },
          shipment: {
            select: {
              id: true,
              reference: true
            }
          }
        },
        orderBy: { sentAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      server.prisma.outboundIntegrationLog.count({ where })
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

  // Get single outbound integration log
  server.get('/api/v1/outbound-integration-logs/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const log = await server.prisma.outboundIntegrationLog.findUnique({
      where: { id },
      include: {
        integration: {
          select: {
            id: true,
            name: true,
            url: true
          }
        },
        shipment: {
          select: {
            id: true,
            reference: true
          }
        }
      }
    });

    if (!log) {
      reply.code(404);
      return { data: null, error: 'Outbound integration log not found' };
    }

    return { data: log, error: null };
  });

  // Get statistics for outbound integration logs
  server.get('/api/v1/outbound-integration-logs/stats', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      integrationId: z.string().uuid().optional()
    }).parse(req.query);

    const where: any = {};
    if (query.integrationId) where.integrationId = query.integrationId;
    if (query.startDate || query.endDate) {
      where.sentAt = {};
      if (query.startDate) where.sentAt.gte = new Date(query.startDate);
      if (query.endDate) where.sentAt.lte = new Date(query.endDate);
    }

    // Default to last 7 days if no dates provided
    if (!query.startDate && !query.endDate) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      where.sentAt = {
        gte: startDate,
        lte: endDate
      };
    }

    const [total, success, errors, pending] = await Promise.all([
      server.prisma.outboundIntegrationLog.count({ where }),
      server.prisma.outboundIntegrationLog.count({ where: { ...where, status: 'success' } }),
      server.prisma.outboundIntegrationLog.count({ where: { ...where, status: 'error' } }),
      server.prisma.outboundIntegrationLog.count({ where: { ...where, status: 'pending' } })
    ]);

    return {
      data: {
        totals: {
          total,
          success,
          errors,
          pending
        }
      },
      error: null
    };
  });
}

