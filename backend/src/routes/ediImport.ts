import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { IEdiImportService } from '../services/EdiImportService.js';
import { container, TOKENS } from '../di/index.js';

export async function ediImportRoutes(server: FastifyInstance) {
  const ediImportService = container.resolve<IEdiImportService>(TOKENS.IEdiImportService);

  // Import EDI content — creates orders
  server.post('/api/v1/orders/import/edi', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      ediContent: z.string().min(1, 'EDI content is required'),
      partnerId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      fileName: z.string().optional(),
      source: z.enum(['manual', 'sftp', 'api']).default('manual'),
      autoAssign: z.boolean().default(false)
    }).parse((req as any).body);

    try {
      const result = await ediImportService.importEdi(body.ediContent, {
        partnerId: body.partnerId,
        customerId: body.customerId,
        fileName: body.fileName,
        source: body.source,
        autoAssign: body.autoAssign
      });

      if (!result.success && result.ordersCreated === 0) {
        reply.code(400);
        return { data: result, error: result.errors.join('; ') };
      }

      reply.code(201);
      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'EDI import failed' };
    }
  });

  // Preview EDI content — parse only, no order creation
  server.post('/api/v1/orders/import/edi/preview', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      ediContent: z.string().min(1, 'EDI content is required'),
      partnerId: z.string().uuid().optional()
    }).parse((req as any).body);

    try {
      const result = await ediImportService.previewEdi(body.ediContent, {
        partnerId: body.partnerId
      });

      return { data: result, error: null };
    } catch (err: any) {
      reply.code(500);
      return { data: null, error: err.message || 'EDI preview failed' };
    }
  });
}
