/**
 * Agent Configuration routes — manage configurable agent prompts and behaviour.
 */

import { FastifyPluginAsync } from 'fastify';
import { DEFAULT_TRIAGE_PROMPT, DEFAULT_TRIAGE_EVENTS } from '../events/handlers/TriageAgentHandler.js';
import { EVENT_TYPES } from '../events/eventTypes.js';

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

  // ── GET /api/v1/agent-configs/available-events ──

  server.get('/api/v1/agent-configs/available-events', {
    schema: {
      tags: ['Agent Config'],
      summary: 'List all available event types for agent subscription',
    },
  }, async () => {
    return { data: AVAILABLE_EVENTS, error: null };
  });

  // ── GET /api/v1/agent-configs/template-variables ──

  server.get('/api/v1/agent-configs/template-variables', {
    schema: {
      tags: ['Agent Config'],
      summary: 'List template variables available in agent prompts, with sample data',
    },
  }, async () => {
    return { data: TEMPLATE_VARIABLES, error: null };
  });

  // ── GET /api/v1/agent-configs ──

  server.get('/api/v1/agent-configs', {
    schema: {
      tags: ['Agent Config'],
      summary: 'List all agent configurations',
    },
  }, async () => {
    const org = await server.prisma.organization.findFirst();
    if (!org) return { data: [], error: null };

    const configs = await server.prisma.agentConfig.findMany({
      where: { orgId: org.id },
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
      params: {
        type: 'object',
        required: ['agentType'],
        properties: { agentType: { type: 'string' } },
      },
    },
  }, async (request) => {
    const org = await server.prisma.organization.findFirst();
    if (!org) return { data: null, error: 'Organization not found' };

    let config = await server.prisma.agentConfig.findFirst({
      where: { orgId: org.id, agentType: request.params.agentType },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    // Auto-create default config if none exists
    if (!config && request.params.agentType === 'triage') {
      config = await server.prisma.agentConfig.create({
        data: {
          orgId: org.id,
          agentType: 'triage',
          name: 'Shipment Triage Agent',
          description: 'Analyzes shipment exceptions, SLA breaches, cargo issues, and cold chain excursions using AI to decide what action to take.',
          enabled: true,
          subscribedEvents: DEFAULT_TRIAGE_EVENTS,
          versions: {
            create: {
              versionNumber: 1,
              systemPrompt: DEFAULT_TRIAGE_PROMPT,
              changeNote: 'Default prompt',
              createdBy: 'system',
            },
          },
        },
        include: { versions: { orderBy: { versionNumber: 'desc' as const } } },
      });
      // Set active version
      await server.prisma.agentConfig.update({
        where: { id: config.id },
        data: { activeVersionId: config.versions[0].id },
      });
      config = await server.prisma.agentConfig.findFirst({
        where: { id: config.id },
        include: { versions: { orderBy: { versionNumber: 'desc' as const } } },
      });
    }

    if (!config) return { data: null, error: 'Agent config not found' };

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
      params: {
        type: 'object',
        required: ['agentType'],
        properties: { agentType: { type: 'string' } },
      },
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
    const org = await server.prisma.organization.findFirst();
    if (!org) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId: org.id, agentType: request.params.agentType },
    });
    if (!config) { reply.code(404); return { data: null, error: 'Agent config not found' }; }

    const body = request.body;
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.enabled !== undefined) updateData.enabled = body.enabled;
    if (body.subscribedEvents !== undefined) updateData.subscribedEvents = body.subscribedEvents;
    if (body.temperature !== undefined) updateData.temperature = body.temperature;
    if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens;
    if (body.confidenceThreshold !== undefined) updateData.confidenceThreshold = body.confidenceThreshold;
    if (body.deduplicationWindowMinutes !== undefined) updateData.deduplicationWindowMinutes = body.deduplicationWindowMinutes;

    const updated = await server.prisma.agentConfig.update({
      where: { id: config.id },
      data: updateData,
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
      params: {
        type: 'object',
        required: ['agentType'],
        properties: { agentType: { type: 'string' } },
      },
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
    const org = await server.prisma.organization.findFirst();
    if (!org) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId: org.id, agentType: request.params.agentType },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!config) { reply.code(404); return { data: null, error: 'Agent config not found' }; }

    const nextVersion = (config.versions[0]?.versionNumber ?? 0) + 1;

    const version = await server.prisma.agentConfigVersion.create({
      data: {
        configId: config.id,
        versionNumber: nextVersion,
        systemPrompt: request.body.systemPrompt,
        changeNote: request.body.changeNote || null,
      },
    });

    // Set as active
    await server.prisma.agentConfig.update({
      where: { id: config.id },
      data: { activeVersionId: version.id },
    });

    return { data: version, error: null };
  });

  // ── GET /api/v1/agent-configs/:agentType/versions ──

  server.get<{ Params: { agentType: string } }>('/api/v1/agent-configs/:agentType/versions', {
    schema: {
      tags: ['Agent Config'],
      summary: 'List prompt version history',
    },
  }, async (request) => {
    const org = await server.prisma.organization.findFirst();
    if (!org) return { data: [], error: null };

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId: org.id, agentType: request.params.agentType },
      select: { id: true, activeVersionId: true },
    });
    if (!config) return { data: [], error: null };

    const versions = await server.prisma.agentConfigVersion.findMany({
      where: { configId: config.id },
      orderBy: { versionNumber: 'desc' },
    });

    return {
      data: versions.map((v) => ({
        ...v,
        isActive: v.id === config.activeVersionId,
      })),
      error: null,
    };
  });

  // ── POST /api/v1/agent-configs/:agentType/versions/:versionId/activate ──

  server.post<{
    Params: { agentType: string; versionId: string };
  }>('/api/v1/agent-configs/:agentType/versions/:versionId/activate', {
    schema: {
      tags: ['Agent Config'],
      summary: 'Activate (rollback to) a specific prompt version',
    },
  }, async (request, reply) => {
    const org = await server.prisma.organization.findFirst();
    if (!org) { reply.code(404); return { data: null, error: 'Organization not found' }; }

    const config = await server.prisma.agentConfig.findFirst({
      where: { orgId: org.id, agentType: request.params.agentType },
    });
    if (!config) { reply.code(404); return { data: null, error: 'Agent config not found' }; }

    const version = await server.prisma.agentConfigVersion.findFirst({
      where: { id: request.params.versionId, configId: config.id },
    });
    if (!version) { reply.code(404); return { data: null, error: 'Version not found' }; }

    await server.prisma.agentConfig.update({
      where: { id: config.id },
      data: { activeVersionId: version.id },
    });

    return { data: { ...version, isActive: true }, error: null };
  });

  // ── POST /api/v1/agent-configs/:agentType/preview-prompt ──

  server.post<{
    Params: { agentType: string };
    Body: { systemPrompt: string };
  }>('/api/v1/agent-configs/:agentType/preview-prompt', {
    schema: {
      tags: ['Agent Config'],
      summary: 'Preview a prompt with template variables replaced by sample data',
      body: {
        type: 'object',
        required: ['systemPrompt'],
        properties: { systemPrompt: { type: 'string' } },
      },
    },
  }, async (request) => {
    const prompt = request.body.systemPrompt;

    // Replace template variables with sample data
    const sampleMap: Record<string, string> = {};
    for (const v of TEMPLATE_VARIABLES) {
      sampleMap[v.name] = v.sample;
    }

    let resolved = prompt;
    for (const [varName, sample] of Object.entries(sampleMap)) {
      const escaped = varName.replace(/[{}]/g, '\\$&');
      resolved = resolved.replace(new RegExp(escaped, 'g'), sample);
    }

    return { data: { resolved }, error: null };
  });
};
