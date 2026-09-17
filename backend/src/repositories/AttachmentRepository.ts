import { PrismaClient, Attachment } from '@prisma/client';

export interface CreateAttachmentDTO {
  orgId: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  storageBackend: string;
  uploadedBy?: string;
  description?: string;
  retentionExpiresAt?: Date;
}

export const ATTACHABLE_ENTITY_TYPES = ['shipment', 'order', 'carrier', 'customer', 'location', 'sop_audit'] as const;
export type AttachableEntityType = typeof ATTACHABLE_ENTITY_TYPES[number];

// Attachments are scoped by their own orgId. A lookup by id from another org reads as not found,
// so the route answers 404 and the file's existence stays opaque.
export interface IAttachmentRepository {
  findById(id: string, orgId: string): Promise<Attachment | null>;
  findByEntity(orgId: string, entityType: string, entityId: string): Promise<Attachment[]>;
  entityExists(orgId: string, entityType: AttachableEntityType, entityId: string): Promise<boolean>;
  create(data: CreateAttachmentDTO): Promise<Attachment>;
  delete(id: string, orgId: string): Promise<void>;
}

export class AttachmentRepository implements IAttachmentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, orgId: string) {
    return this.prisma.attachment.findFirst({ where: { id, orgId } });
  }

  async findByEntity(orgId: string, entityType: string, entityId: string) {
    return this.prisma.attachment.findMany({
      where: { orgId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // An upload must target an entity the caller's org owns, otherwise one tenant could hang files
  // off another tenant's shipment id.
  async entityExists(orgId: string, entityType: AttachableEntityType, entityId: string) {
    const where = { id: entityId, orgId };
    const select = { id: true } as const;
    switch (entityType) {
      case 'shipment': return !!(await this.prisma.shipment.findFirst({ where, select }));
      case 'order': return !!(await this.prisma.order.findFirst({ where, select }));
      case 'carrier': return !!(await this.prisma.carrier.findFirst({ where, select }));
      case 'customer': return !!(await this.prisma.customer.findFirst({ where, select }));
      case 'location': return !!(await this.prisma.location.findFirst({ where, select }));
      case 'sop_audit': return !!(await this.prisma.sOPAudit.findFirst({ where, select }));
    }
  }

  async create(data: CreateAttachmentDTO) {
    return this.prisma.attachment.create({ data });
  }

  async delete(id: string, orgId: string) {
    await this.prisma.attachment.deleteMany({ where: { id, orgId } });
  }
}
