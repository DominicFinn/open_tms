import { container } from '../di/container';

describe('DI Container', () => {
  afterEach(() => {
    container.clear();
  });

  describe('bind', () => {
    it('binds a factory and resolves it', () => {
      const token = Symbol.for('test-factory');
      container.bind(token).toFactory(() => ({ value: 42 }));

      const result = container.resolve<{ value: number }>(token);
      expect(result.value).toBe(42);
    });

    it('creates a new instance on every resolve for bind', () => {
      const token = Symbol.for('test-transient');
      container.bind(token).toFactory(() => ({ id: Math.random() }));

      const a = container.resolve<{ id: number }>(token);
      const b = container.resolve<{ id: number }>(token);
      expect(a).not.toBe(b);
    });

    it('binds a class constructor', () => {
      class MyService {
        name = 'hello';
      }
      const token = Symbol.for('test-class');
      container.bind(token).to(MyService);

      const result = container.resolve<MyService>(token);
      expect(result.name).toBe('hello');
    });
  });

  describe('singleton', () => {
    it('returns the same instance on every resolve', () => {
      const token = Symbol.for('test-singleton');
      container.singleton(token).toFactory(() => ({ id: Math.random() }));

      const a = container.resolve(token);
      const b = container.resolve(token);
      expect(a).toBe(b);
    });

    it('supports class constructors as singletons', () => {
      class SingleService {
        readonly ts = Date.now();
      }
      const token = Symbol.for('test-singleton-class');
      container.singleton(token).to(SingleService);

      const a = container.resolve<SingleService>(token);
      const b = container.resolve<SingleService>(token);
      expect(a).toBe(b);
      expect(a.ts).toBe(b.ts);
    });
  });

  describe('resolve', () => {
    it('throws when no binding is found', () => {
      const token = Symbol.for('missing');
      expect(() => container.resolve(token)).toThrow('No binding found for token');
    });
  });

  describe('has', () => {
    it('returns true when binding exists', () => {
      const token = Symbol.for('test-has');
      container.bind(token).toFactory(() => 'hi');
      expect(container.has(token)).toBe(true);
    });

    it('returns false when binding does not exist', () => {
      expect(container.has(Symbol.for('nope'))).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes all bindings and singletons', () => {
      const token = Symbol.for('test-clear');
      container.singleton(token).toFactory(() => ({ v: 1 }));
      container.resolve(token);

      container.clear();

      expect(container.has(token)).toBe(false);
      expect(() => container.resolve(token)).toThrow();
    });
  });
});
