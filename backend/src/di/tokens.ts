/**
 * Dependency Injection Tokens
 * Symbols used to identify dependencies in the container
 */

// Repository tokens
export const TOKENS = {
  ICustomersRepository: Symbol.for('ICustomersRepository'),
  ICarriersRepository: Symbol.for('ICarriersRepository'),
  ILocationsRepository: Symbol.for('ILocationsRepository'),
  IShipmentsRepository: Symbol.for('IShipmentsRepository'),
  ILanesRepository: Symbol.for('ILanesRepository'),

  // Infrastructure tokens
  PrismaClient: Symbol.for('PrismaClient'),
} as const;
