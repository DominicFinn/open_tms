import { OrderAutoArchiveService } from '../../services/OrderAutoArchiveService';
import { ARCHIVE_ORDER } from '../../commands/orders/ArchiveOrderCommand';

function buildMockPrisma(orders: Array<{ id: string; orgId: string }>) {
  return {
    order: {
      findMany: jest.fn().mockResolvedValue(orders),
    },
  } as any;
}

function buildMockCommandBus(success = true) {
  return {
    dispatch: jest.fn().mockResolvedValue({ success, error: success ? null : 'failed' }),
  } as any;
}

describe('OrderAutoArchiveService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('archives every candidate by dispatching ARCHIVE_ORDER with the order orgId', async () => {
    const prisma = buildMockPrisma([
      { id: 'o-1', orgId: 'org-a' },
      { id: 'o-2', orgId: 'org-b' },
    ]);
    const commandBus = buildMockCommandBus();
    const service = new OrderAutoArchiveService(prisma, commandBus, 30);

    const result = await service.runOnce();

    expect(result).toEqual({ scanned: 2, archived: 2, errors: 0 });
    expect(commandBus.dispatch).toHaveBeenCalledTimes(2);
    expect(commandBus.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ARCHIVE_ORDER,
        orgId: 'org-a',
        payload: { id: 'o-1' },
        metadata: expect.objectContaining({ source: 'auto-archive' }),
      }),
    );
  });

  it('queries with the configured retention cutoff and the eligibility predicate', async () => {
    const prisma = buildMockPrisma([]);
    const commandBus = buildMockCommandBus();
    const service = new OrderAutoArchiveService(prisma, commandBus, 30);

    const before = Date.now();
    await service.runOnce();

    const where = prisma.order.findMany.mock.calls[0][0].where;
    expect(where.archived).toBe(false);
    expect(where.OR).toHaveLength(3);

    const cutoff: Date = where.OR[0].deliveredAt.lt;
    const elapsedMs = before - cutoff.getTime();
    expect(elapsedMs).toBeGreaterThanOrEqual(30 * 86400_000 - 1000);
    expect(elapsedMs).toBeLessThanOrEqual(30 * 86400_000 + 1000);
  });

  it('counts dispatch failures separately from successes', async () => {
    const prisma = buildMockPrisma([
      { id: 'o-1', orgId: 'org-a' },
      { id: 'o-2', orgId: 'org-b' },
    ]);
    const commandBus = {
      dispatch: jest.fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'boom' }),
    } as any;
    const service = new OrderAutoArchiveService(prisma, commandBus, 30);

    const result = await service.runOnce();
    expect(result).toEqual({ scanned: 2, archived: 1, errors: 1 });
  });
});
