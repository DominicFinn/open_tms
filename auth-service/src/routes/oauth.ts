import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { container } from '../di/container.js';
import { TOKENS } from '../di/tokens.js';
import { IAuthProviderRepository } from '../repositories/AuthProviderRepository.js';
import { IOAuthService } from '../services/OAuthService.js';

// In-memory state store for CSRF protection (short-lived)
const pendingStates = new Map<string, { provider: string; returnUrl: string; expiresAt: number }>();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingStates) {
    if (value.expiresAt < now) pendingStates.delete(key);
  }
}, 60_000);

export async function oauthRoutes(server: FastifyInstance) {
  const providerRepo = container.resolve<IAuthProviderRepository>(TOKENS.IAuthProviderRepository);
  const oauthService = container.resolve<IOAuthService>(TOKENS.IOAuthService);

  // GET /api/v1/oauth/:provider — Start OAuth flow (redirects to provider)
  server.get('/api/v1/oauth/:provider', async (req, reply) => {
    const { provider: providerName } = req.params as { provider: string };
    const { returnUrl } = req.query as { returnUrl?: string };

    const providerConfig = await providerRepo.findByProvider(providerName);
    if (!providerConfig || !providerConfig.enabled) {
      reply.code(404);
      return { data: null, error: `OAuth provider "${providerName}" is not configured or not enabled` };
    }

    if (!providerConfig.clientId || !providerConfig.clientSecret) {
      reply.code(500);
      return { data: null, error: 'OAuth provider is not fully configured' };
    }

    // Generate CSRF state token
    const state = randomBytes(32).toString('base64url');
    pendingStates.set(state, {
      provider: providerName,
      returnUrl: returnUrl || '/',
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    // Build callback URL
    const authServiceBaseUrl = process.env.AUTH_SERVICE_URL || `http://localhost:${process.env.AUTH_PORT || 3002}`;
    const callbackUrl = `${authServiceBaseUrl}/api/v1/oauth/${providerName}/callback`;

    const authorizationUrl = oauthService.getAuthorizationUrl(providerConfig, callbackUrl, state);
    reply.redirect(authorizationUrl);
  });

  // GET /api/v1/oauth/:provider/callback — OAuth callback (provider redirects here)
  server.get('/api/v1/oauth/:provider/callback', async (req, reply) => {
    const { provider: providerName } = req.params as { provider: string };
    const { code, state, error: oauthError } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    // Provider returned an error
    if (oauthError) {
      return redirectWithError(reply, '/', `OAuth error: ${oauthError}`);
    }

    // Validate state (CSRF protection)
    if (!state || !pendingStates.has(state)) {
      return redirectWithError(reply, '/', 'Invalid or expired OAuth state. Please try again.');
    }

    const pendingState = pendingStates.get(state)!;
    pendingStates.delete(state);

    if (pendingState.provider !== providerName || pendingState.expiresAt < Date.now()) {
      return redirectWithError(reply, pendingState.returnUrl, 'OAuth state mismatch or expired');
    }

    if (!code) {
      return redirectWithError(reply, pendingState.returnUrl, 'No authorization code received');
    }

    // Load provider config
    const providerConfig = await providerRepo.findByProvider(providerName);
    if (!providerConfig || !providerConfig.enabled) {
      return redirectWithError(reply, pendingState.returnUrl, 'OAuth provider is no longer available');
    }

    try {
      // Exchange code for user info
      const authServiceBaseUrl = process.env.AUTH_SERVICE_URL || `http://localhost:${process.env.AUTH_PORT || 3002}`;
      const callbackUrl = `${authServiceBaseUrl}/api/v1/oauth/${providerName}/callback`;

      const userInfo = await oauthService.exchangeCodeForTokens(providerConfig, code, callbackUrl);

      // Find or create user and generate tokens
      const result = await oauthService.handleOAuthLogin(
        providerConfig,
        userInfo,
        req.headers['user-agent'],
        req.ip,
      );

      if (!result.success) {
        return redirectWithError(reply, pendingState.returnUrl, result.error || 'Authentication failed');
      }

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const returnPath = pendingState.returnUrl || '/';
      const params = new URLSearchParams({
        accessToken: result.tokens!.accessToken,
        refreshToken: result.tokens!.refreshToken,
        expiresIn: result.tokens!.expiresIn.toString(),
      });

      reply.redirect(`${frontendUrl}/auth/callback?${params.toString()}&returnUrl=${encodeURIComponent(returnPath)}`);
    } catch (err) {
      server.log.error(err, 'OAuth callback error');
      return redirectWithError(reply, pendingState.returnUrl, 'Authentication failed. Please try again.');
    }
  });
}

function redirectWithError(reply: any, returnUrl: string, error: string) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const params = new URLSearchParams({ error, returnUrl });
  reply.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
}
