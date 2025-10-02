/**
 * Dependency Injection Registry
 * Registers all dependencies at application startup
 */

import { PrismaClient } from '@prisma/client';
import { container } from './container.js';
import { TOKENS } from './tokens.js';
import { CustomersRepository } from '../repositories/CustomersRepository.js';
import { CarriersRepository } from '../repositories/CarriersRepository.js';
import { LocationsRepository } from '../repositories/LocationsRepository.js';
import { ShipmentsRepository } from '../repositories/ShipmentsRepository.js';
import { LanesRepository } from '../repositories/LanesRepository.js';

/**
 * Register all application dependencies
 */
export function registerDependencies(prisma: PrismaClient): void {
  // Register PrismaClient as singleton
  container.singleton(TOKENS.PrismaClient).toFactory(() => prisma);

  // Register repositories as singletons (they're stateless, so we can reuse instances)
  container.singleton(TOKENS.ICustomersRepository).toFactory(() => {
    return new CustomersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ICarriersRepository).toFactory(() => {
    return new CarriersRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILocationsRepository).toFactory(() => {
    return new LocationsRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.IShipmentsRepository).toFactory(() => {
    return new ShipmentsRepository(container.resolve(TOKENS.PrismaClient));
  });

  container.singleton(TOKENS.ILanesRepository).toFactory(() => {
    return new LanesRepository(container.resolve(TOKENS.PrismaClient));
  });
}
