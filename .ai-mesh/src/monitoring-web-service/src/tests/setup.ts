/**
 * Jest Test Setup
 * Fortium External Metrics Web Service - Task 1.9: Testing Infrastructure
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-32-characters-long-for-testing-purposes';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-32-characters-long-for-testing-purposes';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/fortium_metrics_test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Global test constants
export const TEST_CONSTANTS = {
  VALID_UUID: '123e4567-e89b-12d3-a456-426614174000',
  VALID_EMAIL: 'test@fortium.com',
  VALID_PASSWORD: 'TestPassword123!',
  INVALID_PASSWORD: '123',
  TEST_TENANT_ID: '123e4567-e89b-12d3-a456-426614174000',
  TEST_USER_ID: '987fcdeb-51a2-43d7-8f06-426614174001',
  MOCK_JWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
};

// Test utilities
export const TestUtils = {
  /**
   * Create mock Express request
   */
  createMockRequest: (overrides: any = {}) => ({
    body: {},
    query: {},
    params: {},
    headers: {},
    method: 'GET',
    path: '/',
    originalUrl: '/',
    ip: '127.0.0.1',
    user: undefined,
    tenant: undefined,
    requestId: 'test-request-id',
    ...overrides,
  }),

  /**
   * Create mock Express response
   */
  createMockResponse: () => {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      getHeader: jest.fn(),
      removeHeader: jest.fn().mockReturnThis(),
    };
    
    // Add custom response methods
    res.success = jest.fn().mockReturnThis();
    res.error = jest.fn().mockReturnThis();
    res.created = jest.fn().mockReturnThis();
    res.notFound = jest.fn().mockReturnThis();
    
    return res;
  },

  /**
   * Create mock next function
   */
  createMockNext: () => jest.fn(),
};