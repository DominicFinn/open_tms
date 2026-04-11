/**
 * Tests for ShipmentEtaMonitorService
 */

import { ShipmentEtaMonitorService, EtaMonitorConfig } from '../../services/routing/ShipmentEtaMonitorService.js';
import { IRoutingProvider, RouteResult, MatrixResult, RouteRequest, MatrixRequest } from '../../services/routing/IRoutingProvider.js';
import { IEventBus } from '../../events/IEventBus.js';
import { DomainEvent } from '../../events/DomainEvent.js';

// --- Mocks ---

function createMockRoutingProvider(overrides?: Partial<RouteResult>): IRoutingProvider {
  const defaultResult: RouteResult = {
    durationSeconds: 3600,
    distanceMeters: 50000,
    estimatedArrival: new Date(Date.now() + 3600000).toISOString(),
    polyline: 'mock-polyline',
    trafficUsed: true,
    trafficDelaySeconds: 300,
    provider: 'mock',
    ...overrides,
  };

  return {
    name: 'mock',
    supportsTruckRouting: true,
    supportsTraffic: true,
    computeRoute: jest.fn().mockResolvedValue(defaultResult),
    computeMatrix: jest.fn().mockResolvedValue({ elements: [], provider: 'mock', trafficUsed: true }),
  };
}

function createMockEventBus(): IEventBus {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    publishBatch: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  };
}

function createMockPrisma(shipments: any[] = [], readModels: any[] = []) {
  return {
    shipment: {
      findMany: jest.fn().mockResolvedValue(shipments),
      findUnique: jest.fn().mockImplementation(({ where }: any) => {
        const found = shipments.find((s: any) => s.id === where.id);
        return Promise.resolve(found || null);
      }),
    },
    shipmentReadModel: {
      findMany: jest.fn().mockResolvedValue(readModels),
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const found = readModels.find((rm: any) => rm.id === where.id);
        return Promise.resolve(found || null);
      }),
    },
    shipmentStop: {
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

function createTestShipment(overrides: any = {}) {
  return {
    id: 'ship-001',
    reference: 'SH-0001',
    orgId: 'org-001',
    status: 'in_transit',
    archived: false,
    pickupDate: new Date(Date.now() - 86400000).toISOString(),
    deliveryDate: new Date(Date.now() + 86400000).toISOString(),
    origin: { id: 'loc-001', name: 'Origin Warehouse', lat: 40.7128, lng: -74.006 },
    destination: { id: 'loc-002', name: 'Destination Hub', lat: 41.8781, lng: -87.6298 },
    stops: [
      {
        id: 'stop-001',
        sequenceNumber: 1,
        status: 'completed',
        stopType: 'pickup',
        estimatedArrival: new Date(Date.now() - 7200000).toISOString(),
        actualArrival: new Date(Date.now() - 7200000).toISOString(),
        location: { id: 'loc-001', name: 'Origin Warehouse', lat: 40.7128, lng: -74.006 },
      },
      {
        id: 'stop-002',
        sequenceNumber: 2,
        status: 'pending',
        stopType: 'delivery',
        estimatedArrival: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        location: { id: 'loc-002', name: 'Destination Hub', lat: 41.8781, lng: -87.6298 },
      },
    ],
    ...overrides,
  };
}

// --- Tests ---

describe('ShipmentEtaMonitorService', () => {
  const config: EtaMonitorConfig = {
    delayThresholdMinutes: 15,
    warningThresholdMinutes: 30,
    criticalThresholdMinutes: 60,
    routeDeviationMeters: 5000,
    staleGpsThresholdMinutes: 60,
  };

  describe('checkSingleShipment', () => {
    it('returns on_time when ETA is within threshold', async () => {
      const shipment = createTestShipment();
      const scheduledArrival = new Date(Date.now() + 7200000); // 2 hours from now
      shipment.stops[1].estimatedArrival = scheduledArrival.toISOString();

      // Route result arrives 5 minutes before scheduled
      const routeResult: Partial<RouteResult> = {
        estimatedArrival: new Date(scheduledArrival.getTime() - 300000).toISOString(),
        durationSeconds: 6900,
      };

      const provider = createMockRoutingProvider(routeResult);
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma([shipment], [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
      ]);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.checkSingleShipment('ship-001');

      expect(result.status).toBe('on_time');
      expect(result.delayMinutes).toBe(0);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('detects minor delay and publishes eta_updated event', async () => {
      const shipment = createTestShipment();
      const scheduledArrival = new Date(Date.now() + 7200000);
      shipment.stops[1].estimatedArrival = scheduledArrival.toISOString();

      // Route result: arrives 20 minutes late
      const routeResult: Partial<RouteResult> = {
        estimatedArrival: new Date(scheduledArrival.getTime() + 20 * 60000).toISOString(),
        durationSeconds: 8400,
      };

      const provider = createMockRoutingProvider(routeResult);
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma([shipment], [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
      ]);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.checkSingleShipment('ship-001');

      expect(result.status).toBe('minor_delay');
      expect(result.delayMinutes).toBe(20);
      // Should publish tracking.eta_updated event
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const publishedEvent = (eventBus.publish as jest.Mock).mock.calls[0][0] as DomainEvent;
      expect(publishedEvent.type).toBe('tracking.eta_updated');
      expect((publishedEvent.payload as any).severity).toBe('minor_delay');
    });

    it('detects critical delay and publishes both eta_updated and shipment.exception', async () => {
      const shipment = createTestShipment();
      const scheduledArrival = new Date(Date.now() + 7200000);
      shipment.stops[1].estimatedArrival = scheduledArrival.toISOString();

      // Route result: arrives 90 minutes late (critical)
      const routeResult: Partial<RouteResult> = {
        estimatedArrival: new Date(scheduledArrival.getTime() + 90 * 60000).toISOString(),
        durationSeconds: 12600,
      };

      const provider = createMockRoutingProvider(routeResult);
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma([shipment], [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
      ]);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.checkSingleShipment('ship-001');

      expect(result.status).toBe('critical');
      expect(result.delayMinutes).toBe(90);
      // Should publish both tracking.eta_updated AND shipment.exception
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const events = (eventBus.publish as jest.Mock).mock.calls.map((c: any[]) => c[0]);
      expect(events.map((e: DomainEvent) => e.type)).toContain('tracking.eta_updated');
      expect(events.map((e: DomainEvent) => e.type)).toContain('shipment.exception');
    });

    it('returns error when shipment not found', async () => {
      const provider = createMockRoutingProvider();
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma([], []);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.checkSingleShipment('nonexistent');

      expect(result.status).toBe('error');
      expect(result.errorMessage).toBe('Shipment not found');
    });

    it('returns skipped when shipment has no GPS position', async () => {
      const shipment = createTestShipment();
      const provider = createMockRoutingProvider();
      const eventBus = createMockEventBus();
      // No read model data (no GPS position)
      const prisma = createMockPrisma([shipment], []);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.checkSingleShipment('ship-001');

      expect(result.status).toBe('skipped');
      expect(provider.computeRoute).not.toHaveBeenCalled();
    });

    it('updates ShipmentStop.estimatedArrival with new ETA', async () => {
      const shipment = createTestShipment();
      const scheduledArrival = new Date(Date.now() + 7200000);
      shipment.stops[1].estimatedArrival = scheduledArrival.toISOString();

      const newEta = new Date(scheduledArrival.getTime() + 25 * 60000).toISOString();
      const provider = createMockRoutingProvider({ estimatedArrival: newEta });
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma([shipment], [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
      ]);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      await service.checkSingleShipment('ship-001');

      expect(prisma.shipmentStop.update).toHaveBeenCalledWith({
        where: { id: 'stop-002' },
        data: { estimatedArrival: new Date(newEta) },
      });
    });
  });

  describe('runEtaCheck', () => {
    it('processes all in-transit shipments and returns summary', async () => {
      const shipments = [
        createTestShipment({ id: 'ship-001', reference: 'SH-0001' }),
        createTestShipment({ id: 'ship-002', reference: 'SH-0002' }),
      ];

      const readModels = [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
        { id: 'ship-002', currentLat: 40.5, currentLng: -76.0, lastLocationAt: new Date() },
      ];

      const provider = createMockRoutingProvider({
        estimatedArrival: new Date(Date.now() + 3600000).toISOString(), // On time
      });
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma(shipments, readModels);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.runEtaCheck();

      expect(result.shipmentsChecked).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.runId).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });

    it('skips shipments without GPS data', async () => {
      const shipments = [
        createTestShipment({ id: 'ship-001', reference: 'SH-0001' }),
        createTestShipment({ id: 'ship-002', reference: 'SH-0002' }),
      ];

      // Only ship-001 has GPS data
      const readModels = [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
      ];

      const provider = createMockRoutingProvider();
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma(shipments, readModels);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.runEtaCheck();

      // ship-002 should be skipped (no GPS data)
      expect(result.shipmentsSkipped).toBeGreaterThanOrEqual(1);
    });

    it('continues processing when one shipment errors', async () => {
      const shipments = [
        createTestShipment({ id: 'ship-001', reference: 'SH-0001' }),
        createTestShipment({ id: 'ship-002', reference: 'SH-0002' }),
      ];

      const readModels = [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
        { id: 'ship-002', currentLat: 40.5, currentLng: -76.0, lastLocationAt: new Date() },
      ];

      const provider = createMockRoutingProvider();
      // First call succeeds, second call throws
      let callCount = 0;
      (provider.computeRoute as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('API rate limit exceeded');
        }
        return Promise.resolve({
          durationSeconds: 3600,
          distanceMeters: 50000,
          estimatedArrival: new Date(Date.now() + 3600000).toISOString(),
          trafficUsed: true,
          provider: 'mock',
        });
      });

      const eventBus = createMockEventBus();
      const prisma = createMockPrisma(shipments, readModels);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      const result = await service.runEtaCheck();

      // Both should be processed, one with error
      expect(result.errorsEncountered).toBe(1);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('event metadata', () => {
    it('includes correct metadata on published events', async () => {
      const shipment = createTestShipment();
      const scheduledArrival = new Date(Date.now() + 7200000);
      shipment.stops[1].estimatedArrival = scheduledArrival.toISOString();

      const routeResult: Partial<RouteResult> = {
        estimatedArrival: new Date(scheduledArrival.getTime() + 45 * 60000).toISOString(),
        durationSeconds: 10500,
        trafficDelaySeconds: 600,
        provider: 'tomtom',
      };

      const provider = createMockRoutingProvider(routeResult);
      const eventBus = createMockEventBus();
      const prisma = createMockPrisma([shipment], [
        { id: 'ship-001', currentLat: 41.0, currentLng: -75.5, lastLocationAt: new Date() },
      ]);

      const service = new ShipmentEtaMonitorService(prisma, provider, eventBus, config);
      await service.checkSingleShipment('ship-001');

      const event = (eventBus.publish as jest.Mock).mock.calls[0][0] as DomainEvent;
      expect(event.metadata.source).toBe('eta-monitor');
      expect(event.metadata.correlationId).toBeDefined();
      expect(event.metadata.schemaVersion).toBe(1);
      expect(event.orgId).toBe('org-001');
      expect(event.entityType).toBe('shipment');
      expect(event.entityId).toBe('ship-001');
      expect(event.actorId).toBeNull(); // system-generated
    });
  });
});
