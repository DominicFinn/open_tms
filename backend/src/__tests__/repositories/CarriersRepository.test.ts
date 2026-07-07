import { CarriersRepository } from '../../repositories/CarriersRepository';

function buildPrisma() {
  return {
    carrier: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
}

describe('CarriersRepository', () => {
  describe('all', () => {
    it('excludes archived carriers by default', async () => {
      const prisma = buildPrisma();
      const repo = new CarriersRepository(prisma);

      await repo.all('org-1');

      expect(prisma.carrier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, archived: false, orgId: 'org-1' } })
      );
    });

    it('includes archived carriers when includeArchived is set', async () => {
      const prisma = buildPrisma();
      const repo = new CarriersRepository(prisma);

      await repo.all('org-1', { includeArchived: true });

      const where = prisma.carrier.findMany.mock.calls[0][0].where;
      expect(where.archived).toBeUndefined();
      expect(where.deletedAt).toBeNull();
    });
  });

  describe('findArchived', () => {
    it('backs the Archives page — filters archived, non-deleted carriers scoped to the org', async () => {
      const prisma = buildPrisma();
      const repo = new CarriersRepository(prisma);

      await repo.findArchived('org-1');

      expect(prisma.carrier.findMany).toHaveBeenCalledWith({
        where: { archived: true, deletedAt: null, orgId: 'org-1' },
        orderBy: { archivedAt: 'desc' },
      });
    });
  });
});
