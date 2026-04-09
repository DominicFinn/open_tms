import { hashApiKey, redactApiKey, checkRateLimit } from '../middleware/apiKeyAuth';

describe('apiKeyAuth', () => {
  describe('hashApiKey', () => {
    it('produces a consistent SHA-256 hex hash', () => {
      const hash1 = hashApiKey('my-secret-key');
      const hash2 = hashApiKey('my-secret-key');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    it('different keys produce different hashes', () => {
      const a = hashApiKey('key-a');
      const b = hashApiKey('key-b');
      expect(a).not.toBe(b);
    });
  });

  describe('redactApiKey', () => {
    it('redacts x-api-key header', () => {
      const headers = { 'x-api-key': 'secret-123', 'content-type': 'application/json' };
      const redacted = redactApiKey(headers);
      expect(redacted['x-api-key']).toBe('[REDACTED]');
      expect(redacted['content-type']).toBe('application/json');
    });

    it('redacts Authorization Bearer token', () => {
      const headers = { authorization: 'Bearer my-secret-token' };
      const redacted = redactApiKey(headers);
      expect(redacted.authorization).toBe('Bearer [REDACTED]');
    });

    it('does not modify original headers object', () => {
      const headers = { 'x-api-key': 'secret' };
      redactApiKey(headers);
      expect(headers['x-api-key']).toBe('secret');
    });

    it('handles headers with no sensitive fields', () => {
      const headers = { 'content-type': 'text/html' };
      const redacted = redactApiKey(headers);
      expect(redacted['content-type']).toBe('text/html');
    });
  });

  describe('checkRateLimit', () => {
    it('allows requests within the limit', () => {
      const ip = `test-ip-${Date.now()}`;
      for (let i = 0; i < 100; i++) {
        expect(checkRateLimit(ip)).toBe(true);
      }
    });

    it('blocks requests over the limit', () => {
      const ip = `test-ip-blocked-${Date.now()}`;
      for (let i = 0; i < 100; i++) {
        checkRateLimit(ip);
      }
      expect(checkRateLimit(ip)).toBe(false);
    });

    it('different IPs have independent limits', () => {
      const ip1 = `ip-a-${Date.now()}`;
      const ip2 = `ip-b-${Date.now()}`;
      for (let i = 0; i < 100; i++) {
        checkRateLimit(ip1);
      }
      expect(checkRateLimit(ip1)).toBe(false);
      expect(checkRateLimit(ip2)).toBe(true);
    });
  });
});
