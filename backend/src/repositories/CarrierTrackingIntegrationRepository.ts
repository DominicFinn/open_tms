import { Prisma, PrismaClient, CarrierTrackingIntegration, CarrierTrackingEvent } from '@prisma/client';
import { sealCredentials } from '../security/secretVault.js';

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
  carrier: { id: string; name: string; orgId: string };
};

/**
 * CarrierTrackingIntegration has no orgId of its own: it inherits its tenant through its carrier
 * (see tooling/tenancy/policy.ts), so every tenant read filters on `carrier.orgId`.
 */
export interface ICarrierTrackingIntegrationRepository {
  findAll(orgId: string, filters?: { providerType?: string; status?: string }): Promise<CarrierTrackingIntegrationWithCarrier[]>;
  findById(id: string, orgId: string): Promise<CarrierTrackingIntegrationWithCarrier | null>;
  findByCarrierId(carrierId: string, orgId: string): Promise<CarrierTrackingIntegrationWithCarrier | null>;
  /** Every tenant's due integrations, for the poll worker. Each row carries its carrier's orgId. */
  findActivePollingIntegrations(): Promise<CarrierTrackingIntegrationWithCarrier[]>;
  findRecentEvents(integrationId: string, orgId: string, take: number): Promise<CarrierTrackingEvent[]>;
  findEventsByShipment(shipmentId: string, orgId: string, take: number): Promise<CarrierTrackingEvent[]>;
  create(data: CreateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration>;
  update(id: string, orgId: string, data: UpdateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration>;
  delete(id: string, orgId: string): Promise<void>;
  incrementRateLimitCounter(id: string, orgId: string): Promise<void>;
  resetAllRateLimitCounters(): Promise<void>;
}

const integrationInclude = {
  carrier: { select: { id: true, name: true, orgId: true } },
};

export class CarrierTrackingIntegrationRepository implements ICarrierTrackingIntegrationRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(orgId: string, filters?: { providerType?: string; status?: string }): Promise<CarrierTrackingIntegrationWithCarrier[]> {
    const where: Prisma.CarrierTrackingIntegrationWhereInput = { carrier: { orgId } };
    if (filters?.providerType) where.providerType = filters.providerType;
    if (filters?.status) where.status = filters.status;

    return this.prisma.carrierTrackingIntegration.findMany({
      where,
      include: integrationInclude,
      orderBy: { createdAt: 'desc' },
    }) as Promise<CarrierTrackingIntegrationWithCarrier[]>;
  }

  async findById(id: string, orgId: string): Promise<CarrierTrackingIntegrationWithCarrier | null> {
    return this.prisma.carrierTrackingIntegration.findFirst({
      where: { id, carrier: { orgId } },
      include: integrationInclude,
    }) as Promise<CarrierTrackingIntegrationWithCarrier | null>;
  }

  async findByCarrierId(carrierId: string, orgId: string): Promise<CarrierTrackingIntegrationWithCarrier | null> {
    return this.prisma.carrierTrackingIntegration.findFirst({
      where: { carrierId, carrier: { orgId } },
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

  async findRecentEvents(integrationId: string, orgId: string, take: number): Promise<CarrierTrackingEvent[]> {
    return this.prisma.carrierTrackingEvent.findMany({
      where: { integrationId, shipment: { orgId } },
      orderBy: { occurredAt: 'desc' },
      take,
    });
  }

  async findEventsByShipment(shipmentId: string, orgId: string, take: number): Promise<CarrierTrackingEvent[]> {
    return this.prisma.carrierTrackingEvent.findMany({
      where: { shipmentId, shipment: { orgId } },
      orderBy: { occurredAt: 'desc' },
      take,
    });
  }

  async create(data: CreateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration> {
    return this.prisma.carrierTrackingIntegration.create({
      data: {
        carrierId: data.carrierId,
        providerType: data.providerType,
        status: data.status ?? 'pending_setup',
        credentials: (sealCredentials(data.credentials) as Prisma.InputJsonValue) ?? undefined,
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

  async update(id: string, orgId: string, data: UpdateCarrierTrackingIntegrationDTO): Promise<CarrierTrackingIntegration> {
    const dataToWrite: Record<string, unknown> = { ...data };
    if (data.credentials !== undefined) {
      dataToWrite.credentials = sealCredentials(data.credentials) ?? Prisma.JsonNull;
    }
    return this.prisma.carrierTrackingIntegration.update({
      where: { id, carrier: { orgId } },
      data: dataToWrite,
    });
  }

  async delete(id: string, orgId: string): Promise<void> {
    await this.prisma.carrierTrackingIntegration.delete({ where: { id, carrier: { orgId } } });
  }

  async incrementRateLimitCounter(id: string, orgId: string): Promise<void> {
    await this.prisma.carrierTrackingIntegration.update({
      where: { id, carrier: { orgId } },
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
