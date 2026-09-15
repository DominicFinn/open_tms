import { WarehouseScope, scopedWhere } from './warehouseScope.js';
import { PrismaClient, WarehouseZone, WarehouseBin, WarehouseAisle } from '@prisma/client';

// ── DTOs ─────────────────────────────────────────────────────

export interface CreateWarehouseZoneDTO {
  locationId: string;
  name: string;
  zoneType: string;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  sortOrder?: number;
  orgId: string;
}

export interface UpdateWarehouseZoneDTO {
  name?: string;
  zoneType?: string;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  sortOrder?: number;
  active?: boolean;
}

export interface CreateWarehouseBinDTO {
  zoneId: string;
  aisleId?: string | null;
  locationId: string;
  label: string;
  binType: string;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  maxPalletPositions?: number | null;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  level?: number | null;
  walkSequence?: number;
  orgId: string;
}

export interface UpdateWarehouseBinDTO {
  label?: string;
  binType?: string;
  maxWeightKg?: number | null;
  maxVolumeCbm?: number | null;
  maxPalletPositions?: number | null;
  temperatureZone?: string | null;
  hazmatCertified?: boolean;
  level?: number | null;
  walkSequence?: number;
  active?: boolean;
}

export interface WarehouseZoneWithCounts extends WarehouseZone {
  _count: { bins: number };
}

export interface WarehouseBinWithZone extends WarehouseBin {
  zone: { name: string; zoneType: string };
}

// ── Interface ────────────────────────────────────────────────

export interface IWarehouseZoneRepository {
  // Zones
  findZones(orgId: string, scope: WarehouseScope): Promise<WarehouseZoneWithCounts[]>;
  findZoneById(orgId: string, id: string): Promise<WarehouseZone | null>;
  createZone(data: CreateWarehouseZoneDTO): Promise<WarehouseZone>;
  updateZone(id: string, data: UpdateWarehouseZoneDTO): Promise<WarehouseZone>;

  // Aisles
  findAislesByZone(orgId: string, zoneId: string): Promise<WarehouseAisle[]>;
  createAisle(data: { zoneId: string; locationId: string; name: string; sortOrder?: number }): Promise<WarehouseAisle>;

  // Bins
  findBinsByZone(orgId: string, zoneId: string): Promise<WarehouseBin[]>;
  findBins(orgId: string, scope: WarehouseScope): Promise<WarehouseBinWithZone[]>;
  findBinById(orgId: string, id: string): Promise<WarehouseBin | null>;
  findBinByLabel(orgId: string, locationId: string, label: string): Promise<WarehouseBin | null>;
  createBin(data: CreateWarehouseBinDTO): Promise<WarehouseBin>;
  createBins(data: CreateWarehouseBinDTO[]): Promise<{ count: number }>;
  updateBin(id: string, data: UpdateWarehouseBinDTO): Promise<WarehouseBin>;
}

// ── Implementation ───────────────────────────────────────────

export class WarehouseZoneRepository implements IWarehouseZoneRepository {
  constructor(private prisma: PrismaClient) {}

  // ── Zones ──────────────────────────────────────────────────

  async findZones(orgId: string, scope: WarehouseScope): Promise<WarehouseZoneWithCounts[]> {
    return this.prisma.warehouseZone.findMany({
      where: scopedWhere(orgId, scope),
      include: { _count: { select: { bins: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }) as Promise<WarehouseZoneWithCounts[]>;
  }

  async findZoneById(orgId: string, id: string): Promise<WarehouseZone | null> {
    return this.prisma.warehouseZone.findFirst({ where: { id, orgId } });
  }

  async createZone(data: CreateWarehouseZoneDTO): Promise<WarehouseZone> {
    return this.prisma.warehouseZone.create({ data });
  }

  async updateZone(id: string, data: UpdateWarehouseZoneDTO): Promise<WarehouseZone> {
    return this.prisma.warehouseZone.update({ where: { id }, data });
  }

  // ── Aisles ─────────────────────────────────────────────────

  // WarehouseAisle carries no orgId of its own, so it is scoped through its zone.
  async findAislesByZone(orgId: string, zoneId: string): Promise<WarehouseAisle[]> {
    return this.prisma.warehouseAisle.findMany({
      where: { zoneId, zone: { orgId } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createAisle(data: { zoneId: string; locationId: string; name: string; sortOrder?: number }): Promise<WarehouseAisle> {
    return this.prisma.warehouseAisle.create({ data });
  }

  // ── Bins ───────────────────────────────────────────────────

  async findBinsByZone(orgId: string, zoneId: string): Promise<WarehouseBin[]> {
    return this.prisma.warehouseBin.findMany({
      where: { zoneId, orgId },
      orderBy: [{ walkSequence: 'asc' }, { label: 'asc' }],
    });
  }

  async findBins(orgId: string, scope: WarehouseScope): Promise<WarehouseBinWithZone[]> {
    return this.prisma.warehouseBin.findMany({
      where: scopedWhere(orgId, scope),
      include: { zone: { select: { name: true, zoneType: true } } },
      orderBy: [{ walkSequence: 'asc' }, { label: 'asc' }],
    }) as Promise<WarehouseBinWithZone[]>;
  }

  async findBinById(orgId: string, id: string): Promise<WarehouseBin | null> {
    return this.prisma.warehouseBin.findFirst({ where: { id, orgId } });
  }

  async findBinByLabel(orgId: string, locationId: string, label: string): Promise<WarehouseBin | null> {
    // findFirst rather than findUnique: the compound unique does not include orgId, so the
    // tenant filter has to sit beside it rather than inside the key.
    return this.prisma.warehouseBin.findFirst({
      where: { locationId, label, orgId },
    });
  }

  async createBin(data: CreateWarehouseBinDTO): Promise<WarehouseBin> {
    return this.prisma.warehouseBin.create({ data });
  }

  async createBins(data: CreateWarehouseBinDTO[]): Promise<{ count: number }> {
    return this.prisma.warehouseBin.createMany({ data });
  }

  async updateBin(id: string, data: UpdateWarehouseBinDTO): Promise<WarehouseBin> {
    return this.prisma.warehouseBin.update({ where: { id }, data });
  }
}
