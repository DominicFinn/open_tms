import { CreateCAPAFollowUpCommandHandler, CREATE_CAPA_FOLLOW_UP } from '../../commands/capaFollowUps/CreateCAPAFollowUpCommand';
import { CompleteCAPAFollowUpCommandHandler, COMPLETE_CAPA_FOLLOW_UP } from '../../commands/capaFollowUps/CompleteCAPAFollowUpCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

const mockCapa = {
  id: 'capa-1', orgId: 'org-1', reportNumber: 'CAPA-20260412-001', title: 'Temp excursion',
  status: 'investigation', issueId: 'issue-1', createdAt: new Date(),
};

const mockFollowUp = {
  id: 'fu-1', orgId: 'org-1', capaReportId: 'capa-1', followUpType: '30_day',
  dueDate: new Date('2026-05-12'), status: 'pending', notes: null, outcome: null,
  actionItems: null, assigneeId: null, assigneeName: null,
  completedAt: null, completedById: null, completedByName: null,
  createdBy: 'test-user', createdAt: new Date(), updatedAt: new Date(),
};

describe('CAPA Follow-Up Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('CreateCAPAFollowUpCommandHandler', () => {
    const mockTx = {
      cAPAReport: { findFirst: jest.fn().mockResolvedValue(mockCapa) },
      cAPAFollowUp: { create: jest.fn().mockResolvedValue(mockFollowUp) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const mockPrisma = {
      $transaction: jest.fn((fn: Function) => fn(mockTx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    it('creates follow-up and emits CAPA_FOLLOW_UP_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCAPAFollowUpCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CAPA_FOLLOW_UP, {
          capaReportId: 'capa-1',
          followUpType: '30_day',
          dueDate: '2026-05-12T00:00:00Z',
        })
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('fu-1');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CAPA_FOLLOW_UP_CREATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          capaReportId: 'capa-1',
          followUpType: '30_day',
          reportNumber: 'CAPA-20260412-001',
        })
      );
    });

    it('propagates metadata from command', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCAPAFollowUpCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CAPA_FOLLOW_UP, {
          capaReportId: 'capa-1',
          followUpType: '60_day',
          dueDate: '2026-06-12T00:00:00Z',
        }, { orgId: 'org-1', actorId: 'user-42' })
      );

      expect(result.success).toBe(true);
      expect(result.events[0].orgId).toBe('org-1');
      expect(result.events[0].actorId).toBe('user-42');
    });

    it('fails when CAPA report not found', async () => {
      mockTx.cAPAReport.findFirst.mockResolvedValueOnce(null);
      const { bus } = mockEventBus();
      const handler = new CreateCAPAFollowUpCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CAPA_FOLLOW_UP, {
          capaReportId: 'nonexistent',
          followUpType: '30_day',
          dueDate: '2026-05-12T00:00:00Z',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('CompleteCAPAFollowUpCommandHandler', () => {
    const mockTx = {
      cAPAFollowUp: {
        findFirst: jest.fn().mockResolvedValue({
          ...mockFollowUp,
          capaReport: { reportNumber: 'CAPA-20260412-001' },
        }),
        update: jest.fn().mockResolvedValue({ ...mockFollowUp, status: 'completed' }),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;
    const mockPrisma = {
      $transaction: jest.fn((fn: Function) => fn(mockTx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    it('completes follow-up and emits CAPA_FOLLOW_UP_COMPLETED', async () => {
      const { bus } = mockEventBus();
      const handler = new CompleteCAPAFollowUpCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(COMPLETE_CAPA_FOLLOW_UP, {
          followUpId: 'fu-1',
          outcome: 'on_track',
          notes: 'Corrective action is effective',
        })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CAPA_FOLLOW_UP_COMPLETED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({ outcome: 'on_track' })
      );
    });

    it('fails when follow-up not found', async () => {
      mockTx.cAPAFollowUp.findFirst.mockResolvedValueOnce(null);
      const { bus } = mockEventBus();
      const handler = new CompleteCAPAFollowUpCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(COMPLETE_CAPA_FOLLOW_UP, {
          followUpId: 'nonexistent',
          outcome: 'on_track',
        })
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
