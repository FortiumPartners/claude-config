/**
 * Metrics Processing Pipeline Integration Tests
 * Task 3: End-to-end testing of metrics collection, processing, and querying
 */

import request from 'supertest';
import { Express } from 'express';
import { DatabaseConnection } from '../../database/connection';
import { DatabaseSchema } from '../../database/schema';
import { MetricsCollectionService } from '../../services/metrics-collection.service';
import { MetricsQueryService } from '../../services/metrics-query.service';
import { RealTimeProcessorService } from '../../services/real-time-processor.service';
import { BackgroundProcessorService } from '../../services/background-processor.service';
import { createMetricsCollectionRoutes } from '../../routes/metrics-collection.routes';
import { createMetricsQueryRoutes } from '../../routes/metrics-query.routes';
import { MetricsStreamEvent } from '../../types/metrics';
import * as winston from 'winston';
import express from 'express';

// Test database configuration
const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'metrics_test',
  user: process.env.TEST_DB_USER || 'test',
  password: process.env.TEST_DB_PASSWORD || 'test'
};

// Test organization and user data
const testOrgId = 'test-org-123';
const testUserId = 'test-user-123';
const testTeamId = 'test-team-123';
const testProjectId = 'test-project-123';

// Mock JWT token for authentication
const mockAuthToken = 'Bearer test-token';

// Mock authentication middleware
const mockAuth = (req: any, res: any, next: any) => {
  req.user = {
    id: testUserId,
    organization_id: testOrgId,
    role: 'developer'
  };
  next();
};

describe('Metrics Processing Pipeline Integration Tests', () => {
  let app: Express;
  let db: DatabaseConnection;
  let collectionService: MetricsCollectionService;
  let queryService: MetricsQueryService;
  let realTimeProcessor: RealTimeProcessorService;
  let backgroundProcessor: BackgroundProcessorService;
  let logger: winston.Logger;

  beforeAll(async () => {
    // Setup test logger
    logger = winston.createLogger({
      level: 'error', // Reduce noise during tests
      transports: [new winston.transports.Console({ silent: true })]
    });

    // Setup test database connection
    db = new DatabaseConnection(testDbConfig, logger);
    await db.connect();

    // Initialize database schema
    const schema = new DatabaseSchema(db);
    await schema.dropSchema(); // Clean slate
    await schema.initializeSchema();

    // Setup services
    collectionService = new MetricsCollectionService(db, logger);
    realTimeProcessor = new RealTimeProcessorService(db, logger);
    queryService = new MetricsQueryService(db, logger, realTimeProcessor);
    backgroundProcessor = new BackgroundProcessorService(db, logger, realTimeProcessor, queryService);

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    app.use(mockAuth); // Mock authentication

    const collectionRoutes = createMetricsCollectionRoutes(db, logger);
    const queryRoutes = createMetricsQueryRoutes(db, logger, realTimeProcessor);
    
    app.use('/api/metrics', collectionRoutes.router);
    app.use('/api/metrics', queryRoutes.router);

    // Insert test organization and user data
    await setupTestData();
  }, 30000);

  afterAll(async () => {
    await backgroundProcessor?.shutdown();
    await realTimeProcessor?.shutdown();
    await db?.disconnect();
  });

  describe('End-to-End Metrics Collection and Query Flow', () => {
    it('should collect, process, and query command executions', async () => {
      // Step 1: Collect command execution metrics via API
      const commandData = {
        user_id: testUserId,
        team_id: testTeamId,
        project_id: testProjectId,
        command_name: 'plan-product',
        command_args: { feature: 'dashboard' },
        execution_time_ms: 1500,
        status: 'success',
        context: { session_id: 'session-123' }
      };

      const collectionResponse = await request(app)
        .post('/api/metrics/commands')
        .send(commandData)
        .expect(201);

      expect(collectionResponse.body.success).toBe(true);
      expect(collectionResponse.body.data).toHaveProperty('id');
      expect(collectionResponse.body.data.command_name).toBe('plan-product');

      // Step 2: Wait briefly for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Query the collected data
      const queryResponse = await request(app)
        .get('/api/metrics/commands')
        .query({
          start_date: new Date(Date.now() - 60000).toISOString(),
          end_date: new Date().toISOString(),
          user_id: testUserId,
          limit: 10
        })
        .expect(200);

      expect(queryResponse.body.success).toBe(true);
      expect(queryResponse.body.data).toHaveLength(1);
      expect(queryResponse.body.data[0].command_name).toBe('plan-product');
      expect(queryResponse.body.pagination.total_count).toBe(1);
    });

    it('should collect and aggregate multiple metrics in real-time', async () => {
      // Step 1: Collect multiple command executions
      const commands = [
        { command_name: 'plan-product', execution_time_ms: 1000, status: 'success' },
        { command_name: 'execute-tasks', execution_time_ms: 2000, status: 'success' },
        { command_name: 'code-review', execution_time_ms: 1500, status: 'error' },
        { command_name: 'plan-product', execution_time_ms: 1200, status: 'success' }
      ];

      for (const cmd of commands) {
        await request(app)
          .post('/api/metrics/commands')
          .send({
            user_id: testUserId,
            team_id: testTeamId,
            project_id: testProjectId,
            ...cmd
          })
          .expect(201);
      }

      // Step 2: Process as stream events for real-time aggregation
      for (const cmd of commands) {
        const streamEvent: MetricsStreamEvent = {
          type: 'command_execution',
          organization_id: testOrgId,
          user_id: testUserId,
          data: {
            user_id: testUserId,
            team_id: testTeamId,
            project_id: testProjectId,
            ...cmd
          },
          timestamp: new Date(),
          source: 'test'
        };
        
        await realTimeProcessor.processStreamEvent(streamEvent);
      }

      // Step 3: Get real-time aggregations
      const realTimeMetrics = queryService.getRealTimeMetrics(testOrgId, '5m', testUserId);
      
      expect(realTimeMetrics).toHaveLength(1); // One 5-minute bucket
      expect(realTimeMetrics[0].command_count).toBe(4);
      expect(realTimeMetrics[0].error_rate).toBe(0.25); // 1 error out of 4
      expect(realTimeMetrics[0].avg_execution_time).toBeGreaterThan(0);

      // Step 4: Get aggregated metrics via API
      const aggregatedResponse = await request(app)
        .get('/api/metrics/aggregated')
        .query({
          start_date: new Date(Date.now() - 60000).toISOString(),
          end_date: new Date().toISOString(),
          user_id: testUserId,
          aggregation_window: '5m'
        })
        .expect(200);

      expect(aggregatedResponse.body.success).toBe(true);
      expect(aggregatedResponse.body.data).toHaveLength(1);
      
      const aggregatedData = aggregatedResponse.body.data[0];
      expect(aggregatedData.command_count).toBeGreaterThanOrEqual(4);
      expect(aggregatedData.error_rate).toBeGreaterThanOrEqual(0);
    });

    it('should handle batch collection and processing', async () => {
      // Step 1: Prepare batch data
      const batchData = {
        command_executions: [
          {
            user_id: testUserId,
            command_name: 'batch-cmd-1',
            execution_time_ms: 800,
            status: 'success',
            context: { batch_id: 'batch-123' }
          },
          {
            user_id: testUserId,
            command_name: 'batch-cmd-2',
            execution_time_ms: 1200,
            status: 'success',
            context: { batch_id: 'batch-123' }
          }
        ],
        agent_interactions: [
          {
            user_id: testUserId,
            agent_name: 'frontend-developer',
            interaction_type: 'code-generation',
            execution_time_ms: 3000,
            status: 'success',
            input_tokens: 500,
            output_tokens: 1200
          }
        ],
        productivity_metrics: [
          {
            user_id: testUserId,
            metric_type: 'productivity_score',
            metric_value: 87.5,
            metric_unit: 'percentage'
          }
        ]
      };

      // Step 2: Submit batch collection
      const batchResponse = await request(app)
        .post('/api/metrics/batch')
        .send(batchData)
        .expect(201);

      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.data.command_executions).toBe(2);
      expect(batchResponse.body.data.agent_interactions).toBe(1);
      expect(batchResponse.body.data.productivity_metrics).toBe(1);
      expect(batchResponse.body.data.processing_time_ms).toBeGreaterThan(0);

      // Step 3: Verify data was stored correctly
      await new Promise(resolve => setTimeout(resolve, 100));

      const queryResponse = await request(app)
        .get('/api/metrics/commands')
        .query({
          start_date: new Date(Date.now() - 60000).toISOString(),
          end_date: new Date().toISOString(),
          command_name: 'batch-cmd-1'
        })
        .expect(200);

      expect(queryResponse.body.data).toHaveLength(1);
      expect(queryResponse.body.data[0].context.batch_id).toBe('batch-123');
    });

    it('should generate dashboard metrics with real-time updates', async () => {
      // Step 1: Collect diverse metrics
      const metrics = [
        // Command executions
        { type: 'command', name: 'plan-product', time: 1000, status: 'success' },
        { type: 'command', name: 'execute-tasks', time: 2500, status: 'success' },
        { type: 'command', name: 'code-review', time: 800, status: 'error' },
        
        // Agent interactions
        { type: 'agent', name: 'frontend-developer', time: 3000, status: 'success' },
        { type: 'agent', name: 'backend-developer', time: 2200, status: 'success' }
      ];

      for (const metric of metrics) {
        if (metric.type === 'command') {
          await request(app)
            .post('/api/metrics/commands')
            .send({
              user_id: testUserId,
              team_id: testTeamId,
              command_name: metric.name,
              execution_time_ms: metric.time,
              status: metric.status
            })
            .expect(201);
        } else if (metric.type === 'agent') {
          await request(app)
            .post('/api/metrics/agents')
            .send({
              user_id: testUserId,
              team_id: testTeamId,
              agent_name: metric.name,
              interaction_type: 'code_generation',
              execution_time_ms: metric.time,
              status: metric.status
            })
            .expect(201);
        }
      }

      // Step 2: Get dashboard metrics
      const dashboardResponse = await request(app)
        .get('/api/metrics/dashboard')
        .query({
          user_id: testUserId,
          team_id: testTeamId,
          time_range: '1h'
        })
        .expect(200);

      expect(dashboardResponse.body.success).toBe(true);
      
      const dashboard = dashboardResponse.body.data;
      expect(dashboard).toHaveProperty('overview');
      expect(dashboard).toHaveProperty('trends');
      expect(dashboard).toHaveProperty('top_commands');
      expect(dashboard).toHaveProperty('top_agents');
      expect(dashboard).toHaveProperty('user_activity');

      // Verify overview metrics
      expect(dashboard.overview.total_commands).toBeGreaterThan(0);
      expect(dashboard.overview.avg_execution_time).toBeGreaterThan(0);
      expect(dashboard.overview.error_rate).toBeGreaterThanOrEqual(0);
    });

    it('should handle high-throughput scenarios', async () => {
      // Step 1: Generate high-volume batch data
      const largeNumberOfCommands = 500;
      const batchData = {
        command_executions: Array(largeNumberOfCommands).fill(null).map((_, index) => ({
          user_id: testUserId,
          command_name: `high-volume-cmd-${index % 10}`,
          execution_time_ms: Math.floor(Math.random() * 2000) + 500,
          status: Math.random() > 0.1 ? 'success' : 'error' // 90% success rate
        })),
        timestamp: new Date()
      };

      // Step 2: Submit large batch (should handle efficiently)
      const startTime = Date.now();
      const batchResponse = await request(app)
        .post('/api/metrics/batch')
        .send(batchData)
        .expect(201);

      const processingTime = Date.now() - startTime;

      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.data.command_executions).toBe(largeNumberOfCommands);
      expect(processingTime).toBeLessThan(5000); // Should process in under 5 seconds
      expect(batchResponse.body.data.processing_time_ms).toBeLessThan(5000);

      // Step 3: Verify ingestion rate meets requirements
      const ingestionRate = batchResponse.body.performance?.ingestion_rate;
      expect(ingestionRate).toBeGreaterThan(100); // Should handle >100 events/second
    });

    it('should enforce rate limiting correctly', async () => {
      // Step 1: Make requests rapidly to trigger rate limiting
      const rapidRequests = Array(15).fill(null).map(() => 
        request(app)
          .post('/api/metrics/commands')
          .send({
            user_id: testUserId,
            command_name: 'rate-limit-test',
            execution_time_ms: 100,
            status: 'success'
          })
      );

      const responses = await Promise.allSettled(rapidRequests);
      const successful = responses.filter(r => r.status === 'fulfilled' && (r.value as any).status === 201);
      const rateLimited = responses.filter(r => r.status === 'fulfilled' && (r.value as any).status === 429);

      // Step 2: Verify some requests were rate limited
      expect(successful.length).toBeGreaterThan(0);
      expect(rateLimited.length).toBeGreaterThan(0);

      // Step 3: Check rate limit headers
      if (successful.length > 0) {
        const successResponse = successful[0] as any;
        expect(successResponse.value.headers).toHaveProperty('x-ratelimit-limit');
        expect(successResponse.value.headers).toHaveProperty('x-ratelimit-remaining');
      }
    });
  });

  describe('Performance and Scalability Tests', () => {
    it('should maintain sub-second query response times', async () => {
      // Step 1: Generate sufficient data for meaningful query test
      const commandCount = 100;
      const commands = Array(commandCount).fill(null).map((_, index) => ({
        user_id: testUserId,
        command_name: `perf-test-cmd-${index % 10}`,
        execution_time_ms: Math.floor(Math.random() * 1000) + 100,
        status: 'success'
      }));

      // Batch insert for efficiency
      await request(app)
        .post('/api/metrics/batch')
        .send({ command_executions: commands })
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 200)); // Brief processing time

      // Step 2: Test query performance
      const queryStartTime = Date.now();
      const queryResponse = await request(app)
        .get('/api/metrics/aggregated')
        .query({
          start_date: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          end_date: new Date().toISOString(),
          user_id: testUserId,
          aggregation_window: '1m',
          limit: 100
        })
        .expect(200);

      const queryTime = Date.now() - queryStartTime;

      // Step 3: Verify performance requirements
      expect(queryTime).toBeLessThan(1000); // Sub-second response time
      expect(queryResponse.body.query_performance.response_time_ms).toBeLessThan(1000);
      expect(queryResponse.body.success).toBe(true);
      expect(queryResponse.body.data.length).toBeGreaterThan(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      // Step 1: Generate concurrent collection requests
      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array(concurrentRequests).fill(null).map((_, index) => 
        request(app)
          .post('/api/metrics/commands')
          .send({
            user_id: testUserId,
            command_name: `concurrent-test-${index}`,
            execution_time_ms: 500,
            status: 'success'
          })
      );

      const results = await Promise.allSettled(promises);
      const totalTime = Date.now() - startTime;

      // Step 2: Verify concurrent processing efficiency
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 201);
      expect(successful.length).toBe(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // All requests in under 5 seconds

      // Step 3: Verify no data corruption from concurrency
      await new Promise(resolve => setTimeout(resolve, 100));

      const queryResponse = await request(app)
        .get('/api/metrics/commands')
        .query({
          start_date: new Date(startTime - 1000).toISOString(),
          end_date: new Date().toISOString(),
          limit: concurrentRequests + 5
        })
        .expect(200);

      const concurrentTestCommands = queryResponse.body.data.filter((cmd: any) => 
        cmd.command_name.startsWith('concurrent-test-')
      );
      
      expect(concurrentTestCommands).toHaveLength(concurrentRequests);
    });

    it('should efficiently handle pagination with large datasets', async () => {
      // This test would require a larger dataset to be meaningful
      // For now, we'll test the pagination mechanism itself
      
      const pageSize = 10;
      const queryResponse = await request(app)
        .get('/api/metrics/commands')
        .query({
          start_date: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          end_date: new Date().toISOString(),
          limit: pageSize,
          offset: 0
        })
        .expect(200);

      expect(queryResponse.body.success).toBe(true);
      expect(queryResponse.body.pagination).toHaveProperty('total_count');
      expect(queryResponse.body.pagination).toHaveProperty('page');
      expect(queryResponse.body.pagination).toHaveProperty('per_page');
      expect(queryResponse.body.pagination).toHaveProperty('total_pages');
      expect(queryResponse.body.pagination).toHaveProperty('has_next');
      expect(queryResponse.body.pagination).toHaveProperty('has_previous');
      
      expect(queryResponse.body.data.length).toBeLessThanOrEqual(pageSize);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle malformed requests gracefully', async () => {
      // Step 1: Test invalid JSON
      const invalidJsonResponse = await request(app)
        .post('/api/metrics/commands')
        .send('invalid json')
        .expect(400);

      // Step 2: Test missing required fields
      const missingFieldsResponse = await request(app)
        .post('/api/metrics/commands')
        .send({
          command_name: 'test'
          // Missing required fields
        })
        .expect(400);

      // Step 3: Test invalid data types
      const invalidTypesResponse = await request(app)
        .post('/api/metrics/commands')
        .send({
          user_id: 'invalid-uuid',
          command_name: 123, // Should be string
          execution_time_ms: 'not-a-number',
          status: 'invalid-status'
        })
        .expect(400);

      expect(invalidTypesResponse.body.error).toContain('Collection failed');
    });

    it('should recover from real-time processor errors', async () => {
      // Step 1: Create a problematic stream event
      const problematicEvent: MetricsStreamEvent = {
        type: 'command_execution',
        organization_id: testOrgId,
        user_id: testUserId,
        data: {
          user_id: testUserId,
          command_name: 'problematic-command',
          execution_time_ms: -1, // Invalid value
          status: 'invalid-status' as any
        },
        timestamp: new Date(),
        source: 'test'
      };

      // Step 2: Process the problematic event (should handle gracefully)
      await expect(realTimeProcessor.processStreamEvent(problematicEvent)).rejects.toThrow();

      // Step 3: Verify the processor is still functional with valid events
      const validEvent: MetricsStreamEvent = {
        type: 'command_execution',
        organization_id: testOrgId,
        user_id: testUserId,
        data: {
          user_id: testUserId,
          command_name: 'recovery-test',
          execution_time_ms: 1000,
          status: 'success'
        },
        timestamp: new Date(),
        source: 'test'
      };

      await expect(realTimeProcessor.processStreamEvent(validEvent)).resolves.not.toThrow();

      // Step 4: Verify dead letter queue handling
      const deadLetterStatus = realTimeProcessor.getDeadLetterQueueStatus();
      expect(deadLetterStatus.size).toBeGreaterThan(0);
      expect(deadLetterStatus.max_size).toBeGreaterThan(0);
    });
  });

  // Helper function to setup test data
  async function setupTestData(): Promise<void> {
    // Insert test organization
    await db.query(`
      INSERT INTO organizations (id, name, slug, created_at)
      VALUES ($1, 'Test Organization', 'test-org', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [testOrgId]);

    // Insert test user
    await db.query(`
      INSERT INTO users (id, organization_id, email, full_name, role, created_at)
      VALUES ($1, $2, 'test@example.com', 'Test User', 'developer', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [testUserId, testOrgId]);

    // Insert test team
    await db.query(`
      INSERT INTO teams (id, organization_id, name, created_at)
      VALUES ($1, $2, 'Test Team', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [testTeamId, testOrgId]);

    // Insert test project
    await db.query(`
      INSERT INTO projects (id, organization_id, team_id, name, created_at)
      VALUES ($1, $2, $3, 'Test Project', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [testProjectId, testOrgId, testTeamId]);
  }
});