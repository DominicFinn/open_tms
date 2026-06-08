import { createHmac } from 'crypto';
import { signInternalJWT, INTERNAL_JWT_ISSUER, INTERNAL_JWT_DEFAULT_TTL_HOURS } from '../../auth/internalJWT';

const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';

function decode(token: string) {
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(headerB64, 'base64url').toString()),
    payload: JSON.parse(Buffer.from(payloadB64, 'base64url').toString()),
    signatureB64,
    headerB64,
    payloadB64,
  };
}

describe('signInternalJWT', () => {
  const claims = {
    sub: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    roles: ['warehouse_operator'],
    permissions: ['shipment.read', 'shipment.flag'],
    organizationId: 'org-1',
  };

  it('produces a 3-segment JWT with HS256 header', () => {
    const token = signInternalJWT(claims);
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    const { header } = decode(token);
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });

  it('carries every claim into the payload', () => {
    const token = signInternalJWT(claims);
    const { payload } = decode(token);

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('test@example.com');
    expect(payload.firstName).toBe('Test');
    expect(payload.lastName).toBe('User');
    expect(payload.roles).toEqual(['warehouse_operator']);
    expect(payload.permissions).toEqual(['shipment.read', 'shipment.flag']);
    expect(payload.organizationId).toBe('org-1');
  });

  it('stamps iat, exp, and iss="open-tms-auth" so the existing authenticateJWT accepts it', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signInternalJWT(claims);
    const after = Math.floor(Date.now() / 1000);
    const { payload } = decode(token);

    expect(payload.iss).toBe(INTERNAL_JWT_ISSUER);
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
    expect(payload.exp).toBe(payload.iat + INTERNAL_JWT_DEFAULT_TTL_HOURS * 3600);
  });

  it('honours a custom TTL in hours', () => {
    const token = signInternalJWT(claims, 1);
    const { payload } = decode(token);
    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('signs with HMAC-SHA256 against JWT_SECRET so the signature verifies', () => {
    const token = signInternalJWT(claims);
    const { headerB64, payloadB64, signatureB64 } = decode(token);

    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    expect(signatureB64).toBe(expectedSig);
  });

  it('omits firstName/lastName/organizationId when they are not provided', () => {
    const token = signInternalJWT({
      sub: 'minimal',
      email: 'min@example.com',
      roles: [],
      permissions: [],
    });
    const { payload } = decode(token);
    expect(payload.firstName).toBeUndefined();
    expect(payload.lastName).toBeUndefined();
    expect(payload.organizationId).toBeUndefined();
    expect(payload.sub).toBe('minimal');
    expect(payload.iss).toBe(INTERNAL_JWT_ISSUER);
  });
});
