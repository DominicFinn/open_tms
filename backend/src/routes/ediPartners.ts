import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const createEdiPartnerSchema = z.object({
  name: z.string().min(1),
  customerId: z.string().uuid(),
  active: z.boolean().default(true),

  // SFTP Configuration
  sftpHost: z.string().optional(),
  sftpPort: z.number().int().default(22),
  sftpUsername: z.string().optional(),
  sftpPassword: z.string().optional(),
  sftpPrivateKey: z.string().optional(),
  sftpRemoteDir: z.string().default('/'),
  sftpFilePattern: z.string().default('*.edi,*.x12,*.850'),

  // Polling schedule
  pollingEnabled: z.boolean().default(false),
  pollingInterval: z.number().int().min(60).default(900),
  pollingCron: z.string().optional(),

  // EDI Configuration
  senderId: z.string().optional(),
  receiverId: z.string().optional(),
  ediVersion: z.string().default('005010'),

  // Processing options
  autoCreateOrders: z.boolean().default(true),
  autoAssignShipments: z.boolean().default(false),

  // Field mapping
  fieldMapping: z.record(z.any()).optional()
});

const updateEdiPartnerSchema = createEdiPartnerSchema.partial();

// Redact sensitive SFTP credentials in responses
function redactPartner(partner: any): any {
  return {
    ...partner,
    sftpPassword: partner.sftpPassword ? '[REDACTED]' : null,
    sftpPrivateKey: partner.sftpPrivateKey ? '[REDACTED]' : null
  };
}

export async function ediPartnerRoutes(server: FastifyInstance) {
  // List all EDI partners
  server.get('/api/v1/edi-partners', async (req: FastifyRequest, _reply: FastifyReply) => {
    const query = req.query as { active?: string; customerId?: string };

    const where: any = {};
    if (query.active !== undefined) where.active = query.active === 'true';
    if (query.customerId) where.customerId = query.customerId;

    const partners = await server.prisma.ediPartner.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { ediFiles: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return { data: partners.map(redactPartner), error: null };
  });

  // Get single EDI partner
  server.get('/api/v1/edi-partners/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const partner = await server.prisma.ediPartner.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
        _count: { select: { ediFiles: true } }
      }
    });

    if (!partner) {
      reply.code(404);
      return { data: null, error: 'EDI partner not found' };
    }

    return { data: redactPartner(partner), error: null };
  });

  // Create EDI partner
  server.post('/api/v1/edi-partners', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createEdiPartnerSchema.parse((req as any).body);

    const partner = await server.prisma.ediPartner.create({
      data: body as any,
      include: {
        customer: { select: { id: true, name: true } }
      }
    });

    reply.code(201);
    return { data: redactPartner(partner), error: null };
  });

  // Update EDI partner
  server.put('/api/v1/edi-partners/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = updateEdiPartnerSchema.parse((req as any).body);

    const existing = await server.prisma.ediPartner.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'EDI partner not found' };
    }

    // Don't overwrite password with redacted value
    const updateData: any = { ...body };
    if (updateData.sftpPassword === '[REDACTED]') delete updateData.sftpPassword;
    if (updateData.sftpPrivateKey === '[REDACTED]') delete updateData.sftpPrivateKey;

    const updated = await server.prisma.ediPartner.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true } }
      }
    });

    return { data: redactPartner(updated), error: null };
  });

  // Delete EDI partner
  server.delete('/api/v1/edi-partners/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const existing = await server.prisma.ediPartner.findUnique({ where: { id } });
    if (!existing) {
      reply.code(404);
      return { data: null, error: 'EDI partner not found' };
    }

    await server.prisma.ediPartner.delete({ where: { id } });
    return { data: { success: true }, error: null };
  });

  // Test SFTP connection
  server.post('/api/v1/edi-partners/:id/test-connection', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const partner = await server.prisma.ediPartner.findUnique({ where: { id } });
    if (!partner) {
      reply.code(404);
      return { data: null, error: 'EDI partner not found' };
    }

    if (!partner.sftpHost || !partner.sftpUsername) {
      reply.code(400);
      return { data: null, error: 'SFTP host and username are required to test connection' };
    }

    // SFTP connection test is handled by the edi-collector service.
    // This endpoint returns the config for now — a future version
    // could proxy the test through the collector service API.
    reply.code(501);
    return {
      data: null,
      error: 'SFTP connection test requires the edi-collector service. Configure and deploy it to enable this feature.'
    };
  });
}
