import { PrismaClient, ShipmentType } from '@prisma/client';

export interface CreateShipmentTypeDTO {
  orgId: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  defaults?: Record<string, unknown>;
  requiredFields?: string[];
  isBuiltIn?: boolean;
}

export interface UpdateShipmentTypeDTO {
  name?: string;
  icon?: string;
  color?: string;
  description?: string | null;
  defaults?: Record<string, unknown>;
  requiredFields?: string[];
}

// Shipment types are per tenant, built-ins included: each org gets its own copy so that one
// tenant editing a preset never changes another's.
export interface IShipmentTypesRepository {
  all(orgId: string): Promise<ShipmentType[]>;
  findById(id: string, orgId: string): Promise<ShipmentType | null>;
  findByName(name: string, orgId: string): Promise<ShipmentType | null>;
  create(data: CreateShipmentTypeDTO): Promise<ShipmentType>;
  update(id: string, orgId: string, data: UpdateShipmentTypeDTO): Promise<ShipmentType | null>;
  archive(id: string, orgId: string): Promise<ShipmentType | null>;
}

export class ShipmentTypesRepository implements IShipmentTypesRepository {
  constructor(private prisma: PrismaClient) {}

  async all(orgId: string): Promise<ShipmentType[]> {
    return this.prisma.shipmentType.findMany({
      where: { orgId, archived: false },
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(id: string, orgId: string): Promise<ShipmentType | null> {
    return this.prisma.shipmentType.findFirst({ where: { id, orgId, archived: false } });
  }

  async findByName(name: string, orgId: string): Promise<ShipmentType | null> {
    return this.prisma.shipmentType.findFirst({ where: { name, orgId, archived: false } });
  }

  async create(data: CreateShipmentTypeDTO): Promise<ShipmentType> {
    return this.prisma.shipmentType.create({
      data: {
        orgId: data.orgId,
        name: data.name,
        icon: data.icon ?? 'local_shipping',
        color: data.color ?? '#6366F1',
        description: data.description,
        defaults: (data.defaults ?? {}) as any,
        requiredFields: data.requiredFields ?? [],
        isBuiltIn: data.isBuiltIn ?? false,
      },
    });
  }

  async update(id: string, orgId: string, data: UpdateShipmentTypeDTO): Promise<ShipmentType | null> {
    if (!(await this.findById(id, orgId))) return null;
    return this.prisma.shipmentType.update({
      where: { id, orgId },
      data: {
        name: data.name,
        icon: data.icon,
        color: data.color,
        description: data.description,
        defaults: data.defaults as any,
        requiredFields: data.requiredFields,
      },
    });
  }

  async archive(id: string, orgId: string): Promise<ShipmentType | null> {
    if (!(await this.findById(id, orgId))) return null;
    return this.prisma.shipmentType.update({
      where: { id, orgId },
      data: { archived: true, archivedAt: new Date() },
    });
  }
}
