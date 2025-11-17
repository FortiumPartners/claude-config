/**
 * Jest Configuration for AI Mesh Tests
 * Includes performance testing support with extended timeouts
 */

module.exports = {
  // Test environment (custom environment for Node.js 25+ localStorage compatibility)
  testEnvironment: './jest-custom-environment.js',

  // Test match patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.spec.js'
  ],

  // Coverage configuration
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],

  // Coverage thresholds (aligned with TRD requirements)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80
    }
  },

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Ignore patterns (global)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.claude.old/',
    '/dist/',
    '/build/'
  ],

  // Module resolution ignore patterns (prevents Haste naming collisions)
  modulePathIgnorePatterns: [
    '<rootDir>/.claude.old/',
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],

  // Test timeout (default)
  testTimeout: 10000,

  // Performance test specific configuration
  projects: [
    {
      displayName: 'unit',
      testEnvironment: '<rootDir>/jest-custom-environment.js',
      testMatch: ['**/__tests__/**/*.test.js'],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/.claude.old/',
        '/__tests__/performance/',
        '/__tests__/integration/'
      ]
    },
    {
      displayName: 'performance',
      testEnvironment: '<rootDir>/jest-custom-environment.js',
      testMatch: ['**/__tests__/performance/**/*.test.js'],
      testTimeout: 60000, // 60s for performance tests
      maxWorkers: 1, // Run performance tests serially for accurate metrics
    },
    {
      displayName: 'integration',
      testEnvironment: '<rootDir>/jest-custom-environment.js',
      testMatch: ['**/__tests__/integration/**/*.test.js'],
      testTimeout: 30000, // 30s for integration tests
      maxWorkers: 1 // Run integration tests serially to avoid file system conflicts
    }
  ],

  // Verbose output for CI/CD
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Performance monitoring
  bail: false, // Continue running tests even if some fail
  maxWorkers: 1, // Run projects sequentially to avoid file system conflicts

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Reporters
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ]
};
