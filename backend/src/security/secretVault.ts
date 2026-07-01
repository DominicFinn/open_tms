/**
 * secretVault — symmetric encryption at rest for sensitive config (carrier API
 * credentials, webhook secrets, etc.).
 *
 * AES-256-GCM (authenticated). Ciphertext format: `v1:` + base64(iv[12] ||
 * authTag[16] || ciphertext). The key is derived (SHA-256) from the
 * CREDENTIALS_ENCRYPTION_KEY env var so any length/format input works. In
 * production the env var is REQUIRED; in dev a fixed fallback is used with a
 * warning so local flows still run.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'v1:';
const DEV_FALLBACK = 'open-tms-dev-credentials-key-change-me';

function resolveKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY environment variable is required in production');
    }
    if (!(globalThis as any).__secretVaultWarned) {
      (globalThis as any).__secretVaultWarned = true;
      console.warn('[secretVault] CREDENTIALS_ENCRYPTION_KEY not set — using an insecure dev key. Set it before storing real secrets.');
    }
    return createHash('sha256').update(DEV_FALLBACK).digest();
  }
  return createHash('sha256').update(raw).digest();
}

/** Encrypt a UTF-8 string. Returns the `v1:` token. */
export function encryptString(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', resolveKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a `v1:` token back to the original string. */
export function decryptString(token: string): string {
  if (!token.startsWith(PREFIX)) throw new Error('secretVault: unrecognised ciphertext');
  const buf = Buffer.from(token.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', resolveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Seal a credentials object for storage in a JSON column.
 * Stored shape: `{ __enc: "v1:..." }`.
 */
export function sealCredentials(creds: Record<string, unknown> | null | undefined): { __enc: string } | undefined {
  if (!creds || Object.keys(creds).length === 0) return undefined;
  return { __enc: encryptString(JSON.stringify(creds)) };
}

/**
 * Open a credentials JSON value back to plaintext. Backward-compatible:
 * legacy plaintext objects (no `__enc`) are returned as-is.
 */
export function openCredentials(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const obj = value as Record<string, unknown>;
  if (typeof obj.__enc === 'string') {
    try {
      return JSON.parse(decryptString(obj.__enc)) as Record<string, unknown>;
    } catch (err) {
      console.error(`[secretVault] Failed to decrypt credentials: ${(err as Error).message}`);
      return {};
    }
  }
  return obj; // legacy plaintext
}
