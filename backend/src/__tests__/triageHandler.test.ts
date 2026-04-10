import { TriageHandler } from '../events/handlers/TriageHandler';
import { DomainEvent } from '../events/DomainEvent';

// ── Mock Prisma ─────────────────────────────────────────────
function mockPrisma() {
  const created: Record<string, any[]> = {
    issue: [],
    issueActivity: [],
  };

  let issueCounter = 0;

  return {
    issue: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => {
        issueCounter++;
        const issue = { id: `issue-${issueCounter}`, ...data };
        created.issue.push(issue);
        return Promise.resolve(issue);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        return Promise.resolve({ id: where.id, ...data });
      }),
    },
    issueActivity: {
      create: jest.fn().mockImplementation(({ data }) => {
        const act = { id: `act-${created.issueActivity.length + 1}`, ...data };
        created.issueActivity.push(act);
        return Promise.resolve(act);
      }),
    },
    shipment: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    _created: created,
  } as any;
}

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'evt-001',
    type: 'shipment.exception',
    timestamp: new Date().toISOString(),
    orgId: 'org-001',
    actorId: null,
    entityType: 'shipment',
    entityId: 'shp-001',
    payload: { shipmentReference: 'SHP-100', exceptionType: 'delay', description: 'Delayed at warehouse' },
    metadata: { correlationId: 'corr-001', source: 'api', schemaVersion: 1 },
    ...overrides,
  };
}

describe('TriageHandler', () => {
  let handler: TriageHandler;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    handler = new TriageHandler(prisma);
  });

  describe('event subscriptions', () => {
    it('subscribes to exception and sensor alert events', () => {
      expect(handler.eventPatterns).toContain('shipment.exception');
      expect(handler.eventPatterns).toContain('order.exception');
      expect(handler.eventPatterns).toContain('sensor.alert_temperature');
      expect(handler.eventPatterns).toContain('sensor.alert_impact');
      expect(handler.eventPatterns).toContain('sensor.alert_battery');
      expect(handler.eventPatterns).toContain('sensor.alert_light');
      expect(handler.eventPatterns).toContain('tracking.geofence_entered');
      expect(handler.eventPatterns).toContain('integration.outbound_failed');
    });

    it('has the correct handler name', () => {
      expect(handler.name).toBe('triage.auto_create');
    });
  });

  describe('shipment.exception', () => {
    it('creates an issue from a shipment exception event', async () => {
      await handler.handle(makeEvent());

      expect(prisma.issue.create).toHaveBeenCalledTimes(1);
      const created = prisma._created.issue[0];
      expect(created.issueNumber).toBe('ISS-001');
      expect(created.title).toContain('SHP-100');
      expect(created.title).toContain('delay');
      expect(created.status).toBe('new');
      expect(created.severity).toBe('high');
      expect(created.source).toBe('auto_exception');
      expect(created.sourceEventId).toBe('evt-001');
      expect(created.shipmentId).toBe('shp-001');
      expect(created.signalScore).toBe(75);
    });

    it('sets priority based on exception type', async () => {
      // damage = priority 1
      await handler.handle(makeEvent({
        id: 'evt-dmg',
        payload: { shipmentReference: 'SHP-100', exceptionType: 'damage', description: 'Freight damaged' },
      }));

      const created = prisma._created.issue[0];
      expect(created.priority).toBe(1);
    });

    it('creates an activity record', async () => {
      await handler.handle(makeEvent());

      expect(prisma.issueActivity.create).toHaveBeenCalledTimes(1);
      const activity = prisma._created.issueActivity[0];
      expect(activity.actorName).toBe('System');
      expect(activity.action).toBe('created');
    });

    it('maps exception categories correctly', async () => {
      const cases: [string, string][] = [
        ['delay', 'Delivery Delay'],
        ['damage', 'Freight Damage'],
        ['refused', 'Delivery'],
        ['address_issue', 'Documentation'],
        ['weather', 'Weather'],
        ['temperature', 'Equipment'],
      ];

      for (const [exceptionType, expectedCategory] of cases) {
        const p = mockPrisma();
        const h = new TriageHandler(p);
        await h.handle(makeEvent({
          id: `evt-${exceptionType}`,
          payload: { shipmentReference: 'SHP-100', exceptionType, description: 'Test' },
        }));
        expect(p._created.issue[0].category).toBe(expectedCategory);
      }
    });
  });

  describe('order.exception', () => {
    it('creates an issue linked to the order', async () => {
      await handler.handle(makeEvent({
        type: 'order.exception',
        entityType: 'order',
        entityId: 'ord-001',
        payload: { orderReference: 'ORD-500', exceptionType: 'refused', description: 'Customer refused' },
      }));

      const created = prisma._created.issue[0];
      expect(created.orderId).toBe('ord-001');
      expect(created.shipmentId).toBeUndefined();
      expect(created.title).toContain('ORD-500');
      expect(created.category).toBe('Delivery');
    });
  });

  describe('sensor alerts', () => {
    it('creates a temperature alert issue with low initial signal score', async () => {
      await handler.handle(makeEvent({
        type: 'sensor.alert_temperature',
        payload: { deviceName: 'Tracker-7', temperature: 15.2, tempMin: 2, tempMax: 8, shipmentId: 'shp-001' },
      }));

      const created = prisma._created.issue[0];
      expect(created.source).toBe('auto_sensor');
      expect(created.signalScore).toBe(30); // Single reading = low confidence
      expect(created.category).toBe('Equipment');
      expect(created.tags).toContain('sensor-alert');
      expect(created.tags).toContain('temperature');
    });

    it('creates an impact alert with high signal score', async () => {
      await handler.handle(makeEvent({
        type: 'sensor.alert_impact',
        payload: { deviceName: 'Tracker-7', impactG: 5.2, shipmentId: 'shp-001' },
      }));

      const created = prisma._created.issue[0];
      expect(created.signalScore).toBe(70); // Impacts are rarely false
      expect(created.priority).toBe(1); // Critical
      expect(created.category).toBe('Freight Damage');
    });
  });

  describe('deduplication', () => {
    it('skips creation if an issue with the same sourceEventId exists', async () => {
      // For non-sensor events: first findFirst is sourceEventId check
      prisma.issue.findFirst.mockResolvedValueOnce({ id: 'existing-001', issueNumber: 'ISS-050' });

      await handler.handle(makeEvent());

      expect(prisma.issue.create).not.toHaveBeenCalled();
    });

    it('corroborates existing issue for sensor alerts instead of creating duplicate', async () => {
      // For sensor alerts: first findFirst checks entity+category combo — found!
      const existingIssue = {
        id: 'existing-001',
        issueNumber: 'ISS-050',
        correlatedEvents: 2,
        signalScore: 40,
      };
      prisma.issue.findFirst.mockResolvedValueOnce(existingIssue);

      await handler.handle(makeEvent({
        type: 'sensor.alert_temperature',
        payload: { deviceName: 'Tracker-7', temperature: 15.2, tempMin: 2, tempMax: 8, shipmentId: 'shp-001' },
      }));

      // Should NOT create a new issue
      expect(prisma.issue.create).not.toHaveBeenCalled();

      // Should UPDATE the existing issue with boosted score
      expect(prisma.issue.update).toHaveBeenCalledWith({
        where: { id: 'existing-001' },
        data: expect.objectContaining({
          correlatedEvents: 3,
          signalScore: expect.any(Number),
        }),
      });

      // Score should be boosted: 30 + (3-1) * 15 = 60
      const updateCall = prisma.issue.update.mock.calls[0][0];
      expect(updateCall.data.signalScore).toBe(60);

      // Should create a signal_updated activity
      expect(prisma.issueActivity.create).toHaveBeenCalledTimes(1);
      const activity = prisma._created.issueActivity[0];
      expect(activity.action).toBe('signal_updated');
    });
  });

  describe('enrichment', () => {
    it('enriches issue with carrier/customer/lane/region from shipment', async () => {
      prisma.shipment.findUnique.mockResolvedValueOnce({
        carrierId: 'carrier-001',
        customerId: 'cust-001',
        laneId: 'lane-001',
        destination: { country: 'GB' },
        customer: { name: 'Acme Corp' },
      });

      await handler.handle(makeEvent());

      const created = prisma._created.issue[0];
      expect(created.carrierId).toBe('carrier-001');
      expect(created.customerId).toBe('cust-001');
      expect(created.laneId).toBe('lane-001');
      expect(created.region).toBe('GB');
    });

    it('adds hazmat and temperature-controlled tags from order', async () => {
      prisma.order.findUnique.mockResolvedValueOnce({
        customerId: 'cust-001',
        temperatureControl: 'refrigerated',
        requiresHazmat: true,
        destination: { country: 'US' },
      });

      await handler.handle(makeEvent({
        type: 'order.exception',
        entityType: 'order',
        entityId: 'ord-001',
        payload: { orderReference: 'ORD-100', exceptionType: 'delay', description: 'Delayed' },
      }));

      const created = prisma._created.issue[0];
      expect(created.tags).toContain('temperature-controlled');
      expect(created.tags).toContain('hazmat');
      expect(created.customerId).toBe('cust-001');
      expect(created.region).toBe('US');
    });
  });

  describe('issue numbering', () => {
    it('generates ISS-001 for the first issue', async () => {
      await handler.handle(makeEvent());

      const created = prisma._created.issue[0];
      expect(created.issueNumber).toBe('ISS-001');
    });

    it('increments from the last issue number', async () => {
      // For shipment.exception: first findFirst is sourceEventId check, second is numbering
      prisma.issue.findFirst
        .mockResolvedValueOnce(null)                        // sourceEventId dedup — not found
        .mockResolvedValueOnce({ issueNumber: 'ISS-042' }); // last issue for numbering

      await handler.handle(makeEvent({ id: 'evt-new' }));

      const created = prisma._created.issue[0];
      expect(created.issueNumber).toBe('ISS-043');
    });
  });

  describe('unsupported event types', () => {
    it('ignores events it does not know how to handle', async () => {
      await handler.handle(makeEvent({ type: 'carrier.created' }));

      expect(prisma.issue.create).not.toHaveBeenCalled();
    });
  });
});
