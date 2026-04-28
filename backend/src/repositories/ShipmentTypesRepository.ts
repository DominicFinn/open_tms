import { PrismaClient, ShipmentType } from '@prisma/client';

export interface CreateShipmentTypeDTO {
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

export interface IShipmentTypesRepository {
  all(): Promise<ShipmentType[]>;
  findById(id: string): Promise<ShipmentType | null>;
  findByName(name: string): Promise<ShipmentType | null>;
  create(data: CreateShipmentTypeDTO): Promise<ShipmentType>;
  update(id: string, data: UpdateShipmentTypeDTO): Promise<ShipmentType>;
  archive(id: string): Promise<ShipmentType>;
}

export class ShipmentTypesRepository implements IShipmentTypesRepository {
  constructor(private prisma: PrismaClient) {}

  async all(): Promise<ShipmentType[]> {
    return this.prisma.shipmentType.findMany({
      where: { archived: false },
      orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(id: string): Promise<ShipmentType | null> {
    return this.prisma.shipmentType.findFirst({ where: { id, archived: false } });
  }

  async findByName(name: string): Promise<ShipmentType | null> {
    return this.prisma.shipmentType.findFirst({ where: { name, archived: false } });
  }

  async create(data: CreateShipmentTypeDTO): Promise<ShipmentType> {
    return this.prisma.shipmentType.create({
      data: {
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

  async update(id: string, data: UpdateShipmentTypeDTO): Promise<ShipmentType> {
    return this.prisma.shipmentType.update({
      where: { id },
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

  async archive(id: string): Promise<ShipmentType> {
    return this.prisma.shipmentType.update({
      where: { id },
      data: { archived: true, archivedAt: new Date() },
    });
  }
}
