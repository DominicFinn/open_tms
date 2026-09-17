/**
 * #291: telemetry reads used to query sensor readings by shipment or order id alone, so any
 * authenticated user could read another tenant's readings by guessing an id.
 */

import { SensorReadingRepository } from '../../repositories/SensorReadingRepository';

function makePrisma(owned: { shipment?: boolean; order?: boolean; device?: boolean }) {
  const found = (yes?: boolean) => jest.fn().mockResolvedValue(yes ? { id: 'x' } : null);
  return {
    shipment: { findFirst: found(owned.shipment) },
    order: { findFirst: found(owned.order) },
    device: { findFirst: found(owned.device) },
    sensorReading: { findMany: jest.fn().mockResolvedValue([{ id: 'r1' }]) },
  } as any;
}

const window = { limit: 100 };

describe('SensorReadingRepository org scoping', () => {
  it('returns null for a shipment outside the org and reads no readings', async () => {
    const prisma = makePrisma({ shipment: false });
    const repo = new SensorReadingRepository(prisma);

    expect(await repo.listForShipment('org-1', 'ship-foreign', window)).toBeNull();
    expect(prisma.shipment.findFirst.mock.calls[0][0].where).toEqual({ id: 'ship-foreign', orgId: 'org-1' });
    expect(prisma.sensorReading.findMany).not.toHaveBeenCalled();
  });

  it('filters shipment readings by the device org as well', async () => {
    const prisma = makePrisma({ shipment: true });
    const repo = new SensorReadingRepository(prisma);

    expect(await repo.listForShipment('org-1', 'ship-1', window)).toEqual([{ id: 'r1' }]);
    const args = prisma.sensorReading.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ shipmentId: 'ship-1', device: { orgId: 'org-1' } });
    expect(args.orderBy).toEqual({ eventTime: 'asc' });
    expect(args.take).toBe(100);
  });

  it('returns null for an order outside the org', async () => {
    const prisma = makePrisma({ order: false });
    const repo = new SensorReadingRepository(prisma);

    expect(await repo.listForOrder('org-1', 'order-foreign', window)).toBeNull();
    expect(prisma.order.findFirst.mock.calls[0][0].where).toEqual({ id: 'order-foreign', orgId: 'org-1' });
    expect(prisma.sensorReading.findMany).not.toHaveBeenCalled();
  });

  it('scopes order readings and applies the time window', async () => {
    const prisma = makePrisma({ order: true });
    const repo = new SensorReadingRepository(prisma);
    const since = new Date('2026-09-01T00:00:00Z');
    const until = new Date('2026-09-02T00:00:00Z');

    await repo.listForOrder('org-1', 'order-1', { since, until, limit: 5 });

    expect(prisma.sensorReading.findMany.mock.calls[0][0].where).toEqual({
      orderId: 'order-1',
      device: { orgId: 'org-1' },
      eventTime: { gte: since, lte: until },
    });
  });

  it('returns null for a device outside the org', async () => {
    const prisma = makePrisma({ device: false });
    const repo = new SensorReadingRepository(prisma);

    expect(await repo.listForDevice('org-1', 'dev-foreign', window)).toBeNull();
    expect(prisma.sensorReading.findMany).not.toHaveBeenCalled();
  });

  it('lists device readings newest first', async () => {
    const prisma = makePrisma({ device: true });
    const repo = new SensorReadingRepository(prisma);

    await repo.listForDevice('org-1', 'dev-1', window);

    const args = prisma.sensorReading.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ deviceId: 'dev-1' });
    expect(args.orderBy).toEqual({ eventTime: 'desc' });
  });
});
