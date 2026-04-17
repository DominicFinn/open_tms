import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ICarrierUserRepository } from '../repositories/CarrierUserRepository.js';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';
const CARRIER_JWT_ISSUER = 'open-tms-carrier';
const TOKEN_EXPIRY_HOURS = 24;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface CarrierJWTPayload {
  sub: string;
  email: string;
  carrierId: string;
  carrierName: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    carrierId: string;
    carrierName: string;
  };
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export interface ICarrierAuthService {
  register(carrierId: string, email: string, password: string, name: string, role?: string): Promise<any>;
  login(email: string, password: string): Promise<LoginResult>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  adminResetPassword(userId: string, newPassword: string): Promise<void>;
  validatePasswordStrength(password: string): PasswordValidation;
  verifyToken(token: string): CarrierJWTPayload;
}

// In-memory failed attempt tracking (per email)
// In production, this would use Redis or a DB column
const failedAttempts = new Map<string, { count: number; lockedUntil: Date | null }>();

export class CarrierAuthService implements ICarrierAuthService {
  constructor(private carrierUserRepo: ICarrierUserRepository) {}

  validatePasswordStrength(password: string): PasswordValidation {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (password.length > 128) errors.push('Password must be less than 128 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    return { valid: errors.length === 0, errors };
  }

  async register(carrierId: string, email: string, password: string, name: string, role?: string) {
    const existing = await this.carrierUserRepo.findByEmail(email);
    if (existing) throw new Error('Email already registered');

    const validation = this.validatePasswordStrength(password);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const passwordHash = await this.hashPassword(password);
    return this.carrierUserRepo.create({
      carrierId,
      email,
      passwordHash,
      name,
      role: role ?? 'dispatcher',
    });
  }

  async login(email: string, password: string): Promise<LoginResult> {
    // Check lockout
    const attempts = failedAttempts.get(email);
    if (attempts?.lockedUntil && attempts.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`Account is temporarily locked. Try again in ${minutesLeft} minutes.`);
    }

    const user = await this.carrierUserRepo.findByEmail(email);
    if (!user) {
      this.recordFailedAttempt(email);
      throw new Error('Invalid email or password');
    }
    if (!user.active) throw new Error('Account is deactivated');

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      this.recordFailedAttempt(email);
      const current = failedAttempts.get(email);
      const remaining = MAX_FAILED_ATTEMPTS - (current?.count || 0);
      if (remaining <= 0) {
        throw new Error(`Account is temporarily locked due to too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`);
      }
      if (remaining <= 2) {
        throw new Error(`Invalid email or password. ${remaining} attempt(s) remaining before lockout.`);
      }
      throw new Error('Invalid email or password');
    }

    // Clear failed attempts on successful login
    failedAttempts.delete(email);

    // Update last login
    await this.carrierUserRepo.updateLastLogin(user.id);

    const carrier = (user as any).carrier;
    const token = this.generateToken({
      sub: user.id,
      email: user.email,
      carrierId: user.carrierId,
      carrierName: carrier?.name ?? '',
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        carrierId: user.carrierId,
        carrierName: carrier?.name ?? '',
      },
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.carrierUserRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const valid = await this.verifyPassword(oldPassword, user.passwordHash);
    if (!valid) throw new Error('Current password is incorrect');

    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const newHash = await this.hashPassword(newPassword);
    await this.carrierUserRepo.updatePassword(userId, newHash);
  }

  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.carrierUserRepo.findById(userId);
    if (!user) throw new Error('User not found');

    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const newHash = await this.hashPassword(newPassword);
    await this.carrierUserRepo.updatePassword(userId, newHash);

    // Clear any lockout for this user's email
    failedAttempts.delete(user.email);
  }

  verifyToken(token: string): CarrierJWTPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const [headerB64, payloadB64, signatureB64] = parts;

    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64 !== expectedSig) {
      throw new Error('Invalid signature');
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as CarrierJWTPayload;

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    if (payload.iss !== CARRIER_JWT_ISSUER) {
      throw new Error('Invalid issuer');
    }

    return payload;
  }

  // ── Private helpers ──

  private recordFailedAttempt(email: string): void {
    const current = failedAttempts.get(email) || { count: 0, lockedUntil: null };
    current.count += 1;
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }
    failedAttempts.set(email, current);
  }

  private generateToken(claims: Omit<CarrierJWTPayload, 'iat' | 'exp' | 'iss'>): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: CarrierJWTPayload = {
      ...claims,
      iat: now,
      exp: now + TOKEN_EXPIRY_HOURS * 3600,
      iss: CARRIER_JWT_ISSUER,
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
