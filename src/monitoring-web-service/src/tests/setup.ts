/**
 * Jest setup file for multi-tenant database tests.
 * 
 * Configures test environment, extends Jest matchers, and provides
 * global test utilities for the external metrics service.
 */

import { jest } from '@jest/globals';

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Global test configuration
const TEST_CONFIG = {
  database: {
    maxConnections: 10,
    connectionTimeout: 30000,
    queryTimeout: 10000,
  },
  performance: {
    maxQueryTime: 1000,
    maxInsertTime: 500,
    maxConcurrentConnections: 5,
  },
  retention: {
    commandExecutionsDays: 365,
    agentInteractionsDays: 180,
    userSessionsDays: 730,
  },
};

// Make config globally available
declare global {
  // eslint-disable-next-line no-var
  var TEST_CONFIG: {
    database: {
      maxConnections: number;
      connectionTimeout: number;
      queryTimeout: number;
    };
    performance: {
      maxQueryTime: number;
      maxInsertTime: number;
      maxConcurrentConnections: number;
    };
    retention: {
      commandExecutionsDays: number;
      agentInteractionsDays: number;
      userSessionsDays: number;
    };
  };
}

globalThis.TEST_CONFIG = TEST_CONFIG;

// Custom Jest matchers for database testing
expect.extend({
  toBeWithinPerformanceThreshold(received: number, threshold: number) {
    const pass = received <= threshold;
    return {
      message: () => 
        pass 
          ? `Expected ${received}ms to exceed ${threshold}ms performance threshold`
          : `Expected ${received}ms to be within ${threshold}ms performance threshold`,
      pass,
    };
  },

  toBeIsolatedToOrganization(received: any[], expectedOrgId: string) {
    const allBelongToOrg = received.every(record => 
      record.organization_id === expectedOrgId,
    );
    
    return {
      message: () => 
        allBelongToOrg
          ? 'Expected data to leak across organizations'
          : `Expected all records to belong to organization ${expectedOrgId}, but found cross-tenant data`,
      pass: allBelongToOrg,
    };
  },

  toHaveValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid UUID`
          : `Expected ${received} to be a valid UUID`,
      pass,
    };
  },

  toHaveValidTimestamp(received: string | Date) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && date.getTime() > 0;
    
    return {
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid timestamp`
          : `Expected ${received} to be a valid timestamp`,
      pass,
    };
  },

  toBeRecentTimestamp(received: string | Date, withinMinutes: number = 5) {
    const date = new Date(received);
    const now = new Date();
    const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const pass = diffMinutes <= withinMinutes && diffMinutes >= 0;
    
    return {
      message: () => 
        pass 
          ? `Expected ${received} not to be within ${withinMinutes} minutes of now`
          : `Expected ${received} to be within ${withinMinutes} minutes of now (was ${diffMinutes.toFixed(1)} minutes ago)`,
      pass,
    };
  },
});

// Declare custom matcher types
declare module 'expect' {
  interface AsymmetricMatchers {
    toBeWithinPerformanceThreshold(threshold: number): void;
    toBeIsolatedToOrganization(expectedOrgId: string): void;
    toHaveValidUUID(): void;
    toHaveValidTimestamp(): void;
    toBeRecentTimestamp(withinMinutes?: number): void;
  }
  
  interface Matchers<R> {
    toBeWithinPerformanceThreshold(threshold: number): R;
    toBeIsolatedToOrganization(expectedOrgId: string): R;
    toHaveValidUUID(): R;
    toHaveValidTimestamp(): R;
    toBeRecentTimestamp(withinMinutes?: number): R;
  }
}

// Test utilities
export class TestUtils {
  /**
   * Generate a batch of test data for performance testing
   */
  static generateTestData(count: number, organizationId: string) {
    const commands = ['/plan-product', '/analyze-product', '/execute-tasks', '/fold-prompt', '/dashboard'];
    const data = [];
    
    for (let i = 0; i < count; i++) {
      data.push({
        organization_id: organizationId,
        command_name: commands[i % commands.length],
        execution_time_ms: Math.floor(Math.random() * 5000) + 500,
        success: Math.random() > 0.1, // 90% success rate
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Within last 30 days
      });
    }
    
    return data;
  }

  /**
   * Wait for a specified amount of time
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Measure execution time of an async function
   */
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await fn();
    const executionTime = Date.now() - startTime;
    
    return { result, executionTime };
  }

  /**
   * Generate a realistic fake organization
   */
  static generateFakeOrganization() {
    const companies = ['TechCorp', 'DataSystems', 'CloudWorks', 'DevTools Inc', 'ScaleUp LLC'];
    const domains = ['tech', 'data', 'cloud', 'dev', 'scale'];
    
    const companyIndex = Math.floor(Math.random() * companies.length);
    
    return {
      name: companies[companyIndex],
      domain: `${domains[companyIndex]}.com`,
      subscription_tier: ['basic', 'professional', 'enterprise'][Math.floor(Math.random() * 3)],
      rate_limit_per_hour: [1000, 5000, 50000][Math.floor(Math.random() * 3)],
    };
  }

  /**
   * Validate that a database result contains only expected fields
   */
  static validateResultStructure(result: any, expectedFields: string[]): boolean {
    if (!result || typeof result !== 'object') return false;
    
    const resultFields = Object.keys(result);
    return expectedFields.every(field => resultFields.includes(field));
  }

  /**
   * Generate SQL injection test cases
   */
  static getSQLInjectionTestCases(): string[] {
    return [
      '\'; DROP TABLE organizations; --',
      '\' OR \'1\'=\'1\' --',
      '\' UNION SELECT * FROM organizations --',
      '\'; SELECT password FROM users --',
      '\' OR 1=1 --',
      '\'; INSERT INTO organizations (name) VALUES (\'hacked\') --',
      '\' AND (SELECT COUNT(*) FROM organizations) > 0 --',
    ];
  }

  /**
   * Create a mock database client for unit testing
   */
  static createMockDatabaseClient() {
    return {
      query: jest.fn(),
      release: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
    };
  }
}

// Console overrides for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress expected error logs during testing
  console.error = jest.fn((message) => {
    // Only suppress specific expected errors, log others
    if (
      typeof message === 'string' && 
      (message.includes('role "authenticated_user" already exists') ||
       message.includes('relation') && message.includes('already exists'))
    ) {
      return;
    }
    originalConsoleError(message);
  });

  console.warn = jest.fn((message) => {
    // Suppress warnings about test containers
    if (
      typeof message === 'string' && 
      message.includes('testcontainers')
    ) {
      return;
    }
    originalConsoleWarn(message);
  });
});

afterAll(() => {
  // Restore original console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Export test utilities for use in test files
export default TestUtils;