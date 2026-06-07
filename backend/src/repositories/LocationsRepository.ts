import { PrismaClient, Location } from '@prisma/client';

export interface CreateLocationDTO {
  /** Multi-tenancy scope. Optional during phase-3 transition; tightens
   *  to required in the NOT NULL migration. */
  orgId?: string | null;
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  lat?: number;
  lng?: number;
  locationType?: string;
  facilityCapabilities?: Record<string, boolean>;
  operatingHours?: Record<string, { open: string; close: string }>;
  appointmentRequired?: boolean;
  dockCount?: number;
  maxTrailerLengthFt?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
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
  locationType?: string;
  facilityCapabilities?: Record<string, boolean>;
  operatingHours?: Record<string, { open: string; close: string }>;
  appointmentRequired?: boolean;
  dockCount?: number;
  maxTrailerLengthFt?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}

export interface ILocationsRepository {
  all(orgId?: string | null): Promise<Location[]>;
  findById(id: string, orgId?: string | null): Promise<Location | null>;
  findByIdUnique(id: string, orgId?: string | null): Promise<Location | null>;
  search(query: string, orgId?: string | null): Promise<Location[]>;
  create(data: CreateLocationDTO): Promise<Location>;
  update(id: string, data: UpdateLocationDTO): Promise<Location>;
  archive(id: string): Promise<Location>;
  findMany(orgId?: string | null): Promise<Location[]>;
  findManyByIds(ids: string[], orgId?: string | null): Promise<Location[]>;
  createMany(data: CreateLocationDTO[]): Promise<void>;
  deleteMany(): Promise<void>;
}

export class LocationsRepository implements ILocationsRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId?: string | null): Promise<Location[]> {
    const where: any = { archived: false };
    if (orgId) where.orgId = orgId;
    return this.prisma.location.findMany({
      where,
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string, orgId?: string | null): Promise<Location | null> {
    const where: any = { id, archived: false };
    if (orgId) where.orgId = orgId;
    return this.prisma.location.findFirst({ where });
  }

  async findByIdUnique(id: string, orgId?: string | null): Promise<Location | null> {
    // findUnique can't include orgId in the where (Prisma requires the
    // unique key). If a caller passes orgId we do a post-fetch guard so
    // the contract stays consistent across both find* methods.
    const row = await this.prisma.location.findUnique({ where: { id } });
    if (!row) return null;
    if (orgId && row.orgId && row.orgId !== orgId) return null;
    return row;
  }

  async search(query: string, orgId?: string | null): Promise<Location[]> {
    const searchTerm = query.trim().toLowerCase();
    const where: any = {
      archived: false,
      OR: [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } },
        { state: { contains: searchTerm, mode: 'insensitive' } },
        { country: { contains: searchTerm, mode: 'insensitive' } },
        { address1: { contains: searchTerm, mode: 'insensitive' } },
        { postalCode: { contains: searchTerm, mode: 'insensitive' } }
      ]
    };
    if (orgId) where.orgId = orgId;
    return this.prisma.location.findMany({
      where,
      orderBy: [
        { name: 'asc' },
        { city: 'asc' }
      ],
      take: 20
    });
  }

  async create(data: CreateLocationDTO): Promise<Location> {
    // Location.orgId is NOT NULL post phase-3 tightening; throw rather
    // than write a half-built row.
    if (!data.orgId) {
      throw new Error('orgId is required to create a Location (multi-tenancy)');
    }
    return this.prisma.location.create({
      data: { ...data, orgId: data.orgId }
    });
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

  async findMany(orgId?: string | null): Promise<Location[]> {
    const where: any = {};
    if (orgId) where.orgId = orgId;
    return this.prisma.location.findMany({ where });
  }

  async findManyByIds(ids: string[], orgId?: string | null): Promise<Location[]> {
    const where: any = {
      id: { in: ids },
      archived: false
    };
    if (orgId) where.orgId = orgId;
    return this.prisma.location.findMany({ where });
  }

  async createMany(data: CreateLocationDTO[]): Promise<void> {
    // Same NOT NULL guard as create() — every row must carry an orgId.
    for (const d of data) {
      if (!d.orgId) {
        throw new Error('orgId is required on every Location createMany entry (multi-tenancy)');
      }
    }
    await this.prisma.location.createMany({
      data: data.map(d => ({ ...d, orgId: d.orgId! })) as any
    });
  }

  async deleteMany(): Promise<void> {
    await this.prisma.location.deleteMany();
  }
}
