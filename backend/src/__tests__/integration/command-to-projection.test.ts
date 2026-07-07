/**
 * Integration tests — verify the full CQRS pipeline:
 * Command -> emits events -> projection handles event -> read model updated
 *
 * These tests mock Prisma but wire real command handlers to real projections,
 * proving the event types match and payloads carry through correctly.
 */

import { CreateCarrierCommandHandler, CREATE_CARRIER } from '../../commands/carriers/CreateCarrierCommand';
import { ArchiveCarrierCommandHandler, ARCHIVE_CARRIER } from '../../commands/carriers/ArchiveCarrierCommand';
import { CreateIssueCommandHandler, CREATE_ISSUE } from '../../commands/issues/CreateIssueCommand';
import { EscalateIssueCommandHandler, ESCALATE_ISSUE } from '../../commands/issues/EscalateIssueCommand';
import { CarrierProjection } from '../../events/projections/CarrierProjection';
import { IssueProjection } from '../../events/projections/IssueProjection';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

describe('CQRS Pipeline Integration', () => {
  describe('Carrier: create -> project -> archive -> project', () => {
    const mockCarrier = {
      id: 'carrier-1', name: 'FastFreight', mcNumber: 'MC-123',
      dotNumber: null, contactEmail: 'ops@fast.com',
      archived: false, validationTier: 'tier1',
      createdAt: new Date(), updatedAt: new Date(),
      vehicles: [{ id: 'v1' }], drivers: [{ id: 'd1' }],
      laneCarriers: [{ id: 'lc1' }],
    };

    const mockTx = {
      carrier: {
        create: jest.fn().mockResolvedValue(mockCarrier),
        update: jest.fn().mockResolvedValue({ ...mockCarrier, archived: true }),
      },
      carrierUser: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      laneCarrier: { count: jest.fn().mockResolvedValue(0) },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;

    const mockPrisma = {
      $transaction: jest.fn((fn: Function) => fn(mockTx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      carrier: { findUnique: jest.fn().mockResolvedValue(mockCarrier) },
      carrierReadModel: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    it('command emits event that projection can process', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCarrierCommandHandler(mockPrisma, bus);
      const projection = new CarrierProjection(mockPrisma);

      // 1. Execute command
      const result = await handler.execute(
        createTestCommand(CREATE_CARRIER, { name: 'FastFreight', mcNumber: 'MC-123' })
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);

      // 2. Feed the emitted event to the projection
      await projection.handle(result.events[0]);

      // 3. Verify projection called upsert with correct data
      expect(mockPrisma.carrierReadModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'carrier-1' },
          create: expect.objectContaining({
            name: 'FastFreight',
            mcNumber: 'MC-123',
            vehicleCount: 1,
            driverCount: 1,
            activeLaneCount: 1,
          }),
        })
      );
    });

    it('archive command + projection updates read model status', async () => {
      const { bus } = mockEventBus();
      const archiveHandler = new ArchiveCarrierCommandHandler(mockPrisma, bus);
      const projection = new CarrierProjection(mockPrisma);

      // 1. Execute archive command
      const result = await archiveHandler.execute(
        createTestCommand(ARCHIVE_CARRIER, { id: 'carrier-1' })
      );

      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_ARCHIVED);

      // 2. Feed to projection
      await projection.handle(result.events[0]);

      // 3. Verify status updated to archived
      expect(mockPrisma.carrierReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'archived' }),
        })
      );
    });
  });

  describe('Issue: create -> project -> escalate -> project', () => {
    const mockIssue = {
      id: 'issue-1', orgId: 'org-1', title: 'Carrier no-show',
      status: 'open', priority: 'high', category: 'exception',
      sourceEntityType: 'shipment', sourceEntityId: 'ship-1',
      sourceEventId: null, assigneeId: null, assigneeName: null,
      escalatedTo: null, escalatedAt: null, resolvedAt: null,
      resolvedBy: null, resolution: null,
      createdAt: new Date(), updatedAt: new Date(),
    };

    const mockTx = {
      issue: {
        create: jest.fn().mockResolvedValue(mockIssue),
        update: jest.fn().mockResolvedValue({
          ...mockIssue, escalatedTo: 'ops-director', priority: 'critical', status: 'in_progress',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockIssue),
      },
      domainEventLog: { create: jest.fn().mockResolvedValue({}) },
    } as any;

    const mockPrisma = {
      $transaction: jest.fn((fn: Function) => fn(mockTx)),
      domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      issue: { findUnique: jest.fn().mockResolvedValue(mockIssue) },
      issueReadModel: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    } as any;

    it('full lifecycle: create issue -> project -> escalate -> project', async () => {
      const { bus } = mockEventBus();
      const createHandler = new CreateIssueCommandHandler(mockPrisma, bus);
      const escalateHandler = new EscalateIssueCommandHandler(mockPrisma, bus);
      const projection = new IssueProjection(mockPrisma);

      // 1. Create issue
      const createResult = await createHandler.execute(
        createTestCommand(CREATE_ISSUE, {
          title: 'Carrier no-show',
          category: 'exception',
          priority: 'high',
          sourceEntityType: 'shipment',
          sourceEntityId: 'ship-1',
        })
      );

      expect(createResult.events[0].type).toBe(EVENT_TYPES.ISSUE_CREATED);

      // 2. Project the create event
      await projection.handle(createResult.events[0]);
      expect(mockPrisma.issueReadModel.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            title: 'Carrier no-show',
            priority: 'high',
            category: 'exception',
          }),
        })
      );

      // 3. Escalate the issue
      const escalateResult = await escalateHandler.execute(
        createTestCommand(ESCALATE_ISSUE, {
          id: 'issue-1',
          escalatedTo: 'ops-director',
          reason: 'Customer is VIP',
        })
      );

      expect(escalateResult.events[0].type).toBe(EVENT_TYPES.ISSUE_ESCALATED);
      expect(escalateResult.events[0].payload).toEqual(
        expect.objectContaining({
          escalatedTo: 'ops-director',
          reason: 'Customer is VIP',
        })
      );

      // 4. Project the escalation
      await projection.handle(escalateResult.events[0]);
      expect(mockPrisma.issueReadModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            escalatedTo: 'ops-director',
            status: 'in_progress',
          }),
        })
      );
    });
  });

  describe('Event metadata propagation', () => {
    it('correlationId flows from command through event to projection', async () => {
      const mockTx = {
        carrier: { create: jest.fn().mockResolvedValue({ id: 'c1', name: 'Test', mcNumber: null }) },
        domainEventLog: { create: jest.fn().mockResolvedValue({}) },
      } as any;
      const mockPrisma = {
        $transaction: jest.fn((fn: Function) => fn(mockTx)),
        domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;

      const { bus } = mockEventBus();
      const handler = new CreateCarrierCommandHandler(mockPrisma, bus);

      const command = createTestCommand(CREATE_CARRIER, { name: 'Test' }, {
        metadata: { correlationId: 'trace-abc-123', source: 'api' },
      });

      const result = await handler.execute(command);

      // Event carries the command's correlation ID
      expect(result.events[0].metadata.correlationId).toBe('trace-abc-123');
      expect(result.events[0].metadata.source).toBe('api');
    });
  });
});
