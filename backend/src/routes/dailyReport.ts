import { FastifyInstance } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IDailyReportService } from '../services/DailyReportService.js';

const errorResponse = {
  type: 'object',
  properties: {
    data: { type: 'object', nullable: true },
    error: { type: 'string' },
  },
} as const;

export async function dailyReportRoutes(server: FastifyInstance) {
  const reportService = container.resolve<IDailyReportService>(TOKENS.IDailyReportService);

  // GET /api/v1/reports/daily/summary?date=2026-03-30
  server.get('/api/v1/reports/daily/summary', {
    schema: {
      description: 'Get a JSON summary of daily operations for the given date. Includes shipment and order counts by status, exception count.',
      tags: ['Daily Report'],
      querystring: {
        type: 'object',
        required: ['date'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Report date (YYYY-MM-DD)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                shipmentsByStatus: { type: 'object' },
                ordersByDeliveryStatus: { type: 'object' },
                exceptionCount: { type: 'integer' },
                totalShipments: { type: 'integer' },
                totalOrders: { type: 'integer' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
        400: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { date } = req.query as { date?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      reply.code(400);
      return { data: null, error: 'date query parameter required (YYYY-MM-DD)' };
    }

    const summary = await reportService.getSummary(date);
    return { data: summary, error: null };
  });

  // GET /api/v1/reports/daily?date=2026-03-30&format=xlsx
  server.get('/api/v1/reports/daily', {
    schema: {
      description: 'Download the daily operations report as an Excel workbook. The report contains 5 sheets: Summary, Shipments, Orders, Stop Schedule, and Exceptions.',
      tags: ['Daily Report'],
      querystring: {
        type: 'object',
        required: ['date'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Report date (YYYY-MM-DD)' },
          format: { type: 'string', enum: ['xlsx'], default: 'xlsx', description: 'Report format (currently only xlsx)' },
        },
      },
      response: {
        400: errorResponse,
      },
    },
  }, async (req, reply) => {
    const { date, format } = req.query as { date?: string; format?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      reply.code(400);
      return { data: null, error: 'date query parameter required (YYYY-MM-DD)' };
    }

    const reportFormat = format || 'xlsx';

    if (reportFormat === 'xlsx') {
      const buffer = await reportService.generateExcel(date);
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="Daily-Report-${date}.xlsx"`);
      reply.header('Content-Length', buffer.length);
      return reply.send(buffer);
    }

    reply.code(400);
    return { data: null, error: 'Supported formats: xlsx' };
  });
}
