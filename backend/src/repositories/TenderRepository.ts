import { PrismaClient, Tender, TenderResponse } from '@prisma/client';

export interface CreateTenderDTO {
  shipmentId: string;
  status?: string;
  publishMethod?: string;
  expiresAt?: Date;
  notes?: string;
}

export interface UpdateTenderDTO {
  status?: string;
  publishedAt?: Date | null;
  expiresAt?: Date | null;
  awardedCarrierId?: string | null;
  awardedAt?: Date | null;
  awardedPrice?: number | null;
  awardedCurrency?: string;
  notes?: string | null;
}

export interface CreateTenderResponseDTO {
  tenderId: string;
  carrierId: string;
  price?: number;
  currency?: string;
  notes?: string;
  transitDays?: number;
}

export interface TenderWithRelations extends Tender {
  shipment?: any;
  awardedCarrier?: any;
  responses?: (TenderResponse & { carrier?: any })[];
}

export interface ITenderRepository {
  findById(id: string): Promise<TenderWithRelations | null>;
  findByShipmentId(shipmentId: string): Promise<TenderWithRelations | null>;
  findAll(filters?: { status?: string }): Promise<TenderWithRelations[]>;
  create(data: CreateTenderDTO): Promise<Tender>;
  update(id: string, data: UpdateTenderDTO): Promise<Tender>;
  delete(id: string): Promise<void>;
  createResponse(data: CreateTenderResponseDTO): Promise<TenderResponse>;
  updateResponse(id: string, data: Partial<CreateTenderResponseDTO> & { status?: string; respondedAt?: Date }): Promise<TenderResponse>;
  findResponses(tenderId: string): Promise<(TenderResponse & { carrier: any })[]>;
}

const tenderInclude = {
  shipment: {
    include: {
      customer: true,
      origin: true,
      destination: true,
    },
  },
  awardedCarrier: true,
  responses: {
    include: { carrier: true },
    orderBy: { createdAt: 'asc' as const },
  },
};

export class TenderRepository implements ITenderRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<TenderWithRelations | null> {
    return this.prisma.tender.findUnique({
      where: { id },
      include: tenderInclude,
    });
  }

  async findByShipmentId(shipmentId: string): Promise<TenderWithRelations | null> {
    return this.prisma.tender.findUnique({
      where: { shipmentId },
      include: tenderInclude,
    });
  }

  async findAll(filters?: { status?: string }): Promise<TenderWithRelations[]> {
    return this.prisma.tender.findMany({
      where: filters?.status ? { status: filters.status } : undefined,
      include: tenderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateTenderDTO): Promise<Tender> {
    return this.prisma.tender.create({ data });
  }

  async update(id: string, data: UpdateTenderDTO): Promise<Tender> {
    return this.prisma.tender.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.tender.delete({ where: { id } });
  }

  async createResponse(data: CreateTenderResponseDTO): Promise<TenderResponse> {
    return this.prisma.tenderResponse.create({ data });
  }

  async updateResponse(id: string, data: Partial<CreateTenderResponseDTO> & { status?: string; respondedAt?: Date }): Promise<TenderResponse> {
    return this.prisma.tenderResponse.update({ where: { id }, data });
  }

  async findResponses(tenderId: string): Promise<(TenderResponse & { carrier: any })[]> {
    return this.prisma.tenderResponse.findMany({
      where: { tenderId },
      include: { carrier: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
