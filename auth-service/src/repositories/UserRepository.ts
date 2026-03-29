import { PrismaClient, User } from '@prisma/client';

export interface CreateUserDTO {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  customerId?: string;
  phone?: string;
  timezone?: string;
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  timezone?: string;
  avatarUrl?: string;
  active?: boolean;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByIdWithRoles(id: string): Promise<(User & { roles: { role: { id: string; name: string; permissions: any } }[] }) | null>;
  findByEmailWithRoles(email: string): Promise<(User & { roles: { role: { id: string; name: string; permissions: any } }[] }) | null>;
  all(organizationId?: string): Promise<User[]>;
  create(data: CreateUserDTO): Promise<User>;
  update(id: string, data: UpdateUserDTO): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  recordLogin(id: string, ipAddress?: string): Promise<void>;
  recordFailedLogin(id: string): Promise<void>;
  lockAccount(id: string, until: Date): Promise<void>;
  unlockAccount(id: string): Promise<void>;
  archive(id: string): Promise<User>;
}

export class UserRepository implements IUserRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findByIdWithRoles(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
  }

  async findByEmailWithRoles(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
  }

  async all(organizationId?: string) {
    return this.prisma.user.findMany({
      where: {
        active: true,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreateUserDTO) {
    return this.prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
    });
  }

  async update(id: string, data: UpdateUserDTO) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async updatePassword(id: string, passwordHash: string) {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async recordLogin(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async recordFailedLogin(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  }

  async lockAccount(id: string, until: Date) {
    await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: until },
    });
  }

  async unlockAccount(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { lockedUntil: null, failedLoginAttempts: 0 },
    });
  }

  async archive(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
  }
}
