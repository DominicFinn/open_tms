import { PrismaClient } from '@prisma/client';
import { container } from './container.js';
import { TOKENS } from './tokens.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { RoleRepository } from '../repositories/RoleRepository.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { AuthService } from '../services/AuthService.js';
import { PasswordService } from '../services/PasswordService.js';
import { TokenService } from '../services/TokenService.js';

export function registerDependencies(prisma: PrismaClient): void {
  container.singleton(TOKENS.PrismaClient).toFactory(() => prisma);

  container.singleton(TOKENS.IUserRepository).toFactory(() => {
    return new UserRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IRoleRepository).toFactory(() => {
    return new RoleRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ISessionRepository).toFactory(() => {
    return new SessionRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IPasswordService).toFactory(() => {
    return new PasswordService();
  });

  container.singleton(TOKENS.ITokenService).toFactory(() => {
    return new TokenService();
  });

  container.singleton(TOKENS.IAuthService).toFactory(() => {
    return new AuthService(
      container.resolve(TOKENS.IUserRepository),
      container.resolve(TOKENS.IRoleRepository),
      container.resolve(TOKENS.ISessionRepository),
      container.resolve(TOKENS.IPasswordService),
      container.resolve(TOKENS.ITokenService),
    );
  });
}
