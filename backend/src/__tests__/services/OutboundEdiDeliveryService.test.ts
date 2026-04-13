import { OutboundEdiDeliveryService } from '../../services/OutboundEdiDeliveryService';
import { ITradingPartnerRepository, TradingPartnerWithTransactions } from '../../repositories/TradingPartnerRepository';

// Mock partner repository
function createMockRepo(partner: TradingPartnerWithTransactions | null = null): ITradingPartnerRepository {
  const logs: any[] = [];
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(partner),
    findAll: jest.fn().mockResolvedValue(partner ? [partner] : []),
    findByCarrierId: jest.fn().mockResolvedValue(partner),
    findByCustomerId: jest.fn().mockResolvedValue(partner),
    findInboundPartners: jest.fn().mockResolvedValue([]),
    findOutboundPartnersByTransaction: jest.fn().mockResolvedValue(partner ? [partner] : []),
    update: jest.fn(),
    updateLastPolled: jest.fn(),
    addTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    removeTransaction: jest.fn(),
    createLog: jest.fn().mockImplementation(async (data: any) => {
      const log = { id: 'log-' + logs.length, ...data };
      logs.push(log);
      return log;
    }),
    findLogById: jest.fn(),
    findLogs: jest.fn().mockResolvedValue([]),
    findLogsWithPagination: jest.fn().mockResolvedValue({ logs: [], total: 0 }),
    getLogStats: jest.fn(),
    updateLog: jest.fn(),
  } as any;
}

function makePartner(overrides: Partial<TradingPartnerWithTransactions> = {}): TradingPartnerWithTransactions {
  return {
    id: 'partner-001',
    name: 'Test Partner',
    active: true,
    entityType: 'carrier',
    customerId: null,
    carrierId: 'carrier-001',
    sftpHost: 'sftp.example.com',
    sftpPort: 22,
    sftpUsername: 'user',
    sftpPassword: 'pass',
    sftpPrivateKey: null,
    httpUrl: null,
    httpAuthType: null,
    httpAuthHeader: null,
    httpAuthValue: null,
    senderId: 'PARTNER',
    receiverId: 'OPENTMS',
    ediVersion: '00401',
    inboundEnabled: false,
    inboundDir: '/',
    inboundFilePattern: '*.edi',
    pollingInterval: 900,
    pollingCron: null,
    lastPolledAt: null,
    outboundEnabled: true,
    outboundDir: '/outbound',
    outboundTransport: 'sftp',
    outboundFileNaming: 'reference',
    migratedFromEdiPartnerId: null,
    migratedFromOutboundIntegrationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    transactions: [
      { id: 'txn-001', partnerId: 'partner-001', transactionType: '204', direction: 'outbound', enabled: true, fieldMapping: null, autoProcess: true, ack997Required: false, filePattern: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'txn-002', partnerId: 'partner-001', transactionType: '214', direction: 'outbound', enabled: true, fieldMapping: null, autoProcess: true, ack997Required: true, filePattern: null, createdAt: new Date(), updatedAt: new Date() },
    ],
    ...overrides,
  } as any;
}

describe('OutboundEdiDeliveryService', () => {
  it('returns error when partner not found', async () => {
    const repo = createMockRepo(null);
    const service = new OutboundEdiDeliveryService(repo);

    const result = await service.deliver({
      partnerId: 'nonexistent',
      transactionType: '204',
      ediContent: 'ISA*...',
      referenceId: 'REF-001',
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('not found');
  });

  it('returns error when outbound not enabled', async () => {
    const partner = makePartner({ outboundEnabled: false });
    const repo = createMockRepo(partner);
    const service = new OutboundEdiDeliveryService(repo);

    const result = await service.deliver({
      partnerId: partner.id,
      transactionType: '204',
      ediContent: 'ISA*...',
      referenceId: 'REF-001',
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('not enabled');
  });

  it('returns error when transaction type not supported', async () => {
    const partner = makePartner(); // has 204 and 214 outbound
    const repo = createMockRepo(partner);
    const service = new OutboundEdiDeliveryService(repo);

    const result = await service.deliver({
      partnerId: partner.id,
      transactionType: '810', // not in partner transactions
      ediContent: 'ISA*...',
      referenceId: 'REF-001',
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('does not support outbound 810');
  });

  it('creates a log entry before delivery', async () => {
    const partner = makePartner();
    const repo = createMockRepo(partner);
    const service = new OutboundEdiDeliveryService(repo);

    // Will fail on SFTP since there's no real server, but log should be created
    await service.deliver({
      partnerId: partner.id,
      transactionType: '204',
      ediContent: 'ISA*test content',
      referenceId: 'REF-001',
      shipmentId: 'ship-001',
    });

    expect(repo.createLog).toHaveBeenCalledWith(expect.objectContaining({
      partnerId: partner.id,
      transactionType: '204',
      direction: 'outbound',
      shipmentReference: 'REF-001',
      shipmentId: 'ship-001',
    }));
  });

  it('updates log after delivery attempt', async () => {
    const partner = makePartner();
    const repo = createMockRepo(partner);
    const service = new OutboundEdiDeliveryService(repo);

    await service.deliver({
      partnerId: partner.id,
      transactionType: '204',
      ediContent: 'ISA*test',
      referenceId: 'REF-001',
    });

    expect(repo.updateLog).toHaveBeenCalled();
  });

  describe('deliverToCarrier', () => {
    it('finds partner by carrierId and delivers', async () => {
      const partner = makePartner();
      const repo = createMockRepo(partner);
      (repo.findByCarrierId as jest.Mock).mockResolvedValue(partner);
      const service = new OutboundEdiDeliveryService(repo);

      // Will still fail on SFTP, but should attempt delivery
      await service.deliverToCarrier(
        'carrier-001', '204', 'ISA*test', 'REF-001', { shipmentId: 'ship-001' }
      );

      expect(repo.findByCarrierId).toHaveBeenCalledWith('carrier-001');
    });

    it('returns null when no partner found for carrier', async () => {
      const repo = createMockRepo(null);
      (repo.findByCarrierId as jest.Mock).mockResolvedValue(null);
      const service = new OutboundEdiDeliveryService(repo);

      const result = await service.deliverToCarrier(
        'nonexistent-carrier', '204', 'ISA*test', 'REF-001'
      );

      expect(result).toBeNull();
    });

    it('returns null when partner exists but outbound disabled', async () => {
      const partner = makePartner({ outboundEnabled: false });
      const repo = createMockRepo(partner);
      (repo.findByCarrierId as jest.Mock).mockResolvedValue(partner);
      const service = new OutboundEdiDeliveryService(repo);

      const result = await service.deliverToCarrier(
        'carrier-001', '204', 'ISA*test', 'REF-001'
      );

      expect(result).toBeNull();
    });
  });
});
