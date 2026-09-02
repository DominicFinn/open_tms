/**
 * ShipmentShareService — the credential mechanics behind shipment share links.
 *
 * A share link has two secrets. The token is the unguessable part of the URL and identifies
 * the link. The access code is the shared secret the recipient types in, along with their email,
 * before anything is shown. Both are generated here, returned to the operator exactly once, and
 * stored only as hashes, so a database read cannot reconstruct either one.
 *
 * The token is hashed with SHA-256 because it carries 256 bits of entropy and is looked up on
 * every public request: a slow hash there would be a denial-of-service lever and would buy
 * nothing. The access code is short enough for a person to retype, so it is hashed with scrypt,
 * which makes offline guessing expensive if the table ever leaks.
 *
 * Nothing in this file writes to the database. Lockout counters and the access ledger are
 * written by command handlers inside a transaction; this service only decides.
 */

import { createHash, randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import {
  ShipmentShareSection,
  normaliseShareSections,
} from '@open-tms/shared';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';

/** Distinct issuer so a viewer token can never authenticate an admin, portal or warehouse route. */
export const SHARE_JWT_ISSUER = 'open-tms-share';

/**
 * BUSINESS RULE: five wrong access codes lock a link for 15 minutes, matching the account
 * lockout rule. The link is the only credential a recipient has, and the public endpoint is
 * unauthenticated by design, so brute force is the realistic attack.
 */
export const SHARE_MAX_FAILED_ATTEMPTS = 5;
export const SHARE_LOCKOUT_MINUTES = 15;

/** A viewer session lasts two hours, or until the link expires, whichever comes first. */
const VIEWER_SESSION_HOURS = 2;

/** Excludes I, O, 0 and 1 so a code read off a screen or a phone call cannot be mistyped. */
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_LENGTH = 8;

const SCRYPT_KEYLEN = 32;

export interface MintedShareCredentials {
  /** Goes in the URL. Returned to the operator once and never stored in plaintext. */
  token: string;
  tokenHash: string;
  /** Typed in by the recipient. Returned to the operator once and never stored in plaintext. */
  accessCode: string;
  accessCodeHash: string;
}

export type ShareLinkRejection =
  | 'denied_revoked'
  | 'denied_expired'
  | 'denied_locked'
  | 'denied_bad_code';

export interface ShareLinkState {
  revokedAt: Date | null;
  expiresAt: Date;
  lockedUntil: Date | null;
}

export interface ViewerTokenPayload {
  sub: string;
  shipmentId: string;
  orgId: string;
  sections: ShipmentShareSection[];
  iat: number;
  exp: number;
  iss: string;
}

export interface IShipmentShareService {
  mintCredentials(): MintedShareCredentials;
  hashToken(token: string): string;
  verifyAccessCode(code: string, storedHash: string): boolean;
  hashIp(ip: string | undefined): string | null;
  checkAvailability(link: ShareLinkState, now?: Date): ShareLinkRejection | null;
  isLockoutTriggered(failedAttempts: number): boolean;
  lockoutUntil(now?: Date): Date;
  signViewerToken(input: {
    shareLinkId: string;
    shipmentId: string;
    orgId: string;
    sections: string[];
    linkExpiresAt: Date;
  }): { token: string; expiresAt: Date };
}

export class ShipmentShareService implements IShipmentShareService {
  mintCredentials(): MintedShareCredentials {
    const token = randomBytes(32).toString('base64url');
    const accessCode = generateAccessCode();
    return {
      token,
      tokenHash: this.hashToken(token),
      accessCode,
      accessCodeHash: hashAccessCode(accessCode),
    };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  verifyAccessCode(code: string, storedHash: string): boolean {
    const [salt, expected] = storedHash.split(':');
    if (!salt || !expected) return false;
    const actual = scryptSync(normaliseAccessCode(code), salt, SCRYPT_KEYLEN).toString('hex');
    const a = Buffer.from(actual, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * The access ledger records where an attempt came from without storing an address tied to a
   * named person. A hash is enough to see the same viewer coming back, or the same source
   * hammering a link.
   */
  hashIp(ip: string | undefined): string | null {
    if (!ip) return null;
    return createHmac('sha256', JWT_SECRET).update(ip).digest('hex');
  }

  /**
   * Why a link cannot be opened right now, or null if it can. Order matters: a revoked link
   * reports as revoked even after it would also have expired, because that is the more useful
   * thing for an operator reading the access log.
   */
  checkAvailability(link: ShareLinkState, now: Date = new Date()): ShareLinkRejection | null {
    if (link.revokedAt) return 'denied_revoked';
    if (link.expiresAt.getTime() <= now.getTime()) return 'denied_expired';
    if (link.lockedUntil && link.lockedUntil.getTime() > now.getTime()) return 'denied_locked';
    return null;
  }

  isLockoutTriggered(failedAttempts: number): boolean {
    return failedAttempts >= SHARE_MAX_FAILED_ATTEMPTS;
  }

  lockoutUntil(now: Date = new Date()): Date {
    return new Date(now.getTime() + SHARE_LOCKOUT_MINUTES * 60_000);
  }

  signViewerToken(input: {
    shareLinkId: string;
    shipmentId: string;
    orgId: string;
    sections: string[];
    linkExpiresAt: Date;
  }): { token: string; expiresAt: Date } {
    const now = new Date();
    const sessionEnd = new Date(now.getTime() + VIEWER_SESSION_HOURS * 3600_000);
    // A session can never outlive the link it came from, otherwise revoking or expiring a link
    // would leave already-open sessions working.
    const expiresAt = sessionEnd < input.linkExpiresAt ? sessionEnd : input.linkExpiresAt;

    const payload: ViewerTokenPayload = {
      sub: input.shareLinkId,
      shipmentId: input.shipmentId,
      orgId: input.orgId,
      // The granted sections travel in the token so the read path never re-derives them from a
      // client-supplied value, but the server still re-checks them against the stored link.
      sections: normaliseShareSections(input.sections),
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      iss: SHARE_JWT_ISSUER,
    };

    return { token: signHs256(payload), expiresAt };
  }
}

function generateAccessCode(): string {
  const bytes = randomBytes(ACCESS_CODE_LENGTH);
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_ALPHABET[bytes[i] % ACCESS_CODE_ALPHABET.length];
  }
  return code;
}

/** Recipients retype the code, so case and spacing are forgiven; the alphabet is not. */
function normaliseAccessCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

function hashAccessCode(code: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(normaliseAccessCode(code), salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function signHs256(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}
