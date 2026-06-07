import { CarrierAuthService } from '../../services/CarrierAuthService';

function buildMockRepo(overrides: any = {}) {
  const mockUser = {
    id: 'cu-1',
    carrierId: 'carrier-1',
    email: 'driver@swift.com',
    name: 'Driver One',
    role: 'dispatcher',
    active: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    carrier: { id: 'carrier-1', name: 'Swift' },
    ...overrides.user,
  };

  return {
    create: jest.fn().mockResolvedValue(mockUser),
    findById: jest.fn().mockResolvedValue(mockUser),
    findByEmail: jest.fn().mockResolvedValue(overrides.existingUser === undefined ? null : overrides.existingUser),
    findByCarrierId: jest.fn().mockResolvedValue([mockUser]),
    update: jest.fn().mockResolvedValue(mockUser),
    updatePassword: jest.fn().mockResolvedValue(mockUser),
    updateLastLogin: jest.fn().mockResolvedValue(mockUser),
    applyFailedAttempt: jest.fn().mockResolvedValue(mockUser),
    clearLockout: jest.fn().mockResolvedValue(mockUser),
    _mockUser: mockUser,
  };
}

describe('CarrierAuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('login lockout via DB', () => {
    it('persists incremented failed-attempt count', async () => {
      const repo = buildMockRepo();
      repo.findByEmail.mockResolvedValue({
        ...repo._mockUser,
        passwordHash: 'somesalt:somehash',
        failedLoginAttempts: 0,
      });
      const service = new CarrierAuthService(repo as any);

      await expect(service.login('driver@swift.com', 'WrongPass1')).rejects.toThrow();
      expect(repo.applyFailedAttempt).toHaveBeenCalledWith('cu-1', 1, null);
    });

    it('triggers lockout once threshold is reached', async () => {
      const repo = buildMockRepo();
      repo.findByEmail.mockResolvedValue({
        ...repo._mockUser,
        passwordHash: 'somesalt:somehash',
        failedLoginAttempts: 4,
      });
      const service = new CarrierAuthService(repo as any);

      await expect(service.login('driver@swift.com', 'WrongPass1')).rejects.toThrow(/temporarily locked/);
      const [id, attempts, lockedUntil] = repo.applyFailedAttempt.mock.calls[0];
      expect(id).toBe('cu-1');
      expect(attempts).toBe(5);
      expect(lockedUntil).toBeInstanceOf(Date);
    });

    it('rejects login when DB row indicates active lockout', async () => {
      const repo = buildMockRepo();
      repo.findByEmail.mockResolvedValue({
        ...repo._mockUser,
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      });
      const service = new CarrierAuthService(repo as any);

      await expect(service.login('driver@swift.com', 'SecurePass1')).rejects.toThrow(/temporarily locked/);
      expect(repo.applyFailedAttempt).not.toHaveBeenCalled();
    });

    it('returns generic error for unknown email so existence is not leaked', async () => {
      const repo = buildMockRepo();
      repo.findByEmail.mockResolvedValue(null);
      const service = new CarrierAuthService(repo as any);

      await expect(service.login('ghost@swift.com', 'WhateverPass1')).rejects.toThrow('Invalid email or password');
      expect(repo.applyFailedAttempt).not.toHaveBeenCalled();
    });
  });

  describe('unlockAccount', () => {
    it('clears lockout via repository by user id', async () => {
      const repo = buildMockRepo();
      const service = new CarrierAuthService(repo as any);
      await service.unlockAccount('cu-1');
      expect(repo.clearLockout).toHaveBeenCalledWith('cu-1');
    });
  });

  describe('adminResetPassword', () => {
    it('updates password and clears lockout state', async () => {
      const repo = buildMockRepo();
      repo.findById.mockResolvedValue(repo._mockUser);
      const service = new CarrierAuthService(repo as any);

      await service.adminResetPassword('cu-1', 'NewSecurePass1');
      expect(repo.updatePassword).toHaveBeenCalledWith('cu-1', expect.stringContaining(':'));
      expect(repo.clearLockout).toHaveBeenCalledWith('cu-1');
    });
  });
});
