type Factory<T> = () => T;

class Container {
  private bindings = new Map<symbol, Factory<any>>();
  private singletons = new Map<symbol, any>();

  bind<T>(token: symbol) {
    return {
      toFactory: (factory: Factory<T>) => {
        this.bindings.set(token, factory);
      }
    };
  }

  singleton<T>(token: symbol) {
    return {
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

  resolve<T>(token: symbol): T {
    const factory = this.bindings.get(token);
    if (!factory) {
      throw new Error(`No binding found for token: ${token.toString()}`);
    }
    return factory();
  }

  clear() {
    this.bindings.clear();
    this.singletons.clear();
  }
}

export const container = new Container();
