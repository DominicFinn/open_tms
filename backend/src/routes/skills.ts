/**
 * Skills API routes — catalog, configuration, and skill chains.
 */

import { FastifyPluginAsync } from 'fastify';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { SkillRegistry } from '../services/skills/SkillRegistry.js';

export const skillRoutes: FastifyPluginAsync = async (server) => {

  // ── GET /api/v1/skills — List available skill definitions ──

  server.get('/api/v1/skills', {
    schema: { tags: ['Skills'], summary: 'List all available skill definitions with field schemas' },
  }, async () => {
    const registry = container.resolve<SkillRegistry>(TOKENS.ISkillRegistry);
    return { data: registry.getDefinitions(), error: null };
  });

  // ── GET /api/v1/skills/:type — Get a single skill definition ──

  server.get<{ Params: { type: string } }>('/api/v1/skills/:type', {
    schema: { tags: ['Skills'], summary: 'Get skill definition by type' },
  }, async (request, reply) => {
    const registry = container.resolve<SkillRegistry>(TOKENS.ISkillRegistry);
    const skill = registry.get(request.params.type);
    if (!skill) { reply.code(404); return { data: null, error: 'Skill type not found' }; }
    return { data: skill.definition, error: null };
  });

  // ── GET /api/v1/skill-configs — List org skill configurations ──

  server.get('/api/v1/skill-configs', {
    schema: { tags: ['Skills'], summary: 'List skill configurations for the org' },
  }, async () => {
    const org = await server.prisma.organization.findFirst();
    if (!org) return { data: [], error: null };
    const configs = await server.prisma.skillConfig.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: 'desc' },
    });
    return { data: configs, error: null };
  });

  // ── POST /api/v1/skill-configs — Create skill config ──

  server.post<{
    Body: { skillType: string; name: string; config: Record<string, unknown> };
  }>('/api/v1/skill-configs', {
    schema: {
      tags: ['Skills'],
      summary: 'Create a skill configuration (API keys, webhooks, etc.)',
      body: {
        type: 'object',
        required: ['skillType', 'name', 'config'],
        properties: {
          skillType: { type: 'string' },
          name: { type: 'string' },
          config: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const org = await server.prisma.organization.findFirst();
    if (!org) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    // Validate config against skill schema
    const registry = container.resolve<SkillRegistry>(TOKENS.ISkillRegistry);
    const skill = registry.get(request.body.skillType);
    if (skill) {
      const validation = skill.validateConfig(request.body.config);
      if (!validation.valid) {
        reply.code(400);
        return { data: null, error: `Invalid config: ${validation.errors?.join(', ')}` };
      }
    }

    const config = await server.prisma.skillConfig.create({
      data: {
        orgId: org.id,
        skillType: request.body.skillType,
        name: request.body.name,
        config: request.body.config,
      },
    });

    reply.code(201);
    return { data: config, error: null };
  });

  // ── PUT /api/v1/skill-configs/:id — Update skill config ──

  server.put<{
    Params: { id: string };
    Body: { name?: string; config?: Record<string, unknown>; enabled?: boolean };
  }>('/api/v1/skill-configs/:id', {
    schema: { tags: ['Skills'], summary: 'Update a skill configuration' },
  }, async (request, reply) => {
    const existing = await server.prisma.skillConfig.findUnique({ where: { id: request.params.id } });
    if (!existing) { reply.code(404); return { data: null, error: 'Config not found' }; }

    const body = request.body;
    const config = await server.prisma.skillConfig.update({
      where: { id: request.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.config !== undefined && { config: body.config }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
      },
    });

    return { data: config, error: null };
  });

  // ── DELETE /api/v1/skill-configs/:id — Delete skill config ──

  server.delete<{ Params: { id: string } }>('/api/v1/skill-configs/:id', {
    schema: { tags: ['Skills'], summary: 'Delete a skill configuration' },
  }, async (request) => {
    await server.prisma.skillConfig.delete({ where: { id: request.params.id } }).catch(() => {});
    return { data: { deleted: true }, error: null };
  });

  // ── GET /api/v1/skill-chains — List skill chains ──

  server.get('/api/v1/skill-chains', {
    schema: { tags: ['Skills'], summary: 'List skill chains' },
  }, async () => {
    const org = await server.prisma.organization.findFirst();
    if (!org) return { data: [], error: null };
    const chains = await server.prisma.skillChain.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: 'desc' },
    });
    return { data: chains, error: null };
  });

  // ── POST /api/v1/skill-chains — Create skill chain ──

  server.post<{
    Body: { name: string; description?: string; steps: unknown[] };
  }>('/api/v1/skill-chains', {
    schema: {
      tags: ['Skills'],
      summary: 'Create a skill chain (sequence of skills with branching)',
      body: {
        type: 'object',
        required: ['name', 'steps'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          steps: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  }, async (request, reply) => {
    const org = await server.prisma.organization.findFirst();
    if (!org) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const chain = await server.prisma.skillChain.create({
      data: {
        orgId: org.id,
        name: request.body.name,
        description: request.body.description || null,
        steps: request.body.steps,
      },
    });

    reply.code(201);
    return { data: chain, error: null };
  });

  // ── PUT /api/v1/skill-chains/:id — Update skill chain ──

  server.put<{
    Params: { id: string };
    Body: { name?: string; description?: string; steps?: unknown[] };
  }>('/api/v1/skill-chains/:id', {
    schema: { tags: ['Skills'], summary: 'Update a skill chain' },
  }, async (request, reply) => {
    const existing = await server.prisma.skillChain.findUnique({ where: { id: request.params.id } });
    if (!existing) { reply.code(404); return { data: null, error: 'Chain not found' }; }

    const body = request.body;
    const chain = await server.prisma.skillChain.update({
      where: { id: request.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.steps !== undefined && { steps: body.steps }),
      },
    });

    return { data: chain, error: null };
  });

  // ── DELETE /api/v1/skill-chains/:id — Delete skill chain ──

  server.delete<{ Params: { id: string } }>('/api/v1/skill-chains/:id', {
    schema: { tags: ['Skills'], summary: 'Delete a skill chain' },
  }, async (request) => {
    await server.prisma.skillChain.delete({ where: { id: request.params.id } }).catch(() => {});
    return { data: { deleted: true }, error: null };
  });
};
