import { TriageAgentHandler, DEFAULT_TRIAGE_EVENTS } from '../../events/handlers/TriageAgentHandler';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';
import { ILlmProvider, LlmCompletionRequest, LlmCompletionResponse } from '../../services/llm/ILlmProvider';

// ── Mock LLM Provider ─────────────────────────────────────────────

function createMockLlm(response: string): ILlmProvider {
  return {
    providerName: 'mock',
    modelId: 'mock-model-1',
    complete: jest.fn().mockResolvedValue({
      content: response,
      provider: 'mock',
      model: 'mock-model-1',
      usage: { inputTokens: 100, outputTokens: 50 },
    } satisfies LlmCompletionResponse),
  };
}

// ── Mock CommandBus ───────────────────────────────────────────────

function createMockCommandBus() {
  const dispatched: Array<{ type: string; payload: unknown }> = [];
  return {
    bus: {
      register: jest.fn(),
      dispatch: jest.fn(async (command: { type: string; payload: unknown }) => {
        dispatched.push({ type: command.type, payload: command.payload });
        return {
          success: true,
          data: { id: `created-${dispatched.length}`, summary: 'test', actionType: 'test' },
          events: [],
        };
      }),
    },
    dispatched,
  };
}

// ── Mock Prisma ──────────────────────────────────────────────────

function createMockPrisma(overrides?: {
  shipment?: unknown;
  openIssues?: unknown[];
  slaEvaluations?: unknown[];
  recentDecision?: unknown;
  agentConfig?: unknown;
}) {
  return {
    shipment: {
      findUnique: jest.fn().mockResolvedValue(overrides?.shipment ?? {
        id: 'ship-1',
        reference: 'SH-00001',
        status: 'in_transit',
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
        customer: { id: 'cust-1', name: 'Acme Corp' },
        origin: { id: 'loc-1', name: 'Warehouse A', city: 'Chicago', state: 'IL' },
        destination: { id: 'loc-2', name: 'DC East', city: 'Newark', state: 'NJ' },
        carrier: { id: 'carr-1', name: 'FastFreight' },
        stops: [],
      }),
    },
    issue: {
      findMany: jest.fn().mockResolvedValue(overrides?.openIssues ?? []),
    },
    slaEvaluation: {
      findMany: jest.fn().mockResolvedValue(overrides?.slaEvaluations ?? []),
    },
    agentDecision: {
      findFirst: jest.fn().mockResolvedValue(overrides?.recentDecision ?? null),
    },
    agentConfig: {
      findFirst: jest.fn().mockResolvedValue(overrides?.agentConfig ?? null),
    },
    agentConfigVersion: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('TriageAgentHandler', () => {
  it('has correct name and event patterns', () => {
    const handler = new TriageAgentHandler(
      createMockPrisma(),
      createMockLlm('{}'),
      createMockCommandBus().bus as any,
    );

    expect(handler.name).toBe('agent.triage');
    // Broad subscription patterns (filters against config in handle())
    expect(handler.eventPatterns).toContain('shipment.*');
    expect(handler.eventPatterns).toContain('sla.*');
    expect(handler.eventPatterns).toContain('cargo.*');
    expect(handler.eventPatterns).toContain('cold_chain.*');
  });

  it('calls LLM and logs create_issue decision', async () => {
    const llmResponse = JSON.stringify({
      summary: 'Created critical issue for 60-min delay',
      reasoning: 'Shipment SH-00001 is critically delayed by 60 minutes, breaching the SLA threshold.',
      actionType: 'create_issue',
      confidence: 0.95,
      issuePriority: 'critical',
      issueCategory: 'delay',
      issueTitle: 'Critical delay: SH-00001 - 60 min late',
    });

    const mockLlm = createMockLlm(llmResponse);
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma();

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay', description: '60 min delay' },
    );

    await handler.handle(event);

    // Should have called the LLM
    expect(mockLlm.complete).toHaveBeenCalledTimes(1);
    const llmCall = (mockLlm.complete as jest.Mock).mock.calls[0][0] as LlmCompletionRequest;
    expect(llmCall.messages).toHaveLength(2);
    expect(llmCall.messages[0].role).toBe('system');
    expect(llmCall.messages[1].role).toBe('user');

    // Should have dispatched: 1) create_issue, 2) agent_decision.create
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].type).toBe('issue.create');
    expect(dispatched[1].type).toBe('agent_decision.create');

    // Verify issue creation payload
    const issuePayload = dispatched[0].payload as any;
    expect(issuePayload.title).toBe('Critical delay: SH-00001 - 60 min late');
    expect(issuePayload.priority).toBe('critical');
    expect(issuePayload.category).toBe('delay');
    expect(issuePayload.sourceEntityType).toBe('shipment');
    expect(issuePayload.sourceEntityId).toBe('ship-1');

    // Verify decision logging payload
    const decisionPayload = dispatched[1].payload as any;
    expect(decisionPayload.agentType).toBe('triage');
    expect(decisionPayload.modelProvider).toBe('mock');
    expect(decisionPayload.modelId).toBe('mock-model-1');
    expect(decisionPayload.triggerEventType).toBe(EVENT_TYPES.SHIPMENT_EXCEPTION);
    expect(decisionPayload.actionType).toBe('create_issue');
    expect(decisionPayload.confidence).toBe(0.95);
  });

  it('logs no_action decision when LLM says no action needed', async () => {
    const llmResponse = JSON.stringify({
      summary: 'No action needed - duplicate issue already exists',
      reasoning: 'An open issue already exists for this shipment delay.',
      actionType: 'no_action',
      confidence: 0.85,
    });

    const mockLlm = createMockLlm(llmResponse);
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma({
      openIssues: [{ id: 'issue-1', title: 'Delay on SH-00001', priority: 'high', category: 'delay', status: 'open', createdAt: new Date() }],
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay', description: '60 min delay' },
    );

    await handler.handle(event);

    // Should only dispatch agent_decision.create (no issue creation)
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('agent_decision.create');
    expect((dispatched[0].payload as any).actionType).toBe('no_action');
  });

  it('skips processing when recent decision exists (deduplication)', async () => {
    const mockLlm = createMockLlm('{}');
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma({
      recentDecision: { id: 'decision-existing' },
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay' },
    );

    await handler.handle(event);

    // LLM should NOT have been called
    expect(mockLlm.complete).not.toHaveBeenCalled();
    // No commands dispatched
    expect(dispatched).toHaveLength(0);
  });

  it('defaults to no_action when LLM returns unparseable response', async () => {
    const mockLlm = createMockLlm('This is not valid JSON at all');
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma();

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SLA_BREACHED,
      'shipment',
      'ship-1',
      { evaluationId: 'eval-1', ruleType: 'eta_delivery', entityType: 'shipment', entityId: 'ship-1' },
    );

    await handler.handle(event);

    // Should still log a decision with no_action
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('agent_decision.create');
    expect((dispatched[0].payload as any).actionType).toBe('no_action');
    expect((dispatched[0].payload as any).confidence).toBe(0);
  });

  it('handles escalate_issue action type', async () => {
    const llmResponse = JSON.stringify({
      summary: 'Escalated existing issue - situation worsened',
      reasoning: 'The delay has increased from 30 to 75 minutes. Existing issue should be escalated.',
      actionType: 'escalate_issue',
      confidence: 0.88,
      escalateIssueId: 'issue-1',
      escalateReason: 'Delay worsened from 30 to 75 minutes',
    });

    const mockLlm = createMockLlm(llmResponse);
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma({
      openIssues: [{ id: 'issue-1', title: 'Delay on SH-00001', priority: 'medium', category: 'delay', status: 'open', createdAt: new Date() }],
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay', description: '75 min delay' },
    );

    await handler.handle(event);

    // Should dispatch: 1) escalate_issue, 2) agent_decision.create
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].type).toBe('issue.escalate');
    expect((dispatched[0].payload as any).id).toBe('issue-1');
    expect((dispatched[0].payload as any).reason).toBe('Delay worsened from 30 to 75 minutes');
  });

  it('gathers shipment context including SLA evaluations', async () => {
    const llmResponse = JSON.stringify({
      summary: 'No action',
      reasoning: 'test',
      actionType: 'no_action',
      confidence: 0.5,
    });

    const mockLlm = createMockLlm(llmResponse);
    const { bus } = createMockCommandBus();
    const mockPrisma = createMockPrisma({
      slaEvaluations: [
        { id: 'eval-1', ruleType: 'eta_delivery', ruleName: 'On-Time Delivery', status: 'warning', slaDueAt: new Date() },
      ],
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay' },
    );

    await handler.handle(event);

    // Verify context was gathered: shipment, issues, SLA
    expect(mockPrisma.shipment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ship-1' } })
    );
    expect(mockPrisma.issue.findMany).toHaveBeenCalled();
    expect(mockPrisma.slaEvaluation.findMany).toHaveBeenCalled();

    // Verify LLM was called with context
    const llmCall = (mockLlm.complete as jest.Mock).mock.calls[0][0] as LlmCompletionRequest;
    const userMessage = llmCall.messages[1].content;
    expect(userMessage).toContain('shipment.exception');
    expect(userMessage).toContain('SH-00001');
  });

  it('strips markdown code fences from LLM response', async () => {
    const wrappedResponse = '```json\n' + JSON.stringify({
      summary: 'Created issue',
      reasoning: 'Test',
      actionType: 'create_issue',
      confidence: 0.9,
      issuePriority: 'high',
      issueCategory: 'exception',
      issueTitle: 'Test issue',
    }) + '\n```';

    const mockLlm = createMockLlm(wrappedResponse);
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma();

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay' },
    );

    await handler.handle(event);

    // Should have successfully parsed and dispatched create_issue
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].type).toBe('issue.create');
  });

  it('skips events not in config subscribedEvents', async () => {
    const mockLlm = createMockLlm('{}');
    const { bus, dispatched } = createMockCommandBus();
    // Config only subscribes to shipment.exception, not sla.breached
    const mockPrisma = createMockPrisma({
      agentConfig: {
        id: 'config-1',
        activeVersionId: null,
        enabled: true,
        subscribedEvents: ['shipment.exception'],
        temperature: 0.2,
        maxTokens: 512,
        confidenceThreshold: null,
        deduplicationWindowMinutes: null,
        versions: [],
      },
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    // Send an sla.breached event — should be filtered out
    const event = createTestEvent(
      EVENT_TYPES.SLA_BREACHED,
      'shipment',
      'ship-1',
      { evaluationId: 'eval-1', ruleType: 'eta_delivery', entityType: 'shipment', entityId: 'ship-1' },
    );

    await handler.handle(event);

    // LLM should NOT have been called
    expect(mockLlm.complete).not.toHaveBeenCalled();
    expect(dispatched).toHaveLength(0);
  });

  it('overrides to no_action when confidence below threshold', async () => {
    const llmResponse = JSON.stringify({
      summary: 'Created issue for delay',
      reasoning: 'Shipment is delayed',
      actionType: 'create_issue',
      confidence: 0.4,
      issuePriority: 'medium',
      issueCategory: 'delay',
      issueTitle: 'Delay on SH-00001',
    });

    const mockLlm = createMockLlm(llmResponse);
    const { bus, dispatched } = createMockCommandBus();
    // Config has confidence threshold of 0.7
    const mockPrisma = createMockPrisma({
      agentConfig: {
        id: 'config-1',
        activeVersionId: null,
        enabled: true,
        subscribedEvents: DEFAULT_TRIAGE_EVENTS,
        temperature: 0.2,
        maxTokens: 512,
        confidenceThreshold: 0.7,
        deduplicationWindowMinutes: 30,
        versions: [],
      },
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay' },
    );

    await handler.handle(event);

    // Should only dispatch agent_decision.create (no issue creation — confidence too low)
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].type).toBe('agent_decision.create');
    expect((dispatched[0].payload as any).actionType).toBe('no_action');
  });

  it('skips processing when config is disabled', async () => {
    const mockLlm = createMockLlm('{}');
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma({
      agentConfig: {
        id: 'config-1',
        activeVersionId: null,
        enabled: false,
        subscribedEvents: DEFAULT_TRIAGE_EVENTS,
        temperature: 0.2,
        maxTokens: 512,
        confidenceThreshold: null,
        deduplicationWindowMinutes: null,
        versions: [],
      },
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay' },
    );

    await handler.handle(event);

    expect(mockLlm.complete).not.toHaveBeenCalled();
    expect(dispatched).toHaveLength(0);
  });

  it('writes agentConfigId and promptVersionId to decision log', async () => {
    const llmResponse = JSON.stringify({
      summary: 'No action needed',
      reasoning: 'Test',
      actionType: 'no_action',
      confidence: 0.8,
    });

    const mockLlm = createMockLlm(llmResponse);
    const { bus, dispatched } = createMockCommandBus();
    const mockPrisma = createMockPrisma({
      agentConfig: {
        id: 'config-42',
        activeVersionId: 'version-7',
        enabled: true,
        subscribedEvents: DEFAULT_TRIAGE_EVENTS,
        temperature: 0.3,
        maxTokens: 256,
        confidenceThreshold: null,
        deduplicationWindowMinutes: 15,
        versions: [{ id: 'version-7', systemPrompt: 'Custom prompt', versionNumber: 7 }],
      },
    });
    mockPrisma.agentConfigVersion.findUnique.mockResolvedValue({
      id: 'version-7',
      systemPrompt: 'Custom prompt for testing',
    });

    const handler = new TriageAgentHandler(mockPrisma, mockLlm, bus as any);

    const event = createTestEvent(
      EVENT_TYPES.SHIPMENT_EXCEPTION,
      'shipment',
      'ship-1',
      { shipmentReference: 'SH-00001', exceptionType: 'eta_critical_delay' },
    );

    await handler.handle(event);

    // Decision should have config traceability
    const decisionPayload = dispatched[0].payload as any;
    expect(decisionPayload.agentConfigId).toBe('config-42');
    expect(decisionPayload.promptVersionId).toBe('version-7');
  });
});
