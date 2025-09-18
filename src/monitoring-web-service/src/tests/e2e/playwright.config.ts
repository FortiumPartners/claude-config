/**
 * Playwright E2E Testing Configuration
 * Sprint 9.2: End-to-end testing automation
 * Coverage: Authentication flows, Dashboard functionality, Real-time features
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Global timeout for each test
  timeout: 30 * 1000,
  
  // Global timeout for the entire test suite
  globalTimeout: 5 * 60 * 1000,
  
  // Expect timeout
  expect: {
    // Maximum time expect() should wait for the condition to be met
    timeout: 5000
  },

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'e2e-results/html' }],
    ['json', { outputFile: 'e2e-results/results.json' }],
    ['junit', { outputFile: 'e2e-results/junit.xml' }],
    // Add line reporter for CI
    process.env.CI ? ['github'] : ['list']
  ],

  // Global Setup and Teardown
  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),

  use: {
    // Base URL for the application
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video recording
    video: 'retain-on-failure',
    
    // Emulate timezone
    timezoneId: 'America/New_York',
    
    // Emulate locale
    locale: 'en-US',
    
    // Emulate reduced motion
    reducedMotion: 'reduce',
    
    // Default navigation timeout
    navigationTimeout: 15000,
    
    // Default action timeout
    actionTimeout: 10000,
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    }
  },

  // Configure projects for major browsers
  projects: [
    // Setup project that runs before all other projects
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'teardown'
    },
    {
      name: 'teardown',
      testMatch: /.*\.teardown\.ts/
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      dependencies: ['setup']
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
      dependencies: ['setup']
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
      dependencies: ['setup']
    },

    // Mobile devices
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup']
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup']
    },

    // Tablet devices
    {
      name: 'iPad',
      use: { ...devices['iPad Pro'] },
      dependencies: ['setup']
    },

    // High DPI displays
    {
      name: 'Desktop Chrome High DPI',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2
      },
      dependencies: ['setup']
    }
  ],

  // Development server configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30 * 1000,
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      // Test database configuration
      DATABASE_URL: 'postgresql://test:test@localhost:5432/fortium_metrics_e2e_test',
      JWT_SECRET: 'e2e-test-jwt-secret-32-characters-long',
      JWT_REFRESH_SECRET: 'e2e-test-jwt-refresh-secret-32-chars',
      // Disable external services for E2E tests
      REDIS_URL: 'redis://localhost:6379/15', // Use database 15 for E2E tests
      LOG_LEVEL: 'warn'
    }
  },

  // Test output directory
  outputDir: 'e2e-results/artifacts',

  // Maximum number of test files running in parallel
  maxFailures: process.env.CI ? 10 : 0,

  // Whether to preserve output between runs
  preserveOutput: 'failures-only',

  // Update snapshots on CI
  updateSnapshots: process.env.CI ? 'none' : 'missing',

  // Global test configuration
  globalTeardown: './global-teardown.ts'
});