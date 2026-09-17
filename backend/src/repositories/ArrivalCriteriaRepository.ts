import { PrismaClient, ArrivalCriteria } from '@prisma/client';

export interface CreateArrivalCriteriaDTO {
  locationId: string;
  criteriaType: 'geofence' | 'wifi' | 'ble';
  radiusMeters?: number;
  lat?: number;
  lng?: number;
  wifiSsid?: string;
  wifiBssid?: string;
  bleUuid?: string;
  bleMajor?: number;
  bleMinor?: number;
  bleRssiThreshold?: number;
  bleAnchorId?: string;
  bleReaderLocation?: string;
  name?: string;
  priority?: number;
}

export interface UpdateArrivalCriteriaDTO {
  criteriaType?: 'geofence' | 'wifi' | 'ble';
  radiusMeters?: number | null;
  lat?: number | null;
  lng?: number | null;
  wifiSsid?: string | null;
  wifiBssid?: string | null;
  bleUuid?: string | null;
  bleMajor?: number | null;
  bleMinor?: number | null;
  bleRssiThreshold?: number | null;
  bleAnchorId?: string | null;
  bleReaderLocation?: string | null;
  name?: string | null;
  active?: boolean;
  priority?: number;
}

export interface IArrivalCriteriaRepository {
  findByLocationId(locationId: string, orgId: string): Promise<ArrivalCriteria[]>;
  findById(id: string, orgId: string): Promise<ArrivalCriteria | null>;
  create(data: CreateArrivalCriteriaDTO): Promise<ArrivalCriteria>;
  update(id: string, orgId: string, data: UpdateArrivalCriteriaDTO): Promise<ArrivalCriteria>;
  delete(id: string, orgId: string): Promise<void>;
  createDefaultGeofence(locationId: string, radiusMeters: number, lat?: number, lng?: number): Promise<ArrivalCriteria>;
}

export class ArrivalCriteriaRepository implements IArrivalCriteriaRepository {
  constructor(private prisma: PrismaClient) {}

  async findByLocationId(locationId: string, orgId: string): Promise<ArrivalCriteria[]> {
    return this.prisma.arrivalCriteria.findMany({
      where: { locationId, location: { orgId }, active: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string, orgId: string): Promise<ArrivalCriteria | null> {
    return this.prisma.arrivalCriteria.findUnique({ where: { id, location: { orgId } } });
  }

  async create(data: CreateArrivalCriteriaDTO): Promise<ArrivalCriteria> {
    return this.prisma.arrivalCriteria.create({ data });
  }

  async update(id: string, orgId: string, data: UpdateArrivalCriteriaDTO): Promise<ArrivalCriteria> {
    return this.prisma.arrivalCriteria.update({ where: { id, location: { orgId } }, data });
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.prisma.arrivalCriteria.delete({ where: { id, location: { orgId } } });
  }

  async createDefaultGeofence(locationId: string, radiusMeters: number, lat?: number, lng?: number): Promise<ArrivalCriteria> {
    return this.prisma.arrivalCriteria.create({
      data: {
        locationId,
        criteriaType: 'geofence',
        radiusMeters,
        lat,
        lng,
        name: 'Default geofence',
        active: true,
        priority: 0,
      },
    });
  }
}
