import { FastifyInstance } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IDailyReportService } from '../services/DailyReportService.js';

export async function dailyReportRoutes(server: FastifyInstance) {
  const reportService = container.resolve<IDailyReportService>(TOKENS.IDailyReportService);

  // GET /api/v1/reports/daily/summary?date=2026-03-30
  server.get('/api/v1/reports/daily/summary', async (req, reply) => {
    const { date } = req.query as { date?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      reply.code(400);
      return { data: null, error: 'date query parameter required (YYYY-MM-DD)' };
    }

    const summary = await reportService.getSummary(date);
    return { data: summary, error: null };
  });

  // GET /api/v1/reports/daily?date=2026-03-30&format=xlsx
  server.get('/api/v1/reports/daily', async (req, reply) => {
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
