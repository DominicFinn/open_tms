import { createHash, randomUUID } from 'crypto';

/**
 * WarehouseService — Business logic for the warehouse shipment launch app.
 *
 * Extracted from route handlers to enable unit testing with mocked Prisma.
 * All methods accept a Prisma client (or transaction) and return typed results.
 */

export interface MagicLinkResult {
  token: string;
  userId: string;
  userName: string;
  expiresAt: Date | null;
}

export interface WarehouseUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  organizationId: string | null;
  preferredLocationId: string | null;
}

export interface LoginResult {
  user: WarehouseUser;
}

export interface LoginAuditEntry {
  userId: string;
  method: string;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failReason: string | null;
}

export class WarehouseService {
  constructor(private prisma: any) {}

  // ─── Magic Link Auth ────────────────────────────────────────────────────

  async generateMagicLink(
    userId: string,
    expiresInDays?: number,
  ): Promise<{ success: true; data: MagicLinkResult } | { success: false; error: string }> {
    // Check magic links are enabled
    const org = await this.prisma.organization.findFirst();
    if (!org?.magicLinksEnabled) {
      return { success: false, error: 'Magic links are disabled for this organization' };
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      return { success: false, error: 'User not found or inactive' };
    }

    // Deactivate existing active magic links
    await this.prisma.magicLink.updateMany({
      where: { userId, active: true },
      data: { active: false },
    });

    // Generate token
    const token = randomUUID() + '-' + randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000)
      : null;

    await this.prisma.magicLink.create({
      data: { userId, tokenHash, expiresAt, active: true },
    });

    return {
      success: true,
      data: {
        token,
        userId,
        userName: `${user.firstName} ${user.lastName}`,
        expiresAt,
      },
    };
  }

  async validateMagicLink(
    token: string,
    ipAddress: string | null,
    userAgent: string | null,
  ): Promise<{ success: true; data: LoginResult } | { success: false; error: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const magicLink = await this.prisma.magicLink.findUnique({
      where: { tokenHash },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });

    if (!magicLink || !magicLink.active) {
      await this.logLoginAttempt({
        userId: magicLink?.userId || 'unknown',
        method: 'magic_link',
        ipAddress,
        userAgent,
        success: false,
        failReason: !magicLink ? 'invalid_token' : 'inactive_link',
      });
      return { success: false, error: 'Invalid or expired magic link' };
    }

    if (magicLink.expiresAt && magicLink.expiresAt < new Date()) {
      await this.prisma.magicLink.update({
        where: { id: magicLink.id },
        data: { active: false },
      });
      await this.logLoginAttempt({
        userId: magicLink.userId,
        method: 'magic_link',
        ipAddress,
        userAgent,
        success: false,
        failReason: 'expired_link',
      });
      return { success: false, error: 'Magic link has expired' };
    }

    if (!magicLink.user.active) {
      return { success: false, error: 'User account is inactive' };
    }

    // Valid — update last login (do NOT deactivate — reusable QR codes)
    await this.prisma.user.update({
      where: { id: magicLink.userId },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0 },
    });

    await this.logLoginAttempt({
      userId: magicLink.userId,
      method: 'magic_link',
      ipAddress,
      userAgent,
      success: true,
      failReason: null,
    });

    return { success: true, data: { user: this.buildUserPayload(magicLink.user) } };
  }

  async passwordLogin(
    email: string,
    password: string,
    ipAddress: string | null,
    userAgent: string | null,
    comparePassword: (plain: string, hash: string) => Promise<boolean>,
  ): Promise<{ success: true; data: LoginResult } | { success: false; error: string; statusCode: number }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.active) {
      if (user) {
        await this.logLoginAttempt({ userId: user.id, method: 'password', ipAddress, userAgent, success: false, failReason: 'user_not_found' });
      }
      return { success: false, error: 'Invalid credentials', statusCode: 401 };
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logLoginAttempt({ userId: user.id, method: 'password', ipAddress, userAgent, success: false, failReason: 'locked' });
      return { success: false, error: 'Account is locked. Try again later.', statusCode: 423 };
    }

    if (!user.passwordHash) {
      await this.logLoginAttempt({ userId: user.id, method: 'password', ipAddress, userAgent, success: false, failReason: 'no_password_set' });
      return { success: false, error: 'Invalid credentials', statusCode: 401 };
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockData: any = { failedLoginAttempts: attempts };
      if (attempts >= 5) {
        lockData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await this.prisma.user.update({ where: { id: user.id }, data: lockData });
      await this.logLoginAttempt({ userId: user.id, method: 'password', ipAddress, userAgent, success: false, failReason: 'invalid_password' });
      return { success: false, error: 'Invalid credentials', statusCode: 401 };
    }

    // Success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.logLoginAttempt({ userId: user.id, method: 'password', ipAddress, userAgent, success: true, failReason: null });

    return { success: true, data: { user: this.buildUserPayload(user) } };
  }

  // ─── Shipment Operations ────────────────────────────────────────────────

  async flagShipment(
    shipmentId: string,
    flaggedBy: string,
    flaggedByName: string,
    reason: string,
  ): Promise<{ success: true; data: any } | { success: false; error: string }> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, archived: false },
    });
    if (!shipment) {
      return { success: false, error: 'Shipment not found' };
    }

    const flag = await this.prisma.shipmentFlag.create({
      data: { shipmentId, flaggedBy, flaggedByName, reason },
    });

    return { success: true, data: flag };
  }

  async resolveFlag(
    flagId: string,
    resolvedBy: string,
  ): Promise<{ success: true; data: any } | { success: false; error: string }> {
    const flag = await this.prisma.shipmentFlag.findUnique({ where: { id: flagId } });
    if (!flag) {
      return { success: false, error: 'Flag not found' };
    }

    const updated = await this.prisma.shipmentFlag.update({
      where: { id: flagId },
      data: { resolved: true, resolvedBy, resolvedAt: new Date() },
    });

    return { success: true, data: updated };
  }

  async launchShipment(
    shipmentId: string,
    launchedBy: string,
  ): Promise<{ success: true; data: any } | { success: false; error: string }> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, archived: false },
    });
    if (!shipment) {
      return { success: false, error: 'Shipment not found' };
    }

    // Check for unresolved flags
    const unresolvedFlags = await this.prisma.shipmentFlag.count({
      where: { shipmentId, resolved: false },
    });
    if (unresolvedFlags > 0) {
      return { success: false, error: `Cannot launch: ${unresolvedFlags} unresolved flag(s)` };
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        launchedAt: new Date(),
        launchedBy,
        status: shipment.status === 'draft' ? 'ready' : shipment.status,
      },
    });

    return { success: true, data: updated };
  }

  // ─── Device Operations ──────────────────────────────────────────────────

  async lookupDevice(
    barcode: string,
  ): Promise<{ success: true; data: any } | { success: false; error: string }> {
    const device = await this.prisma.device.findFirst({
      where: {
        OR: [
          { externalId: barcode },
          { displayId: barcode },
          { name: barcode },
        ],
        status: 'active',
      },
      include: {
        assignments: {
          where: { active: true },
          include: {
            shipment: { select: { id: true, reference: true } },
          },
        },
      },
    });

    if (!device) {
      return { success: false, error: 'Device not found. Check the barcode and try again.' };
    }

    const activeAssignment = device.assignments[0];
    return {
      success: true,
      data: {
        ...device,
        alreadyAssigned: !!activeAssignment,
        currentShipmentRef: activeAssignment?.shipment?.reference || null,
      },
    };
  }

  async assignDeviceToShipment(
    shipmentId: string,
    deviceId: string,
    trackableUnitId?: string,
  ): Promise<{ success: true; data: any } | { success: false; error: string }> {
    // Deactivate existing assignments
    await this.prisma.deviceAssignment.updateMany({
      where: { deviceId, active: true },
      data: { active: false, unassignedAt: new Date() },
    });

    const assignment = await this.prisma.deviceAssignment.create({
      data: {
        deviceId,
        shipmentId,
        trackableUnitId: trackableUnitId || null,
      },
    });

    return { success: true, data: assignment };
  }

  async removeDeviceFromShipment(
    shipmentId: string,
    deviceId: string,
  ): Promise<{ success: true } | { success: false; error: string }> {
    await this.prisma.deviceAssignment.updateMany({
      where: { deviceId, shipmentId, active: true },
      data: { active: false, unassignedAt: new Date() },
    });
    return { success: true };
  }

  // ─── Accessories ────────────────────────────────────────────────────────

  async addAccessory(
    shipmentId: string,
    data: {
      accessoryType: string;
      alias?: string;
      identifier?: string;
      isIoT?: boolean;
      deviceId?: string;
      notes?: string;
    },
  ): Promise<{ success: true; data: any }> {
    const accessory = await this.prisma.shipmentAccessory.create({
      data: {
        shipmentId,
        accessoryType: data.accessoryType,
        alias: data.alias || null,
        identifier: data.identifier || null,
        isIoT: data.isIoT || false,
        deviceId: data.deviceId || null,
        notes: data.notes || null,
      },
    });
    return { success: true, data: accessory };
  }

  async removeAccessory(
    accessoryId: string,
  ): Promise<{ success: true }> {
    await this.prisma.shipmentAccessory.delete({ where: { id: accessoryId } });
    return { success: true };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private buildUserPayload(user: any): WarehouseUser {
    const roles = user.roles.map((r: any) => r.role.name);
    const permissions = user.roles.flatMap((r: any) => {
      const perms = r.role.permissions;
      return Array.isArray(perms) ? (perms as string[]) : [];
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
      organizationId: user.organizationId,
      preferredLocationId: user.preferredLocationId,
    };
  }

  async logLoginAttempt(entry: LoginAuditEntry): Promise<void> {
    try {
      await this.prisma.loginAuditLog.create({ data: entry });
    } catch {
      // Don't fail operations for audit log issues
    }
  }
}
