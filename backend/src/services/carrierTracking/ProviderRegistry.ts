/**
 * ProviderRegistry -- factory that maps providerType strings to ICarrierTrackingProvider instances.
 *
 * Register concrete provider implementations at startup, then create instances by type string.
 */

import type { ICarrierTrackingProvider } from './ICarrierTrackingProvider.js';

/** Factory function that creates a provider instance */
export type ProviderFactory = () => ICarrierTrackingProvider;

export class CarrierTrackingProviderRegistry {
  private factories = new Map<string, ProviderFactory>();

  /**
   * Register a provider factory for a given type string.
   * @param providerType - e.g. "fedex", "ups", "dhl", "usps", "easypost", "aftership"
   * @param factory - function that creates an instance of the provider
   */
  register(providerType: string, factory: ProviderFactory): void {
    this.factories.set(providerType.toLowerCase(), factory);
  }

  /**
   * Create a provider instance for the given type.
   * @throws Error if providerType is not registered
   */
  create(providerType: string): ICarrierTrackingProvider {
    const factory = this.factories.get(providerType.toLowerCase());
    if (!factory) {
      throw new Error(
        `Unknown carrier tracking provider type: "${providerType}". ` +
        `Supported types: ${this.getSupportedProviders().join(', ')}`
      );
    }
    return factory();
  }

  /** Return a list of all registered provider type strings */
  getSupportedProviders(): string[] {
    return Array.from(this.factories.keys());
  }
}
