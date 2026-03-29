import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

export interface JWTPayload {
  sub: string;          // User ID
  email: string;
  roles: string[];      // Role names
  permissions: string[];// Flattened permission strings
  organizationId?: string;
  customerId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;     // seconds until access token expires
  refreshExpiresAt: Date;
}

export interface ITokenService {
  generateTokenPair(payload: JWTPayload): TokenPair;
  verifyAccessToken(token: string): JWTPayload;
  generateRefreshToken(): string;
}

export class TokenService implements ITokenService {
  private readonly accessSecret: string;
  private readonly accessExpiresIn: number; // seconds
  private readonly refreshExpiresIn: number; // seconds

  constructor() {
    this.accessSecret = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';
    this.accessExpiresIn = Number(process.env.JWT_ACCESS_EXPIRES_IN || 900); // 15 minutes
    this.refreshExpiresIn = Number(process.env.JWT_REFRESH_EXPIRES_IN || 604800); // 7 days
  }

  generateTokenPair(payload: JWTPayload): TokenPair {
    const accessToken = jwt.sign(payload, this.accessSecret, {
      expiresIn: this.accessExpiresIn,
      issuer: 'open-tms-auth',
      audience: 'open-tms',
    });

    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + this.refreshExpiresIn * 1000);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresIn,
      refreshExpiresAt,
    };
  }

  verifyAccessToken(token: string): JWTPayload {
    const decoded = jwt.verify(token, this.accessSecret, {
      issuer: 'open-tms-auth',
      audience: 'open-tms',
    });
    return decoded as JWTPayload;
  }

  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }
}
