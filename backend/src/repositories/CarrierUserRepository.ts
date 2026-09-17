import { PrismaClient, CarrierUser } from '@prisma/client';

export interface CreateCarrierUserDTO {
  carrierId: string;
  email: string;
  passwordHash: string;
  name: string;
  role?: string;
}

export interface UpdateCarrierUserDTO {
  name?: string;
  role?: string;
  active?: boolean;
}

export interface ICarrierUserRepository {
  create(data: CreateCarrierUserDTO): Promise<CarrierUser>;
  findById(id: string, orgId: string): Promise<CarrierUser | null>;
  findByEmail(email: string): Promise<CarrierUser | null>;
  findByCarrierId(carrierId: string, orgId: string): Promise<CarrierUser[]>;
  update(id: string, orgId: string, data: UpdateCarrierUserDTO): Promise<CarrierUser>;
  updatePassword(id: string, orgId: string, passwordHash: string): Promise<CarrierUser>;
  updateLastLogin(id: string, orgId: string): Promise<CarrierUser>;
  applyFailedAttempt(id: string, orgId: string, failedLoginAttempts: number, lockedUntil: Date | null): Promise<CarrierUser>;
  clearLockout(id: string, orgId: string): Promise<CarrierUser>;
}

export class CarrierUserRepository implements ICarrierUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCarrierUserDTO): Promise<CarrierUser> {
    return this.prisma.carrierUser.create({ data });
  }

  async findById(id: string, orgId: string): Promise<CarrierUser | null> {
    return this.prisma.carrierUser.findUnique({
      where: { id, carrier: { orgId } },
      include: {
        carrier: { select: { id: true, name: true } },
      },
    });
  }

  async findByEmail(email: string): Promise<CarrierUser | null> {
    return this.prisma.carrierUser.findUnique({
      where: { email },
      include: {
        carrier: { select: { id: true, orgId: true, name: true, archived: true, deletedAt: true } },
      },
    });
  }

  async findByCarrierId(carrierId: string, orgId: string): Promise<CarrierUser[]> {
    return this.prisma.carrierUser.findMany({
      where: { carrierId, carrier: { orgId } },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, orgId: string, data: UpdateCarrierUserDTO): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({ where: { id, carrier: { orgId } }, data });
  }

  async updatePassword(id: string, orgId: string, passwordHash: string): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({
      where: { id, carrier: { orgId } },
      data: { passwordHash },
    });
  }

  async updateLastLogin(id: string, orgId: string): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({
      where: { id, carrier: { orgId } },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  async applyFailedAttempt(id: string, orgId: string, failedLoginAttempts: number, lockedUntil: Date | null): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({
      where: { id, carrier: { orgId } },
      data: { failedLoginAttempts, lockedUntil },
    });
  }

  async clearLockout(id: string, orgId: string): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({
      where: { id, carrier: { orgId } },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}
