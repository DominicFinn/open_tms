/**
 * Sensor reading reads (#291).
 *
 * Module: tms. SensorReading is a ledger table with no orgId column of its own, so every read is
 * scoped twice: the parent (shipment, order or device) must belong to the org, and each reading's
 * device must too. A parent from another org returns null so the route can answer 404.
 */

import { Prisma, PrismaClient } from '@prisma/client';

export interface ReadingWindow {
  since?: Date;
  until?: Date;
  limit: number;
}

const deviceSummarySelect = { id: true, name: true, displayId: true, model: true } as const;

export type SensorReadingWithDevice = Prisma.SensorReadingGetPayload<{
  include: { device: { select: typeof deviceSummarySelect } };
}>;

export type SensorReadingRow = Prisma.SensorReadingGetPayload<object>;

export interface ISensorReadingRepository {
  listForShipment(orgId: string, shipmentId: string, window: ReadingWindow): Promise<SensorReadingWithDevice[] | null>;
  listForOrder(orgId: string, orderId: string, window: ReadingWindow): Promise<SensorReadingWithDevice[] | null>;
  listForDevice(orgId: string, deviceId: string, window: ReadingWindow): Promise<SensorReadingRow[] | null>;
}

export class SensorReadingRepository implements ISensorReadingRepository {
  constructor(private prisma: PrismaClient) {}

  async listForShipment(orgId: string, shipmentId: string, window: ReadingWindow) {
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, orgId }, select: { id: true } });
    if (!shipment) return null;
    return this.prisma.sensorReading.findMany({
      where: { shipmentId, device: { orgId }, ...eventTimeFilter(window) },
      orderBy: { eventTime: 'asc' },
      take: window.limit,
      include: { device: { select: deviceSummarySelect } },
    });
  }

  async listForOrder(orgId: string, orderId: string, window: ReadingWindow) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, orgId }, select: { id: true } });
    if (!order) return null;
    return this.prisma.sensorReading.findMany({
      where: { orderId, device: { orgId }, ...eventTimeFilter(window) },
      orderBy: { eventTime: 'asc' },
      take: window.limit,
      include: { device: { select: deviceSummarySelect } },
    });
  }

  async listForDevice(orgId: string, deviceId: string, window: ReadingWindow) {
    const device = await this.prisma.device.findFirst({ where: { id: deviceId, orgId }, select: { id: true } });
    if (!device) return null;
    return this.prisma.sensorReading.findMany({
      where: { deviceId, ...eventTimeFilter(window) },
      orderBy: { eventTime: 'desc' },
      take: window.limit,
    });
  }
}

function eventTimeFilter({ since, until }: ReadingWindow): Prisma.SensorReadingWhereInput {
  if (!since && !until) return {};
  return {
    eventTime: {
      ...(since ? { gte: since } : {}),
      ...(until ? { lte: until } : {}),
    },
  };
}
