import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { IEdiImportService } from '../services/EdiImportService.js';
import { container, TOKENS } from '../di/index.js';

export async function ediFileRoutes(server: FastifyInstance) {
  const ediImportService = container.resolve<IEdiImportService>(TOKENS.IEdiImportService);

  // List EDI files with filtering and pagination
  server.get('/api/v1/edi-files', async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as {
      status?: string;
      partnerId?: string;
      source?: string;
      limit?: string;
      offset?: string;
    };

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.source) where.source = query.source;

    const limit = query.limit ? Math.min(parseInt(query.limit, 10), 100) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const [files, total] = await Promise.all([
      server.prisma.ediFile.findMany({
        where,
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          source: true,
          status: true,
          transactionType: true,
          transactionCount: true,
          ordersCreated: true,
          orderIds: true,
          errorMessage: true,
          processedAt: true,
          createdAt: true,
          partner: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      server.prisma.ediFile.count({ where })
    ]);

    return { data: { files, total, limit, offset }, error: null };
  });

  // Get single EDI file detail (includes parsed data, excludes raw content by default)
  server.get('/api/v1/edi-files/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { includeContent?: string };

    const file = await server.prisma.ediFile.findUnique({
      where: { id },
      include: {
        partner: {
          select: { id: true, name: true, customerId: true }
        }
      }
    });

    if (!file) {
      reply.code(404);
      return { data: null, error: 'EDI file not found' };
    }

    // Don't return raw content unless explicitly requested (it can be large)
    const result: any = { ...file };
    if (query.includeContent !== 'true') {
      result.fileContent = undefined;
    }

    return { data: result, error: null };
  });

  // Reprocess a failed EDI file
  server.post('/api/v1/edi-files/:id/reprocess', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const file = await server.prisma.ediFile.findUnique({
      where: { id },
      include: {
        partner: { select: { id: true, customerId: true, fieldMapping: true } }
      }
    });

    if (!file) {
      reply.code(404);
      return { data: null, error: 'EDI file not found' };
    }

    if (file.status !== 'failed') {
      reply.code(400);
      return { data: null, error: `Cannot reprocess file with status '${file.status}'. Only failed files can be reprocessed.` };
    }

    // Reset file status
    await server.prisma.ediFile.update({
      where: { id },
      data: {
        status: 'pending',
        processedAt: null,
        errorMessage: null,
        ordersCreated: 0,
        orderIds: undefined
      }
    });

    // Re-import using the stored content
    const result = await ediImportService.importEdi(file.fileContent, {
      partnerId: file.partnerId || undefined,
      fileName: file.fileName,
      source: file.source
    });

    return { data: result, error: result.success ? null : result.errors.join('; ') };
  });

  // Get EDI file stats
  server.get('/api/v1/edi-files/stats', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const [pending, processing, completed, failed] = await Promise.all([
      server.prisma.ediFile.count({ where: { status: 'pending' } }),
      server.prisma.ediFile.count({ where: { status: 'processing' } }),
      server.prisma.ediFile.count({ where: { status: 'completed' } }),
      server.prisma.ediFile.count({ where: { status: 'failed' } })
    ]);

    const totalOrders = await server.prisma.ediFile.aggregate({
      _sum: { ordersCreated: true }
    });

    return {
      data: {
        pending,
        processing,
        completed,
        failed,
        totalFiles: pending + processing + completed + failed,
        totalOrdersCreated: totalOrders._sum.ordersCreated || 0
      },
      error: null
    };
  });
}
