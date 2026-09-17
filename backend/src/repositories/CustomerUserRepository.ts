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
  findById(id: string, orgId: string): Promise<CustomerUser | null>;
  findByEmail(email: string): Promise<CustomerUser | null>;
  findByCustomerId(customerId: string, orgId: string): Promise<CustomerUser[]>;
  update(id: string, orgId: string, data: UpdateCustomerUserDTO): Promise<CustomerUser>;
  updatePassword(id: string, orgId: string, passwordHash: string): Promise<CustomerUser>;
  updateLastLogin(id: string, orgId: string): Promise<CustomerUser>;
  applyFailedAttempt(id: string, orgId: string, failedLoginAttempts: number, lockedUntil: Date | null): Promise<CustomerUser>;
  clearLockout(id: string, orgId: string): Promise<CustomerUser>;
}

export class CustomerUserRepository implements ICustomerUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCustomerUserDTO): Promise<CustomerUser> {
    return this.prisma.customerUser.create({ data });
  }

  async findById(id: string, orgId: string): Promise<CustomerUser | null> {
    return this.prisma.customerUser.findUnique({
      where: { id, customer: { orgId } },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async findByEmail(email: string): Promise<CustomerUser | null> {
    return this.prisma.customerUser.findUnique({
      where: { email },
      include: {
        customer: { select: { id: true, orgId: true, name: true } },
      },
    });
  }

  async findByCustomerId(customerId: string, orgId: string): Promise<CustomerUser[]> {
    return this.prisma.customerUser.findMany({
      where: { customerId, customer: { orgId } },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, orgId: string, data: UpdateCustomerUserDTO): Promise<CustomerUser> {
    return this.prisma.customerUser.update({ where: { id, customer: { orgId } }, data });
  }

  async updatePassword(id: string, orgId: string, passwordHash: string): Promise<CustomerUser> {
    return this.prisma.customerUser.update({
      where: { id, customer: { orgId } },
      data: { passwordHash },
    });
  }

  async updateLastLogin(id: string, orgId: string): Promise<CustomerUser> {
    return this.prisma.customerUser.update({
      where: { id, customer: { orgId } },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async applyFailedAttempt(id: string, orgId: string, failedLoginAttempts: number, lockedUntil: Date | null): Promise<CustomerUser> {
    return this.prisma.customerUser.update({
      where: { id, customer: { orgId } },
      data: { failedLoginAttempts, lockedUntil },
    });
  }

  async clearLockout(id: string, orgId: string): Promise<CustomerUser> {
    return this.prisma.customerUser.update({
      where: { id, customer: { orgId } },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}
