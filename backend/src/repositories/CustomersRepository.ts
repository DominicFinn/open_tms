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
  all(orgId: string): Promise<Customer[]>;
  findById(id: string, orgId: string): Promise<Customer | null>;
  create(data: CreateCustomerDTO): Promise<Customer>;
  update(id: string, orgId: string, data: UpdateCustomerDTO): Promise<Customer>;
  archive(id: string, orgId: string): Promise<Customer>;
}

export class CustomersRepository implements ICustomersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId: string): Promise<Customer[]> {
    const where: any = { archived: false, orgId };
    return this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string, orgId: string): Promise<Customer | null> {
    const where: any = { id, archived: false, orgId };
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

  async update(id: string, orgId: string, data: UpdateCustomerDTO): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id, orgId },
      data
    });
  }

  async archive(id: string, orgId: string): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id, orgId },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }
}
