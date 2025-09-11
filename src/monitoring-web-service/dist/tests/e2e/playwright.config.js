"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
exports.default = (0, test_1.defineConfig)({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 30 * 1000,
    globalTimeout: 5 * 60 * 1000,
    expect: {
        timeout: 5000
    },
    reporter: [
        ['html', { outputFolder: 'e2e-results/html' }],
        ['json', { outputFile: 'e2e-results/results.json' }],
        ['junit', { outputFile: 'e2e-results/junit.xml' }],
        process.env.CI ? ['github'] : ['list']
    ],
    globalSetup: require.resolve('./global-setup.ts'),
    globalTeardown: require.resolve('./global-teardown.ts'),
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        timezoneId: 'America/New_York',
        locale: 'en-US',
        reducedMotion: 'reduce',
        navigationTimeout: 15000,
        actionTimeout: 10000,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9'
        }
    },
    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
            teardown: 'teardown'
        },
        {
            name: 'teardown',
            testMatch: /.*\.teardown\.ts/
        },
        {
            name: 'chromium',
            use: {
                ...test_1.devices['Desktop Chrome'],
                viewport: { width: 1280, height: 720 }
            },
            dependencies: ['setup']
        },
        {
            name: 'firefox',
            use: {
                ...test_1.devices['Desktop Firefox'],
                viewport: { width: 1280, height: 720 }
            },
            dependencies: ['setup']
        },
        {
            name: 'webkit',
            use: {
                ...test_1.devices['Desktop Safari'],
                viewport: { width: 1280, height: 720 }
            },
            dependencies: ['setup']
        },
        {
            name: 'Mobile Chrome',
            use: { ...test_1.devices['Pixel 5'] },
            dependencies: ['setup']
        },
        {
            name: 'Mobile Safari',
            use: { ...test_1.devices['iPhone 12'] },
            dependencies: ['setup']
        },
        {
            name: 'iPad',
            use: { ...test_1.devices['iPad Pro'] },
            dependencies: ['setup']
        },
        {
            name: 'Desktop Chrome High DPI',
            use: {
                ...test_1.devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
                deviceScaleFactor: 2
            },
            dependencies: ['setup']
        }
    ],
    webServer: process.env.CI ? undefined : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 30 * 1000,
        env: {
            NODE_ENV: 'test',
            PORT: '3000',
            DATABASE_URL: 'postgresql://test:test@localhost:5432/fortium_metrics_e2e_test',
            JWT_SECRET: 'e2e-test-jwt-secret-32-characters-long',
            JWT_REFRESH_SECRET: 'e2e-test-jwt-refresh-secret-32-chars',
            REDIS_URL: 'redis://localhost:6379/15',
            LOG_LEVEL: 'warn'
        }
    },
    outputDir: 'e2e-results/artifacts',
    maxFailures: process.env.CI ? 10 : 0,
    preserveOutput: 'failures-only',
    updateSnapshots: process.env.CI ? 'none' : 'missing',
    globalTeardown: './global-teardown.ts'
});
//# sourceMappingURL=playwright.config.js.map