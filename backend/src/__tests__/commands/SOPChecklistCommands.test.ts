import { CreateSOPChecklistCommandHandler, CREATE_SOP_CHECKLIST } from '../../commands/sopChecklists/CreateSOPChecklistCommand';
import { StartSOPAuditCommandHandler, START_SOP_AUDIT } from '../../commands/sopChecklists/StartSOPAuditCommand';
import { CompleteSOPAuditCommandHandler, COMPLETE_SOP_AUDIT } from '../../commands/sopChecklists/CompleteSOPAuditCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockChecklist = {
  id: 'checklist-1', orgId: 'org-1', title: 'GDP Annual Review',
  category: 'gdp', frequency: 'annual', status: 'active', version: 1,
  items: [
    { id: 'item-1', question: 'Temp records maintained?', isCritical: true, sortOrder: 0 },
    { id: 'item-2', question: 'Training documented?', isCritical: false, sortOrder: 1 },
    { id: 'item-3', question: 'SOPs accessible?', isCritical: false, sortOrder: 2 },
  ],
};

const mockAudit = {
  id: 'audit-1', orgId: 'org-1', checklistId: 'checklist-1',
  auditNumber: 'AUDIT-20260412-001', status: 'in_progress',
  checklist: mockChecklist,
};

describe('SOP Checklist Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateSOPChecklistCommandHandler', () => {
    const mockTx = {
      sOPChecklist: {
        create: jest.fn().mockResolvedValue({ id: 'checklist-1' }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const mockPrisma = {
      $transaction: jest.fn((fn: Function) => fn(mockTx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    it('creates checklist with items and emits SOP_CHECKLIST_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateSOPChecklistCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_SOP_CHECKLIST, {
          title: 'GDP Annual Review',
          category: 'gdp',
          frequency: 'annual',
          items: [
            { sortOrder: 0, question: 'Temp records maintained?', isCritical: true },
            { sortOrder: 1, question: 'Training documented?', isCritical: false },
          ],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('checklist-1');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SOP_CHECKLIST_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          title: 'GDP Annual Review',
          category: 'gdp',
          itemCount: 2,
        })
      );
    });

    it('propagates command metadata', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateSOPChecklistCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_SOP_CHECKLIST, {
          title: 'Test', category: 'general', items: [{ sortOrder: 0, question: 'Q?' }],
        }, { orgId: 'org-1', actorId: 'user-7' })
      );

      expect(result.events[0].orgId).toBe('org-1');
      expect(result.events[0].actorId).toBe('user-7');
    });
  });

  describe('StartSOPAuditCommandHandler', () => {
    const mockTx = {
      sOPChecklist: { findFirst: jest.fn().mockResolvedValue(mockChecklist) },
      sOPAudit: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(mockAudit),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const mockPrisma = {
      $transaction: jest.fn((fn: Function) => fn(mockTx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    it('starts audit and emits SOP_AUDIT_STARTED', async () => {
      const { bus } = mockEventBus();
      const handler = new StartSOPAuditCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(START_SOP_AUDIT, {
          checklistId: 'checklist-1',
          auditorName: 'John Quality',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.auditNumber).toMatch(/^AUDIT-\d{8}-001$/);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.SOP_AUDIT_STARTED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          checklistTitle: 'GDP Annual Review',
        })
      );
    });

    it('fails when checklist not found', async () => {
      mockTx.sOPChecklist.findFirst.mockResolvedValueOnce(null);
      const { bus } = mockEventBus();
      const handler = new StartSOPAuditCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(START_SOP_AUDIT, { checklistId: 'nonexistent' })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('CompleteSOPAuditCommandHandler', () => {
    it('completes audit with passing score', async () => {
      const mockTx = {
        sOPAudit: {
          findFirst: jest.fn().mockResolvedValue(mockAudit),
          update: jest.fn().mockResolvedValue({ ...mockAudit, status: 'completed' }),
        },
        sOPAuditResponse: { create: jest.fn().mockResolvedValue({}) },
        sOPChecklist: { update: jest.fn().mockResolvedValue({}) },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const mockPrisma = {
        $transaction: jest.fn((fn: Function) => fn(mockTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new CompleteSOPAuditCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(COMPLETE_SOP_AUDIT, {
          auditId: 'audit-1',
          responses: [
            { checklistItemId: 'item-1', result: 'pass' },
            { checklistItemId: 'item-2', result: 'pass' },
            { checklistItemId: 'item-3', result: 'na' },
          ],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.passed).toBe(true);
      expect(result.data?.score).toBe(100);
      expect(result.events[0].type).toBe(EVENT_TYPES.SOP_AUDIT_COMPLETED);
    });

    it('fails audit when critical item fails', async () => {
      const mockTx = {
        sOPAudit: {
          findFirst: jest.fn().mockResolvedValue(mockAudit),
          update: jest.fn().mockResolvedValue({ ...mockAudit, status: 'failed' }),
        },
        sOPAuditResponse: { create: jest.fn().mockResolvedValue({}) },
        sOPChecklist: { update: jest.fn().mockResolvedValue({}) },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const mockPrisma = {
        $transaction: jest.fn((fn: Function) => fn(mockTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new CompleteSOPAuditCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(COMPLETE_SOP_AUDIT, {
          auditId: 'audit-1',
          responses: [
            { checklistItemId: 'item-1', result: 'fail' },  // critical item
            { checklistItemId: 'item-2', result: 'pass' },
            { checklistItemId: 'item-3', result: 'pass' },
          ],
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.passed).toBe(false);
      expect(result.events[0].type).toBe(EVENT_TYPES.SOP_AUDIT_FAILED);
    });

    it('fails when audit not found', async () => {
      const mockTx = {
        sOPAudit: { findFirst: jest.fn().mockResolvedValue(null) },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const mockPrisma = {
        $transaction: jest.fn((fn: Function) => fn(mockTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new CompleteSOPAuditCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(COMPLETE_SOP_AUDIT, {
          auditId: 'nonexistent',
          responses: [],
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
