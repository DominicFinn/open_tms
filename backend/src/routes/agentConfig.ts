/**
 * Agent Configuration routes — manage configurable agent prompts and behaviour.
 *
 * All writes go through the command bus. The /:agentType GET endpoint will
 * lazily auto-provision the default triage config if none exists; that
 * provisioning also goes through CreateAgentConfigCommand so the config +
 * first version + active pointer land atomically.
 */

import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { DEFAULT_TRIAGE_PROMPT, DEFAULT_TRIAGE_EVENTS } from '../events/handlers/TriageAgentHandler.js';
import { EVENT_TYPES } from '../events/eventTypes.js';
import { container, TOKENS } from '../di/index.js';
import { ICommandBus } from '../commands/CommandBus.js';
import {
  CREATE_AGENT_CONFIG,
  UPDATE_AGENT_CONFIG,
  CREATE_PROMPT_VERSION,
  ACTIVATE_PROMPT_VERSION,
} from '../commands/agentConfig/index.js';

/** All event types available for agent subscription */
const AVAILABLE_EVENTS = Object.entries(EVENT_TYPES).map(([key, value]) => ({
  key,
  value,
  domain: value.split('.')[0],
}));

/** Template variables available in agent prompts */
const TEMPLATE_VARIABLES = [
  {
    name: '{{event}}',
    description: 'The triggering event - type, timestamp, entity, and full payload',
    sample: JSON.stringify({ type: 'shipment.exception', entityType: 'shipment', entityId: 'abc-123', payload: { shipmentReference: 'SH-00042', exceptionType: 'eta_critical_delay', description: '65 min delay' }, timestamp: '2026-04-12T14:30:00Z' }, null, 2),
  },
  {
    name: '{{shipment}}',
    description: 'Shipment details including reference, status, customer, origin, destination, carrier, and stops',
    sample: JSON.stringify({ id: 'abc-123', reference: 'SH-00042', status: 'in_transit', customerName: 'Acme Corp', origin: 'Warehouse A, Chicago, IL', destination: 'DC East, Newark, NJ', carrierName: 'FastFreight', pickupDate: '2026-04-11T08:00:00Z', deliveryDate: '2026-04-12T18:00:00Z', stops: [] }, null, 2),
  },
  {
    name: '{{issues}}',
    description: 'Open issues linked to this shipment (up to 5)',
    sample: JSON.stringify([{ id: 'issue-1', title: 'Delay on SH-00042', priority: 'high', category: 'delay', status: 'open', createdAt: '2026-04-12T10:30:00Z' }], null, 2),
  },
  {
    name: '{{sla_status}}',
    description: 'Active SLA evaluations for this shipment',
    sample: JSON.stringify([{ id: 'eval-1', ruleType: 'eta_delivery', ruleName: 'On-Time Delivery', status: 'warning', slaDueAt: '2026-04-12T18:00:00Z' }], null, 2),
  },
  {
    name: '{{driver}}',
    description: 'Driver assigned to this shipment (via loads). null if no driver assigned - agent should not use contact_driver action in that case',
    sample: JSON.stringify({ id: 'driver-1', name: 'John Smith', phone: '+1-555-0123', email: 'john@carrier.com', hasContactInfo: true }, null, 2),
  },
];

export const agentConfigRoutes: FastifyPluginAsync = async (server) => {
  const commandBus = container.resolve<ICommandBus>(TOKENS.ICommandBus);

  // ── GET /api/v1/agent-configs/available-events ──
  server.get('/api/v1/agent-configs/available-events', {
    schema: { tags: ['Agent Config'], summary: 'List all available event types for agent subscription' },
  }, async () => ({ data: AVAILABLE_EVENTS, error: null }));

  // ── GET /api/v1/agent-configs/template-variables ──
  server.get('/api/v1/agent-configs/template-variables', {
    schema: { tags: ['Agent Config'], summary: 'List template variables available in agent prompts, with sample data' },
  }, async () => ({ data: TEMPLATE_VARIABLES, error: null }));

  // ── GET /api/v1/agent-configs ──
  server.get('/api/v1/agent-configs', {
    schema: { tags: ['Agent Config'], summary: 'List all agent configurations' },
  }, async (req) => {
    const orgId = req.user?.organizationId
      ?? (await server.prisma.organization.findFirst())?.id;
    if (!orgId) return { data: [], error: null };

    const configs = await server.prisma.agentConfig.findMany({
      where: { orgId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { id: true, versionNumber: true, createdAt: true },
        },
      },
    });

    return { data: configs, error: null };
  });

  // ── GET /api/v1/agent-configs/:agentType ──
  server.get<{ Params: { agentType: string } }>('/api/v1/agent-configs/:agentType', {
    schema: {
      tags: ['Agent Config'],
      summary: 'Get agent config by type (auto-creates default if missing)',
      params: { type: 'object', required: ['agentType'], properties: { agentType: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const orgId = request.user?.organizationId
      ?? (await server.prisma.organization.findFirst())?.id;
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    let config = await server.prisma.agentConfig.findFirst({
      where: { orgId, agentType: request.params.agentType },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });

    // Auto-create default config if none exists, via the command bus so the
    // first-version + active pointer land in a single transaction.
    if (!config && request.params.agentType === 'triage') {
      const result = await commandBus.dispatch({
        type: CREATE_AGENT_CONFIG,
        orgId,
        actorId: request.user?.sub ?? 'system',
        payload: {
          agentType: 'triage',
          name: 'Shipment Triage Agent',
          description: 'Analyzes shipment exceptions, SLA breaches, cargo issues, and cold chain excursions using AI to decide what action to take.',
          enabled: true,
          subscribedEvents: DEFAULT_TRIAGE_EVENTS,
          systemPrompt: DEFAULT_TRIAGE_PROMPT,
          changeNote: 'Default prompt',
          createdBy: 'system',
        },
        metadata: { correlationId: crypto.randomUUID(), source: 'api' },
      });

      if (!result.success) {
        reply.code(500);
        return { data: null, error: result.error ?? 'Failed to provision default config' };
      }

      config = await server.prisma.agentConfig.findFirst({
        where: { orgId, agentType: 'triage' },
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
      });
    }

    if (!config) { reply.code(404); return { data: null, error: 'Agent config not found' }; }

    return { data: config, error: null };
  });

  // ── PUT /api/v1/agent-configs/:agentType ──
  server.put<{
    Params: { agentType: string };
    Body: {
      name?: string;
      description?: string;
      enabled?: boolean;
      subscribedEvents?: string[];
      temperature?: number | null;
      maxTokens?: number | null;
      confidenceThreshold?: number | null;
      deduplicationWindowMinutes?: number | null;
    };
  }>('/api/v1/agent-configs/:agentType', {
    schema: {
      tags: ['Agent Config'],
      summary: 'Update agent config settings (non-prompt fields)',
      params: { type: 'object', required: ['agentType'], properties: { agentType: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          enabled: { type: 'boolean' },
          subscribedEvents: { type: 'array', items: { type: 'string' } },
          temperature: { type: 'number', nullable: true, minimum: 0, maximum: 1 },
          maxTokens: { type: 'integer', nullable: true, minimum: 64, maximum: 4096 },
          confidenceThreshold: { type: 'number', nullable: true, minimum: 0, maximum: 1 },
          deduplicationWindowMinutes: { type: 'integer', nullable: true, minimum: 1, maximum: 1440 },
        },
      },
    },
  }, async (request, reply) => {
    const orgId = request.user?.organizationId
      ?? (await server.prisma.organization.findFirst())?.id;
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId, agentType: request.params.agentType },
      select: { id: true },
    });
    if (!config) { reply.code(404); return { data: null, error: 'Agent config not found' }; }

    const result = await commandBus.dispatch({
      type: UPDATE_AGENT_CONFIG,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: { id: config.id, data: request.body },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to update agent config' };
    }

    const updated = await server.prisma.agentConfig.findUnique({
      where: { id: config.id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    return { data: updated, error: null };
  });

  // ── PUT /api/v1/agent-configs/:agentType/prompt ──
  server.put<{
    Params: { agentType: string };
    Body: { systemPrompt: string; changeNote?: string };
  }>('/api/v1/agent-configs/:agentType/prompt', {
    schema: {
      tags: ['Agent Config'],
      summary: 'Save a new prompt version (creates an immutable version record)',
      params: { type: 'object', required: ['agentType'], properties: { agentType: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['systemPrompt'],
        properties: {
          systemPrompt: { type: 'string', minLength: 10 },
          changeNote: { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const orgId = request.user?.organizationId
      ?? (await server.prisma.organization.findFirst())?.id;
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId, agentType: request.params.agentType },
      select: { id: true },
    });
    if (!config) { reply.code(404); return { data: null, error: 'Agent config not found' }; }

    const result = await commandBus.dispatch({
      type: CREATE_PROMPT_VERSION,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: {
        configId: config.id,
        systemPrompt: request.body.systemPrompt,
        changeNote: request.body.changeNote ?? null,
        createdBy: request.user?.sub ?? null,
      },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      reply.code(400);
      return { data: null, error: result.error ?? 'Failed to save prompt version' };
    }

    const version = await server.prisma.agentConfigVersion.findUnique({
      where: { id: (result.data as { versionId: string }).versionId },
    });
    return { data: version, error: null };
  });

  // ── GET /api/v1/agent-configs/:agentType/versions ──
  server.get<{ Params: { agentType: string } }>('/api/v1/agent-configs/:agentType/versions', {
    schema: { tags: ['Agent Config'], summary: 'List prompt version history' },
  }, async (request) => {
    const orgId = request.user?.organizationId
      ?? (await server.prisma.organization.findFirst())?.id;
    if (!orgId) return { data: [], error: null };

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId, agentType: request.params.agentType },
      select: { id: true, activeVersionId: true },
    });
    if (!config) return { data: [], error: null };

    const versions = await server.prisma.agentConfigVersion.findMany({
      where: { configId: config.id },
      orderBy: { versionNumber: 'desc' },
    });

    return {
      data: versions.map((v) => ({ ...v, isActive: v.id === config.activeVersionId })),
      error: null,
    };
  });

  // ── POST /api/v1/agent-configs/:agentType/versions/:versionId/activate ──
  server.post<{
    Params: { agentType: string; versionId: string };
  }>('/api/v1/agent-configs/:agentType/versions/:versionId/activate', {
    schema: { tags: ['Agent Config'], summary: 'Activate (rollback to) a specific prompt version' },
  }, async (request, reply) => {
    const orgId = request.user?.organizationId
      ?? (await server.prisma.organization.findFirst())?.id;
    if (!orgId) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId, agentType: request.params.agentType },
      select: { id: true },
    });
    if (!config) { reply.code(404); return { data: null, error: 'Agent config not found' }; }

    const result = await commandBus.dispatch({
      type: ACTIVATE_PROMPT_VERSION,
      orgId,
      actorId: request.user?.sub ?? null,
      payload: { configId: config.id, versionId: request.params.versionId },
      metadata: { correlationId: crypto.randomUUID(), source: 'api' },
    });

    if (!result.success) {
      const code = (result.error || '').toLowerCase().includes('not found') ? 404 : 400;
      reply.code(code);
      return { data: null, error: result.error ?? 'Failed to activate version' };
    }

    const version = await server.prisma.agentConfigVersion.findUnique({
      where: { id: request.params.versionId },
    });
    return { data: version ? { ...version, isActive: true } : null, error: null };
  });

  // ── POST /api/v1/agent-configs/:agentType/preview-prompt ──
  // Pure server-side string templating — no DB writes, so it stays out of
  // the command bus.
  server.post<{
    Params: { agentType: string };
    Body: { systemPrompt: string };
  }>('/api/v1/agent-configs/:agentType/preview-prompt', {
    schema: {
      tags: ['Agent Config'],
      summary: 'Preview a prompt with template variables replaced by sample data',
      body: { type: 'object', required: ['systemPrompt'], properties: { systemPrompt: { type: 'string' } } },
    },
  }, async (request) => {
    const prompt = request.body.systemPrompt;

    const sampleMap: Record<string, string> = {};
    for (const v of TEMPLATE_VARIABLES) sampleMap[v.name] = v.sample;

    let resolved = prompt;
    for (const [varName, sample] of Object.entries(sampleMap)) {
      const escaped = varName.replace(/[{}]/g, '\\$&');
      resolved = resolved.replace(new RegExp(escaped, 'g'), sample);
    }

    return { data: { resolved }, error: null };
  });
};
