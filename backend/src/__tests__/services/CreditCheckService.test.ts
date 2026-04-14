import { CreditCheckService } from '../../services/CreditCheckService';

function buildMockPrisma(overrides: any = {}) {
  return {
    customer: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'cust-1',
        name: 'Test Customer',
        creditLimitCents: 1000000, // $10,000
        ...overrides.customer,
      }),
    },
    invoice: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { totalCents: overrides.outstandingCents ?? 500000 }, // $5,000
      }),
    },
  } as any;
}

describe('CreditCheckService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('passes when outstanding + additional is within limit', async () => {
    const prisma = buildMockPrisma();
    const service = new CreditCheckService(prisma);

    const result = await service.checkCredit('cust-1', 200000); // $2,000 additional

    expect(result.passed).toBe(true);
    expect(result.creditLimitCents).toBe(1000000);
    expect(result.outstandingBalanceCents).toBe(500000);
    expect(result.availableCreditCents).toBe(500000);
  });

  it('fails when outstanding + additional exceeds limit', async () => {
    const prisma = buildMockPrisma();
    const service = new CreditCheckService(prisma);

    const result = await service.checkCredit('cust-1', 600000); // $6,000 additional, total $11,000

    expect(result.passed).toBe(false);
    expect(result.reason).toContain('exceeds credit limit');
  });

  it('always passes when credit limit is null (unlimited)', async () => {
    const prisma = buildMockPrisma({
      customer: { id: 'cust-1', name: 'VIP Customer', creditLimitCents: null },
    });
    const service = new CreditCheckService(prisma);

    const result = await service.checkCredit('cust-1', 99999999);

    expect(result.passed).toBe(true);
    expect(result.creditLimitCents).toBeNull();
    expect(result.availableCreditCents).toBeNull();
  });

  it('passes with exact limit amount', async () => {
    const prisma = buildMockPrisma({ outstandingCents: 800000 });
    const service = new CreditCheckService(prisma);

    const result = await service.checkCredit('cust-1', 200000); // exactly at limit

    expect(result.passed).toBe(true);
  });

  it('fails at one cent over limit', async () => {
    const prisma = buildMockPrisma({ outstandingCents: 800000 });
    const service = new CreditCheckService(prisma);

    const result = await service.checkCredit('cust-1', 200001); // one cent over

    expect(result.passed).toBe(false);
  });

  it('throws when customer not found', async () => {
    const prisma = buildMockPrisma();
    prisma.customer.findUnique.mockResolvedValue(null);
    const service = new CreditCheckService(prisma);

    await expect(service.checkCredit('nonexistent')).rejects.toThrow('Customer not found');
  });

  it('handles zero outstanding balance', async () => {
    const prisma = buildMockPrisma({ outstandingCents: 0 });
    const service = new CreditCheckService(prisma);

    const result = await service.checkCredit('cust-1', 500000);

    expect(result.passed).toBe(true);
    expect(result.availableCreditCents).toBe(1000000);
  });
});
