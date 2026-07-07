import { CarrierUserAnonymizationService } from '../../services/CarrierUserAnonymizationService';

describe('CarrierUserAnonymizationService', () => {
  it('scrubs PII, deactivates, and stamps anonymizedAt for eligible users', async () => {
    const updated: any[] = [];
    const prisma = {
      carrierUser: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
        update: jest.fn().mockImplementation((args: any) => { updated.push(args); return Promise.resolve({}); }),
      },
    } as any;

    const service = new CarrierUserAnonymizationService(prisma, 365);
    const result = await service.runOnce();

    expect(result).toEqual({ scanned: 2, anonymized: 2, errors: 0 });
    // Query only targets not-yet-anonymised users of archived/deleted carriers.
    const where = prisma.carrierUser.findMany.mock.calls[0][0].where;
    expect(where.anonymizedAt).toBeNull();
    expect(where.carrier.OR).toEqual([
      { deletedAt: { lt: expect.any(Date) } },
      { archived: true, archivedAt: { lt: expect.any(Date) } },
    ]);
    // PII replaced with placeholders; email stays unique; account deactivated.
    expect(updated[0].data.email).toBe('anonymized-u1@removed.invalid');
    expect(updated[0].data.name).toBe('Anonymized User');
    expect(updated[0].data.active).toBe(false);
    expect(updated[0].data.anonymizedAt).toBeInstanceOf(Date);
  });

  it('counts errors without aborting the batch', async () => {
    const prisma = {
      carrierUser: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
        update: jest.fn()
          .mockRejectedValueOnce(new Error('boom'))
          .mockResolvedValueOnce({}),
      },
    } as any;

    const service = new CarrierUserAnonymizationService(prisma, 365);
    const result = await service.runOnce();
    expect(result).toEqual({ scanned: 2, anonymized: 1, errors: 1 });
  });
});
