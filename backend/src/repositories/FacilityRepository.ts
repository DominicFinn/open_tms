/**
 * Facility reads (Phase 2a, #217).
 *
 * Module: wms. Facility is a small reference table, so list queries read it directly rather than
 * through a read model; there is nothing to denormalise and no join to avoid.
 */

import { PrismaClient, Facility } from '@prisma/client';

export interface FacilityListFilters {
  orgId: string;
  includeArchived?: boolean;
  page: number;
  perPage: number;
}

export interface IFacilityRepository {
  findMany(filters: FacilityListFilters): Promise<{ rows: Facility[]; total: number }>;
  findById(orgId: string, id: string): Promise<Facility | null>;
  findBySourceLocation(orgId: string, locationId: string): Promise<Facility | null>;
}

export class FacilityRepository implements IFacilityRepository {
  constructor(private prisma: PrismaClient) {}

  async findMany(filters: FacilityListFilters): Promise<{ rows: Facility[]; total: number }> {
    const where = {
      orgId: filters.orgId,
      ...(filters.includeArchived ? {} : { archived: false }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.facility.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      this.prisma.facility.count({ where }),
    ]);

    return { rows, total };
  }

  async findById(orgId: string, id: string): Promise<Facility | null> {
    return this.prisma.facility.findFirst({ where: { id, orgId } });
  }

  async findBySourceLocation(orgId: string, locationId: string): Promise<Facility | null> {
    return this.prisma.facility.findUnique({
      where: { orgId_sourceLocationId: { orgId, sourceLocationId: locationId } },
    });
  }
}
