/**
 * Simple Dependency Injection Container
 * Manages the registration and resolution of dependencies
 */

type Constructor<T> = new (...args: any[]) => T;
type Factory<T> = () => T;

class Container {
  private bindings = new Map<symbol, Factory<any>>();
  private singletons = new Map<symbol, any>();

  /**
   * Bind an interface to a concrete implementation
   */
  bind<T>(token: symbol): {
    to: (implementation: Constructor<T>) => void;
    toFactory: (factory: Factory<T>) => void;
  } {
    return {
      to: (implementation: Constructor<T>) => {
        this.bindings.set(token, () => new implementation());
      },
      toFactory: (factory: Factory<T>) => {
        this.bindings.set(token, factory);
      }
    };
  }

  /**
   * Bind an interface to a singleton instance
   */
  singleton<T>(token: symbol): {
    to: (implementation: Constructor<T>) => void;
    toFactory: (factory: Factory<T>) => void;
  } {
    return {
      to: (implementation: Constructor<T>) => {
        this.bindings.set(token, () => {
          if (!this.singletons.has(token)) {
            this.singletons.set(token, new implementation());
          }
          return this.singletons.get(token);
        });
      },
      toFactory: (factory: Factory<T>) => {
        this.bindings.set(token, () => {
          if (!this.singletons.has(token)) {
            this.singletons.set(token, factory());
          }
          return this.singletons.get(token);
        });
      }
    };
  }

  /**
   * Resolve a dependency from the container
   */
  resolve<T>(token: symbol): T {
    const factory = this.bindings.get(token);
    if (!factory) {
      throw new Error(`No binding found for token: ${token.toString()}`);
    }
    return factory();
  }

  /**
   * Check if a binding exists
   */
  has(token: symbol): boolean {
    return this.bindings.has(token);
  }

  /**
   * Clear all bindings (useful for testing)
   */
  clear(): void {
    this.bindings.clear();
    this.singletons.clear();
  }
}

// Export singleton instance
export const container = new Container();
