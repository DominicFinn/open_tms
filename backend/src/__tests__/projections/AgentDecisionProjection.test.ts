import { AgentDecisionProjection } from '../../events/projections/AgentDecisionProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestEvent } from '../helpers/testUtils';

const mockDecision = {
  id: 'decision-1', orgId: 'org-1', agentType: 'triage',
  modelProvider: 'anthropic', modelId: 'claude-sonnet-4-20250514',
  triggerType: 'domain_event', triggerEventType: 'shipment.exception',
  entityType: 'shipment', entityId: 'ship-1',
  summary: 'Escalated issue to critical priority',
  confidence: 0.92,
  actionType: 'escalate_issue',
  actionEntityType: 'issue', actionEntityId: 'issue-1',
  outcomeStatus: 'pending',
  promotedToAutomation: false,
  createdAt: new Date(), updatedAt: new Date(),
};

const upsertMock = jest.fn().mockResolvedValue({});
const updateMock = jest.fn().mockResolvedValue({});
const findUniqueMock = jest.fn().mockResolvedValue(mockDecision);

const mockPrisma = {
  agentDecision: {
    findUnique: findUniqueMock,
  },
  agentDecisionReadModel: {
    upsert: upsertMock,
    update: updateMock,
  },
} as any;

describe('AgentDecisionProjection', () => {
  let projection: AgentDecisionProjection;

  beforeEach(() => {
    jest.clearAllMocks();
    projection = new AgentDecisionProjection(mockPrisma);
  });

  it('has correct name and event patterns', () => {
    expect(projection.name).toBe('projection.agent_decision');
    expect(projection.eventPatterns).toEqual(['agent_decision.*']);
  });

  describe('on AGENT_DECISION_CREATED', () => {
    it('upserts read model with correct fields', async () => {
      await projection.handle(
        createTestEvent(
          EVENT_TYPES.AGENT_DECISION_CREATED,
          'agent_decision',
          'decision-1',
          {
            agentType: 'triage',
            actionType: 'escalate_issue',
            entityType: 'shipment',
            entityId: 'ship-1',
          }
        )
      );

      expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'decision-1' } });
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'decision-1' },
          create: expect.objectContaining({
            id: 'decision-1',
            orgId: 'org-1',
            agentType: 'triage',
            modelProvider: 'anthropic',
            modelId: 'claude-sonnet-4-20250514',
            triggerType: 'domain_event',
            triggerEventType: 'shipment.exception',
            entityType: 'shipment',
            entityId: 'ship-1',
            summary: 'Escalated issue to critical priority',
            confidence: 0.92,
            actionType: 'escalate_issue',
            actionEntityType: 'issue',
            actionEntityId: 'issue-1',
            outcomeStatus: 'pending',
            promotedToAutomation: false,
          }),
        })
      );
    });

    it('logs error when decision not found', async () => {
      findUniqueMock.mockResolvedValueOnce(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await projection.handle(
        createTestEvent(
          EVENT_TYPES.AGENT_DECISION_CREATED,
          'agent_decision',
          'missing-1',
          {}
        )
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing-1')
      );
      expect(upsertMock).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('on AGENT_DECISION_OUTCOME_RECORDED', () => {
    it('updates outcomeStatus in read model', async () => {
      findUniqueMock.mockResolvedValueOnce({
        ...mockDecision,
        outcomeStatus: 'correct',
        outcomeRecordedAt: new Date(),
      });

      await projection.handle(
        createTestEvent(
          EVENT_TYPES.AGENT_DECISION_OUTCOME_RECORDED,
          'agent_decision',
          'decision-1',
          { outcomeStatus: 'correct' }
        )
      );

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'decision-1' },
          data: expect.objectContaining({
            outcomeStatus: 'correct',
          }),
        })
      );
    });
  });

  describe('on AGENT_DECISION_PROMOTED', () => {
    it('updates promotedToAutomation flag in read model', async () => {
      await projection.handle(
        createTestEvent(
          EVENT_TYPES.AGENT_DECISION_PROMOTED,
          'agent_decision',
          'decision-1',
          { agentType: 'triage', actionType: 'escalate_issue' }
        )
      );

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'decision-1' },
          data: expect.objectContaining({
            promotedToAutomation: true,
          }),
        })
      );
    });
  });
});
