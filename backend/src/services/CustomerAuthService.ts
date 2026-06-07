import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ICustomerUserRepository } from '../repositories/CustomerUserRepository.js';
import {
  computeLockoutStatus,
  isLockedOut,
  LOCKOUT_MINUTES,
  LockoutStatus,
  MAX_FAILED_ATTEMPTS,
  minutesUntilUnlocked,
  nextFailedAttemptState,
} from './auth/lockout.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';
const CUSTOMER_JWT_ISSUER = 'open-tms-customer';
const TOKEN_EXPIRY_HOURS = 24;

export interface CustomerJWTPayload {
  sub: string;
  email: string;
  customerId: string;
  customerName: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface CustomerLoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    customerId: string;
    customerName: string;
  };
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export type { LockoutStatus } from './auth/lockout.js';

export interface ICustomerAuthService {
  register(customerId: string, email: string, password: string, name: string, role?: string): Promise<any>;
  login(email: string, password: string): Promise<CustomerLoginResult>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  adminResetPassword(userId: string, newPassword: string): Promise<void>;
  validatePasswordStrength(password: string): PasswordValidation;
  verifyToken(token: string): CustomerJWTPayload;
  unlockAccount(userId: string): Promise<void>;
  getLockoutStatus(userId: string): Promise<LockoutStatus>;
}

export class CustomerAuthService implements ICustomerAuthService {
  constructor(private customerUserRepo: ICustomerUserRepository) {}

  validatePasswordStrength(password: string): PasswordValidation {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (password.length > 128) errors.push('Password must be less than 128 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    return { valid: errors.length === 0, errors };
  }

  async register(customerId: string, email: string, password: string, name: string, role?: string) {
    const existing = await this.customerUserRepo.findByEmail(email);
    if (existing) throw new Error('Email already registered');

    const validation = this.validatePasswordStrength(password);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const passwordHash = await this.hashPassword(password);
    return this.customerUserRepo.create({
      customerId,
      email,
      passwordHash,
      name,
      role: role ?? 'viewer',
    });
  }

  async login(email: string, password: string): Promise<CustomerLoginResult> {
    const user = await this.customerUserRepo.findByEmail(email);
    if (!user) throw new Error('Invalid email or password');

    if (isLockedOut(user)) {
      const minutesLeft = minutesUntilUnlocked(user);
      throw new Error(`Account is temporarily locked. Try again in ${minutesLeft} minutes.`);
    }

    if (!user.active) throw new Error('Account is deactivated');

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      const next = nextFailedAttemptState(user);
      await this.customerUserRepo.applyFailedAttempt(user.id, next.failedLoginAttempts, next.lockedUntil);
      if (next.triggeredLock) {
        throw new Error(`Account is temporarily locked due to too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
      }
      const remaining = MAX_FAILED_ATTEMPTS - next.failedLoginAttempts;
      if (remaining <= 2) {
        throw new Error(`Invalid email or password. ${remaining} attempt(s) remaining before lockout.`);
      }
      throw new Error('Invalid email or password');
    }

    await this.customerUserRepo.updateLastLogin(user.id);

    const customer = (user as any).customer;
    const token = this.generateToken({
      sub: user.id,
      email: user.email,
      customerId: user.customerId,
      customerName: customer?.name ?? '',
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        customerId: user.customerId,
        customerName: customer?.name ?? '',
      },
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.customerUserRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const valid = await this.verifyPassword(oldPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');

    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const newHash = await this.hashPassword(newPassword);
    await this.customerUserRepo.updatePassword(userId, newHash);
  }

  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.customerUserRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const newHash = await this.hashPassword(newPassword);
    await this.customerUserRepo.updatePassword(userId, newHash);
    await this.customerUserRepo.clearLockout(userId);
  }

  async unlockAccount(userId: string): Promise<void> {
    await this.customerUserRepo.clearLockout(userId);
  }

  async getLockoutStatus(userId: string): Promise<LockoutStatus> {
    const user = await this.customerUserRepo.findById(userId);
    return computeLockoutStatus(user);
  }

  verifyToken(token: string): CustomerJWTPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const [headerB64, payloadB64, signatureB64] = parts;

    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64 !== expectedSig) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as CustomerJWTPayload;

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    if (payload.iss !== CUSTOMER_JWT_ISSUER) {
      throw new Error('Invalid issuer');
    }

    return payload;
  }

  private generateToken(claims: Omit<CustomerJWTPayload, 'iat' | 'exp' | 'iss'>): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: CustomerJWTPayload = {
      ...claims,
      iat: now,
      exp: now + TOKEN_EXPIRY_HOURS * 3600,
      iss: CUSTOMER_JWT_ISSUER,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    return `${header}.${body}.${signature}`;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = createHmac('sha256', salt).update(password).digest('hex');
    return `${salt}:${hash}`;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
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
