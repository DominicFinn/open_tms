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
  findZonesByLocation(locationId: string): Promise<WarehouseZoneWithCounts[]>;
  findZoneById(id: string): Promise<WarehouseZone | null>;
  createZone(data: CreateWarehouseZoneDTO): Promise<WarehouseZone>;
  updateZone(id: string, data: UpdateWarehouseZoneDTO): Promise<WarehouseZone>;

  // Aisles
  findAislesByZone(zoneId: string): Promise<WarehouseAisle[]>;
  createAisle(data: { zoneId: string; locationId: string; name: string; sortOrder?: number }): Promise<WarehouseAisle>;

  // Bins
  findBinsByZone(zoneId: string): Promise<WarehouseBin[]>;
  findBinsByLocation(locationId: string): Promise<WarehouseBinWithZone[]>;
  findBinById(id: string): Promise<WarehouseBin | null>;
  findBinByLabel(locationId: string, label: string): Promise<WarehouseBin | null>;
  createBin(data: CreateWarehouseBinDTO): Promise<WarehouseBin>;
  createBins(data: CreateWarehouseBinDTO[]): Promise<{ count: number }>;
  updateBin(id: string, data: UpdateWarehouseBinDTO): Promise<WarehouseBin>;
}

// ── Implementation ───────────────────────────────────────────

export class WarehouseZoneRepository implements IWarehouseZoneRepository {
  constructor(private prisma: PrismaClient) {}

  // ── Zones ──────────────────────────────────────────────────

  async findZonesByLocation(locationId: string): Promise<WarehouseZoneWithCounts[]> {
    return this.prisma.warehouseZone.findMany({
      where: { locationId },
      include: { _count: { select: { bins: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }) as Promise<WarehouseZoneWithCounts[]>;
  }

  async findZoneById(id: string): Promise<WarehouseZone | null> {
    return this.prisma.warehouseZone.findUnique({ where: { id } });
  }

  async createZone(data: CreateWarehouseZoneDTO): Promise<WarehouseZone> {
    return this.prisma.warehouseZone.create({ data });
  }

  async updateZone(id: string, data: UpdateWarehouseZoneDTO): Promise<WarehouseZone> {
    return this.prisma.warehouseZone.update({ where: { id }, data });
  }

  // ── Aisles ─────────────────────────────────────────────────

  async findAislesByZone(zoneId: string): Promise<WarehouseAisle[]> {
    return this.prisma.warehouseAisle.findMany({
      where: { zoneId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createAisle(data: { zoneId: string; locationId: string; name: string; sortOrder?: number }): Promise<WarehouseAisle> {
    return this.prisma.warehouseAisle.create({ data });
  }

  // ── Bins ───────────────────────────────────────────────────

  async findBinsByZone(zoneId: string): Promise<WarehouseBin[]> {
    return this.prisma.warehouseBin.findMany({
      where: { zoneId },
      orderBy: [{ walkSequence: 'asc' }, { label: 'asc' }],
    });
  }

  async findBinsByLocation(locationId: string): Promise<WarehouseBinWithZone[]> {
    return this.prisma.warehouseBin.findMany({
      where: { locationId },
      include: { zone: { select: { name: true, zoneType: true } } },
      orderBy: [{ walkSequence: 'asc' }, { label: 'asc' }],
    }) as Promise<WarehouseBinWithZone[]>;
  }

  async findBinById(id: string): Promise<WarehouseBin | null> {
    return this.prisma.warehouseBin.findUnique({ where: { id } });
  }

  async findBinByLabel(locationId: string, label: string): Promise<WarehouseBin | null> {
    return this.prisma.warehouseBin.findUnique({
      where: { locationId_label: { locationId, label } },
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
