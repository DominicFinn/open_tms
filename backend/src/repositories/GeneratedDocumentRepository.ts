import { Prisma, PrismaClient, GeneratedDocument } from '@prisma/client';

export interface CreateGeneratedDocumentDTO {
  orgId: string;
  documentType: string;
  documentNumber?: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  fileContent?: Buffer;
  storageKey?: string;
  storageBackend?: string;
  templateId?: string;
  shipmentId?: string;
  orderId?: string;
  carrierId?: string;
  customerId?: string;
  generatedBy?: string;
  metadata?: any;
  notes?: string;
  retentionExpiresAt?: Date;
}

export interface GeneratedDocumentFilters {
  documentType?: string;
  shipmentId?: string;
  orderId?: string;
}

/**
 * Every method takes orgId. A document id, shipment id or order id from another tenant finds
 * nothing, so callers answer 404 without learning whether the document exists (#294).
 */
export interface IGeneratedDocumentRepository {
  findById(orgId: string, id: string): Promise<GeneratedDocument | null>;
  findByShipment(orgId: string, shipmentId: string): Promise<Omit<GeneratedDocument, 'fileContent'>[]>;
  findByOrder(orgId: string, orderId: string): Promise<Omit<GeneratedDocument, 'fileContent'>[]>;
  findAll(orgId: string, filters?: GeneratedDocumentFilters): Promise<Omit<GeneratedDocument, 'fileContent'>[]>;
  findByCorrelationId(orgId: string, correlationId: string): Promise<GeneratedDocument | null>;
  findForCustomer(orgId: string, customerId: string, limit: number): Promise<CustomerDocumentSummary[]>;
  findByIdForCustomer(orgId: string, customerId: string, id: string): Promise<GeneratedDocument | null>;
  create(data: CreateGeneratedDocumentDTO): Promise<GeneratedDocument>;
  mergeMetadata(orgId: string, id: string, extra: Record<string, unknown>): Promise<void>;
  delete(orgId: string, id: string): Promise<boolean>;
}

export interface CustomerDocumentSummary {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  fileSize: number | null;
  createdAt: Date;
  shipmentId: string | null;
}

// Fields to select when we don't want the binary content
const metadataSelect = {
  id: true,
  orgId: true,
  documentType: true,
  documentNumber: true,
  fileName: true,
  mimeType: true,
  fileSize: true,
  storageKey: true,
  storageBackend: true,
  templateId: true,
  shipmentId: true,
  orderId: true,
  carrierId: true,
  customerId: true,
  generatedBy: true,
  metadata: true,
  notes: true,
  retentionExpiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class GeneratedDocumentRepository implements IGeneratedDocumentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(orgId: string, id: string) {
    return this.prisma.generatedDocument.findFirst({ where: { id, orgId } });
  }

  async findByShipment(orgId: string, shipmentId: string) {
    return this.prisma.generatedDocument.findMany({
      where: { orgId, shipmentId },
      select: metadataSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByOrder(orgId: string, orderId: string) {
    return this.prisma.generatedDocument.findMany({
      where: { orgId, orderId },
      select: metadataSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(orgId: string, filters?: GeneratedDocumentFilters) {
    return this.prisma.generatedDocument.findMany({
      where: {
        orgId,
        ...(filters?.documentType && { documentType: filters.documentType }),
        ...(filters?.shipmentId && { shipmentId: filters.shipmentId }),
        ...(filters?.orderId && { orderId: filters.orderId }),
      },
      select: metadataSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByCorrelationId(orgId: string, correlationId: string) {
    return this.prisma.generatedDocument.findFirst({
      where: { orgId, metadata: { path: ['correlationId'], equals: correlationId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForCustomer(orgId: string, customerId: string, limit: number) {
    return this.prisma.generatedDocument.findMany({
      where: { orgId, customerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, documentType: true, fileName: true,
        mimeType: true, fileSize: true, createdAt: true,
        shipmentId: true,
      },
      take: limit,
    });
  }

  async findByIdForCustomer(orgId: string, customerId: string, id: string) {
    return this.prisma.generatedDocument.findFirst({ where: { id, orgId, customerId } });
  }

  async create(data: CreateGeneratedDocumentDTO) {
    return this.prisma.generatedDocument.create({ data });
  }

  async mergeMetadata(orgId: string, id: string, extra: Record<string, unknown>) {
    const existing = await this.prisma.generatedDocument.findFirst({
      where: { id, orgId },
      select: { metadata: true },
    });
    if (!existing) return;
    await this.prisma.generatedDocument.updateMany({
      where: { id, orgId },
      data: { metadata: { ...((existing.metadata as Prisma.JsonObject) ?? {}), ...extra } as Prisma.InputJsonObject },
    });
  }

  async delete(orgId: string, id: string) {
    const { count } = await this.prisma.generatedDocument.deleteMany({ where: { id, orgId } });
    return count > 0;
  }
}
