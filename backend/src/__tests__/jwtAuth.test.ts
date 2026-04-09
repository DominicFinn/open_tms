import { createHmac } from 'crypto';
import { authenticateJWT, requirePermission, optionalAuth } from '../middleware/jwtAuth';

const JWT_SECRET = process.env.JWT_SECRET || 'open-tms-dev-secret-change-in-production';

function makeToken(payload: Record<string, any>, secret = JWT_SECRET): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function mockReq(authHeader?: string): any {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  };
}

function mockReply(): any {
  const reply: any = { statusCode: 200, body: null };
  reply.code = jest.fn((c: number) => { reply.statusCode = c; return reply; });
  reply.send = jest.fn((b: any) => { reply.body = b; return reply; });
  return reply;
}

describe('jwtAuth', () => {
  describe('authenticateJWT', () => {
    it('sets req.user for a valid token', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        roles: ['admin'],
        permissions: ['*'],
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'open-tms-auth',
      };
      const token = makeToken(payload);
      const req = mockReq(`Bearer ${token}`);
      const reply = mockReply();

      await authenticateJWT(req, reply);

      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('user-1');
      expect(req.user.email).toBe('test@example.com');
    });

    it('rejects request with no auth header', async () => {
      const req = mockReq();
      const reply = mockReply();

      await authenticateJWT(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authorization header required' }));
    });

    it('rejects expired token', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        exp: Math.floor(Date.now() / 1000) - 3600,
      };
      const token = makeToken(payload);
      const req = mockReq(`Bearer ${token}`);
      const reply = mockReply();

      await authenticateJWT(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('rejects token with wrong signature', async () => {
      const payload = { sub: 'user-1', email: 'a@b.com', roles: [], permissions: [] };
      const token = makeToken(payload, 'wrong-secret');
      const req = mockReq(`Bearer ${token}`);
      const reply = mockReply();

      await authenticateJWT(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('rejects non-Bearer auth scheme', async () => {
      const req = mockReq('Basic abc123');
      const reply = mockReply();

      await authenticateJWT(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
    });
  });

  describe('requirePermission', () => {
    it('allows user with wildcard permission', async () => {
      const req = mockReq();
      req.user = { sub: 'u1', permissions: ['*'], roles: [] };
      const reply = mockReply();

      const handler = requirePermission('orders:read');
      await handler(req, reply);

      expect(reply.code).not.toHaveBeenCalled();
    });

    it('allows user with exact permission', async () => {
      const req = mockReq();
      req.user = { sub: 'u1', permissions: ['orders:read'], roles: [] };
      const reply = mockReply();

      const handler = requirePermission('orders:read');
      await handler(req, reply);

      expect(reply.code).not.toHaveBeenCalled();
    });

    it('allows user with resource wildcard', async () => {
      const req = mockReq();
      req.user = { sub: 'u1', permissions: ['orders:*'], roles: [] };
      const reply = mockReply();

      const handler = requirePermission('orders:write');
      await handler(req, reply);

      expect(reply.code).not.toHaveBeenCalled();
    });

    it('rejects user without required permission', async () => {
      const req = mockReq();
      req.user = { sub: 'u1', permissions: ['orders:read'], roles: [] };
      const reply = mockReply();

      const handler = requirePermission('orders:write');
      await handler(req, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
    });

    it('rejects unauthenticated user', async () => {
      const req = mockReq();
      const reply = mockReply();

      const handler = requirePermission('orders:read');
      await handler(req, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalAuth', () => {
    it('sets req.user when valid token is present', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        roles: [],
        permissions: [],
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = makeToken(payload);
      const req = mockReq(`Bearer ${token}`);

      await optionalAuth(req);

      expect(req.user).toBeDefined();
      expect(req.user.sub).toBe('user-1');
    });

    it('does nothing when no auth header present', async () => {
      const req = mockReq();
      await optionalAuth(req);
      expect(req.user).toBeUndefined();
    });

    it('silently ignores invalid token', async () => {
      const req = mockReq('Bearer invalid.token.here');
      await optionalAuth(req);
      expect(req.user).toBeUndefined();
    });
  });
});
