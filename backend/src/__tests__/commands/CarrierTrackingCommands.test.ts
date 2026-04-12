import {
  CreateCarrierTrackingIntegrationCommandHandler,
  CREATE_CARRIER_TRACKING_INTEGRATION,
} from '../../commands/carrierTracking/CreateCarrierTrackingIntegrationCommand';
import {
  UpdateCarrierTrackingIntegrationCommandHandler,
  UPDATE_CARRIER_TRACKING_INTEGRATION,
} from '../../commands/carrierTracking/UpdateCarrierTrackingIntegrationCommand';
import {
  DeleteCarrierTrackingIntegrationCommandHandler,
  DELETE_CARRIER_TRACKING_INTEGRATION,
} from '../../commands/carrierTracking/DeleteCarrierTrackingIntegrationCommand';
import {
  RecordCarrierTrackingEventCommandHandler,
  RECORD_CARRIER_TRACKING_EVENT,
} from '../../commands/carrierTracking/RecordCarrierTrackingEventCommand';
import { EVENT_TYPES } from '../../events/eventTypes';
import { createTestCommand, mockEventBus } from '../helpers/testUtils';

/* ---------- shared mock data ---------- */

const mockIntegration = {
  id: 'int-1',
  carrierId: 'carrier-1',
  providerType: 'FedEx',
  status: 'pending_setup',
  credentials: null,
  webhookEnabled: false,
  webhookSecret: null,
  webhookEndpointId: null,
  pollingEnabled: true,
  pollingIntervalSeconds: 900,
  rateLimitDailyMax: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTrackingEvent = {
  id: 'evt-1',
  shipmentId: 'ship-1',
  carrierId: 'carrier-1',
  integrationId: 'int-1',
  providerType: 'FedEx',
  trackingNumber: '794644790132',
  status: 'in_transit',
  statusDetail: 'In transit',
  statusCode: 'IT',
  city: 'Memphis',
  state: 'TN',
  country: 'US',
  postalCode: '38118',
  lat: null,
  lng: null,
  occurredAt: new Date('2026-04-12T10:00:00Z'),
  estimatedDelivery: new Date('2026-04-13T17:00:00Z'),
  signedBy: null,
  rawPayload: null,
  source: 'poll',
  createdAt: new Date(),
};

const mockTx = {
  carrierTrackingIntegration: {
    create: jest.fn().mockResolvedValue(mockIntegration),
    findUniqueOrThrow: jest.fn().mockResolvedValue(mockIntegration),
    update: jest.fn().mockResolvedValue({ ...mockIntegration, providerType: 'UPS', pollingEnabled: false }),
    delete: jest.fn().mockResolvedValue(mockIntegration),
  },
  carrierTrackingEvent: {
    create: jest.fn().mockResolvedValue(mockTrackingEvent),
    deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
  },
  domainEventLog: { create: jest.fn().mockResolvedValue({}) },
} as any;

const mockPrisma = {
  $transaction: jest.fn((fn: Function) => fn(mockTx)),
  domainEventLog: { findFirst: jest.fn().mockResolvedValue(null) },
} as any;

/* ---------- tests ---------- */

describe('Carrier Tracking Command Handlers', () => {
  beforeEach(() => jest.clearAllMocks());

  /* ---- CreateCarrierTrackingIntegrationCommand ---- */
  describe('CreateCarrierTrackingIntegrationCommandHandler', () => {
    it('creates integration and emits CARRIER_TRACKING_INTEGRATION_CREATED', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CARRIER_TRACKING_INTEGRATION, {
          carrierId: 'carrier-1',
          providerType: 'FedEx',
          pollingEnabled: true,
        }),
      );

      expect(result.success).toBe(true);
      expect(result.data?.carrierId).toBe('carrier-1');
      expect(result.data?.providerType).toBe('FedEx');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_CREATED);
    });

    it('includes carrierId and providerType in event payload', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CARRIER_TRACKING_INTEGRATION, {
          carrierId: 'carrier-1',
          providerType: 'FedEx',
        }),
      );

      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          carrierId: 'carrier-1',
          providerType: 'FedEx',
        }),
      );
    });

    it('propagates metadata from command to event', async () => {
      const { bus } = mockEventBus();
      const handler = new CreateCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(
          CREATE_CARRIER_TRACKING_INTEGRATION,
          { carrierId: 'carrier-1', providerType: 'FedEx' },
          { orgId: 'custom-org', actorId: 'admin-user' },
        ),
      );

      expect(result.events[0].orgId).toBe('custom-org');
      expect(result.events[0].actorId).toBe('admin-user');
    });

    it('returns error when create fails (e.g. duplicate carrierId)', async () => {
      const { bus } = mockEventBus();
      mockTx.carrierTrackingIntegration.create.mockRejectedValueOnce(
        new Error('Unique constraint failed on the fields: (`carrierId`)'),
      );
      const handler = new CreateCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(CREATE_CARRIER_TRACKING_INTEGRATION, {
          carrierId: 'carrier-1',
          providerType: 'FedEx',
        }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unique constraint');
      expect(result.events).toHaveLength(0);
    });
  });

  /* ---- UpdateCarrierTrackingIntegrationCommand ---- */
  describe('UpdateCarrierTrackingIntegrationCommandHandler', () => {
    it('updates fields and emits CARRIER_TRACKING_INTEGRATION_UPDATED with changes', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(UPDATE_CARRIER_TRACKING_INTEGRATION, {
          id: 'int-1',
          providerType: 'UPS',
          pollingEnabled: false,
        }),
      );

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_UPDATED);
      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          changes: expect.objectContaining({
            providerType: { before: 'FedEx', after: 'UPS' },
            pollingEnabled: { before: true, after: false },
          }),
        }),
      );
    });

    it('propagates metadata from command to event', async () => {
      const { bus } = mockEventBus();
      const handler = new UpdateCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(
          UPDATE_CARRIER_TRACKING_INTEGRATION,
          { id: 'int-1', notes: 'Updated note' },
          { orgId: 'org-abc', actorId: 'user-xyz' },
        ),
      );

      expect(result.events[0].orgId).toBe('org-abc');
      expect(result.events[0].actorId).toBe('user-xyz');
    });
  });

  /* ---- DeleteCarrierTrackingIntegrationCommand ---- */
  describe('DeleteCarrierTrackingIntegrationCommandHandler', () => {
    it('deletes integration and emits CARRIER_TRACKING_INTEGRATION_DELETED', async () => {
      const { bus } = mockEventBus();
      const handler = new DeleteCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_CARRIER_TRACKING_INTEGRATION, { id: 'int-1' }),
      );

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('int-1');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_TRACKING_INTEGRATION_DELETED);
    });

    it('deletes related tracking events before integration', async () => {
      const { bus } = mockEventBus();
      const handler = new DeleteCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      await handler.execute(
        createTestCommand(DELETE_CARRIER_TRACKING_INTEGRATION, { id: 'int-1' }),
      );

      expect(mockTx.carrierTrackingEvent.deleteMany).toHaveBeenCalledWith({
        where: { integrationId: 'int-1' },
      });
      // Ensure deleteMany was called before delete
      const deleteManyOrder = mockTx.carrierTrackingEvent.deleteMany.mock.invocationCallOrder[0];
      const deleteOrder = mockTx.carrierTrackingIntegration.delete.mock.invocationCallOrder[0];
      expect(deleteManyOrder).toBeLessThan(deleteOrder);
    });

    it('includes carrierId and providerType in deletion event payload', async () => {
      const { bus } = mockEventBus();
      const handler = new DeleteCarrierTrackingIntegrationCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(DELETE_CARRIER_TRACKING_INTEGRATION, { id: 'int-1' }),
      );

      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          carrierId: 'carrier-1',
          providerType: 'FedEx',
        }),
      );
    });
  });

  /* ---- RecordCarrierTrackingEventCommand ---- */
  describe('RecordCarrierTrackingEventCommandHandler', () => {
    const basePayload = {
      shipmentId: 'ship-1',
      carrierId: 'carrier-1',
      integrationId: 'int-1',
      providerType: 'FedEx',
      trackingNumber: '794644790132',
      status: 'in_transit',
      statusDetail: 'In transit',
      statusCode: 'IT',
      city: 'Memphis',
      state: 'TN',
      country: 'US',
      occurredAt: '2026-04-12T10:00:00Z',
      source: 'poll',
    };

    it('records event and emits CARRIER_TRACKING_UPDATE_RECEIVED', async () => {
      const { bus } = mockEventBus();
      const handler = new RecordCarrierTrackingEventCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_CARRIER_TRACKING_EVENT, basePayload),
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('in_transit');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED);
    });

    it('includes shipmentId and trackingNumber in update event payload', async () => {
      const { bus } = mockEventBus();
      const handler = new RecordCarrierTrackingEventCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_CARRIER_TRACKING_EVENT, basePayload),
      );

      expect(result.events[0].payload).toEqual(
        expect.objectContaining({
          shipmentId: 'ship-1',
          trackingNumber: '794644790132',
          status: 'in_transit',
          providerType: 'FedEx',
          source: 'poll',
        }),
      );
    });

    it('emits CARRIER_TRACKING_DELIVERED when status is delivered', async () => {
      const { bus } = mockEventBus();
      const deliveredEvent = {
        ...mockTrackingEvent,
        status: 'delivered',
        signedBy: 'J. Smith',
      };
      mockTx.carrierTrackingEvent.create.mockResolvedValueOnce(deliveredEvent);
      const handler = new RecordCarrierTrackingEventCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_CARRIER_TRACKING_EVENT, {
          ...basePayload,
          status: 'delivered',
          signedBy: 'J. Smith',
        }),
      );

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED);
      expect(result.events[1].type).toBe(EVENT_TYPES.CARRIER_TRACKING_DELIVERED);
      expect(result.events[1].payload).toEqual(
        expect.objectContaining({
          shipmentId: 'ship-1',
          signedBy: 'J. Smith',
        }),
      );
    });

    it('emits CARRIER_TRACKING_EXCEPTION when status is exception', async () => {
      const { bus } = mockEventBus();
      const exceptionEvent = {
        ...mockTrackingEvent,
        status: 'exception',
        statusDetail: 'Package damaged',
      };
      mockTx.carrierTrackingEvent.create.mockResolvedValueOnce(exceptionEvent);
      const handler = new RecordCarrierTrackingEventCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(RECORD_CARRIER_TRACKING_EVENT, {
          ...basePayload,
          status: 'exception',
          statusDetail: 'Package damaged',
        }),
      );

      expect(result.events).toHaveLength(2);
      expect(result.events[0].type).toBe(EVENT_TYPES.CARRIER_TRACKING_UPDATE_RECEIVED);
      expect(result.events[1].type).toBe(EVENT_TYPES.CARRIER_TRACKING_EXCEPTION);
      expect(result.events[1].payload).toEqual(
        expect.objectContaining({
          shipmentId: 'ship-1',
          statusDetail: 'Package damaged',
        }),
      );
    });

    it('propagates metadata from command to events', async () => {
      const { bus } = mockEventBus();
      const handler = new RecordCarrierTrackingEventCommandHandler(mockPrisma, bus);

      const result = await handler.execute(
        createTestCommand(
          RECORD_CARRIER_TRACKING_EVENT,
          basePayload,
          { orgId: 'org-track', actorId: 'system' },
        ),
      );

      expect(result.events[0].orgId).toBe('org-track');
      expect(result.events[0].actorId).toBe('system');
    });
  });
});
