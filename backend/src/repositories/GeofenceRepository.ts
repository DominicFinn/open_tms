import { PrismaClient, Geofence, Prisma } from '@prisma/client';

export interface RadialGeometry {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

export interface PolygonGeometry {
  points: { lat: number; lng: number }[];
}

export interface CreateGeofenceDTO {
  orgId: string;
  entityType: string;
  entityId: string;
  name?: string;
  shapeType: 'radial' | 'polygon';
  geometry: RadialGeometry | PolygonGeometry;
}

export interface UpdateGeofenceDTO {
  name?: string;
  shapeType?: 'radial' | 'polygon';
  geometry?: RadialGeometry | PolygonGeometry;
}

export interface IGeofenceRepository {
  findByEntity(entityType: string, entityId: string, orgId: string): Promise<Geofence[]>;
  findByEntities(entityType: string, entityIds: string[], orgId: string): Promise<Geofence[]>;
  findById(id: string, orgId: string): Promise<Geofence | null>;
  create(data: CreateGeofenceDTO): Promise<Geofence>;
  update(id: string, data: UpdateGeofenceDTO): Promise<Geofence>;
  archive(id: string): Promise<Geofence>;
}

export class GeofenceRepository implements IGeofenceRepository {
  constructor(private prisma: PrismaClient) {}

  async findByEntity(entityType: string, entityId: string, orgId: string): Promise<Geofence[]> {
    return this.prisma.geofence.findMany({
      where: { entityType, entityId, orgId, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Batch lookup for list/search endpoints that embed geofences on each entity in one query. */
  async findByEntities(entityType: string, entityIds: string[], orgId: string): Promise<Geofence[]> {
    if (entityIds.length === 0) return [];
    return this.prisma.geofence.findMany({
      where: { entityType, entityId: { in: entityIds }, orgId, active: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string, orgId: string): Promise<Geofence | null> {
    return this.prisma.geofence.findFirst({ where: { id, orgId } });
  }

  async create(data: CreateGeofenceDTO): Promise<Geofence> {
    return this.prisma.geofence.create({
      data: {
        orgId: data.orgId,
        entityType: data.entityType,
        entityId: data.entityId,
        name: data.name,
        shapeType: data.shapeType,
        geometry: data.geometry as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(id: string, data: UpdateGeofenceDTO): Promise<Geofence> {
    return this.prisma.geofence.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.shapeType !== undefined ? { shapeType: data.shapeType } : {}),
        ...(data.geometry !== undefined
          ? { geometry: data.geometry as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async archive(id: string): Promise<Geofence> {
    return this.prisma.geofence.update({
      where: { id },
      data: { active: false, archivedAt: new Date() },
    });
  }
}
