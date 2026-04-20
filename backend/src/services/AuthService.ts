import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';
const JWT_ISSUER = 'open-tms-auth';
const TOKEN_EXPIRY_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface InternalJWTPayload {
  sub: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
  organizationId?: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
    organizationId: string | null;
  };
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

const failedAttempts = new Map<string, { count: number; lockedUntil: Date | null }>();

setInterval(() => {
  const now = new Date();
  for (const [key, value] of failedAttempts) {
    if (value.lockedUntil && value.lockedUntil < now) failedAttempts.delete(key);
  }
}, 15 * 60 * 1000).unref();

export interface IAuthService {
  login(email: string, password: string): Promise<LoginResult>;
  getUserWithAuthContext(userId: string): Promise<LoginResult['user'] | null>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  adminResetPassword(targetUserId: string, newPassword: string): Promise<void>;
  validatePasswordStrength(password: string): PasswordValidation;
}

export class AuthService implements IAuthService {
  constructor(private prisma: PrismaClient) {}

  validatePasswordStrength(password: string): PasswordValidation {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (password.length > 128) errors.push('Password must be less than 128 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    return { valid: errors.length === 0, errors };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const attempts = failedAttempts.get(normalizedEmail);
    if (attempts?.lockedUntil && attempts.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`Account is temporarily locked. Try again in ${minutesLeft} minutes.`);
    }

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.passwordHash) {
      this.recordFailedAttempt(normalizedEmail);
      throw new Error('Invalid email or password');
    }
    if (!user.active) throw new Error('Account is deactivated. Contact your administrator.');

    const valid = this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      this.recordFailedAttempt(normalizedEmail);
      const current = failedAttempts.get(normalizedEmail);
      const remaining = MAX_FAILED_ATTEMPTS - (current?.count || 0);
      if (remaining <= 0) {
        throw new Error(`Account is temporarily locked due to too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
      }
      if (remaining <= 2) {
        throw new Error(`Invalid email or password. ${remaining} attempt(s) remaining before lockout.`);
      }
      throw new Error('Invalid email or password');
    }

    failedAttempts.delete(normalizedEmail);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    const { roles, permissions } = this.aggregateRolesAndPermissions(user.roles);

    const token = this.generateToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
      organizationId: user.organizationId ?? undefined,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions,
        organizationId: user.organizationId,
      },
    };
  }

  async getUserWithAuthContext(userId: string): Promise<LoginResult['user'] | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.active) return null;

    const { roles, permissions } = this.aggregateRolesAndPermissions(user.roles);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
      organizationId: user.organizationId,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new Error('User not found');

    const valid = this.verifyPassword(oldPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');

    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const newHash = this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    });
  }

  async adminResetPassword(targetUserId: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new Error('User not found');

    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const newHash = this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    failedAttempts.delete(user.email.toLowerCase());
  }

  // ── private helpers ──

  private aggregateRolesAndPermissions(
    userRoles: Array<{ role: { name: string; permissions: unknown } }>
  ): { roles: string[]; permissions: string[] } {
    const roleNames = userRoles.map((ur) => ur.role.name);
    const permSet = new Set<string>();
    for (const ur of userRoles) {
      const perms = Array.isArray(ur.role.permissions) ? (ur.role.permissions as string[]) : [];
      for (const p of perms) permSet.add(p);
    }
    return { roles: roleNames, permissions: Array.from(permSet) };
  }

  private recordFailedAttempt(email: string): void {
    const current = failedAttempts.get(email) || { count: 0, lockedUntil: null };
    current.count += 1;
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }
    failedAttempts.set(email, current);
  }

  private generateToken(claims: Omit<InternalJWTPayload, 'iat' | 'exp' | 'iss'>): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: InternalJWTPayload = {
      ...claims,
      iat: now,
      exp: now + TOKEN_EXPIRY_HOURS * 3600,
      iss: JWT_ISSUER,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = createHmac('sha256', salt).update(password).digest('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return false;
    const computed = createHmac('sha256', salt).update(password).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
    } catch {
      return false;
    }
  }
}
