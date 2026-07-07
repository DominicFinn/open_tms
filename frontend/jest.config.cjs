module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: false,
      tsconfig: 'tsconfig.jest.json',
    }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // The monorepo root hoists a React 19 copy (pulled in transitively by other
    // workspaces), but this app pins React 18. Hoisted deps like
    // @testing-library/react resolve react-dom from the root, so force every
    // react / react-dom entrypoint to this workspace's single 18.x copy —
    // otherwise elements created by React 18 are rendered by ReactDOM 19 and
    // React throws "an older version of React was rendered".
    '^react$': '<rootDir>/node_modules/react',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    // packages/shared ships ESM-only output; point tests at the TS source instead
    // so ts-jest compiles it inline rather than requiring the built ESM dist.
    '^@open-tms/shared$': '<rootDir>/../packages/shared/src/index.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(leaflet)/)',
  ],
};
