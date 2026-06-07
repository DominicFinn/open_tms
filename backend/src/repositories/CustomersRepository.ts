import { PrismaClient, Customer } from '@prisma/client';

export interface CreateCustomerDTO {
  /** Multi-tenancy scope. Required post phase-2 tightening. */
  orgId: string;
  name: string;
  contactEmail?: string;
}

export interface UpdateCustomerDTO {
  name?: string;
  contactEmail?: string;
}

export interface ICustomersRepository {
  all(orgId?: string | null): Promise<Customer[]>;
  findById(id: string, orgId?: string | null): Promise<Customer | null>;
  create(data: CreateCustomerDTO): Promise<Customer>;
  update(id: string, data: UpdateCustomerDTO): Promise<Customer>;
  archive(id: string): Promise<Customer>;
}

export class CustomersRepository implements ICustomersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId?: string | null): Promise<Customer[]> {
    const where: any = { archived: false };
    // Multi-tenancy: filter by orgId when the caller supplies one. Legacy
    // rows with NULL orgId are excluded from scoped queries so they can't
    // leak across tenants — they remain accessible only via internal/admin
    // paths that explicitly pass `null` / `undefined`.
    if (orgId) where.orgId = orgId;
    return this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string, orgId?: string | null): Promise<Customer | null> {
    const where: any = { id, archived: false };
    if (orgId) where.orgId = orgId;
    return this.prisma.customer.findFirst({ where });
  }

  async create(data: CreateCustomerDTO): Promise<Customer> {
    return this.prisma.customer.create({
      data: {
        orgId: data.orgId,
        name: data.name,
        contactEmail: data.contactEmail,
      },
    });
  }

  async update(id: string, data: UpdateCustomerDTO): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data
    });
  }

  async archive(id: string): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }
}
