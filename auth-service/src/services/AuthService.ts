import { IUserRepository } from '../repositories/UserRepository.js';
import { IRoleRepository } from '../repositories/RoleRepository.js';
import { ISessionRepository } from '../repositories/SessionRepository.js';
import { IPasswordService } from './PasswordService.js';
import { ITokenService, JWTPayload, TokenPair } from './TokenService.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationId?: string;
  roleName?: string; // Default role to assign
}

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
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
}

export interface IAuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(input: LoginInput): Promise<AuthResult>;
  logout(refreshToken: string): Promise<void>;
  logoutAll(userId: string): Promise<void>;
  refresh(refreshToken: string, userAgent?: string, ipAddress?: string): Promise<AuthResult>;
  getProfile(userId: string): Promise<AuthResult>;
}

export class AuthService implements IAuthService {
  constructor(
    private userRepo: IUserRepository,
    private roleRepo: IRoleRepository,
    private sessionRepo: ISessionRepository,
    private passwordService: IPasswordService,
    private tokenService: ITokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    // Validate password
    const validation = this.passwordService.validate(input.password);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('. ') };
    }

    // Check if email already exists
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      return { success: false, error: 'Email already registered' };
    }

    // Hash password and create user
    const passwordHash = await this.passwordService.hash(input.password);
    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      organizationId: input.organizationId,
    });

    // Assign default role
    const roleName = input.roleName || 'readonly';
    const role = await this.roleRepo.findByName(roleName);
    if (role) {
      await this.roleRepo.assignToUser(user.id, role.id);
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: role ? [role.name] : [],
      },
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmailWithRoles(input.email);

    if (!user || !user.active) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return { success: false, error: `Account locked. Try again in ${minutesLeft} minute(s)` };
    }

    // OAuth-only users can't log in with password
    if (!user.passwordHash) {
      return { success: false, error: 'This account uses OAuth sign-in. Please use the appropriate sign-in provider.' };
    }

    // Verify password
    const valid = await this.passwordService.verify(input.password, user.passwordHash);
    if (!valid) {
      await this.userRepo.recordFailedLogin(user.id);

      // Lock after max attempts
      if (user.failedLoginAttempts + 1 >= MAX_FAILED_ATTEMPTS) {
        await this.userRepo.lockAccount(user.id, new Date(Date.now() + LOCKOUT_DURATION_MS));
        return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes' };
      }

      return { success: false, error: 'Invalid email or password' };
    }

    // Build JWT payload
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur => ur.role.permissions as string[]);
    const uniquePermissions = [...new Set(permissions)];

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions: uniquePermissions,
      organizationId: user.organizationId ?? undefined,
      customerId: user.customerId ?? undefined,
    };

    const tokens = this.tokenService.generateTokenPair(payload);

    // Store refresh token session
    await this.sessionRepo.create(
      user.id,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
      input.userAgent,
      input.ipAddress,
    );

    // Record successful login
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
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessionRepo.deleteByToken(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepo.deleteAllForUser(userId);
  }

  async refresh(refreshToken: string, userAgent?: string, ipAddress?: string): Promise<AuthResult> {
    const session = await this.sessionRepo.findByToken(refreshToken);
    if (!session || session.expiresAt < new Date()) {
      return { success: false, error: 'Invalid or expired refresh token' };
    }

    // Delete old session
    await this.sessionRepo.deleteByToken(refreshToken);

    // Load user with roles
    const user = await this.userRepo.findByIdWithRoles(session.userId);
    if (!user || !user.active) {
      return { success: false, error: 'User account is inactive' };
    }

    // Generate new token pair (token rotation)
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

    // Store new refresh token session
    await this.sessionRepo.create(
      user.id,
      tokens.refreshToken,
      tokens.refreshExpiresAt,
      userAgent,
      ipAddress,
    );

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
    };
  }

  async getProfile(userId: string): Promise<AuthResult> {
    const user = await this.userRepo.findByIdWithRoles(userId);
    if (!user || !user.active) {
      return { success: false, error: 'User not found' };
    }

    const roles = user.roles.map(ur => ur.role.name);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
      },
    };
  }
}
