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
  findById(id: string): Promise<CarrierUser | null>;
  findByEmail(email: string): Promise<CarrierUser | null>;
  findByCarrierId(carrierId: string): Promise<CarrierUser[]>;
  update(id: string, data: UpdateCarrierUserDTO): Promise<CarrierUser>;
  updatePassword(id: string, passwordHash: string): Promise<CarrierUser>;
  updateLastLogin(id: string): Promise<CarrierUser>;
}

export class CarrierUserRepository implements ICarrierUserRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateCarrierUserDTO): Promise<CarrierUser> {
    return this.prisma.carrierUser.create({ data });
  }

  async findById(id: string): Promise<CarrierUser | null> {
    return this.prisma.carrierUser.findUnique({
      where: { id },
      include: {
        carrier: { select: { id: true, name: true } },
      },
    });
  }

  async findByEmail(email: string): Promise<CarrierUser | null> {
    return this.prisma.carrierUser.findUnique({
      where: { email },
      include: {
        carrier: { select: { id: true, name: true } },
      },
    });
  }

  async findByCarrierId(carrierId: string): Promise<CarrierUser[]> {
    return this.prisma.carrierUser.findMany({
      where: { carrierId },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, data: UpdateCarrierUserDTO): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({ where: { id }, data });
  }

  async updatePassword(id: string, passwordHash: string): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async updateLastLogin(id: string): Promise<CarrierUser> {
    return this.prisma.carrierUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
