import { CustomerUserRepository } from '../../repositories/CustomerUserRepository';

function buildPrisma() {
  return {
    customerUser: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
  } as any;
}

describe('CustomerUserRepository', () => {
  describe('create', () => {
    it('writes through to prisma.customerUser.create unchanged', async () => {
      const prisma = buildPrisma();
      const repo = new CustomerUserRepository(prisma);

      await repo.create({
        customerId: 'cust-1',
        email: 'jane@acme.com',
        passwordHash: 'salt:hash',
        name: 'Jane',
      });

      expect(prisma.customerUser.create).toHaveBeenCalledWith({
        data: {
          customerId: 'cust-1',
          email: 'jane@acme.com',
          passwordHash: 'salt:hash',
          name: 'Jane',
        },
      });
    });
  });

  describe('findById / findByEmail', () => {
    it('includes the customer relation for downstream auth flows', async () => {
      const prisma = buildPrisma();
      const repo = new CustomerUserRepository(prisma);

      await repo.findById('cu-1');
      await repo.findByEmail('jane@acme.com');

      const idCall = prisma.customerUser.findUnique.mock.calls[0][0];
      const emailCall = prisma.customerUser.findUnique.mock.calls[1][0];
      expect(idCall.include.customer.select).toEqual({ id: true, name: true });
      expect(emailCall.include.customer.select).toEqual({ id: true, name: true });
    });
  });

  describe('findByCustomerId', () => {
    it('orders results alphabetically by name', async () => {
      const prisma = buildPrisma();
      const repo = new CustomerUserRepository(prisma);

      await repo.findByCustomerId('cust-1');

      expect(prisma.customerUser.findMany).toHaveBeenCalledWith({
        where: { customerId: 'cust-1' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('updateLastLogin', () => {
    it('also clears any active lockout state on successful login', async () => {
      const prisma = buildPrisma();
      const repo = new CustomerUserRepository(prisma);

      await repo.updateLastLogin('cu-1');

      const data = prisma.customerUser.update.mock.calls[0][0].data;
      expect(data.lastLoginAt).toBeInstanceOf(Date);
      expect(data.failedLoginAttempts).toBe(0);
      expect(data.lockedUntil).toBeNull();
    });
  });

  describe('applyFailedAttempt', () => {
    it('persists the new failed-attempt count and lock window', async () => {
      const prisma = buildPrisma();
      const repo = new CustomerUserRepository(prisma);

      const future = new Date('2026-06-01T12:00:00Z');
      await repo.applyFailedAttempt('cu-1', 5, future);

      expect(prisma.customerUser.update).toHaveBeenCalledWith({
        where: { id: 'cu-1' },
        data: { failedLoginAttempts: 5, lockedUntil: future },
      });
    });

    it('accepts null lockedUntil for the pre-threshold case', async () => {
      const prisma = buildPrisma();
      const repo = new CustomerUserRepository(prisma);

      await repo.applyFailedAttempt('cu-1', 2, null);

      const data = prisma.customerUser.update.mock.calls[0][0].data;
      expect(data.lockedUntil).toBeNull();
    });
  });

  describe('clearLockout', () => {
    it('zeroes the counter and nulls the lockout window', async () => {
      const prisma = buildPrisma();
      const repo = new CustomerUserRepository(prisma);

      await repo.clearLockout('cu-1');

      expect(prisma.customerUser.update).toHaveBeenCalledWith({
        where: { id: 'cu-1' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });
  });
});
