import {
  ShipmentTimelineProjection,
  buildTimelineRow,
} from '../../events/projections/ShipmentTimelineProjection';
import { createTestEvent } from '../helpers/testUtils';

function mockPrisma(overrides: any = {}) {
  return {
    shipmentEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    shipmentStop: {
      findUnique: jest.fn(),
      aggregate: jest.fn(),
    },
    ...overrides,
  } as any;
}

describe('buildTimelineRow', () => {
  it('maps the simple command-driven events to canonical types + descriptions', async () => {
    const prisma = mockPrisma();
    const cases: Array<[string, any, string, string]> = [
      ['shipment.created', {}, 'created', 'Shipment created'],
      ['shipment.updated', {}, 'updated', 'Shipment updated'],
      ['shipment.carrier_assigned', { carrierId: 'c1' }, 'carrier_assigned', 'Carrier assigned'],
      ['shipment.delivered', {}, 'delivered', 'Delivered'],
      ['shipment.archived', {}, 'archived', 'Shipment archived'],
      ['shipment.unarchived', {}, 'unarchived', 'Shipment restored'],
      ['shipment.deleted', {}, 'deleted', 'Shipment deleted'],
    ];
    for (const [type, payload, eventType, description] of cases) {
      const row = await buildTimelineRow(prisma, createTestEvent(type, 'shipment', 'ship-1', payload));
      expect(row).toMatchObject({ shipmentId: 'ship-1', eventType, description, source: 'system' });
    }
  });

  it('includes from/to status in the status_changed description', async () => {
    const prisma = mockPrisma();
    const row = await buildTimelineRow(
      prisma,
      createTestEvent('shipment.status_changed', 'shipment', 'ship-1', { previousStatus: 'draft', newStatus: 'ready' })
    );
    expect(row).toMatchObject({ eventType: 'status_changed', description: 'Status changed from draft to ready' });
  });

  it('summarizes the exception reason', async () => {
    const prisma = mockPrisma();
    const row = await buildTimelineRow(
      prisma,
      createTestEvent('shipment.exception', 'shipment', 'ship-1', { reason: 'Package damaged' })
    );
    expect(row).toMatchObject({ eventType: 'exception', description: 'Exception: Package damaged' });
  });

  it('returns null for unmapped shipment events', async () => {
    const prisma = mockPrisma();
    const row = await buildTimelineRow(prisma, createTestEvent('shipment.cutoff_at_risk', 'shipment', 'ship-1', {}));
    expect(row).toBeNull();
  });

  describe('stop classification', () => {
    function stopPrisma(seq: number, min: number, max: number) {
      return mockPrisma({
        shipmentStop: {
          findUnique: jest.fn().mockResolvedValue({ sequenceNumber: seq, shipmentId: 'ship-1' }),
          aggregate: jest.fn().mockResolvedValue({ _min: { sequenceNumber: min }, _max: { sequenceNumber: max } }),
        },
      });
    }

    it('arrival at the last stop is enters_destination', async () => {
      const row = await buildTimelineRow(stopPrisma(3, 1, 3), createTestEvent('shipment.stop_arrived', 'shipment', 'ship-1', { stopId: 's3' }));
      expect(row).toMatchObject({ eventType: 'enters_destination' });
    });

    it('arrival at a middle stop is entered_waypoint', async () => {
      const row = await buildTimelineRow(stopPrisma(2, 1, 3), createTestEvent('shipment.stop_arrived', 'shipment', 'ship-1', { stopId: 's2', location: 'Chicago, IL' }));
      expect(row).toMatchObject({ eventType: 'entered_waypoint', address: 'Chicago, IL' });
    });

    it('arrival at the first stop (origin) is not timelined', async () => {
      const row = await buildTimelineRow(stopPrisma(1, 1, 3), createTestEvent('shipment.stop_arrived', 'shipment', 'ship-1', { stopId: 's1' }));
      expect(row).toBeNull();
    });

    it('departure from the first stop is leaves_origin', async () => {
      const row = await buildTimelineRow(stopPrisma(1, 1, 3), createTestEvent('shipment.stop_completed', 'shipment', 'ship-1', { stopId: 's1' }));
      expect(row).toMatchObject({ eventType: 'leaves_origin' });
    });

    it('departure from a middle stop is exited_waypoint', async () => {
      const row = await buildTimelineRow(stopPrisma(2, 1, 3), createTestEvent('shipment.stop_completed', 'shipment', 'ship-1', { stopId: 's2' }));
      expect(row).toMatchObject({ eventType: 'exited_waypoint' });
    });
  });
});

describe('ShipmentTimelineProjection.handle', () => {
  it('writes a timeline row for a mapped event', async () => {
    const prisma = mockPrisma();
    const proj = new ShipmentTimelineProjection(prisma);
    await proj.handle(createTestEvent('shipment.created', 'shipment', 'ship-1', {}));
    expect(prisma.shipmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'created', shipmentId: 'ship-1' }) })
    );
  });

  it('is idempotent — skips an event already materialized (sourceEventId seen)', async () => {
    const prisma = mockPrisma({
      shipmentEvent: { findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), create: jest.fn() },
    });
    const proj = new ShipmentTimelineProjection(prisma);
    await proj.handle(createTestEvent('shipment.created', 'shipment', 'ship-1', {}));
    expect(prisma.shipmentEvent.create).not.toHaveBeenCalled();
  });

  it('does nothing for an unmapped event', async () => {
    const prisma = mockPrisma();
    const proj = new ShipmentTimelineProjection(prisma);
    await proj.handle(createTestEvent('shipment.cutoff_cleared', 'shipment', 'ship-1', {}));
    expect(prisma.shipmentEvent.findFirst).not.toHaveBeenCalled();
    expect(prisma.shipmentEvent.create).not.toHaveBeenCalled();
  });
});
