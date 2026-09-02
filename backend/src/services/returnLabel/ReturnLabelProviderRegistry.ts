import type { IReturnLabelProvider, IReturnLabelProviderRegistry } from './IReturnLabelProvider.js';
import { ManualReturnLabelProvider } from './providers/ManualReturnLabelProvider.js';
import { FedExReturnLabelProvider } from './providers/FedExReturnLabelProvider.js';
import { UPSReturnLabelProvider } from './providers/UPSReturnLabelProvider.js';
import { DHLReturnLabelProvider } from './providers/DHLReturnLabelProvider.js';

export class ReturnLabelProviderRegistry implements IReturnLabelProviderRegistry {
  private readonly providers: Map<string, IReturnLabelProvider>;

  constructor(providers?: IReturnLabelProvider[]) {
    this.providers = new Map();
    const defaults = providers ?? [
      new ManualReturnLabelProvider(),
      new FedExReturnLabelProvider(),
      new UPSReturnLabelProvider(),
      new DHLReturnLabelProvider(),
    ];
    for (const p of defaults) {
      this.providers.set(p.name, p);
    }
  }

  get(providerName: string): IReturnLabelProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(
        `Unknown return label provider "${providerName}". Available: ${Array.from(this.providers.keys()).join(', ')}`,
      );
    }
    return provider;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
