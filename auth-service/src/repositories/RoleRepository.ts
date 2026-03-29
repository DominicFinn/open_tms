import { PrismaClient, Role } from '@prisma/client';

export interface CreateRoleDTO {
  name: string;
  description?: string;
  permissions: string[];
  isSystem?: boolean;
}

export interface UpdateRoleDTO {
  description?: string;
  permissions?: string[];
}

export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  all(): Promise<Role[]>;
  create(data: CreateRoleDTO): Promise<Role>;
  update(id: string, data: UpdateRoleDTO): Promise<Role>;
  delete(id: string): Promise<void>;
  assignToUser(userId: string, roleId: string): Promise<void>;
  removeFromUser(userId: string, roleId: string): Promise<void>;
  seedDefaults(): Promise<void>;
}

const DEFAULT_ROLES: CreateRoleDTO[] = [
  {
    name: 'admin',
    description: 'Full system access',
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: 'dispatcher',
    description: 'Manage shipments, orders, and carrier assignments',
    permissions: [
      'shipments:*', 'orders:*', 'carriers:read', 'lanes:read',
      'locations:read', 'customers:read', 'integrations:read',
    ],
    isSystem: true,
  },
  {
    name: 'warehouse',
    description: 'Manage orders and inventory at warehouse level',
    permissions: [
      'orders:read', 'orders:update', 'shipments:read',
      'locations:read', 'customers:read',
    ],
    isSystem: true,
  },
  {
    name: 'readonly',
    description: 'View-only access to all data',
    permissions: [
      'shipments:read', 'orders:read', 'carriers:read', 'lanes:read',
      'locations:read', 'customers:read', 'integrations:read',
    ],
    isSystem: true,
  },
  {
    name: 'customer',
    description: 'Customer portal access — view own shipments and orders',
    permissions: [
      'orders:read:own', 'shipments:read:own', 'documents:read:own',
    ],
    isSystem: true,
  },
];

export class RoleRepository implements IRoleRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.role.findUnique({ where: { id } });
  }

  async findByName(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }

  async all() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  async create(data: CreateRoleDTO) {
    return this.prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        isSystem: data.isSystem ?? false,
      },
    });
  }

  async update(id: string, data: UpdateRoleDTO) {
    return this.prisma.role.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.prisma.role.delete({ where: { id } });
  }

  async assignToUser(userId: string, roleId: string) {
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
  }

  async removeFromUser(userId: string, roleId: string) {
    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  async seedDefaults() {
    for (const role of DEFAULT_ROLES) {
      await this.prisma.role.upsert({
        where: { name: role.name },
        create: {
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: role.isSystem ?? false,
        },
        update: {},
      });
    }
  }
}
