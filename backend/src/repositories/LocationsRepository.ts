import { PrismaClient, Location } from '@prisma/client';

export interface CreateLocationDTO {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
}

export interface UpdateLocationDTO {
  name?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface ILocationsRepository {
  all(): Promise<Location[]>;
  findById(id: string): Promise<Location | null>;
  findByIdUnique(id: string): Promise<Location | null>;
  search(query: string): Promise<Location[]>;
  create(data: CreateLocationDTO): Promise<Location>;
  update(id: string, data: UpdateLocationDTO): Promise<Location>;
  archive(id: string): Promise<Location>;
  findMany(): Promise<Location[]>;
  findManyByIds(ids: string[]): Promise<Location[]>;
  createMany(data: CreateLocationDTO[]): Promise<void>;
  deleteMany(): Promise<void>;
}

export class LocationsRepository implements ILocationsRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: { archived: false },
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string): Promise<Location | null> {
    return this.prisma.location.findFirst({
      where: { id, archived: false }
    });
  }

  async findByIdUnique(id: string): Promise<Location | null> {
    return this.prisma.location.findUnique({
      where: { id }
    });
  }

  async search(query: string): Promise<Location[]> {
    const searchTerm = query.trim().toLowerCase();

    return this.prisma.location.findMany({
      where: {
        archived: false,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { city: { contains: searchTerm, mode: 'insensitive' } },
          { state: { contains: searchTerm, mode: 'insensitive' } },
          { country: { contains: searchTerm, mode: 'insensitive' } },
          { address1: { contains: searchTerm, mode: 'insensitive' } },
          { postalCode: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      orderBy: [
        { name: 'asc' },
        { city: 'asc' }
      ],
      take: 20
    });
  }

  async create(data: CreateLocationDTO): Promise<Location> {
    return this.prisma.location.create({ data });
  }

  async update(id: string, data: UpdateLocationDTO): Promise<Location> {
    return this.prisma.location.update({
      where: { id },
      data
    });
  }

  async archive(id: string): Promise<Location> {
    return this.prisma.location.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }

  async findMany(): Promise<Location[]> {
    return this.prisma.location.findMany();
  }

  async findManyByIds(ids: string[]): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: {
        id: { in: ids },
        archived: false
      }
    });
  }

  async createMany(data: CreateLocationDTO[]): Promise<void> {
    await this.prisma.location.createMany({ data });
  }

  async deleteMany(): Promise<void> {
    await this.prisma.location.deleteMany();
  }
}
