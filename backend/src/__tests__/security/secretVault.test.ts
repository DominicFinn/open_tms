import { encryptString, decryptString, sealCredentials, openCredentials, isEncrypted } from '../../security/secretVault';

describe('secretVault', () => {
  it('round-trips a string through encrypt/decrypt', () => {
    const secret = 'super-secret-api-key-12345';
    const token = encryptString(secret);
    expect(token.startsWith('v1:')).toBe(true);
    expect(token).not.toContain(secret);
    expect(decryptString(token)).toBe(secret);
  });

  it('produces different ciphertext each time (random IV) but decrypts to the same value', () => {
    const a = encryptString('same');
    const b = encryptString('same');
    expect(a).not.toBe(b);
    expect(decryptString(a)).toBe('same');
    expect(decryptString(b)).toBe('same');
  });

  it('seals a credentials object and never stores plaintext', () => {
    const creds = { clientId: 'abc', clientSecret: 'topsecret' };
    const sealed = sealCredentials(creds)!;
    expect(isEncrypted(sealed.__enc)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain('topsecret');
    expect(openCredentials(sealed)).toEqual(creds);
  });

  it('opens legacy plaintext credentials unchanged (backward compatible)', () => {
    const legacy = { apiKey: 'plain' };
    expect(openCredentials(legacy)).toEqual(legacy);
  });

  it('returns {} for empty/nullish and seals empty as undefined', () => {
    expect(openCredentials(null)).toEqual({});
    expect(openCredentials(undefined)).toEqual({});
    expect(sealCredentials({})).toBeUndefined();
    expect(sealCredentials(null)).toBeUndefined();
  });

  it('fails to decrypt tampered ciphertext (GCM auth)', () => {
    const token = encryptString('secret');
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(() => decryptString(tampered)).toThrow();
  });
});
