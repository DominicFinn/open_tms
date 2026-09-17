/**
 * IoT device reads (#291).
 *
 * Module: tms. Device is a reference table scoped by orgId; every method takes orgId first.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const RECENT_ACTIVITY_ROWS = 50;

const assignmentTargetInclude = {
  shipment: { select: { id: true, reference: true, status: true } },
  order: { select: { id: true, orderNumber: true, status: true } },
} as const;

const listInclude = {
  assignments: { where: { active: true }, include: assignmentTargetInclude },
  _count: { select: { sensorReadings: true, deviceEvents: true } },
} satisfies Prisma.DeviceInclude;

const detailInclude = {
  assignments: { orderBy: { assignedAt: 'desc' }, include: assignmentTargetInclude },
  sensorReadings: { orderBy: { eventTime: 'desc' }, take: RECENT_ACTIVITY_ROWS },
  deviceEvents: { orderBy: { startTime: 'desc' }, take: RECENT_ACTIVITY_ROWS },
} satisfies Prisma.DeviceInclude;

export type DeviceListItem = Prisma.DeviceGetPayload<{ include: typeof listInclude }>;
export type DeviceDetail = Prisma.DeviceGetPayload<{ include: typeof detailInclude }>;

export interface DevicePage {
  devices: DeviceListItem[];
  total: number;
}

export interface IDeviceRepository {
  list(orgId: string, page: { limit: number; offset: number }): Promise<DevicePage>;
  findDetail(orgId: string, id: string): Promise<DeviceDetail | null>;
}

export class DeviceRepository implements IDeviceRepository {
  constructor(private prisma: PrismaClient) {}

  async list(orgId: string, { limit, offset }: { limit: number; offset: number }): Promise<DevicePage> {
    const where = { orgId };
    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        include: listInclude,
        take: limit,
        skip: offset,
      }),
      this.prisma.device.count({ where }),
    ]);
    return { devices, total };
  }

  findDetail(orgId: string, id: string): Promise<DeviceDetail | null> {
    return this.prisma.device.findFirst({ where: { id, orgId }, include: detailInclude });
  }
}
