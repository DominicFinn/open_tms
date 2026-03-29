import { AuthProvider } from '@prisma/client';
import { IUserRepository } from '../repositories/UserRepository.js';
import { IRoleRepository } from '../repositories/RoleRepository.js';
import { ISessionRepository } from '../repositories/SessionRepository.js';
import { ITokenService, JWTPayload, TokenPair } from './TokenService.js';

// OAuth provider configurations (endpoints)
const PROVIDER_CONFIG: Record<string, {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  microsoft: {
    authUrl: '', // Constructed dynamically with tenantId
    tokenUrl: '', // Constructed dynamically with tenantId
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
  },
};

function getMicrosoftUrls(tenantId?: string | null) {
  const tenant = tenantId || 'common';
  return {
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  };
}

export interface OAuthUserInfo {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface OAuthResult {
  success: boolean;
  error?: string;
  tokens?: TokenPair;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
  isNewUser?: boolean;
}

export interface IOAuthService {
  getAuthorizationUrl(provider: AuthProvider, callbackUrl: string, state: string): string;
  exchangeCodeForTokens(provider: AuthProvider, code: string, callbackUrl: string): Promise<OAuthUserInfo>;
  handleOAuthLogin(providerConfig: AuthProvider, userInfo: OAuthUserInfo, userAgent?: string, ipAddress?: string): Promise<OAuthResult>;
}

export class OAuthService implements IOAuthService {
  constructor(
    private userRepo: IUserRepository,
    private roleRepo: IRoleRepository,
    private sessionRepo: ISessionRepository,
    private tokenService: ITokenService,
  ) {}

  getAuthorizationUrl(provider: AuthProvider, callbackUrl: string, state: string): string {
    const config = PROVIDER_CONFIG[provider.provider];
    if (!config) throw new Error(`Unsupported provider: ${provider.provider}`);

    let authUrl = config.authUrl;
    if (provider.provider === 'microsoft') {
      authUrl = getMicrosoftUrls(provider.tenantId).authUrl;
    }

    const params = new URLSearchParams({
      client_id: provider.clientId!,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return `${authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(provider: AuthProvider, code: string, callbackUrl: string): Promise<OAuthUserInfo> {
    const config = PROVIDER_CONFIG[provider.provider];
    if (!config) throw new Error(`Unsupported provider: ${provider.provider}`);

    let tokenUrl = config.tokenUrl;
    if (provider.provider === 'microsoft') {
      tokenUrl = getMicrosoftUrls(provider.tenantId).tokenUrl;
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: provider.clientId!,
        client_secret: provider.clientSecret!,
        code,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokenData = await tokenResponse.json() as { access_token: string };

    // Fetch user profile
    const userInfoResponse = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user profile from provider');
    }

    const profile = await userInfoResponse.json() as Record<string, any>;

    // Normalize profile across providers
    return this.normalizeProfile(provider.provider, profile);
  }

  async handleOAuthLogin(
    providerConfig: AuthProvider,
    userInfo: OAuthUserInfo,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<OAuthResult> {
    // Check allowed domains
    const allowedDomains = providerConfig.allowedDomains as string[] | null;
    if (allowedDomains && allowedDomains.length > 0) {
      const emailDomain = userInfo.email.split('@')[1]?.toLowerCase();
      if (!allowedDomains.map(d => d.toLowerCase()).includes(emailDomain)) {
        return { success: false, error: `Email domain "${emailDomain}" is not allowed for this provider` };
      }
    }

    // Find existing user by provider+providerId or by email
    let user = await this.userRepo.findByEmailWithRoles(userInfo.email);
    let isNewUser = false;

    if (!user) {
      // Auto-create if enabled
      if (!providerConfig.autoCreateUsers) {
        return { success: false, error: 'Account does not exist. Contact an administrator.' };
      }

      const newUser = await this.userRepo.create({
        email: userInfo.email,
        passwordHash: '', // No password for OAuth users
        firstName: userInfo.firstName,
        lastName: userInfo.lastName,
      });

      // Update provider fields (not in create DTO, use direct update)
      await this.userRepo.update(newUser.id, {
        avatarUrl: userInfo.avatarUrl,
      });

      // Assign default role
      if (providerConfig.defaultRoleId) {
        await this.roleRepo.assignToUser(newUser.id, providerConfig.defaultRoleId);
      } else {
        const readonlyRole = await this.roleRepo.findByName('readonly');
        if (readonlyRole) {
          await this.roleRepo.assignToUser(newUser.id, readonlyRole.id);
        }
      }

      user = await this.userRepo.findByIdWithRoles(newUser.id);
      isNewUser = true;
    }

    if (!user || !user.active) {
      return { success: false, error: 'Account is inactive' };
    }

    // Build JWT payload
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur => ur.role.permissions as string[]);

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions: [...new Set(permissions)],
      organizationId: user.organizationId ?? undefined,
      customerId: user.customerId ?? undefined,
    };

    const tokens = this.tokenService.generateTokenPair(payload);

    await this.sessionRepo.create(
      user.id,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
      userAgent,
      ipAddress,
    );

    await this.userRepo.recordLogin(user.id);

    return {
      success: true,
      tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
      },
      isNewUser,
    };
  }

  private normalizeProfile(provider: string, profile: Record<string, any>): OAuthUserInfo {
    switch (provider) {
      case 'google':
        return {
          providerId: profile.id,
          email: profile.email,
          firstName: profile.given_name || profile.name?.split(' ')[0] || '',
          lastName: profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
          avatarUrl: profile.picture,
        };
      case 'microsoft':
        return {
          providerId: profile.id,
          email: profile.mail || profile.userPrincipalName,
          firstName: profile.givenName || profile.displayName?.split(' ')[0] || '',
          lastName: profile.surname || profile.displayName?.split(' ').slice(1).join(' ') || '',
        };
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
