import { WarehouseService } from '../../services/WarehouseService';
import { createHash } from 'crypto';

// ─── Shared Mock Data ─────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  email: 'warehouse@test.com',
  firstName: 'Jane',
  lastName: 'Worker',
  active: true,
  passwordHash: '$2b$10$hashedpassword',
  organizationId: 'org-1',
  preferredLocationId: 'loc-1',
  failedLoginAttempts: 0,
  lockedUntil: null,
  roles: [
    { role: { name: 'warehouse', permissions: ['shipments:read', 'devices:read'] } },
  ],
};

const mockShipment = {
  id: 'ship-1',
  reference: 'SH-001',
  status: 'draft',
  archived: false,
  launchedAt: null,
  launchedBy: null,
};

const mockDevice = {
  id: 'dev-1',
  externalId: 'SL-TRACKER-001',
  displayId: 'HG-00012345',
  name: 'Tracker Alpha',
  status: 'active',
  assignments: [],
};

const mockFlag = {
  id: 'flag-1',
  shipmentId: 'ship-1',
  flaggedBy: 'user-1',
  flaggedByName: 'Jane Worker',
  reason: 'Wrong pallet count',
  resolved: false,
};

// ─── Helper: Create Mock Prisma ───────────────────────────────────────────

function createMockPrisma(overrides: any = {}) {
  return {
    organization: {
      findFirst: jest.fn().mockResolvedValue({ magicLinksEnabled: true }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(mockUser),
    },
    magicLink: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'ml-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    loginAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    shipment: {
      findFirst: jest.fn().mockResolvedValue(mockShipment),
      update: jest.fn().mockResolvedValue({ ...mockShipment, launchedAt: new Date(), status: 'ready' }),
    },
    shipmentFlag: {
      create: jest.fn().mockResolvedValue(mockFlag),
      findUnique: jest.fn().mockResolvedValue(mockFlag),
      update: jest.fn().mockResolvedValue({ ...mockFlag, resolved: true }),
      count: jest.fn().mockResolvedValue(0),
    },
    device: {
      findFirst: jest.fn().mockResolvedValue(mockDevice),
    },
    deviceAssignment: {
      create: jest.fn().mockResolvedValue({ id: 'assign-1', deviceId: 'dev-1', shipmentId: 'ship-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    shipmentAccessory: {
      create: jest.fn().mockResolvedValue({ id: 'acc-1', accessoryType: 'door_seal' }),
      delete: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('WarehouseService', () => {
  let prisma: any;
  let service: WarehouseService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createMockPrisma();
    service = new WarehouseService(prisma);
  });

  // ─── Magic Link Generation ────────────────────────────────────────────

  describe('generateMagicLink', () => {
    it('generates a magic link token for a valid user', async () => {
      const result = await service.generateMagicLink('user-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBeTruthy();
        expect(result.data.token.length).toBeGreaterThan(36); // UUID-UUID format
        expect(result.data.userId).toBe('user-1');
        expect(result.data.userName).toBe('Jane Worker');
        expect(result.data.expiresAt).toBeNull(); // No expiry by default
      }
    });

    it('deactivates existing magic links before creating a new one', async () => {
      await service.generateMagicLink('user-1');

      expect(prisma.magicLink.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', active: true },
        data: { active: false },
      });
    });

    it('stores a SHA-256 hash of the token, not the token itself', async () => {
      const result = await service.generateMagicLink('user-1');
      expect(result.success).toBe(true);

      const createCall = prisma.magicLink.create.mock.calls[0][0];
      if (result.success) {
        const expectedHash = createHash('sha256').update(result.data.token).digest('hex');
        expect(createCall.data.tokenHash).toBe(expectedHash);
      }
    });

    it('sets expiry when expiresInDays is provided', async () => {
      const result = await service.generateMagicLink('user-1', 30);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresAt).toBeInstanceOf(Date);
        const diffDays = (result.data.expiresAt!.getTime() - Date.now()) / 86400000;
        expect(diffDays).toBeCloseTo(30, 0);
      }
    });

    it('fails if magic links are disabled', async () => {
      prisma.organization.findFirst.mockResolvedValue({ magicLinksEnabled: false });

      const result = await service.generateMagicLink('user-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('disabled');
      }
    });

    it('fails if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.generateMagicLink('user-999');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });

    it('fails if user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, active: false });

      const result = await service.generateMagicLink('user-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('inactive');
      }
    });
  });

  // ─── Magic Link Validation ────────────────────────────────────────────

  describe('validateMagicLink', () => {
    it('validates a valid magic link and returns user data', async () => {
      const token = 'test-token-123';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1',
        userId: 'user-1',
        tokenHash,
        active: true,
        expiresAt: null, // No expiry
        user: mockUser,
      });

      const result = await service.validateMagicLink(token, '127.0.0.1', 'TestAgent');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.id).toBe('user-1');
        expect(result.data.user.email).toBe('warehouse@test.com');
        expect(result.data.user.roles).toEqual(['warehouse']);
        expect(result.data.user.permissions).toEqual(['shipments:read', 'devices:read']);
        // Session JWT is now returned alongside the user payload so the
        // PWA can include it on every subsequent operational request.
        expect(typeof result.data.token).toBe('string');
        expect(result.data.token.split('.')).toHaveLength(3);
        const payload = JSON.parse(Buffer.from(result.data.token.split('.')[1], 'base64url').toString());
        expect(payload.iss).toBe('open-tms-auth');
        expect(payload.sub).toBe('user-1');
        expect(payload.organizationId).toBe(mockUser.organizationId);
      }
    });

    it('updates lastLoginAt on successful validation', async () => {
      const token = 'test-token-123';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1', userId: 'user-1', tokenHash, active: true, expiresAt: null, user: mockUser,
      });

      await service.validateMagicLink(token, '127.0.0.1', 'TestAgent');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ failedLoginAttempts: 0 }),
        })
      );
    });

    it('logs successful login to audit log', async () => {
      const token = 'test-token-123';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1', userId: 'user-1', tokenHash, active: true, expiresAt: null, user: mockUser,
      });

      await service.validateMagicLink(token, '192.168.1.1', 'Zebra/Android');

      expect(prisma.loginAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          method: 'magic_link',
          success: true,
          ipAddress: '192.168.1.1',
          userAgent: 'Zebra/Android',
        }),
      });
    });

    it('does NOT deactivate the magic link (reusable QR codes)', async () => {
      const token = 'test-token-123';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1', userId: 'user-1', tokenHash, active: true, expiresAt: null, user: mockUser,
      });

      await service.validateMagicLink(token, null, null);

      // magicLink.update should NOT be called for active valid links
      expect(prisma.magicLink.update).not.toHaveBeenCalled();
    });

    it('fails for invalid token', async () => {
      prisma.magicLink.findUnique.mockResolvedValue(null);

      const result = await service.validateMagicLink('invalid-token', null, null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Invalid');
      }
    });

    it('fails and logs for inactive link', async () => {
      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1', userId: 'user-1', active: false, user: mockUser,
      });

      const result = await service.validateMagicLink('some-token', null, null);

      expect(result.success).toBe(false);
      expect(prisma.loginAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ failReason: 'inactive_link' }),
      });
    });

    it('fails for expired link and deactivates it', async () => {
      const token = 'test-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1', userId: 'user-1', tokenHash, active: true,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        user: mockUser,
      });

      const result = await service.validateMagicLink(token, null, null);

      expect(result.success).toBe(false);
      expect(prisma.magicLink.update).toHaveBeenCalledWith({
        where: { id: 'ml-1' },
        data: { active: false },
      });
      expect(prisma.loginAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ failReason: 'expired_link' }),
      });
    });

    it('fails if user account is inactive', async () => {
      const token = 'test-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');

      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1', userId: 'user-1', tokenHash, active: true, expiresAt: null,
        user: { ...mockUser, active: false },
      });

      const result = await service.validateMagicLink(token, null, null);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('inactive');
      }
    });
  });

  // ─── Password Login ───────────────────────────────────────────────────

  describe('passwordLogin', () => {
    const compareTrue = jest.fn().mockResolvedValue(true);
    const compareFalse = jest.fn().mockResolvedValue(false);

    it('logs in successfully with valid credentials', async () => {
      const result = await service.passwordLogin(
        'warehouse@test.com', 'password123', '127.0.0.1', 'Agent', compareTrue,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.id).toBe('user-1');
        expect(result.data.user.email).toBe('warehouse@test.com');
      }
    });

    it('returns a session JWT alongside the user payload', async () => {
      const result = await service.passwordLogin(
        'warehouse@test.com', 'password123', null, null, compareTrue,
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.token).toBe('string');
        const payload = JSON.parse(
          Buffer.from(result.data.token.split('.')[1], 'base64url').toString(),
        );
        expect(payload.iss).toBe('open-tms-auth');
        expect(payload.sub).toBe('user-1');
        expect(payload.organizationId).toBe(mockUser.organizationId);
        expect(payload.roles).toEqual(['warehouse']);
      }
    });

    it('resets failed attempts on successful login', async () => {
      await service.passwordLogin('warehouse@test.com', 'pass', null, null, compareTrue);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
        })
      );
    });

    it('logs successful login to audit log', async () => {
      await service.passwordLogin('warehouse@test.com', 'pass', '10.0.0.1', 'Chrome', compareTrue);

      expect(prisma.loginAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method: 'password',
          success: true,
          ipAddress: '10.0.0.1',
        }),
      });
    });

    it('fails for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.passwordLogin('nobody@test.com', 'pass', null, null, compareTrue);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.statusCode).toBe(401);
      }
    });

    it('fails for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, active: false });

      const result = await service.passwordLogin('warehouse@test.com', 'pass', null, null, compareTrue);

      expect(result.success).toBe(false);
    });

    it('fails when account is locked', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 600000), // Locked for 10 more minutes
      });

      const result = await service.passwordLogin('warehouse@test.com', 'pass', null, null, compareTrue);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.statusCode).toBe(423);
        expect(result.error).toContain('locked');
      }
    });

    it('fails for user without password hash (OAuth-only)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: null });

      const result = await service.passwordLogin('warehouse@test.com', 'pass', null, null, compareTrue);

      expect(result.success).toBe(false);
    });

    it('increments failed attempts on wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, failedLoginAttempts: 2 });

      await service.passwordLogin('warehouse@test.com', 'wrong', null, null, compareFalse);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 3 }),
        })
      );
    });

    it('locks account after 5 failed attempts', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, failedLoginAttempts: 4 });

      await service.passwordLogin('warehouse@test.com', 'wrong', null, null, compareFalse);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it('logs failed login to audit', async () => {
      await service.passwordLogin('warehouse@test.com', 'wrong', null, null, compareFalse);

      expect(prisma.loginAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method: 'password',
          success: false,
          failReason: 'invalid_password',
        }),
      });
    });
  });

  // ─── Shipment Flags ───────────────────────────────────────────────────

  describe('flagShipment', () => {
    it('creates a flag on an existing shipment', async () => {
      const result = await service.flagShipment('ship-1', 'user-1', 'Jane Worker', 'Wrong pallet count');

      expect(result.success).toBe(true);
      expect(prisma.shipmentFlag.create).toHaveBeenCalledWith({
        data: {
          shipmentId: 'ship-1',
          flaggedBy: 'user-1',
          flaggedByName: 'Jane Worker',
          reason: 'Wrong pallet count',
        },
      });
    });

    it('fails if shipment not found', async () => {
      prisma.shipment.findFirst.mockResolvedValue(null);

      const result = await service.flagShipment('ship-999', 'user-1', 'Jane', 'Issue');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });

    it('fails if shipment is archived', async () => {
      prisma.shipment.findFirst.mockResolvedValue(null); // archived filter excludes it

      const result = await service.flagShipment('ship-1', 'user-1', 'Jane', 'Issue');
      expect(result.success).toBe(false);
    });
  });

  describe('resolveFlag', () => {
    it('resolves an existing flag', async () => {
      const result = await service.resolveFlag('flag-1', 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.shipmentFlag.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'flag-1' },
          data: expect.objectContaining({ resolved: true, resolvedBy: 'admin-1' }),
        })
      );
    });

    it('fails if flag not found', async () => {
      prisma.shipmentFlag.findUnique.mockResolvedValue(null);

      const result = await service.resolveFlag('flag-999', 'admin-1');
      expect(result.success).toBe(false);
    });
  });

  // ─── Launch Shipment ──────────────────────────────────────────────────

  describe('launchShipment', () => {
    it('launches a draft shipment and transitions to ready', async () => {
      const result = await service.launchShipment('ship-1', 'user-1');

      expect(result.success).toBe(true);
      expect(prisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          data: expect.objectContaining({
            launchedAt: expect.any(Date),
            launchedBy: 'user-1',
            status: 'ready', // draft → ready
          }),
        })
      );
    });

    it('preserves non-draft status when launching', async () => {
      prisma.shipment.findFirst.mockResolvedValue({ ...mockShipment, status: 'picked' });

      await service.launchShipment('ship-1', 'user-1');

      expect(prisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'picked' }), // Not overridden
        })
      );
    });

    it('fails if shipment not found', async () => {
      prisma.shipment.findFirst.mockResolvedValue(null);

      const result = await service.launchShipment('ship-999', 'user-1');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });

    it('blocks launch when unresolved flags exist', async () => {
      prisma.shipmentFlag.count.mockResolvedValue(2);

      const result = await service.launchShipment('ship-1', 'user-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('2 unresolved flag');
      }
      expect(prisma.shipment.update).not.toHaveBeenCalled();
    });

    it('allows launch when all flags are resolved', async () => {
      prisma.shipmentFlag.count.mockResolvedValue(0);

      const result = await service.launchShipment('ship-1', 'user-1');
      expect(result.success).toBe(true);
    });
  });

  // ─── Device Lookup ────────────────────────────────────────────────────

  describe('lookupDevice', () => {
    it('finds device by externalId barcode', async () => {
      const result = await service.lookupDevice('SL-TRACKER-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('dev-1');
        expect(result.data.alreadyAssigned).toBe(false);
      }
      expect(prisma.device.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { externalId: 'SL-TRACKER-001' },
              { displayId: 'SL-TRACKER-001' },
              { name: 'SL-TRACKER-001' },
            ],
          }),
        })
      );
    });

    it('returns alreadyAssigned=true when device has active assignment', async () => {
      prisma.device.findFirst.mockResolvedValue({
        ...mockDevice,
        assignments: [{ shipment: { id: 'ship-2', reference: 'SH-002' } }],
      });

      const result = await service.lookupDevice('SL-TRACKER-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.alreadyAssigned).toBe(true);
        expect(result.data.currentShipmentRef).toBe('SH-002');
      }
    });

    it('fails if device not found', async () => {
      prisma.device.findFirst.mockResolvedValue(null);

      const result = await service.lookupDevice('UNKNOWN-BARCODE');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Device not found');
      }
    });
  });

  // ─── Device Assignment ────────────────────────────────────────────────

  describe('assignDeviceToShipment', () => {
    it('deactivates existing assignments and creates a new one', async () => {
      const result = await service.assignDeviceToShipment('ship-1', 'dev-1');

      expect(result.success).toBe(true);
      expect(prisma.deviceAssignment.updateMany).toHaveBeenCalledWith({
        where: { deviceId: 'dev-1', active: true },
        data: expect.objectContaining({ active: false }),
      });
      expect(prisma.deviceAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceId: 'dev-1',
          shipmentId: 'ship-1',
          trackableUnitId: null,
        }),
      });
    });

    it('assigns to a trackable unit when provided', async () => {
      await service.assignDeviceToShipment('ship-1', 'dev-1', 'unit-42');

      expect(prisma.deviceAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ trackableUnitId: 'unit-42' }),
      });
    });
  });

  describe('removeDeviceFromShipment', () => {
    it('deactivates the assignment for the specific shipment', async () => {
      const result = await service.removeDeviceFromShipment('ship-1', 'dev-1');

      expect(result.success).toBe(true);
      expect(prisma.deviceAssignment.updateMany).toHaveBeenCalledWith({
        where: { deviceId: 'dev-1', shipmentId: 'ship-1', active: true },
        data: expect.objectContaining({ active: false }),
      });
    });
  });

  // ─── Accessories ──────────────────────────────────────────────────────

  describe('addAccessory', () => {
    it('creates a non-IoT door seal', async () => {
      const result = await service.addAccessory('ship-1', {
        accessoryType: 'door_seal',
        identifier: 'SEAL-12345',
        isIoT: false,
      });

      expect(result.success).toBe(true);
      expect(prisma.shipmentAccessory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shipmentId: 'ship-1',
          accessoryType: 'door_seal',
          identifier: 'SEAL-12345',
          isIoT: false,
          deviceId: null,
        }),
      });
    });

    it('creates an IoT temperature sensor with device reference', async () => {
      const result = await service.addAccessory('ship-1', {
        accessoryType: 'temp_sensor_front',
        alias: 'Front Temp',
        isIoT: true,
        deviceId: 'dev-2',
      });

      expect(result.success).toBe(true);
      expect(prisma.shipmentAccessory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accessoryType: 'temp_sensor_front',
          isIoT: true,
          deviceId: 'dev-2',
          alias: 'Front Temp',
        }),
      });
    });
  });

  describe('removeAccessory', () => {
    it('deletes the accessory record', async () => {
      const result = await service.removeAccessory('acc-1');

      expect(result.success).toBe(true);
      expect(prisma.shipmentAccessory.delete).toHaveBeenCalledWith({ where: { id: 'acc-1' } });
    });
  });

  // ─── Login Audit Logging ──────────────────────────────────────────────

  describe('logLoginAttempt', () => {
    it('creates an audit log entry', async () => {
      await service.logLoginAttempt({
        userId: 'user-1',
        method: 'magic_link',
        ipAddress: '10.0.0.1',
        userAgent: 'Zebra/Android',
        success: true,
        failReason: null,
      });

      expect(prisma.loginAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          method: 'magic_link',
          success: true,
        }),
      });
    });

    it('does not throw if audit logging fails', async () => {
      prisma.loginAuditLog.create.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(
        service.logLoginAttempt({
          userId: 'user-1', method: 'password',
          ipAddress: null, userAgent: null,
          success: false, failReason: 'test',
        })
      ).resolves.toBeUndefined();
    });
  });
});
