export const TOKENS = {
  PrismaClient: Symbol.for('PrismaClient'),
  IUserRepository: Symbol.for('IUserRepository'),
  IRoleRepository: Symbol.for('IRoleRepository'),
  ISessionRepository: Symbol.for('ISessionRepository'),
  IAuthProviderRepository: Symbol.for('IAuthProviderRepository'),
  IAuthService: Symbol.for('IAuthService'),
  IPasswordService: Symbol.for('IPasswordService'),
  ITokenService: Symbol.for('ITokenService'),
  IOAuthService: Symbol.for('IOAuthService'),
} as const;
