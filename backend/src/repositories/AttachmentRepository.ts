import { PrismaClient, Attachment } from '@prisma/client';

export interface CreateAttachmentDTO {
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  storageBackend: string;
  uploadedBy?: string;
  description?: string;
}

export interface IAttachmentRepository {
  findById(id: string): Promise<Attachment | null>;
  findByEntity(entityType: string, entityId: string): Promise<Attachment[]>;
  create(data: CreateAttachmentDTO): Promise<Attachment>;
  delete(id: string): Promise<void>;
}

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.attachment.findUnique({ where: { id } });
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.prisma.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateAttachmentDTO) {
    return this.prisma.attachment.create({ data });
  }

  async delete(id: string) {
    await this.prisma.attachment.delete({ where: { id } });
  }
}
