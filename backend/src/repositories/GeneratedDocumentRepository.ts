import { PrismaClient, GeneratedDocument } from '@prisma/client';

export interface CreateGeneratedDocumentDTO {
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

export interface IGeneratedDocumentRepository {
  findById(id: string): Promise<GeneratedDocument | null>;
  findByShipment(shipmentId: string): Promise<Omit<GeneratedDocument, 'fileContent'>[]>;
  findByOrder(orderId: string): Promise<Omit<GeneratedDocument, 'fileContent'>[]>;
  findAll(filters?: { documentType?: string; shipmentId?: string; orderId?: string }): Promise<Omit<GeneratedDocument, 'fileContent'>[]>;
  create(data: CreateGeneratedDocumentDTO): Promise<GeneratedDocument>;
  delete(id: string): Promise<void>;
}

// Fields to select when we don't want the binary content
const metadataSelect = {
  id: true,
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

  async findById(id: string) {
    return this.prisma.generatedDocument.findUnique({ where: { id } });
  }

  async findByShipment(shipmentId: string) {
    return this.prisma.generatedDocument.findMany({
      where: { shipmentId },
      select: metadataSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByOrder(orderId: string) {
    return this.prisma.generatedDocument.findMany({
      where: { orderId },
      select: metadataSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(filters?: { documentType?: string; shipmentId?: string; orderId?: string }) {
    return this.prisma.generatedDocument.findMany({
      where: {
        ...(filters?.documentType && { documentType: filters.documentType }),
        ...(filters?.shipmentId && { shipmentId: filters.shipmentId }),
        ...(filters?.orderId && { orderId: filters.orderId }),
      },
      select: metadataSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateGeneratedDocumentDTO) {
    return this.prisma.generatedDocument.create({ data });
  }

  async delete(id: string) {
    await this.prisma.generatedDocument.delete({ where: { id } });
  }
}
