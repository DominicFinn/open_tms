import { PrismaClient, Carrier } from '@prisma/client';

export interface CreateCarrierDTO {
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface UpdateCarrierDTO {
  name?: string;
  mcNumber?: string;
  dotNumber?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface ICarriersRepository {
  all(): Promise<Carrier[]>;
  findById(id: string): Promise<Carrier | null>;
  create(data: CreateCarrierDTO): Promise<Carrier>;
  update(id: string, data: UpdateCarrierDTO): Promise<Carrier>;
  archive(id: string): Promise<Carrier>;
}

export class CarriersRepository implements ICarriersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<Carrier[]> {
    return this.prisma.carrier.findMany({
      where: { archived: false },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<Carrier | null> {
    return this.prisma.carrier.findFirst({
      where: { id, archived: false }
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

  async archive(id: string): Promise<Carrier> {
    return this.prisma.carrier.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }
}
