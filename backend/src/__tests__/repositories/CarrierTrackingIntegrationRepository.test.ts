import { CarrierTrackingIntegrationRepository } from '../../repositories/CarrierTrackingIntegrationRepository';

function buildPrisma() {
  return {
    carrierTrackingIntegration: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn(),
    },
  } as any;
}

describe('CarrierTrackingIntegrationRepository', () => {
  describe('create', () => {
    it('applies sensible defaults: pending_setup status, polling disabled, 15-min interval', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierTrackingIntegrationRepository(prisma);

      await repo.create({ carrierId: 'car-1', providerType: 'fedex' });

      const data = prisma.carrierTrackingIntegration.create.mock.calls[0][0].data;
      expect(data.status).toBe('pending_setup');
      expect(data.webhookEnabled).toBe(false);
      expect(data.pollingEnabled).toBe(false);
      expect(data.pollingIntervalSeconds).toBe(900);
    });

    it('persists explicit overrides', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierTrackingIntegrationRepository(prisma);

      await repo.create({
        carrierId: 'car-1',
        providerType: 'ups',
        status: 'active',
        pollingEnabled: true,
        pollingIntervalSeconds: 300,
        webhookEnabled: true,
        webhookSecret: 'whsec_x',
      });

      const data = prisma.carrierTrackingIntegration.create.mock.calls[0][0].data;
      expect(data.status).toBe('active');
      expect(data.pollingEnabled).toBe(true);
      expect(data.pollingIntervalSeconds).toBe(300);
      expect(data.webhookEnabled).toBe(true);
      expect(data.webhookSecret).toBe('whsec_x');
    });
  });

  describe('findAll', () => {
    it('translates filters and orders by createdAt desc', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierTrackingIntegrationRepository(prisma);

      await repo.findAll({ providerType: 'fedex', status: 'active' });

      const args = prisma.carrierTrackingIntegration.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ providerType: 'fedex', status: 'active' });
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('returns all rows when no filters supplied', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierTrackingIntegrationRepository(prisma);

      await repo.findAll();

      expect(prisma.carrierTrackingIntegration.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('findActivePollingIntegrations', () => {
    it('only matches rows with pollingEnabled=true and status=active', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierTrackingIntegrationRepository(prisma);

      await repo.findActivePollingIntegrations();

      const args = prisma.carrierTrackingIntegration.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ pollingEnabled: true, status: 'active' });
      // lastPolledAt asc means least-recently-polled gets handled first,
      // which is what the worker expects.
      expect(args.orderBy).toEqual({ lastPolledAt: 'asc' });
    });
  });

  describe('incrementRateLimitCounter', () => {
    it('uses Prisma `increment` rather than read-modify-write', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierTrackingIntegrationRepository(prisma);

      await repo.incrementRateLimitCounter('int-1');

      expect(prisma.carrierTrackingIntegration.update).toHaveBeenCalledWith({
        where: { id: 'int-1' },
        data: { rateLimitCallsToday: { increment: 1 } },
      });
    });
  });

  describe('resetAllRateLimitCounters', () => {
    it('zeroes the daily counter and stamps the reset time on every row', async () => {
      const prisma = buildPrisma();
      const repo = new CarrierTrackingIntegrationRepository(prisma);

      await repo.resetAllRateLimitCounters();

      const args = prisma.carrierTrackingIntegration.updateMany.mock.calls[0][0];
      expect(args.data.rateLimitCallsToday).toBe(0);
      expect(args.data.rateLimitResetAt).toBeInstanceOf(Date);
    });
  });
});
