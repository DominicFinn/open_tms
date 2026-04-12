import { SlaEvaluationService } from '../../services/SlaEvaluationService';

const mockSlaRepo = {
  findPolicyForEntity: jest.fn(),
  findEvaluationsByEntity: jest.fn(),
  findActiveEvaluationsDueBefore: jest.fn(),
  findActiveEvaluationsWarningBefore: jest.fn(),
  createEvaluation: jest.fn(),
  updateEvaluationStatus: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
};

const mockPrisma = {
  shipment: {
    findUnique: jest.fn(),
  },
  issue: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  slaRule: {
    findUnique: jest.fn(),
  },
  slaEvaluation: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
} as any;

describe('SlaEvaluationService', () => {
  let service: SlaEvaluationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SlaEvaluationService(mockPrisma, mockSlaRepo as any, mockEventBus as any);
  });

  describe('createEvaluationsForShipment', () => {
    it('returns 0 when no policy found', async () => {
      mockSlaRepo.findPolicyForEntity.mockResolvedValue(null);

      const count = await service.createEvaluationsForShipment('ship-1', 'org-1', 'cust-1');

      expect(count).toBe(0);
      expect(mockSlaRepo.createEvaluation).not.toHaveBeenCalled();
    });

    it('creates evaluations for shipment-applicable rules', async () => {
      mockSlaRepo.findPolicyForEntity.mockResolvedValue({
        id: 'policy-1',
        rules: [
          { id: 'rule-1', ruleType: 'eta_delivery', name: 'Delivery SLA', maxDeliveryMinutes: 1440, warningThresholdMinutes: 60, active: true },
          { id: 'rule-2', ruleType: 'issue_response', name: 'Response SLA', breachThresholdMinutes: 15, active: true },
        ],
      });
      mockPrisma.shipment.findUnique.mockResolvedValue({
        id: 'ship-1', reference: 'SH-001', pickupDate: new Date('2026-04-12T10:00:00Z'), customerId: 'cust-1',
      });
      mockSlaRepo.createEvaluation.mockImplementation(async (data: any) => data);

      const count = await service.createEvaluationsForShipment('ship-1', 'org-1', 'cust-1');

      // Only eta_delivery applies to shipments, not issue_response
      expect(count).toBe(1);
      expect(mockSlaRepo.createEvaluation).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'shipment',
          entityId: 'ship-1',
          ruleType: 'eta_delivery',
          entityReference: 'SH-001',
        })
      );
    });

    it('calculates slaDueAt from pickupDate + maxDeliveryMinutes', async () => {
      const pickupDate = new Date('2026-04-12T10:00:00Z');
      mockSlaRepo.findPolicyForEntity.mockResolvedValue({
        id: 'policy-1',
        rules: [
          { id: 'rule-1', ruleType: 'eta_delivery', name: 'Delivery SLA', maxDeliveryMinutes: 1440, warningThresholdMinutes: 60, active: true },
        ],
      });
      mockPrisma.shipment.findUnique.mockResolvedValue({
        id: 'ship-1', reference: 'SH-001', pickupDate, customerId: 'cust-1',
      });
      mockSlaRepo.createEvaluation.mockImplementation(async (data: any) => data);

      await service.createEvaluationsForShipment('ship-1', 'org-1', 'cust-1');

      const call = mockSlaRepo.createEvaluation.mock.calls[0][0];
      expect(call.slaDueAt.getTime()).toBe(pickupDate.getTime() + 1440 * 60_000);
    });

    it('skips duplicate evaluations (P2002 unique constraint)', async () => {
      mockSlaRepo.findPolicyForEntity.mockResolvedValue({
        id: 'policy-1',
        rules: [{ id: 'rule-1', ruleType: 'eta_delivery', name: 'Test', maxDeliveryMinutes: 1440, active: true }],
      });
      mockPrisma.shipment.findUnique.mockResolvedValue({
        id: 'ship-1', reference: 'SH-001', pickupDate: new Date(), customerId: 'cust-1',
      });
      mockSlaRepo.createEvaluation.mockRejectedValue({ code: 'P2002' });

      const count = await service.createEvaluationsForShipment('ship-1', 'org-1');

      expect(count).toBe(0); // Skipped, not errored
    });
  });

  describe('createEvaluationsForIssue', () => {
    it('creates evaluations for matching issue rules', async () => {
      mockSlaRepo.findPolicyForEntity.mockResolvedValue({
        id: 'policy-1',
        rules: [
          { id: 'rule-1', ruleType: 'issue_response', name: 'Response', breachThresholdMinutes: 15, issuePriority: 'critical', active: true },
          { id: 'rule-2', ruleType: 'issue_resolution', name: 'Resolution', breachThresholdMinutes: 120, issuePriority: null, active: true },
        ],
      });
      mockPrisma.issue.findUnique.mockResolvedValue({
        id: 'issue-1', title: 'Temperature breach', createdAt: new Date(),
      });
      mockSlaRepo.createEvaluation.mockImplementation(async (data: any) => data);

      const count = await service.createEvaluationsForIssue('issue-1', 'org-1', 'critical', 'compliance');

      // rule-1 matches (priority filter = critical), rule-2 matches (no filter)
      expect(count).toBe(2);
    });

    it('skips rules that dont match priority filter', async () => {
      mockSlaRepo.findPolicyForEntity.mockResolvedValue({
        id: 'policy-1',
        rules: [
          { id: 'rule-1', ruleType: 'issue_response', name: 'Critical Only', breachThresholdMinutes: 15, issuePriority: 'critical', active: true },
        ],
      });
      mockPrisma.issue.findUnique.mockResolvedValue({
        id: 'issue-1', title: 'Minor issue', createdAt: new Date(),
      });

      const count = await service.createEvaluationsForIssue('issue-1', 'org-1', 'low', 'other');

      expect(count).toBe(0);
    });
  });

  describe('markEvaluationsMet', () => {
    it('marks active evaluations as met', async () => {
      mockSlaRepo.findEvaluationsByEntity.mockResolvedValue([
        { id: 'eval-1', status: 'active', ruleType: 'eta_delivery', orgId: 'org-1', ruleName: 'Delivery', entityType: 'shipment', entityId: 'ship-1', entityReference: 'SH-001' },
      ]);
      mockSlaRepo.updateEvaluationStatus.mockResolvedValue({ id: 'eval-1', status: 'met' });

      const count = await service.markEvaluationsMet('shipment', 'ship-1', ['eta_delivery']);

      expect(count).toBe(1);
      expect(mockSlaRepo.updateEvaluationStatus).toHaveBeenCalledWith(
        'eval-1', 'active', expect.objectContaining({ status: 'met' })
      );
    });

    it('skips already met/breached evaluations', async () => {
      mockSlaRepo.findEvaluationsByEntity.mockResolvedValue([
        { id: 'eval-1', status: 'met', ruleType: 'eta_delivery' },
        { id: 'eval-2', status: 'breached', ruleType: 'eta_delivery' },
      ]);

      const count = await service.markEvaluationsMet('shipment', 'ship-1');

      expect(count).toBe(0);
      expect(mockSlaRepo.updateEvaluationStatus).not.toHaveBeenCalled();
    });

    it('filters by ruleType when specified', async () => {
      mockSlaRepo.findEvaluationsByEntity.mockResolvedValue([
        { id: 'eval-1', status: 'active', ruleType: 'eta_delivery', orgId: 'org-1', ruleName: 'Delivery', entityType: 'shipment', entityId: 'ship-1' },
        { id: 'eval-2', status: 'active', ruleType: 'dwell_time', orgId: 'org-1', ruleName: 'Dwell', entityType: 'shipment', entityId: 'ship-1' },
      ]);
      mockSlaRepo.updateEvaluationStatus.mockResolvedValue({ status: 'met' });

      const count = await service.markEvaluationsMet('shipment', 'ship-1', ['eta_delivery']);

      expect(count).toBe(1);
    });
  });

  describe('runBreachSweep', () => {
    it('transitions active evaluations past warning threshold', async () => {
      const pastWarning = { id: 'eval-1', status: 'active', warningAt: new Date(Date.now() - 60_000), slaDueAt: new Date(Date.now() + 600_000), orgId: 'org-1', ruleType: 'eta_delivery', ruleName: 'Delivery', entityType: 'shipment', entityId: 'ship-1' };
      mockSlaRepo.findActiveEvaluationsWarningBefore.mockResolvedValue([pastWarning]);
      mockSlaRepo.findActiveEvaluationsDueBefore.mockResolvedValue([]);
      mockSlaRepo.updateEvaluationStatus.mockResolvedValue({ ...pastWarning, status: 'warning', remainingMinutes: 10 });

      const result = await service.runBreachSweep();

      expect(result.warningsIssued).toBe(1);
      expect(mockSlaRepo.updateEvaluationStatus).toHaveBeenCalledWith(
        'eval-1', 'active', expect.objectContaining({ status: 'warning' })
      );
    });

    it('transitions past-due evaluations to breached', async () => {
      const pastDue = { id: 'eval-2', status: 'warning', slaDueAt: new Date(Date.now() - 300_000), slaStartedAt: new Date(), orgId: 'org-1', ruleId: 'rule-1', ruleType: 'issue_response', ruleName: 'Response', entityType: 'issue', entityId: 'issue-1', entityReference: 'Temperature breach', customerId: null, issueId: null };
      mockSlaRepo.findActiveEvaluationsWarningBefore.mockResolvedValue([]);
      mockSlaRepo.findActiveEvaluationsDueBefore.mockResolvedValue([pastDue]);
      mockSlaRepo.updateEvaluationStatus.mockResolvedValue({ ...pastDue, status: 'breached' });
      mockPrisma.slaRule.findUnique.mockResolvedValue({ id: 'rule-1', autoCreateIssue: true, issuePriorityOnBreach: 'critical' });
      mockPrisma.issue.findFirst.mockResolvedValue(null);
      mockPrisma.issue.create.mockResolvedValue({ id: 'auto-issue-1' });

      const result = await service.runBreachSweep();

      expect(result.breachesDetected).toBe(1);
      expect(result.issuesCreated).toBe(1);
    });

    it('does not create duplicate issues on breach', async () => {
      const pastDue = { id: 'eval-3', status: 'active', slaDueAt: new Date(Date.now() - 60_000), slaStartedAt: new Date(), orgId: 'org-1', ruleId: 'rule-1', ruleType: 'eta_delivery', ruleName: 'Delivery', entityType: 'shipment', entityId: 'ship-1', entityReference: 'SH-001', customerId: null, issueId: 'existing-issue' };
      mockSlaRepo.findActiveEvaluationsWarningBefore.mockResolvedValue([]);
      mockSlaRepo.findActiveEvaluationsDueBefore.mockResolvedValue([pastDue]);
      mockSlaRepo.updateEvaluationStatus.mockResolvedValue({ ...pastDue, status: 'breached' });
      mockPrisma.slaRule.findUnique.mockResolvedValue({ id: 'rule-1', autoCreateIssue: true, issuePriorityOnBreach: 'high' });

      const result = await service.runBreachSweep();

      expect(result.issuesCreated).toBe(0); // Already has issueId
    });

    it('returns complete sweep result with timing', async () => {
      mockSlaRepo.findActiveEvaluationsWarningBefore.mockResolvedValue([]);
      mockSlaRepo.findActiveEvaluationsDueBefore.mockResolvedValue([]);

      const result = await service.runBreachSweep();

      expect(result.runId).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.evaluationsChecked).toBe(0);
      expect(result.warningsIssued).toBe(0);
      expect(result.breachesDetected).toBe(0);
      expect(result.issuesCreated).toBe(0);
    });
  });
});
