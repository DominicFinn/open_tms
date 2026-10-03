import { PrismaClient, Charge } from '@prisma/client';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateChargeDTO {
  orgId: string;
  orderId?: string;
  shipmentId?: string;
  chargeType: string;
  chargeCategory: string;
  description: string;
  amountCents: number;
  currency?: string;
  source?: string;
  sourceId?: string;
  accessorialCode?: string;
  freightClass?: string;
  nmfcCode?: string;
  ratedWeight?: number;
  ratePerCwt?: number;
  status?: string;
  createdBy?: string;
}

export interface UpdateChargeDTO {
  amountCents?: number;
  description?: string;
  status?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ChargeFilters {
  orgId: string;
  shipmentId?: string;
  shipmentIds?: string[];
  orderId?: string;
  chargeCategory?: string;
  chargeType?: string;
  status?: string;
}

// ─── Interface ──────────────────────────────────────────────────────────────

export interface IChargeRepository {
  create(data: CreateChargeDTO): Promise<Charge>;
  findById(id: string, orgId: string): Promise<Charge | null>;
  findAll(filters: ChargeFilters): Promise<Charge[]>;
  findByShipmentId(shipmentId: string, orgId: string): Promise<Charge[]>;
  findByOrderId(orderId: string, orgId: string): Promise<Charge[]>;
  update(id: string, orgId: string, data: UpdateChargeDTO): Promise<Charge>;
  updateMany(ids: string[], orgId: string, data: UpdateChargeDTO): Promise<{ count: number }>;
  delete(id: string, orgId: string): Promise<void>;
  sumByShipment(shipmentId: string, orgId: string, chargeCategory: string): Promise<number>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class ChargeRepository implements IChargeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateChargeDTO): Promise<Charge> {
    return this.prisma.charge.create({
      data: {
        orgId: data.orgId,
        orderId: data.orderId,
        shipmentId: data.shipmentId,
        chargeType: data.chargeType,
        chargeCategory: data.chargeCategory,
        description: data.description,
        amountCents: data.amountCents,
        currency: data.currency ?? 'USD',
        source: data.source ?? 'manual',
        sourceId: data.sourceId,
        accessorialCode: data.accessorialCode,
        freightClass: data.freightClass,
        nmfcCode: data.nmfcCode,
        ratedWeight: data.ratedWeight,
        ratePerCwt: data.ratePerCwt,
        status: data.status ?? 'pending',
        createdBy: data.createdBy,
      },
    });
  }

  async findById(id: string, orgId: string): Promise<Charge | null> {
    return this.prisma.charge.findFirst({ where: { id, orgId } });
  }

  async findAll(filters: ChargeFilters): Promise<Charge[]> {
    return this.prisma.charge.findMany({
      where: {
        orgId: filters.orgId,
        ...(filters.shipmentId && { shipmentId: filters.shipmentId }),
        ...(filters.shipmentIds && filters.shipmentIds.length > 0 && {
          shipmentId: { in: filters.shipmentIds },
        }),
        ...(filters.orderId && { orderId: filters.orderId }),
        ...(filters.chargeCategory && { chargeCategory: filters.chargeCategory }),
        ...(filters.chargeType && { chargeType: filters.chargeType }),
        ...(filters.status && { status: filters.status }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByShipmentId(shipmentId: string, orgId: string): Promise<Charge[]> {
    return this.prisma.charge.findMany({
      where: { shipmentId, orgId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByOrderId(orderId: string, orgId: string): Promise<Charge[]> {
    return this.prisma.charge.findMany({
      where: { orderId, orgId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, orgId: string, data: UpdateChargeDTO): Promise<Charge> {
    return this.prisma.charge.update({
      where: { id, orgId },
      data,
    });
  }

  async updateMany(ids: string[], orgId: string, data: UpdateChargeDTO): Promise<{ count: number }> {
    if (ids.length === 0) return { count: 0 };
    const result = await this.prisma.charge.updateMany({
      where: { id: { in: ids }, orgId },
      data,
    });
    return { count: result.count };
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.prisma.charge.delete({ where: { id, orgId } });
  }

  async sumByShipment(shipmentId: string, orgId: string, chargeCategory: string): Promise<number> {
    const result = await this.prisma.charge.aggregate({
      where: { shipmentId, orgId, chargeCategory, status: { not: 'written_off' } },
      _sum: { amountCents: true },
    });
    return result._sum.amountCents ?? 0;
  }
}
