import { CreateAgentDecisionCommandHandler, CREATE_AGENT_DECISION } from '../../commands/agentDecisions/CreateAgentDecisionCommand';
import { RecordDecisionOutcomeCommandHandler, RECORD_DECISION_OUTCOME } from '../../commands/agentDecisions/RecordDecisionOutcomeCommand';
import { PromoteDecisionCommandHandler, PROMOTE_DECISION } from '../../commands/agentDecisions/PromoteDecisionCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockDecision = {
  id: 'decision-1', orgId: 'org-1', agentType: 'triage',
  modelProvider: 'anthropic', modelId: 'claude-sonnet-4-20250514',
  triggerType: 'domain_event', triggerEventType: 'shipment.exception',
  triggerEventId: 'evt-1', entityType: 'shipment', entityId: 'ship-1',
  summary: 'Escalated issue to critical priority',
  reasoning: 'SLA breach imminent based on current delay of 45 minutes',
  context: { currentDelay: 45, slaThreshold: 30 },
  conversationLog: null, confidence: 0.92,
  actionType: 'escalate_issue', actionPayload: { issueId: 'issue-1', newPriority: 'critical' },
  actionEntityType: 'issue', actionEntityId: 'issue-1',
  outcomeStatus: 'pending', outcomeNotes: null,
  outcomeRecordedAt: null, outcomeRecordedBy: null,
  promotedToAutomation: false, promotedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockTx = {
  agentDecision: {
    create: jest.fn().mockResolvedValue(mockDecision),
    update: jest.fn().mockResolvedValue(mockDecision),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockDecision),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('Agent Decision Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateAgentDecisionCommandHandler', () => {
    it('creates decision and emits AGENT_DECISION_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateAgentDecisionCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_AGENT_DECISION, {
          agentType: 'triage',
          modelProvider: 'anthropic',
          modelId: 'claude-sonnet-4-20250514',
          triggerType: 'domain_event',
          triggerEventType: 'shipment.exception',
          triggerEventId: 'evt-1',
          entityType: 'shipment',
          entityId: 'ship-1',
          summary: 'Escalated issue to critical priority',
          reasoning: 'SLA breach imminent based on current delay of 45 minutes',
          context: { currentDelay: 45, slaThreshold: 30 },
          confidence: 0.92,
          actionType: 'escalate_issue',
          actionPayload: { issueId: 'issue-1', newPriority: 'critical' },
          actionEntityType: 'issue',
          actionEntityId: 'issue-1',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.summary).toBe('Escalated issue to critical priority');
      expect(result.data?.actionType).toBe('escalate_issue');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.AGENT_DECISION_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          agentType: 'triage',
          modelProvider: 'anthropic',
          modelId: 'claude-sonnet-4-20250514',
          actionType: 'escalate_issue',
          entityType: 'shipment',
          entityId: 'ship-1',
          confidence: 0.92,
        })
      );
    });

    it('propagates metadata from command to event', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateAgentDecisionCommandHandler(mockPrisma, bus);

      const command = createTestCommand(CREATE_AGENT_DECISION, {
        agentType: 'triage',
        triggerType: 'manual',
        summary: 'Test decision',
        reasoning: 'Test reasoning',
        context: {},
        actionType: 'no_action',
      }, { orgId: 'org-custom' });

      const result = await handler.execute(command);

      expect(result.success).toBe(true);
      expect(result.events[0].orgId).toBe('org-custom');
      expect(result.events[0].metadata.correlationId).toBe(command.metadata.correlationId);
    });
  });

  describe('RecordDecisionOutcomeCommandHandler', () => {
    it('records outcome and emits AGENT_DECISION_OUTCOME_RECORDED', async () => {
      mockTx.agentDecision.update.mockResolvedValueOnce({
        ...mockDecision, outcomeStatus: 'correct', outcomeNotes: 'Good call',
        outcomeRecordedAt: new Date(), outcomeRecordedBy: 'test-user',
      });
      const { bus } = mockEventBus();
      const handler = new RecordDecisionOutcomeCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_DECISION_OUTCOME, {
          id: 'decision-1',
          outcomeStatus: 'correct',
          outcomeNotes: 'Good call',
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.AGENT_DECISION_OUTCOME_RECORDED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          outcomeStatus: 'correct',
          outcomeNotes: 'Good call',
        })
      );
    });

    it('throws when decision not found', async () => {
      mockTx.agentDecision.findUniqueOrThrow.mockRejectedValueOnce(new Error('Not found'));
      const { bus } = mockEventBus();
      const handler = new RecordDecisionOutcomeCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_DECISION_OUTCOME, {
          id: 'nonexistent',
          outcomeStatus: 'incorrect',
        })
      );

      expect(result.success).toBe(false);
    });
  });

  describe('PromoteDecisionCommandHandler', () => {
    it('promotes decision and emits AGENT_DECISION_PROMOTED', async () => {
      mockTx.agentDecision.update.mockResolvedValueOnce({
        ...mockDecision, promotedToAutomation: true, promotedAt: new Date(),
      });
      const { bus } = mockEventBus();
      const handler = new PromoteDecisionCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(PROMOTE_DECISION, { id: 'decision-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.AGENT_DECISION_PROMOTED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          agentType: 'triage',
          actionType: 'escalate_issue',
        })
      );
    });
  });
});
