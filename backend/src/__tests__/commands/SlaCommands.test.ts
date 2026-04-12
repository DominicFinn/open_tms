import { CreateSlaPolicyCommandHandler, CREATE_SLA_POLICY } from '../../commands/sla/CreateSlaPolicyCommand';
import { UpdateSlaPolicyCommandHandler, UPDATE_SLA_POLICY } from '../../commands/sla/UpdateSlaPolicyCommand';
import { DeactivateSlaPolicyCommandHandler, DEACTIVATE_SLA_POLICY } from '../../commands/sla/DeactivateSlaPolicyCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockPolicy = {
  id: 'policy-1', orgId: 'org-1', name: 'Standard SLA',
  description: 'Default SLA policy', customerId: null, active: true,
  createdAt: new Date(), updatedAt: new Date(),
  rules: [
    { id: 'rule-1', policyId: 'policy-1', ruleType: 'eta_delivery', name: 'Delivery SLA',
      breachThresholdMinutes: 1440, warningThresholdMinutes: 60, active: true },
    { id: 'rule-2', policyId: 'policy-1', ruleType: 'issue_response', name: 'Critical Response',
      breachThresholdMinutes: 15, issuePriority: 'critical', active: true },
  ],
};

const mockTx = {
  slaPolicy: {
    create: jest.fn().mockResolvedValue(mockPolicy),
    update: jest.fn().mockResolvedValue(mockPolicy),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockPolicy),
  },
  slaRule: {
    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    create: jest.fn().mockResolvedValue({}),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

describe('SLA Policy Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateSlaPolicyCommandHandler', () => {
    it('creates policy with rules and emits SLA_POLICY_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateSlaPolicyCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_SLA_POLICY, {
          name: 'Standard SLA',
          description: 'Default SLA policy',
          rules: [
            { ruleType: 'eta_delivery', name: 'Delivery SLA', breachThresholdMinutes: 1440, warningThresholdMinutes: 60 },
            { ruleType: 'issue_response', name: 'Critical Response', breachThresholdMinutes: 15, issuePriority: 'critical' },
          ],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Standard SLA');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SLA_POLICY_CREATED);
    });

    it('includes rule count in event payload', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateSlaPolicyCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_SLA_POLICY, {
          name: 'Standard SLA',
          rules: [{ ruleType: 'eta_delivery', name: 'Delivery SLA', maxDeliveryMinutes: 1440 }],
        })
      );

      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ ruleCount: 2 }) // mock returns 2 rules
      );
    });

    it('propagates metadata from command to event', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateSlaPolicyCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_SLA_POLICY, {
          name: 'Test',
          rules: [],
        }, { orgId: 'custom-org', actorId: 'admin-user' })
      );

      expect(result.events[0].orgId).toBe('custom-org');
      expect(result.events[0].actorId).toBe('admin-user');
    });
  });

  describe('UpdateSlaPolicyCommandHandler', () => {
    it('updates policy and emits SLA_POLICY_UPDATED', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateSlaPolicyCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_SLA_POLICY, {
          id: 'policy-1',
          name: 'Updated SLA',
          rules: [
            { ruleType: 'eta_delivery', name: 'Faster Delivery', maxDeliveryMinutes: 720 },
          ],
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SLA_POLICY_UPDATED);
    });

    it('replaces rules when rules array is provided', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateSlaPolicyCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_SLA_POLICY, {
          id: 'policy-1',
          rules: [{ ruleType: 'dwell_time', name: 'Dwell', maxDwellMinutes: 120 }],
        })
      );

      expect(mockTx.slaRule.deleteMany).toHaveBeenCalledWith({ where: { policyId: 'policy-1' } });
      expect(mockTx.slaRule.create).toHaveBeenCalled();
    });

    it('does not delete rules when rules not provided', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateSlaPolicyCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(UPDATE_SLA_POLICY, {
          id: 'policy-1',
          name: 'Just rename',
        })
      );

      expect(mockTx.slaRule.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('DeactivateSlaPolicyCommandHandler', () => {
    it('deactivates policy and emits SLA_POLICY_DEACTIVATED', async () => {
      const { bus } = mockEventBus();
      const handler = new DeactivateSlaPolicyCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(DEACTIVATE_SLA_POLICY, { id: 'policy-1' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SLA_POLICY_DEACTIVATED);
      expect(mockTx.slaPolicy.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } })
      );
    });

    it('includes policy name in deactivation event', async () => {
      const { bus } = mockEventBus();
      const handler = new DeactivateSlaPolicyCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(DEACTIVATE_SLA_POLICY, { id: 'policy-1' })
      );

      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ name: 'Standard SLA' })
      );
    });
  });
});
