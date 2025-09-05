"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'metrics_test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'metrics_user';
process.env.DB_PASSWORD = 'test_password';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-for-testing-purposes-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-purposes-only';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.JWT_ISSUER = 'fortium-test';
process.env.LOG_LEVEL = 'error';
process.env.SSO_ENCRYPTION_KEY = 'test-encryption-key-for-sso-secrets';
jest.setTimeout(30000);
afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
});
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
});
afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});
global.delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
//# sourceMappingURL=setup.js.map