import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

// Note: In production, auth values should be encrypted, not hashed
// For now, we store them as-is but redact in responses

// Helper to redact auth values in responses
function redactAuthValue(authType: string | null, value: string | null): string | null {
  if (!value || !authType || authType === 'none') return null;
  return '[REDACTED]';
}

export async function outboundIntegrationRoutes(server: FastifyInstance) {
  // Get all outbound integrations
  server.get('/api/v1/outbound-integrations', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const integrations = await server.prisma.outboundIntegration.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            logs: true
          }
        }
      }
    });

    // Redact auth values
    const safeIntegrations = integrations.map((integration: any) => ({
      ...integration,
      authValue: redactAuthValue(integration.authType, integration.authValue)
    }));

    return { data: safeIntegrations, error: null };
  });

  // Get single outbound integration
  server.get('/api/v1/outbound-integrations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const integration = await server.prisma.outboundIntegration.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            logs: true
          }
        }
      }
    });

    if (!integration) {
      reply.code(404);
      return { data: null, error: 'Outbound integration not found' };
    }

    return {
      data: {
        ...integration,
        authValue: redactAuthValue(integration.authType, integration.authValue)
      },
      error: null
    };
  });

  // Create outbound integration
  server.post('/api/v1/outbound-integrations', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      url: z.string().url(),
      description: z.string().optional(),
      active: z.boolean().default(true),
      senderId: z.string().optional(),
      receiverId: z.string().optional(),
      interchangeControlNumber: z.string().optional(),
      authType: z.enum(['none', 'basic', 'bearer', 'api_key']).default('none'),
      authHeader: z.string().optional(),
      authValue: z.string().optional()
    }).parse((req as any).body);

    // Store auth value (in production, encrypt this)
    let storedAuthValue: string | null = null;
    if (body.authValue && body.authType !== 'none') {
      storedAuthValue = body.authValue;
    }

    const integration = await server.prisma.outboundIntegration.create({
      data: {
        name: body.name,
        url: body.url,
        description: body.description,
        active: body.active,
        senderId: body.senderId,
        receiverId: body.receiverId,
        interchangeControlNumber: body.interchangeControlNumber,
        authType: body.authType,
        authHeader: body.authHeader,
        authValue: storedAuthValue
      }
    });

    reply.code(201);
    return {
      data: {
        ...integration,
        authValue: redactAuthValue(integration.authType, integration.authValue)
      },
      error: null
    };
  });

  // Update outbound integration
  server.put('/api/v1/outbound-integrations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      url: z.string().url().optional(),
      description: z.string().optional(),
      active: z.boolean().optional(),
      senderId: z.string().optional(),
      receiverId: z.string().optional(),
      interchangeControlNumber: z.string().optional(),
      authType: z.enum(['none', 'basic', 'bearer', 'api_key']).optional(),
      authHeader: z.string().optional(),
      authValue: z.string().optional()
    }).parse((req as any).body);

    const integration = await server.prisma.outboundIntegration.findUnique({
      where: { id }
    });

    if (!integration) {
      reply.code(404);
      return { data: null, error: 'Outbound integration not found' };
    }

    // Handle auth value update
    const updateData: any = { ...body };
    if (body.authValue !== undefined) {
      if (body.authValue && body.authType !== 'none') {
        updateData.authValue = body.authValue;
      } else {
        updateData.authValue = null;
      }
    }

    const updated = await server.prisma.outboundIntegration.update({
      where: { id },
      data: updateData
    });

    return {
      data: {
        ...updated,
        authValue: redactAuthValue(updated.authType, updated.authValue)
      },
      error: null
    };
  });

  // Delete outbound integration
  server.delete('/api/v1/outbound-integrations/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const integration = await server.prisma.outboundIntegration.findUnique({
      where: { id }
    });

    if (!integration) {
      reply.code(404);
      return { data: null, error: 'Outbound integration not found' };
    }

    await server.prisma.outboundIntegration.delete({
      where: { id }
    });

    return { data: { success: true }, error: null };
  });

  // Test outbound integration (send a test EDI 856)
  server.post('/api/v1/outbound-integrations/:id/test', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const integration = await server.prisma.outboundIntegration.findUnique({
      where: { id }
    });

    if (!integration) {
      reply.code(404);
      return { data: null, error: 'Outbound integration not found' };
    }

    // This would trigger a test send - for now just return success
    // In a real implementation, you'd generate a test EDI 856 and send it
    return {
      data: {
        message: 'Test functionality coming soon',
        integrationId: id
      },
      error: null
    };
  });
}
