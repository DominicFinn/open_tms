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
  all(orgId: string, opts?: { includeArchived?: boolean }): Promise<Carrier[]>;
  // Mirrors OrdersRepository.findArchived / ShipmentsRepository — backs the
  // Archives admin page's Carriers tab.
  findArchived(orgId: string): Promise<Carrier[]>;
  findById(id: string, orgId: string): Promise<Carrier | null>;
  create(data: CreateCarrierDTO): Promise<Carrier>;
  update(id: string, orgId: string, data: UpdateCarrierDTO): Promise<Carrier>;
  archive(id: string, orgId: string): Promise<Carrier>;
}

export class CarriersRepository implements ICarriersRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId: string, opts?: { includeArchived?: boolean }): Promise<Carrier[]> {
    // Never surface soft-deleted carriers. Archived ones are excluded by default
    // (so selection dropdowns don't offer them) but can be included for the
    // management list where they show with an "Inactive" badge.
    const where: any = { deletedAt: null, orgId };
    if (!opts?.includeArchived) where.archived = false;
    return this.prisma.carrier.findMany({
      where,
      orderBy: { name: 'asc' }
    });
  }

  async findArchived(orgId: string): Promise<Carrier[]> {
    const where: any = { archived: true, deletedAt: null, orgId };
    return this.prisma.carrier.findMany({
      where,
      orderBy: { archivedAt: 'desc' },
    });
  }

  async findById(id: string, orgId: string): Promise<Carrier | null> {
    // Archived carriers are still reachable (detail page shows a banner);
    // soft-deleted carriers 404.
    const where: any = { id, deletedAt: null, orgId };
    return this.prisma.carrier.findFirst({ where });
  }

  async create(data: CreateCarrierDTO): Promise<Carrier> {
    return this.prisma.carrier.create({ data });
  }

  async update(id: string, orgId: string, data: UpdateCarrierDTO): Promise<Carrier> {
    return this.prisma.carrier.update({
      where: { id, orgId },
      data
    });
  }

  async archive(id: string, orgId: string): Promise<Carrier> {
    return this.prisma.carrier.update({
      where: { id, orgId },
      data: {
        archived: true,
        archivedAt: new Date()
      }
    });
  }
}
