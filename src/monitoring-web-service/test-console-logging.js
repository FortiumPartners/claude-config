#!/usr/bin/env node

/**
 * Test Console Logging Configuration
 * Verifies that application errors and logs appear on console while OpenTelemetry tracing is suppressed
 */

// Import logger after OTEL initialization
const { logger } = require('./src/config/logger');

console.log('🧪 Testing console logging configuration...\n');

// Test 1: Direct console logs
console.log('✅ Direct console.log works');
console.error('✅ Direct console.error works');
console.warn('✅ Direct console.warn works');

console.log('\n--- Winston Logger Tests ---');

// Test 2: Winston logger levels
logger.info('✅ Winston INFO log message');
logger.warn('✅ Winston WARN log message');
logger.error('✅ Winston ERROR log message');

// Test 3: Error with stack trace
try {
  throw new Error('Test error for stack trace visibility');
} catch (error) {
  logger.error('✅ Winston ERROR with exception:', {
    error: error.message,
    stack: error.stack,
    event: 'test.error'
  });
}

// Test 4: Structured logging
logger.info('✅ Winston structured log', {
  userId: 'test-user-123',
  tenantId: 'test-tenant',
  operation: 'console-test',
  metadata: {
    testId: Date.now(),
    success: true
  }
});

// Test 5: HTTP error simulation (like a 500 error)
logger.error('✅ Simulated HTTP 500 error', {
  method: 'POST',
  path: '/api/v1/test',
  statusCode: 500,
  error: 'Internal Server Error',
  userId: 'demo-user',
  duration: 123,
  event: 'api.error'
});

console.log('\n🎯 Console logging test complete!');
console.log('📝 All messages above should be visible on the console.');
console.log('🚫 You should NOT see any OpenTelemetry diagnostic messages.');

process.exit(0);