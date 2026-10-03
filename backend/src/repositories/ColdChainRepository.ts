import {
  PrismaClient,
  DeviceCalibration,
  ColdChainExcursion,
  CAPAReport,
} from '@prisma/client';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CAPAReportFilters {
  status?: string;
  priority?: string;
  investigatorId?: string;
  shipmentId?: string;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IColdChainRepository {
  // Device Calibrations
  getLatestCalibration(deviceId: string, orgId: string): Promise<DeviceCalibration | null>;
  listCalibrations(deviceId: string, orgId: string): Promise<DeviceCalibration[]>;

  // Cold Chain Excursions
  getExcursion(id: string, orgId: string): Promise<ColdChainExcursion | null>;
  listExcursions(shipmentId: string, orgId: string): Promise<ColdChainExcursion[]>;

  // CAPA Reports
  getCAPAReport(id: string, orgId: string): Promise<CAPAReport | null>;
  listCAPAReports(orgId: string, filters?: CAPAReportFilters): Promise<CAPAReport[]>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class ColdChainRepository implements IColdChainRepository {
  constructor(private prisma: PrismaClient) {}

  // ── Device Calibrations ──

  async getLatestCalibration(deviceId: string, orgId: string): Promise<DeviceCalibration | null> {
    return this.prisma.deviceCalibration.findFirst({
      where: {
        deviceId,
        orgId,
        status: 'valid',
        expiresAt: { gt: new Date() },
      },
      orderBy: { calibratedAt: 'desc' },
    });
  }

  async listCalibrations(deviceId: string, orgId: string): Promise<DeviceCalibration[]> {
    return this.prisma.deviceCalibration.findMany({
      where: { deviceId, orgId },
      orderBy: { calibratedAt: 'desc' },
    });
  }

  // ── Cold Chain Excursions ──

  async getExcursion(id: string, orgId: string): Promise<ColdChainExcursion | null> {
    return this.prisma.coldChainExcursion.findUnique({
      where: { id, orgId },
    });
  }

  async listExcursions(shipmentId: string, orgId: string): Promise<ColdChainExcursion[]> {
    return this.prisma.coldChainExcursion.findMany({
      where: { shipmentId, orgId },
      orderBy: { startedAt: 'desc' },
    });
  }

  // ── CAPA Reports ──

  async getCAPAReport(id: string, orgId: string): Promise<CAPAReport | null> {
    return this.prisma.cAPAReport.findUnique({
      where: { id, orgId },
      include: {
        issue: true,
        shipment: true,
      },
    });
  }

  async listCAPAReports(orgId: string, filters?: CAPAReportFilters): Promise<CAPAReport[]> {
    const where: any = { orgId };

    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.investigatorId) where.investigatorId = filters.investigatorId;
    if (filters?.shipmentId) where.shipmentId = filters.shipmentId;

    return this.prisma.cAPAReport.findMany({
      where,
      include: {
        issue: true,
        shipment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
