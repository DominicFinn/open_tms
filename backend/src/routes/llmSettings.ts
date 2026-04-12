/**
 * LLM Settings API routes — manage AI/LLM configuration for the organization.
 *
 * Allows admins to configure their API key, provider, and model via the UI
 * instead of requiring environment variables.
 */

import { FastifyPluginAsync } from 'fastify';

export const llmSettingsRoutes: FastifyPluginAsync = async (server) => {

  // ── GET /api/v1/settings/llm — Get current LLM config ──

  server.get('/api/v1/settings/llm', {
    schema: {
      tags: ['Settings'],
      summary: 'Get LLM/AI configuration',
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                llmProvider: { type: 'string', nullable: true },
                llmModel: { type: 'string', nullable: true },
                llmEnabled: { type: 'boolean' },
                hasApiKey: { type: 'boolean' },
                apiKeyMasked: { type: 'string', nullable: true },
                envConfigured: { type: 'boolean' },
              },
            },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async () => {
    const org = await server.prisma.organization.findFirst({
      select: {
        llmProvider: true,
        llmApiKey: true,
        llmModel: true,
        llmEnabled: true,
      },
    });

    const hasApiKey = !!(org?.llmApiKey);
    // Mask the key: show first 7 and last 4 chars
    let apiKeyMasked: string | null = null;
    if (org?.llmApiKey && org.llmApiKey.length > 12) {
      apiKeyMasked = org.llmApiKey.slice(0, 7) + '...' + org.llmApiKey.slice(-4);
    } else if (org?.llmApiKey) {
      apiKeyMasked = '***';
    }

    return {
      data: {
        llmProvider: org?.llmProvider || null,
        llmModel: org?.llmModel || null,
        llmEnabled: org?.llmEnabled ?? false,
        hasApiKey,
        apiKeyMasked,
        envConfigured: !!process.env.ANTHROPIC_API_KEY,
      },
      error: null,
    };
  });

  // ── PUT /api/v1/settings/llm — Update LLM config ──

  server.put<{
    Body: {
      llmProvider?: string;
      llmApiKey?: string;
      llmModel?: string;
      llmEnabled?: boolean;
    };
  }>('/api/v1/settings/llm', {
    schema: {
      tags: ['Settings'],
      summary: 'Update LLM/AI configuration',
      body: {
        type: 'object',
        properties: {
          llmProvider: { type: 'string', nullable: true, description: 'LLM provider: "anthropic"' },
          llmApiKey: { type: 'string', nullable: true, description: 'API key (send null to clear)' },
          llmModel: { type: 'string', nullable: true, description: 'Model override, e.g. "claude-sonnet-4-20250514"' },
          llmEnabled: { type: 'boolean', description: 'Enable/disable AI agents globally' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'string', nullable: true },
          },
        },
      },
    },
  }, async (request) => {
    const org = await server.prisma.organization.findFirst();
    if (!org) {
      return { data: null, error: 'Organization not found' };
    }

    const updateData: Record<string, unknown> = {};
    const body = request.body;

    if (body.llmProvider !== undefined) updateData.llmProvider = body.llmProvider || null;
    if (body.llmApiKey !== undefined) updateData.llmApiKey = body.llmApiKey || null;
    if (body.llmModel !== undefined) updateData.llmModel = body.llmModel || null;
    if (body.llmEnabled !== undefined) updateData.llmEnabled = body.llmEnabled;

    await server.prisma.organization.update({
      where: { id: org.id },
      data: updateData,
    });

    // Return updated config (masked)
    const updated = await server.prisma.organization.findFirst({
      select: { llmProvider: true, llmApiKey: true, llmModel: true, llmEnabled: true },
    });

    let apiKeyMasked: string | null = null;
    if (updated?.llmApiKey && updated.llmApiKey.length > 12) {
      apiKeyMasked = updated.llmApiKey.slice(0, 7) + '...' + updated.llmApiKey.slice(-4);
    } else if (updated?.llmApiKey) {
      apiKeyMasked = '***';
    }

    return {
      data: {
        llmProvider: updated?.llmProvider || null,
        llmModel: updated?.llmModel || null,
        llmEnabled: updated?.llmEnabled ?? false,
        hasApiKey: !!updated?.llmApiKey,
        apiKeyMasked,
        envConfigured: !!process.env.ANTHROPIC_API_KEY,
      },
      error: null,
    };
  });
};
