import { PrismaClient, Customer } from '@prisma/client';

export interface CreateCustomerDTO {
  name: string;
  contactEmail?: string;
}

export interface UpdateCustomerDTO {
  name?: string;
  contactEmail?: string;
}

export interface ICustomersRepository {
  all(): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  create(data: CreateCustomerDTO): Promise<Customer>;
  update(id: string, data: UpdateCustomerDTO): Promise<Customer>;
  archive(id: string): Promise<Customer>;
}

export class CustomersRepository implements ICustomersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      where: { archived: false },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: { id, archived: false }
    });
  }

  async create(data: CreateCustomerDTO): Promise<Customer> {
    return this.prisma.customer.create({ data });
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
