import { PrismaClient, Carrier } from '@prisma/client';

export interface CreateCarrierDTO {
  name: string;
  mcNumber?: string;
  dotNumber?: string;
}

export interface UpdateCarrierDTO {
  name?: string;
  mcNumber?: string;
  dotNumber?: string;
}

export interface ICarriersRepository {
  all(): Promise<Carrier[]>;
  findById(id: string): Promise<Carrier | null>;
  create(data: CreateCarrierDTO): Promise<Carrier>;
  update(id: string, data: UpdateCarrierDTO): Promise<Carrier>;
  delete(id: string): Promise<void>;
}

export class CarriersRepository implements ICarriersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<Carrier[]> {
    return this.prisma.carrier.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<Carrier | null> {
    return this.prisma.carrier.findUnique({
      where: { id }
    });
  }

  async create(data: CreateCarrierDTO): Promise<Carrier> {
    return this.prisma.carrier.create({ data });
  }

  async update(id: string, data: UpdateCarrierDTO): Promise<Carrier> {
    return this.prisma.carrier.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.carrier.delete({
      where: { id }
    });
  }
}
