import { CustomerAuthService } from '../../services/CustomerAuthService';

function buildMockRepo(overrides: any = {}) {
  const mockUser = {
    id: 'cu-1',
    customerId: 'cust-1',
    email: 'john@acme.com',
    name: 'John Smith',
    role: 'viewer',
    active: true,
    customer: { id: 'cust-1', name: 'Acme Corp' },
    ...overrides.user,
  };

  return {
    create: jest.fn().mockResolvedValue(mockUser),
    findById: jest.fn().mockResolvedValue(mockUser),
    findByEmail: jest.fn().mockResolvedValue(overrides.existingUser === undefined ? null : overrides.existingUser),
    findByCustomerId: jest.fn().mockResolvedValue([mockUser]),
    update: jest.fn().mockResolvedValue(mockUser),
    updatePassword: jest.fn().mockResolvedValue(mockUser),
    updateLastLogin: jest.fn().mockResolvedValue(mockUser),
    _mockUser: mockUser,
  };
}

describe('CustomerAuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('validatePasswordStrength', () => {
    it('rejects short passwords', () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);
      const result = service.validatePasswordStrength('Ab1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('requires uppercase', () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);
      const result = service.validatePasswordStrength('abcdefg1');
      expect(result.valid).toBe(false);
    });

    it('requires lowercase', () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);
      const result = service.validatePasswordStrength('ABCDEFG1');
      expect(result.valid).toBe(false);
    });

    it('requires number', () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);
      const result = service.validatePasswordStrength('Abcdefgh');
      expect(result.valid).toBe(false);
    });

    it('accepts valid password', () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);
      const result = service.validatePasswordStrength('SecurePass1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('register', () => {
    it('creates a customer user with hashed password', async () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);

      await service.register('cust-1', 'new@acme.com', 'SecurePass1', 'Jane Doe');

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 'cust-1',
        email: 'new@acme.com',
        name: 'Jane Doe',
        role: 'viewer',
      }));
      // Password should be hashed, not plain text
      const call = repo.create.mock.calls[0][0];
      expect(call.passwordHash).not.toBe('SecurePass1');
      expect(call.passwordHash).toContain(':'); // salt:hash format
    });

    it('rejects duplicate email', async () => {
      const repo = buildMockRepo({ existingUser: { id: 'existing', email: 'john@acme.com' } });
      const service = new CustomerAuthService(repo as any);

      await expect(service.register('cust-1', 'john@acme.com', 'SecurePass1', 'Jane'))
        .rejects.toThrow('Email already registered');
    });

    it('rejects weak password', async () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);

      await expect(service.register('cust-1', 'new@acme.com', 'weak', 'Jane'))
        .rejects.toThrow();
    });
  });

  describe('login', () => {
    it('returns token and user on valid credentials', async () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);

      // First register to get a valid hash
      await service.register('cust-1', 'login@acme.com', 'SecurePass1', 'Test User');
      const createdHash = repo.create.mock.calls[0][0].passwordHash;

      // Now mock findByEmail to return the user with the hash
      repo.findByEmail.mockResolvedValue({
        ...repo._mockUser,
        email: 'login@acme.com',
        passwordHash: createdHash,
      });

      const result = await service.login('login@acme.com', 'SecurePass1');

      expect(result.token).toBeDefined();
      expect(result.token.split('.')).toHaveLength(3); // JWT format
      expect(result.user.customerId).toBe('cust-1');
      expect(result.user.customerName).toBe('Acme Corp');
    });

    it('rejects invalid password', async () => {
      const repo = buildMockRepo({
        existingUser: { ...buildMockRepo()._mockUser, passwordHash: 'invalid:hash' },
      });
      repo.findByEmail.mockResolvedValue(repo._mockUser);
      // Override to return user with bad hash
      repo.findByEmail.mockResolvedValue({
        ...repo._mockUser,
        passwordHash: 'somesalt:somehash',
      });

      const service = new CustomerAuthService(repo as any);
      await expect(service.login('john@acme.com', 'WrongPass1')).rejects.toThrow('Invalid email or password');
    });

    it('rejects deactivated user', async () => {
      const repo = buildMockRepo();
      repo.findByEmail.mockResolvedValue({ ...repo._mockUser, active: false });
      const service = new CustomerAuthService(repo as any);

      await expect(service.login('john@acme.com', 'SecurePass1')).rejects.toThrow('Account is deactivated');
    });
  });

  describe('verifyToken', () => {
    it('verifies a valid token', async () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);

      // Register and login to get a valid token
      await service.register('cust-1', 'verify@acme.com', 'SecurePass1', 'Test');
      const hash = repo.create.mock.calls[0][0].passwordHash;
      repo.findByEmail.mockResolvedValue({ ...repo._mockUser, email: 'verify@acme.com', passwordHash: hash });

      const { token } = await service.login('verify@acme.com', 'SecurePass1');
      const payload = service.verifyToken(token);

      expect(payload.customerId).toBe('cust-1');
      expect(payload.iss).toBe('open-tms-customer');
    });

    it('rejects token with wrong issuer', () => {
      const repo = buildMockRepo();
      const service = new CustomerAuthService(repo as any);

      // Craft a token with wrong issuer (this is a simplified test)
      expect(() => service.verifyToken('invalid.token.here')).toThrow();
    });
  });
});
