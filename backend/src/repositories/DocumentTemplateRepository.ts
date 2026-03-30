import { PrismaClient, DocumentTemplate } from '@prisma/client';

export interface CreateDocumentTemplateDTO {
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

export interface IDocumentTemplateRepository {
  all(): Promise<DocumentTemplate[]>;
  findById(id: string): Promise<DocumentTemplate | null>;
  findByType(documentType: string): Promise<DocumentTemplate[]>;
  findDefault(documentType: string): Promise<DocumentTemplate | null>;
  create(data: CreateDocumentTemplateDTO): Promise<DocumentTemplate>;
  update(id: string, data: UpdateDocumentTemplateDTO): Promise<DocumentTemplate>;
  delete(id: string): Promise<void>;
}

export class DocumentTemplateRepository implements IDocumentTemplateRepository {
  constructor(private prisma: PrismaClient) {}

  async all() {
    return this.prisma.documentTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.documentTemplate.findUnique({ where: { id } });
  }

  async findByType(documentType: string) {
    return this.prisma.documentTemplate.findMany({
      where: { documentType, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDefault(documentType: string) {
    return this.prisma.documentTemplate.findFirst({
      where: { documentType, isDefault: true, active: true },
    });
  }

  async create(data: CreateDocumentTemplateDTO) {
    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
      await this.prisma.documentTemplate.updateMany({
        where: { documentType: data.documentType, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.documentTemplate.create({ data });
  }

  async update(id: string, data: UpdateDocumentTemplateDTO) {
    // If setting as default, unset other defaults of same type
    if (data.isDefault) {
      const template = await this.prisma.documentTemplate.findUnique({ where: { id } });
      if (template) {
        await this.prisma.documentTemplate.updateMany({
          where: { documentType: template.documentType, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
    }

    return this.prisma.documentTemplate.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.prisma.documentTemplate.delete({ where: { id } });
  }
}
