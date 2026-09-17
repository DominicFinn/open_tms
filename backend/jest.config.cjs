module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  // Several suites can run at once across worktrees and subagents, and the
  // default of one worker per core has locked up 16GB machines (#310).
  maxWorkers: 4,
  workerIdleMemoryLimit: '1GB',
  transform: {
    // Transpile only: `tsc --noEmit` does the type-checking, and a full
    // TypeScript program in every worker is what used the memory (#310).
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: '<rootDir>/tsconfig.jest.json',
    }],
  },
  // Strip .js extensions from imports so ts-jest can resolve .ts files
  moduleNameMapper: {
    // packages/shared ships ESM-only output; point tests at the TS source instead
    // so ts-jest compiles it inline rather than requiring the built ESM dist.
    '^@open-tms/shared$': '<rootDir>/../packages/shared/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
