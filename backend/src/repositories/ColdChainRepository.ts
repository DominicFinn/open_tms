import {
  PrismaClient,
  ColdChainProfile,
  DeviceCalibration,
  ImmutableTemperatureLog,
  ColdChainExcursion,
  CAPAReport,
} from '@prisma/client';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateColdChainProfileDTO {
  orgId: string;
  name: string;
  description?: string;
  minTemperature: number;
  maxTemperature: number;
  alertMinTemperature: number;
  alertMaxTemperature: number;
  minHumidity?: number;
  maxHumidity?: number;
  alertMinHumidity?: number;
  alertMaxHumidity?: number;
  createdBy?: string;
}

export interface UpdateColdChainProfileDTO {
  name?: string;
  description?: string;
  minTemperature?: number;
  maxTemperature?: number;
  alertMinTemperature?: number;
  alertMaxTemperature?: number;
  minHumidity?: number;
  maxHumidity?: number;
  alertMinHumidity?: number;
  alertMaxHumidity?: number;
  active?: boolean;
  updatedBy?: string;
}

export interface CreateDeviceCalibrationDTO {
  orgId: string;
  deviceId: string;
  calibratedAt: Date;
  calibratedBy: string;
  certificateNumber?: string;
  expiresAt: Date;
  calibrationMethod?: string;
  accuracy?: number;
  notes?: string;
  documentStorageKey?: string;
  createdBy?: string;
}

export interface CreateTemperatureLogDTO {
  orgId: string;
  shipmentId?: string;
  deviceId?: string;
  orderId?: string;
  trackableUnitId?: string;
  temperature: number;
  humidity?: number;
  lat?: number;
  lng?: number;
  recordedAt: Date;
  profileMinTemp?: number;
  profileMaxTemp?: number;
  profileAlertMinTemp?: number;
  profileAlertMaxTemp?: number;
  profileName?: string;
  isWithinRange: boolean;
  isWithinAlertRange: boolean;
  isExcursion: boolean;
  isAlert: boolean;
  integrityHash: string;
  rawPayload?: any;
}

export interface CreateExcursionDTO {
  orgId: string;
  shipmentId: string;
  deviceId?: string;
  excursionType: string;
  severity: string;
  startedAt: Date;
  peakValue: number;
  thresholdValue: number;
}

export interface UpdateExcursionDTO {
  status?: string;
  endedAt?: Date;
  durationMinutes?: number;
  peakValue?: number;
  readingCount?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  dispositionDecision?: string;
  notes?: string;
}

export interface CreateCAPAReportDTO {
  orgId: string;
  issueId: string;
  shipmentId?: string;
  reportNumber: string;
  title: string;
  description: string;
  priority?: string;
  immediateAction?: string;
  containmentAction?: string;
  investigatorId?: string;
  investigatorName?: string;
  affectedProducts?: string[];
  affectedShipmentIds?: string[];
  affectedLocationIds?: string[];
  eventTimeline?: any;
  temperatureData?: any;
  createdBy?: string;
}

export interface UpdateCAPAReportDTO {
  title?: string;
  status?: string;
  priority?: string;
  description?: string;
  immediateAction?: string;
  containmentAction?: string;
  investigationDetails?: string;
  rootCause?: string;
  rootCauseCategory?: string;
  correctiveAction?: string;
  correctiveActionDueDate?: Date;
  correctiveActionCompletedDate?: Date;
  preventiveAction?: string;
  preventiveActionDueDate?: Date;
  preventiveActionCompletedDate?: Date;
  investigatorId?: string;
  investigatorName?: string;
  approverId?: string;
  approverName?: string;
  approvedAt?: Date;
  verificationMethod?: string;
  verifiedById?: string;
  verifiedByName?: string;
  verifiedAt?: Date;
  effectivenessCheck?: string;
  lessonsLearned?: string;
  updatedBy?: string;
}

export interface CAPAReportFilters {
  status?: string;
  priority?: string;
  investigatorId?: string;
  shipmentId?: string;
}

export interface TemperatureLogFilters {
  shipmentId?: string;
  deviceId?: string;
  orderId?: string;
  trackableUnitId?: string;
  isExcursion?: boolean;
  isAlert?: boolean;
  from?: Date;
  to?: Date;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IColdChainRepository {
  // Cold Chain Profiles
  createProfile(data: CreateColdChainProfileDTO): Promise<ColdChainProfile>;
  updateProfile(id: string, data: UpdateColdChainProfileDTO): Promise<ColdChainProfile>;
  getProfile(id: string): Promise<ColdChainProfile | null>;
  listProfiles(orgId: string): Promise<ColdChainProfile[]>;

  // Device Calibrations
  createCalibration(data: CreateDeviceCalibrationDTO): Promise<DeviceCalibration>;
  getLatestCalibration(deviceId: string): Promise<DeviceCalibration | null>;
  listCalibrations(deviceId: string): Promise<DeviceCalibration[]>;

  // Immutable Temperature Logs — CREATE and READ ONLY (CFR 21 Part 11)
  createTemperatureLog(data: CreateTemperatureLogDTO): Promise<ImmutableTemperatureLog>;
  getTemperatureLogs(orgId: string, filters?: TemperatureLogFilters): Promise<ImmutableTemperatureLog[]>;

  // Cold Chain Excursions
  createExcursion(data: CreateExcursionDTO): Promise<ColdChainExcursion>;
  updateExcursion(id: string, data: UpdateExcursionDTO): Promise<ColdChainExcursion>;
  getExcursion(id: string): Promise<ColdChainExcursion | null>;
  listExcursions(shipmentId: string): Promise<ColdChainExcursion[]>;
  getActiveExcursionForDevice(deviceId: string): Promise<ColdChainExcursion | null>;

  // CAPA Reports
  createCAPAReport(data: CreateCAPAReportDTO): Promise<CAPAReport>;
  updateCAPAReport(id: string, data: UpdateCAPAReportDTO): Promise<CAPAReport>;
  getCAPAReport(id: string): Promise<CAPAReport | null>;
  listCAPAReports(orgId: string, filters?: CAPAReportFilters): Promise<CAPAReport[]>;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class ColdChainRepository implements IColdChainRepository {
  constructor(private prisma: PrismaClient) {}

  // ── Cold Chain Profiles ──

  async createProfile(data: CreateColdChainProfileDTO): Promise<ColdChainProfile> {
    return this.prisma.coldChainProfile.create({ data });
  }

  async updateProfile(id: string, data: UpdateColdChainProfileDTO): Promise<ColdChainProfile> {
    return this.prisma.coldChainProfile.update({
      where: { id },
      data,
    });
  }

  async getProfile(id: string): Promise<ColdChainProfile | null> {
    return this.prisma.coldChainProfile.findUnique({
      where: { id },
    });
  }

  async listProfiles(orgId: string): Promise<ColdChainProfile[]> {
    return this.prisma.coldChainProfile.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });
  }

  // ── Device Calibrations ──

  async createCalibration(data: CreateDeviceCalibrationDTO): Promise<DeviceCalibration> {
    return this.prisma.deviceCalibration.create({ data });
  }

  async getLatestCalibration(deviceId: string): Promise<DeviceCalibration | null> {
    return this.prisma.deviceCalibration.findFirst({
      where: {
        deviceId,
        status: 'valid',
        expiresAt: { gt: new Date() },
      },
      orderBy: { calibratedAt: 'desc' },
    });
  }

  async listCalibrations(deviceId: string): Promise<DeviceCalibration[]> {
    return this.prisma.deviceCalibration.findMany({
      where: { deviceId },
      orderBy: { calibratedAt: 'desc' },
    });
  }

  // ── Immutable Temperature Logs (CREATE + READ ONLY — no update/delete) ──

  async createTemperatureLog(data: CreateTemperatureLogDTO): Promise<ImmutableTemperatureLog> {
    return this.prisma.immutableTemperatureLog.create({ data });
  }

  async getTemperatureLogs(orgId: string, filters?: TemperatureLogFilters): Promise<ImmutableTemperatureLog[]> {
    const where: any = { orgId };

    if (filters?.shipmentId) where.shipmentId = filters.shipmentId;
    if (filters?.deviceId) where.deviceId = filters.deviceId;
    if (filters?.orderId) where.orderId = filters.orderId;
    if (filters?.trackableUnitId) where.trackableUnitId = filters.trackableUnitId;
    if (filters?.isExcursion !== undefined) where.isExcursion = filters.isExcursion;
    if (filters?.isAlert !== undefined) where.isAlert = filters.isAlert;

    if (filters?.from || filters?.to) {
      where.recordedAt = {};
      if (filters.from) where.recordedAt.gte = filters.from;
      if (filters.to) where.recordedAt.lte = filters.to;
    }

    return this.prisma.immutableTemperatureLog.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
    });
  }

  // ── Cold Chain Excursions ──

  async createExcursion(data: CreateExcursionDTO): Promise<ColdChainExcursion> {
    return this.prisma.coldChainExcursion.create({ data });
  }

  async updateExcursion(id: string, data: UpdateExcursionDTO): Promise<ColdChainExcursion> {
    return this.prisma.coldChainExcursion.update({
      where: { id },
      data,
    });
  }

  async getExcursion(id: string): Promise<ColdChainExcursion | null> {
    return this.prisma.coldChainExcursion.findUnique({
      where: { id },
    });
  }

  async listExcursions(shipmentId: string): Promise<ColdChainExcursion[]> {
    return this.prisma.coldChainExcursion.findMany({
      where: { shipmentId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getActiveExcursionForDevice(deviceId: string): Promise<ColdChainExcursion | null> {
    return this.prisma.coldChainExcursion.findFirst({
      where: {
        deviceId,
        status: 'active',
        endedAt: null,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  // ── CAPA Reports ──

  async createCAPAReport(data: CreateCAPAReportDTO): Promise<CAPAReport> {
    return this.prisma.cAPAReport.create({ data });
  }

  async updateCAPAReport(id: string, data: UpdateCAPAReportDTO): Promise<CAPAReport> {
    return this.prisma.cAPAReport.update({
      where: { id },
      data,
    });
  }

  async getCAPAReport(id: string): Promise<CAPAReport | null> {
    return this.prisma.cAPAReport.findUnique({
      where: { id },
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
