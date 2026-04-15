import { PrismaClient, CustomerUser } from '@prisma/client';

export interface CreateCustomerUserDTO {
  customerId: string;
  email: string;
  passwordHash: string;
  name: string;
  role?: string;
}

export interface UpdateCustomerUserDTO {
  name?: string;
  role?: string;
  active?: boolean;
}

export interface ICustomerUserRepository {
  create(data: CreateCustomerUserDTO): Promise<CustomerUser>;
  findById(id: string): Promise<CustomerUser | null>;
  findByEmail(email: string): Promise<CustomerUser | null>;
  findByCustomerId(customerId: string): Promise<CustomerUser[]>;
  update(id: string, data: UpdateCustomerUserDTO): Promise<CustomerUser>;
  updatePassword(id: string, passwordHash: string): Promise<CustomerUser>;
  updateLastLogin(id: string): Promise<CustomerUser>;
}

export class CustomerUserRepository implements ICustomerUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCustomerUserDTO): Promise<CustomerUser> {
    return this.prisma.customerUser.create({ data });
  }

  async findById(id: string): Promise<CustomerUser | null> {
    return this.prisma.customerUser.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async findByEmail(email: string): Promise<CustomerUser | null> {
    return this.prisma.customerUser.findUnique({
      where: { email },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async findByCustomerId(customerId: string): Promise<CustomerUser[]> {
    return this.prisma.customerUser.findMany({
      where: { customerId },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, data: UpdateCustomerUserDTO): Promise<CustomerUser> {
    return this.prisma.customerUser.update({ where: { id }, data });
  }

  async updatePassword(id: string, passwordHash: string): Promise<CustomerUser> {
    return this.prisma.customerUser.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async updateLastLogin(id: string): Promise<CustomerUser> {
    return this.prisma.customerUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
