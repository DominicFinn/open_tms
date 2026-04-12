import { Prisma, PrismaClient, CarrierTrackingIntegration } from '@prisma/client';

export interface CreateCarrierTrackingIntegrationDTO {
  carrierId: string;
  providerType: string;
  status?: string;
  credentials?: Record<string, unknown>;
  webhookEnabled?: boolean;
  webhookSecret?: string;
  webhookEndpointId?: string;
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  rateLimitDailyMax?: number;
  notes?: string;
}

export interface UpdateCarrierTrackingIntegrationDTO {
  providerType?: string;
  status?: string;
  credentials?: Record<string, unknown>;
  webhookEnabled?: boolean;
  webhookSecret?: string;
  webhookEndpointId?: string;
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  rateLimitDailyMax?: number;
  lastErrorMessage?: string | null;
  lastErrorAt?: Date | null;
  notes?: string;
}

export type CarrierTrackingIntegrationWithCarrier = CarrierTrackingIntegration & {
  carrier: { id: string; name: string };
};

export interface ICarrierTrackingIntegrationRepository {
  findAll(filters?: { providerType?: string; status?: string }): Promise<CarrierTrackingIntegrationWithCarrier[]>;
  findById(id: string): Promise<CarrierTrackingIntegrationWithCarrier | null>;
  findByCarrierId(carrierId: string): Promise<CarrierTrackingIntegrationWithCarrier | null>;
  findActivePollingIntegrations(): Promise<CarrierTrackingIntegrationWithCarrier[]>;
  create(data: CreateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration>;
  update(id: string, data: UpdateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration>;
  delete(id: string): Promise<void>;
  incrementRateLimitCounter(id: string): Promise<void>;
  resetAllRateLimitCounters(): Promise<void>;
}

const integrationInclude = {
  carrier: { select: { id: true, name: true } },
};

export class CarrierTrackingIntegrationRepository implements ICarrierTrackingIntegrationRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(filters?: { providerType?: string; status?: string }): Promise<CarrierTrackingIntegrationWithCarrier[]> {
    const where: Record<string, unknown> = {};
    if (filters?.providerType) where.providerType = filters.providerType;
    if (filters?.status) where.status = filters.status;

    return this.prisma.carrierTrackingIntegration.findMany({
      where,
      include: integrationInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<CarrierTrackingIntegrationWithCarrier[]>;
  }

  async findById(id: string): Promise<CarrierTrackingIntegrationWithCarrier | null> {
    return this.prisma.carrierTrackingIntegration.findUnique({
      where: { id },
      include: integrationInclude,
    }) as Promise<CarrierTrackingIntegrationWithCarrier | null>;
  }

  async findByCarrierId(carrierId: string): Promise<CarrierTrackingIntegrationWithCarrier | null> {
    return this.prisma.carrierTrackingIntegration.findFirst({
      where: { carrierId },
      include: integrationInclude,
    }) as Promise<CarrierTrackingIntegrationWithCarrier | null>;
  }

  async findActivePollingIntegrations(): Promise<CarrierTrackingIntegrationWithCarrier[]> {
    return this.prisma.carrierTrackingIntegration.findMany({
      where: {
        pollingEnabled: true,
        status: 'active',
      },
      include: integrationInclude,
      orderBy: { lastPolledAt: 'asc' },
    }) as Promise<CarrierTrackingIntegrationWithCarrier[]>;
  }

  async create(data: CreateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration> {
    return this.prisma.carrierTrackingIntegration.create({
      data: {
        carrierId: data.carrierId,
        providerType: data.providerType,
        status: data.status ?? 'pending_setup',
        credentials: data.credentials ? (data.credentials as Prisma.InputJsonValue) : undefined,
        webhookEnabled: data.webhookEnabled ?? false,
        webhookSecret: data.webhookSecret ?? undefined,
        webhookEndpointId: data.webhookEndpointId ?? undefined,
        pollingEnabled: data.pollingEnabled ?? false,
        pollingIntervalSeconds: data.pollingIntervalSeconds ?? 900,
        rateLimitDailyMax: data.rateLimitDailyMax ?? undefined,
        notes: data.notes ?? undefined,
      },
    });
  }

  async update(id: string, data: UpdateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration> {
    return this.prisma.carrierTrackingIntegration.update({
      where: { id },
      data: data as Record<string, unknown>,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.carrierTrackingIntegration.delete({ where: { id } });
  }

  async incrementRateLimitCounter(id: string): Promise<void> {
    await this.prisma.carrierTrackingIntegration.update({
      where: { id },
      data: { rateLimitCallsToday: { increment: 1 } },
    });
  }

  async resetAllRateLimitCounters(): Promise<void> {
    await this.prisma.carrierTrackingIntegration.updateMany({
      data: {
        rateLimitCallsToday: 0,
        rateLimitResetAt: new Date(),
      },
    });
  }
}
