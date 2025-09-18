/**
 * Playwright Global Setup
 * Sprint 9.2: End-to-end testing automation
 * Prepares test environment, database, and test data
 */

import { chromium, FullConfig } from '@playwright/test';
import { DatabaseConnection } from '../../database/connection';
import { DatabaseConfig } from '../../database/types';
import * as winston from 'winston';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E Test Environment Setup...');
  
  try {
    // Create E2E test database connection
    const dbConfig: DatabaseConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'fortium_metrics_e2e_test',
      username: process.env.DB_USER || 'test',
      password: process.env.DB_PASSWORD || 'test',
      ssl: false,
      maxConnections: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    };

    // Setup test database
    await setupTestDatabase(dbConfig);
    
    // Create test data
    await createTestData(dbConfig);
    
    // Wait for application to be ready
    await waitForApplication();
    
    // Create test users and authenticate
    await createTestAuthData();
    
    console.log('✅ E2E Test Environment Setup Complete');
    
  } catch (error) {
    console.error('❌ E2E Test Environment Setup Failed:', error);
    process.exit(1);
  }
}

async function setupTestDatabase(config: DatabaseConfig) {
  console.log('📊 Setting up E2E test database...');
  
  const logger = winston.createLogger({
    level: 'error',
    transports: [new winston.transports.Console()]
  });

  const db = new DatabaseConnection(config);
  
  try {
    await db.connect();
    
    // Clean existing data
    await cleanTestDatabase(db);
    
    // Create test schema if needed
    await createTestSchema(db);
    
    console.log('✅ E2E test database ready');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await db.disconnect();
  }
}

async function cleanTestDatabase(db: DatabaseConnection) {
  console.log('🧹 Cleaning test database...');
  
  const cleanupQueries = [
    'DELETE FROM tool_metrics WHERE 1=1',
    'DELETE FROM metrics_sessions WHERE 1=1', 
    'DELETE FROM dashboard_configs WHERE 1=1',
    'DELETE FROM users WHERE email LIKE \'%@e2e-test.com\'',
    'DELETE FROM tenants WHERE name LIKE \'E2E Test%\''
  ];
  
  for (const query of cleanupQueries) {
    try {
      await db.query(query);
    } catch (error) {
      // Ignore errors for non-existent tables during first run
      console.warn(`Cleanup warning: ${error.message}`);
    }
  }
}

async function createTestSchema(db: DatabaseConnection) {
  console.log('🏗️ Creating test schema...');
  
  // Create test tenant
  const createTenantQuery = `
    INSERT INTO tenants (id, name, domain, schema_name, subscription_plan, is_active)
    VALUES (
      'e2e-test-tenant-id-12345678-1234-1234-1234-123456789abc',
      'E2E Test Organization',
      'e2e-test.com',
      'tenant_e2e_test',
      'enterprise',
      true
    ) ON CONFLICT (domain) DO UPDATE SET
      name = EXCLUDED.name,
      subscription_plan = EXCLUDED.subscription_plan,
      is_active = EXCLUDED.is_active
  `;
  
  await db.query(createTenantQuery);
}

async function createTestData(config: DatabaseConfig) {
  console.log('📝 Creating test data...');
  
  const logger = winston.createLogger({
    level: 'error',
    transports: [new winston.transports.Console()]
  });

  const db = new DatabaseConnection(config);
  
  try {
    await db.connect();
    
    // Create test users with different roles
    const testUsers = [
      {
        id: 'e2e-admin-user-12345678-1234-1234-1234-123456789abc',
        email: 'admin@e2e-test.com',
        firstName: 'E2E',
        lastName: 'Admin',
        role: 'admin',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewCwKeWJi4TzA2Y6' // 'TestAdmin123!'
      },
      {
        id: 'e2e-dev-user-12345678-1234-1234-1234-123456789abc',
        email: 'developer@e2e-test.com',
        firstName: 'E2E',
        lastName: 'Developer',
        role: 'developer',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewCwKeWJi4TzA2Y6' // 'TestAdmin123!'
      },
      {
        id: 'e2e-manager-user-12345678-1234-1234-1234-123456789abc',
        email: 'manager@e2e-test.com',
        firstName: 'E2E',
        lastName: 'Manager',
        role: 'manager',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewCwKeWJi4TzA2Y6' // 'TestAdmin123!'
      }
    ];
    
    for (const user of testUsers) {
      const userQuery = `
        INSERT INTO users (id, email, first_name, last_name, role, password_hash, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
        ON CONFLICT (email) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          role = EXCLUDED.role,
          is_active = EXCLUDED.is_active
      `;
      
      await db.query(userQuery, [
        user.id, user.email, user.firstName, user.lastName, user.role, user.password
      ]);
    }
    
    // Create sample metrics sessions for testing dashboard
    await createSampleMetricsData(db);
    
  } finally {
    await db.disconnect();
  }
}

async function createSampleMetricsData(db: DatabaseConnection) {
  console.log('📊 Creating sample metrics data...');
  
  const sessions = [
    {
      id: 'e2e-session-1-12345678-1234-1234-1234-123456789abc',
      userId: 'e2e-dev-user-12345678-1234-1234-1234-123456789abc',
      sessionStart: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      sessionEnd: new Date(Date.now() - 23 * 60 * 60 * 1000),
      totalDurationMs: 3600000, // 1 hour
      toolsUsed: ['Read', 'Write', 'Bash'],
      productivityScore: 85
    },
    {
      id: 'e2e-session-2-12345678-1234-1234-1234-123456789abc',
      userId: 'e2e-dev-user-12345678-1234-1234-1234-123456789abc',
      sessionStart: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      sessionEnd: null, // Active session
      totalDurationMs: null,
      toolsUsed: ['Read', 'Edit'],
      productivityScore: null
    }
  ];
  
  for (const session of sessions) {
    const sessionQuery = `
      INSERT INTO metrics_sessions (id, user_id, session_start, session_end, total_duration_ms, tools_used, productivity_score, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (id) DO UPDATE SET
        session_end = EXCLUDED.session_end,
        total_duration_ms = EXCLUDED.total_duration_ms,
        tools_used = EXCLUDED.tools_used,
        productivity_score = EXCLUDED.productivity_score
    `;
    
    await db.query(sessionQuery, [
      session.id,
      session.userId,
      session.sessionStart,
      session.sessionEnd,
      session.totalDurationMs,
      JSON.stringify(session.toolsUsed),
      session.productivityScore
    ]);
  }
  
  // Create tool metrics
  const toolMetrics = [
    {
      sessionId: 'e2e-session-1-12345678-1234-1234-1234-123456789abc',
      toolName: 'Read',
      executionCount: 15,
      totalDurationMs: 1800000, // 30 minutes
      successRate: 0.95,
      errorCount: 1
    },
    {
      sessionId: 'e2e-session-1-12345678-1234-1234-1234-123456789abc',
      toolName: 'Write',
      executionCount: 8,
      totalDurationMs: 1200000, // 20 minutes
      successRate: 1.0,
      errorCount: 0
    }
  ];
  
  for (const metric of toolMetrics) {
    const metricQuery = `
      INSERT INTO tool_metrics (session_id, tool_name, execution_count, total_duration_ms, success_rate, error_count, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (session_id, tool_name) DO UPDATE SET
        execution_count = EXCLUDED.execution_count,
        total_duration_ms = EXCLUDED.total_duration_ms,
        success_rate = EXCLUDED.success_rate,
        error_count = EXCLUDED.error_count
    `;
    
    await db.query(metricQuery, [
      metric.sessionId,
      metric.toolName,
      metric.executionCount,
      metric.totalDurationMs,
      metric.successRate,
      metric.errorCount
    ]);
  }
}

async function waitForApplication() {
  console.log('⏳ Waiting for application to be ready...');
  
  const maxAttempts = 30;
  const delay = 1000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('http://localhost:3000/health', {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        console.log('✅ Application is ready');
        return;
      }
    } catch (error) {
      console.log(`Attempt ${attempt}/${maxAttempts}: Application not ready yet...`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Application failed to start within timeout');
}

async function createTestAuthData() {
  console.log('🔐 Creating test authentication data...');
  
  // Launch browser for authentication setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to login page
    await page.goto('http://localhost:3000/login');
    
    // Check if login page is accessible
    await page.waitForSelector('[data-testid="login-form"]', { timeout: 10000 });
    
    console.log('✅ Login page accessible');
    
    // Store auth state for different user roles
    const authStates = {
      admin: await getAuthState(page, 'admin@e2e-test.com', 'TestAdmin123!'),
      developer: await getAuthState(page, 'developer@e2e-test.com', 'TestAdmin123!'),
      manager: await getAuthState(page, 'manager@e2e-test.com', 'TestAdmin123!')
    };
    
    // Save auth states to files
    const authDir = path.join(process.cwd(), 'src/tests/e2e/auth-states');
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    
    for (const [role, state] of Object.entries(authStates)) {
      fs.writeFileSync(
        path.join(authDir, `${role}.json`),
        JSON.stringify(state, null, 2)
      );
    }
    
    console.log('✅ Test authentication data created');
    
  } finally {
    await context.close();
    await browser.close();
  }
}

async function getAuthState(page: any, email: string, password: string) {
  // Fill login form
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  
  // Submit form
  await page.click('[data-testid="login-submit"]');
  
  // Wait for successful login (redirect to dashboard)
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Get authentication state
  const cookies = await page.context().cookies();
  const localStorage = await page.evaluate(() => 
    Object.fromEntries(Object.entries(localStorage))
  );
  
  return {
    cookies,
    localStorage,
    userEmail: email
  };
}

export default globalSetup;