import { PrismaClient, AuthProvider } from '@prisma/client';

export interface CreateAuthProviderDTO {
  provider: string;
  displayName: string;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  allowedDomains?: string[];
  autoCreateUsers?: boolean;
  defaultRoleId?: string;
}

export interface UpdateAuthProviderDTO {
  displayName?: string;
  enabled?: boolean;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  allowedDomains?: string[];
  autoCreateUsers?: boolean;
  defaultRoleId?: string;
}

export interface IAuthProviderRepository {
  findById(id: string): Promise<AuthProvider | null>;
  findByProvider(provider: string): Promise<AuthProvider | null>;
  all(): Promise<AuthProvider[]>;
  allEnabled(): Promise<AuthProvider[]>;
  create(data: CreateAuthProviderDTO): Promise<AuthProvider>;
  update(id: string, data: UpdateAuthProviderDTO): Promise<AuthProvider>;
  delete(id: string): Promise<void>;
  seedDefaults(): Promise<void>;
}

export class AuthProviderRepository implements IAuthProviderRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.authProvider.findUnique({ where: { id } });
  }

  async findByProvider(provider: string) {
    return this.prisma.authProvider.findUnique({ where: { provider } });
  }

  async all() {
    return this.prisma.authProvider.findMany({ orderBy: { provider: 'asc' } });
  }

  async allEnabled() {
    return this.prisma.authProvider.findMany({
      where: { enabled: true },
      orderBy: { provider: 'asc' },
    });
  }

  async create(data: CreateAuthProviderDTO) {
    return this.prisma.authProvider.create({ data });
  }

  async update(id: string, data: UpdateAuthProviderDTO) {
    return this.prisma.authProvider.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.prisma.authProvider.delete({ where: { id } });
  }

  async seedDefaults() {
    const defaults = [
      { provider: 'google', displayName: 'Google' },
      { provider: 'microsoft', displayName: 'Microsoft' },
    ];

    for (const def of defaults) {
      await this.prisma.authProvider.upsert({
        where: { provider: def.provider },
        create: { provider: def.provider, displayName: def.displayName, enabled: false },
        update: {},
      });
    }
  }
}
