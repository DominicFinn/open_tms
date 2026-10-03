import { PrismaClient, DocumentTemplate } from '@prisma/client';

export interface CreateDocumentTemplateDTO {
  orgId: string;
  name: string;
  documentType: string;
  description?: string;
  htmlTemplate: string;
  config?: any;
  isDefault?: boolean;
}

export interface UpdateDocumentTemplateDTO {
  name?: string;
  description?: string;
  htmlTemplate?: string;
  config?: any;
  isDefault?: boolean;
  active?: boolean;
}

/**
 * Templates belong to one organization (#294). The default for a document type is a
 * per-organization choice, so setting one never unsets another tenant's.
 */
export interface IDocumentTemplateRepository {
  all(orgId: string): Promise<DocumentTemplate[]>;
  findById(orgId: string, id: string): Promise<DocumentTemplate | null>;
  findByType(orgId: string, documentType: string): Promise<DocumentTemplate[]>;
  findDefault(orgId: string, documentType: string): Promise<DocumentTemplate | null>;
  create(data: CreateDocumentTemplateDTO): Promise<DocumentTemplate>;
  update(orgId: string, id: string, data: UpdateDocumentTemplateDTO): Promise<DocumentTemplate | null>;
  delete(orgId: string, id: string): Promise<boolean>;
}

export class DocumentTemplateRepository implements IDocumentTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId: string) {
    return this.prisma.documentTemplate.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(orgId: string, id: string) {
    return this.prisma.documentTemplate.findFirst({ where: { id, orgId } });
  }

  async findByType(orgId: string, documentType: string) {
    return this.prisma.documentTemplate.findMany({
      where: { orgId, documentType, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDefault(orgId: string, documentType: string) {
    return this.prisma.documentTemplate.findFirst({
      where: { orgId, documentType, isDefault: true, active: true },
    });
  }

  async create(data: CreateDocumentTemplateDTO) {
    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
      await this.prisma.documentTemplate.updateMany({
        where: { orgId: data.orgId, documentType: data.documentType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.documentTemplate.create({ data });
  }

  async update(orgId: string, id: string, data: UpdateDocumentTemplateDTO) {
    const template = await this.prisma.documentTemplate.findFirst({ where: { id, orgId } });
    if (!template) return null;

    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
      await this.prisma.documentTemplate.updateMany({
        where: { orgId, documentType: template.documentType, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.documentTemplate.update({ where: { id: template.id, orgId }, data });
  }

  async delete(orgId: string, id: string) {
    const { count } = await this.prisma.documentTemplate.deleteMany({ where: { id, orgId } });
    return count > 0;
  }
}
