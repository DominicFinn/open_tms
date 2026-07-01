import { PrismaClient, Carrier } from '@prisma/client';

export interface CreateCarrierDTO {
  /** Multi-tenancy scope. Required post phase-2 tightening. */
  orgId: string;
  name: string;
  mcNumber?: string;
  dotNumber?: string;
  scacCode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  validationTier?: string;
  registrationChecked?: boolean;
  insuranceDocReceived?: boolean;
  insuranceVerified?: boolean;
  identityConfirmed?: boolean;
  complianceChecked?: boolean;
  validationNotes?: string;
  validatedAt?: string;
  validatedBy?: string;
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
  validationTier?: string;
  registrationChecked?: boolean;
  insuranceDocReceived?: boolean;
  insuranceVerified?: boolean;
  identityConfirmed?: boolean;
  complianceChecked?: boolean;
  validationNotes?: string;
  validatedAt?: string;
  validatedBy?: string;
}

export interface ICarriersRepository {
  all(orgId?: string | null, opts?: { includeArchived?: boolean }): Promise<Carrier[]>;
  findById(id: string, orgId?: string | null): Promise<Carrier | null>;
  create(data: CreateCarrierDTO): Promise<Carrier>;
  update(id: string, data: UpdateCarrierDTO): Promise<Carrier>;
  archive(id: string): Promise<Carrier>;
}

export class CarriersRepository implements ICarriersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId?: string | null, opts?: { includeArchived?: boolean }): Promise<Carrier[]> {
    // Never surface soft-deleted carriers. Archived ones are excluded by default
    // (so selection dropdowns don't offer them) but can be included for the
    // management list where they show with an "Inactive" badge.
    const where: any = { deletedAt: null };
    if (!opts?.includeArchived) where.archived = false;
    // Scope to the requesting tenant when supplied. NULL orgId rows
    // are legacy and excluded from scoped queries.
    if (orgId) where.orgId = orgId;
    return this.prisma.carrier.findMany({
      where,
      orderBy: { name: 'asc' }
    });
  }

  async findById(id: string, orgId?: string | null): Promise<Carrier | null> {
    // Archived carriers are still reachable (detail page shows a banner);
    // soft-deleted carriers 404.
    const where: any = { id, deletedAt: null };
    if (orgId) where.orgId = orgId;
    return this.prisma.carrier.findFirst({ where });
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
