/**
 * Jest Test Setup
 * Global setup for all test files
 */

// Set test environment variables
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
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
process.env.SSO_ENCRYPTION_KEY = 'test-encryption-key-for-sso-secrets';

// Mock external services that we don't want to hit during tests
// jest.mock('node-fetch'); // Commented out for now since node-fetch isn't installed yet

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Global test teardown
afterAll(async () => {
  // Clean up any global resources
  await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay to ensure cleanup
});

// Mock console methods to reduce noise during tests
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

// Helper function for tests
global.delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define global test types
declare global {
  namespace NodeJS {
    interface Global {
      delay: (ms: number) => Promise<void>;
    }
  }
  
  var delay: (ms: number) => Promise<void>;
}

export {};