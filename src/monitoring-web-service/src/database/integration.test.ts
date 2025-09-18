/**
 * Integration Tests for Database ORM Setup
 * External Metrics Web Service - Task 1.5 Validation
 */

import { createPrismaClient, ExtendedPrismaClient } from './prisma-client';
import { ormUtils } from './orm-utils';
import { createDbConnection, DatabaseConnection } from './connection';
import * as winston from 'winston';

describe('Database ORM Integration Tests', () => {
  let client: ExtendedPrismaClient;
  let connection: DatabaseConnection;
  let testTenant: any;
  let testUser: any;

  const logger = winston.createLogger({
    level: 'error', // Suppress logs during testing
    transports: [new winston.transports.Console()],
  });

  beforeAll(async () => {
    // Skip tests if no database connection
    if (!process.env.DATABASE_URL) {
      console.log('Skipping database tests - DATABASE_URL not set');
      return;
    }

    client = createPrismaClient({ 
      logger,
      enableQueryLogging: false, // Disable for cleaner test output
    });

    connection = await createDbConnection(logger);
  });

  afterAll(async () => {
    if (client) {
      // Cleanup test data
      try {
        if (testTenant) {
          await client.tenant.delete({
            where: { id: testTenant.id },
          });
        }
      } catch (error) {
        // Ignore cleanup errors
      }

      await client.shutdown();
    }

    if (connection) {
      await connection.end();
    }
  });

  describe('Prisma Client Setup', () => {
    test('should create Prisma client successfully', () => {
      expect(client).toBeDefined();
      expect(client.tenant).toBeDefined();
      expect(client.user).toBeDefined();
      expect(client.metricsSession).toBeDefined();
      expect(client.toolMetric).toBeDefined();
      expect(client.dashboardConfig).toBeDefined();
    });

    test('should perform health check', async () => {
      if (!process.env.DATABASE_URL) return;

      const health = await client.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.details.connection).toBe(true);
      expect(typeof health.details.responseTime).toBe('number');
    });
  });

  describe('Multi-tenant Operations', () => {
    test('should create and manage tenant', async () => {
      if (!process.env.DATABASE_URL) return;

      // Create test tenant
      testTenant = await client.tenant.create({
        data: {
          name: 'Test Organization',
          domain: 'test-org-' + Date.now(),
          schemaName: 'tenant_test_' + Date.now(),
          subscriptionPlan: 'basic',
          adminEmail: 'admin@test.example',
        },
      });

      expect(testTenant).toBeDefined();
      expect(testTenant.domain).toMatch(/^test-org-\d+$/);
      expect(testTenant.subscriptionPlan).toBe('basic');
    });

    test('should set tenant context', async () => {
      if (!process.env.DATABASE_URL || !testTenant) return;

      await client.setTenantContext({
        tenantId: testTenant.id,
        schemaName: testTenant.schemaName,
        domain: testTenant.domain,
      });

      const context = client.getCurrentTenantContext();
      expect(context).toBeDefined();
      expect(context?.tenantId).toBe(testTenant.id);
      expect(context?.domain).toBe(testTenant.domain);
    });

    test('should retrieve tenant by domain', async () => {
      if (!process.env.DATABASE_URL || !testTenant) return;

      const retrievedTenant = await client.getTenantByDomain(testTenant.domain);
      expect(retrievedTenant).toBeDefined();
      expect(retrievedTenant.id).toBe(testTenant.id);
      expect(retrievedTenant.name).toBe('Test Organization');
    });
  });

  describe('Per-tenant Data Operations', () => {
    test('should create user in tenant context', async () => {
      if (!process.env.DATABASE_URL || !testTenant) return;

      // Ensure tenant context is set
      await client.setTenantContext({
        tenantId: testTenant.id,
        schemaName: testTenant.schemaName,
        domain: testTenant.domain,
      });

      testUser = await client.user.create({
        data: {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'developer',
          timezone: 'UTC',
          preferences: {
            theme: 'light',
            language: 'en',
          },
        },
      });

      expect(testUser).toBeDefined();
      expect(testUser.email).toBe('test@example.com');
      expect(testUser.role).toBe('developer');
    });

    test('should create metrics session with tool metrics', async () => {
      if (!process.env.DATABASE_URL || !testTenant || !testUser) return;

      const sessionStart = new Date();
      const sessionEnd = new Date(sessionStart.getTime() + 3600000); // 1 hour later

      await ormUtils.withTransaction(client, async (tx) => {
        const session = await tx.metricsSession.create({
          data: {
            userId: testUser.id,
            sessionStart,
            sessionEnd,
            totalDurationMs: BigInt(3600000),
            sessionType: 'development',
            productivityScore: 85,
            tags: ['testing', 'typescript'],
            focusTimeMs: BigInt(2700000), // 45 minutes
            description: 'Integration test session',
          },
        });

        await tx.toolMetric.createMany({
          data: [
            {
              sessionId: session.id,
              toolName: 'Read',
              toolCategory: 'file-ops',
              executionCount: 5,
              totalDurationMs: BigInt(750),
              averageDurationMs: BigInt(150),
              successRate: 1.0,
              errorCount: 0,
            },
            {
              sessionId: session.id,
              toolName: 'Write',
              toolCategory: 'file-ops',
              executionCount: 3,
              totalDurationMs: BigInt(900),
              averageDurationMs: BigInt(300),
              successRate: 0.97,
              errorCount: 0,
            },
          ],
        });

        expect(session.id).toBeDefined();
        expect(session.productivityScore).toBe(85);
      });
    });

    test('should create dashboard configuration', async () => {
      if (!process.env.DATABASE_URL || !testTenant || !testUser) return;

      const dashboardConfig = await client.dashboardConfig.create({
        data: {
          userId: testUser.id,
          dashboardName: 'Test Dashboard',
          description: 'Integration test dashboard',
          widgetLayout: {
            widgets: [
              {
                id: 'productivity-chart',
                type: 'line-chart',
                position: { x: 0, y: 0, w: 6, h: 4 },
              },
            ],
            layout: 'grid',
          },
          isDefault: true,
          refreshIntervalSeconds: 30,
        },
      });

      expect(dashboardConfig).toBeDefined();
      expect(dashboardConfig.dashboardName).toBe('Test Dashboard');
      expect(dashboardConfig.isDefault).toBe(true);
    });
  });

  describe('ORM Utilities', () => {
    test('should paginate results', async () => {
      if (!process.env.DATABASE_URL || !testTenant || !testUser) return;

      const result = await ormUtils.paginate(
        client.user,
        {
          page: 1,
          limit: 10,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }
      );

      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(typeof result.meta.total).toBe('number');
    });

    test('should handle batch operations', async () => {
      if (!process.env.DATABASE_URL || !testTenant) return;

      const testUsers = Array.from({ length: 3 }, (_, i) => ({
        email: `batch-user-${i}@example.com`,
        firstName: `BatchUser${i}`,
        lastName: 'Test',
        role: 'developer' as const,
      }));

      const results = await ormUtils.batchProcess(
        testUsers,
        async (batch) => {
          const created = [];
          for (const userData of batch) {
            const user = await client.user.create({ data: userData });
            created.push(user);
          }
          return created;
        },
        { batchSize: 2 }
      );

      expect(results).toHaveLength(3);
      expect(results[0].email).toMatch(/^batch-user-\d+@example\.com$/);

      // Cleanup batch users
      await client.user.deleteMany({
        where: {
          email: {
            startsWith: 'batch-user-',
          },
        },
      });
    });

    test('should generate health report', async () => {
      if (!process.env.DATABASE_URL) return;

      const report = await ormUtils.generateHealthReport(client);
      expect(report.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(report.metrics).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Connection Integration', () => {
    test('should integrate with legacy connection', async () => {
      if (!process.env.DATABASE_URL) return;

      expect(connection.prisma).toBeDefined();
      expect(connection.pool).toBeDefined();

      // Test legacy query method
      const result = await connection.query('SELECT 1 as test');
      expect(result.rows[0].test).toBe(1);
    });

    test('should set organization context on both clients', async () => {
      if (!process.env.DATABASE_URL || !testTenant) return;

      await connection.setOrganizationContext(testTenant.id);
      
      const context = connection.prisma?.getCurrentTenantContext();
      expect(context?.tenantId).toBe(testTenant.id);
    });
  });

  describe('Performance Validation', () => {
    test('should meet query performance requirements', async () => {
      if (!process.env.DATABASE_URL || !testTenant) return;

      const start = Date.now();
      
      // Simple query should be < 100ms as per TRD requirements
      await client.tenant.findUnique({
        where: { id: testTenant.id },
      });
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    test('should handle concurrent operations', async () => {
      if (!process.env.DATABASE_URL || !testTenant) return;

      const promises = Array.from({ length: 5 }, () =>
        client.tenant.findUnique({
          where: { id: testTenant.id },
        })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result?.id).toBe(testTenant.id);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle unique constraint violations', async () => {
      if (!process.env.DATABASE_URL || !testTenant || !testUser) return;

      await expect(
        client.user.create({
          data: {
            email: testUser.email, // Duplicate email
            firstName: 'Duplicate',
            lastName: 'User',
            role: 'developer',
          },
        })
      ).rejects.toThrow();
    });

    test('should handle invalid tenant context', async () => {
      if (!process.env.DATABASE_URL) return;

      // Clear context and try to use withTenantContext with invalid data
      await client.clearTenantContext();

      const invalidContext = {
        tenantId: 'invalid-uuid-12345',
        schemaName: 'non_existent_schema',
        domain: 'invalid-domain',
      };

      // Should not throw, but should handle gracefully
      await expect(
        client.setTenantContext(invalidContext)
      ).resolves.not.toThrow();
    });
  });
});

// Helper function to run tests only if database is available
function describeWithDb(name: string, fn: () => void) {
  if (process.env.DATABASE_URL) {
    describe(name, fn);
  } else {
    describe.skip(name + ' (DATABASE_URL not set)', () => {});
  }
}

// Export for use in other test files
export { describeWithDb };