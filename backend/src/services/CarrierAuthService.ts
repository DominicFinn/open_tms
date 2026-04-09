import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ICarrierUserRepository } from '../repositories/CarrierUserRepository.js';

const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';
const CARRIER_JWT_ISSUER = 'open-tms-carrier';
const TOKEN_EXPIRY_HOURS = 24;

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

export interface ICarrierAuthService {
  register(carrierId: string, email: string, password: string, name: string, role?: string): Promise<any>;
  login(email: string, password: string): Promise<LoginResult>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
  verifyToken(token: string): CarrierJWTPayload;
}

export class CarrierAuthService implements ICarrierAuthService {
  constructor(private carrierUserRepo: ICarrierUserRepository) {}

  async register(carrierId: string, email: string, password: string, name: string, role?: string) {
    // Check if email already exists
    const existing = await this.carrierUserRepo.findByEmail(email);
    if (existing) throw new Error('Email already registered');

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
    const user = await this.carrierUserRepo.findByEmail(email);
    if (!user) throw new Error('Invalid email or password');
    if (!user.active) throw new Error('Account is deactivated');

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) throw new Error('Invalid email or password');

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

    const newHash = await this.hashPassword(newPassword);
    await this.carrierUserRepo.updatePassword(userId, newHash);
  }

  verifyToken(token: string): CarrierJWTPayload {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify HMAC SHA-256 signature
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
    // Use timing-safe comparison
    try {
      return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
    } catch {
      return false;
    }
  }
}
