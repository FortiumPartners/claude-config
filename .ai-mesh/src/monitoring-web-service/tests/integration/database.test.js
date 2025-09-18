// Integration tests for database operations
// Part of Phase 2: Infrastructure & Integration - Testing Pipeline

const db = require('../../src/database/connection');
const { Pool } = require('pg');

describe('Database Integration', () => {
  let testPool;
  let testOrgId = 'test-org';

  beforeAll(async () => {
    // Create test database connection
    testPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'metrics_test',
      user: process.env.DB_USER || 'test_user',
      password: process.env.DB_PASSWORD || 'test_password',
      ssl: process.env.DB_SSL === 'true'
    });

    // Ensure test schema is clean
    await testPool.query('DELETE FROM metrics WHERE org_id = $1', [testOrgId]);
  });

  afterAll(async () => {
    await testPool.end();
  });

  afterEach(async () => {
    // Clean up test data after each test
    await testPool.query('DELETE FROM metrics WHERE org_id = $1', [testOrgId]);
  });

  describe('Connection Management', () => {
    test('should establish database connection', async () => {
      const result = await testPool.query('SELECT NOW()');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty('now');
    });

    test('should handle connection pool correctly', async () => {
      const promises = Array.from({ length: 10 }, () => 
        testPool.query('SELECT $1 as test_value', [Math.random()])
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.rows).toHaveLength(1);
        expect(typeof result.rows[0].test_value).toBe('number');
      });
    });

    test('should handle connection errors gracefully', async () => {
      const badPool = new Pool({
        host: 'nonexistent-host',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
        connectionTimeoutMillis: 1000
      });

      await expect(badPool.query('SELECT 1')).rejects.toThrow();
      await badPool.end();
    });
  });

  describe('Schema Validation', () => {
    test('should have required tables', async () => {
      const tables = [
        'metrics',
        'users',
        'organizations',
        'api_keys',
        'user_sessions'
      ];

      for (const tableName of tables) {
        const result = await testPool.query(`
          SELECT table_name FROM information_schema.tables 
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);

        expect(result.rows).toHaveLength(1);
      }
    });

    test('should have correct metrics table structure', async () => {
      const result = await testPool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'metrics' AND table_schema = 'public'
        ORDER BY ordinal_position
      `);

      const expectedColumns = [
        { column_name: 'id', data_type: 'bigint', is_nullable: 'NO' },
        { column_name: 'org_id', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'value', data_type: 'double precision', is_nullable: 'NO' },
        { column_name: 'unit', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'tags', data_type: 'jsonb', is_nullable: 'YES' },
        { column_name: 'timestamp', data_type: 'timestamp with time zone', is_nullable: 'NO' },
        { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' }
      ];

      expectedColumns.forEach(expected => {
        const column = result.rows.find(row => row.column_name === expected.column_name);
        expect(column).toBeDefined();
        expect(column.data_type).toBe(expected.data_type);
        expect(column.is_nullable).toBe(expected.is_nullable);
      });
    });

    test('should have proper indexes', async () => {
      const result = await testPool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'metrics'
      `);

      const indexNames = result.rows.map(row => row.indexname);
      
      // Check for expected indexes
      expect(indexNames).toContain('metrics_pkey'); // Primary key
      expect(indexNames).toContain('metrics_org_id_name_timestamp_idx'); // Query optimization
      expect(indexNames).toContain('metrics_timestamp_idx'); // Time range queries
      expect(indexNames).toContain('metrics_tags_idx'); // JSONB queries
    });
  });

  describe('CRUD Operations', () => {
    test('should insert metric data', async () => {
      const metricData = {
        org_id: testOrgId,
        name: 'cpu_usage',
        value: 75.5,
        unit: 'percent',
        tags: { host: 'web-server-01', environment: 'test' },
        timestamp: new Date(),
        created_at: new Date()
      };

      const result = await testPool.query(`
        INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        metricData.org_id,
        metricData.name,
        metricData.value,
        metricData.unit,
        metricData.tags,
        metricData.timestamp,
        metricData.created_at
      ]);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBeDefined();
    });

    test('should query metric data with filters', async () => {
      // Insert test data
      const testData = [
        {
          org_id: testOrgId,
          name: 'cpu_usage',
          value: 75.5,
          unit: 'percent',
          tags: { host: 'server-01' },
          timestamp: new Date('2024-01-01T10:00:00Z')
        },
        {
          org_id: testOrgId,
          name: 'memory_usage',
          value: 2048,
          unit: 'MB',
          tags: { host: 'server-01' },
          timestamp: new Date('2024-01-01T10:01:00Z')
        }
      ];

      for (const data of testData) {
        await testPool.query(`
          INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [data.org_id, data.name, data.value, data.unit, data.tags, data.timestamp]);
      }

      // Query by organization
      const orgResult = await testPool.query(
        'SELECT * FROM metrics WHERE org_id = $1',
        [testOrgId]
      );
      expect(orgResult.rows).toHaveLength(2);

      // Query by metric name
      const nameResult = await testPool.query(
        'SELECT * FROM metrics WHERE org_id = $1 AND name = $2',
        [testOrgId, 'cpu_usage']
      );
      expect(nameResult.rows).toHaveLength(1);
      expect(nameResult.rows[0].name).toBe('cpu_usage');

      // Query by time range
      const timeResult = await testPool.query(`
        SELECT * FROM metrics 
        WHERE org_id = $1 AND timestamp >= $2 AND timestamp < $3
      `, [testOrgId, new Date('2024-01-01T09:59:00Z'), new Date('2024-01-01T10:00:30Z')]);
      expect(timeResult.rows).toHaveLength(1);
    });

    test('should update metric data', async () => {
      // Insert test metric
      const insertResult = await testPool.query(`
        INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `, [testOrgId, 'test_metric', 100, 'count', {}, new Date()]);

      const metricId = insertResult.rows[0].id;

      // Update the metric
      const updateResult = await testPool.query(`
        UPDATE metrics SET value = $1, tags = $2 
        WHERE id = $3 AND org_id = $4
        RETURNING *
      `, [200, { updated: true }, metricId, testOrgId]);

      expect(updateResult.rows).toHaveLength(1);
      expect(updateResult.rows[0].value).toBe(200);
      expect(updateResult.rows[0].tags.updated).toBe(true);
    });

    test('should delete metric data', async () => {
      // Insert test metric
      const insertResult = await testPool.query(`
        INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `, [testOrgId, 'test_metric', 100, 'count', {}, new Date()]);

      const metricId = insertResult.rows[0].id;

      // Delete the metric
      const deleteResult = await testPool.query(
        'DELETE FROM metrics WHERE id = $1 AND org_id = $2',
        [metricId, testOrgId]
      );

      expect(deleteResult.rowCount).toBe(1);

      // Verify deletion
      const verifyResult = await testPool.query(
        'SELECT * FROM metrics WHERE id = $1',
        [metricId]
      );
      expect(verifyResult.rows).toHaveLength(0);
    });
  });

  describe('JSONB Operations', () => {
    beforeEach(async () => {
      // Insert test data with various tag structures
      const testMetrics = [
        {
          tags: { host: 'server-01', environment: 'production', region: 'us-east-1' },
          name: 'metric1'
        },
        {
          tags: { host: 'server-02', environment: 'staging', region: 'us-west-2' },
          name: 'metric2'
        },
        {
          tags: { host: 'server-01', environment: 'development' },
          name: 'metric3'
        }
      ];

      for (const metric of testMetrics) {
        await testPool.query(`
          INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [testOrgId, metric.name, 100, 'count', metric.tags, new Date()]);
      }
    });

    test('should query by JSONB key existence', async () => {
      const result = await testPool.query(
        "SELECT * FROM metrics WHERE org_id = $1 AND tags ? 'region'",
        [testOrgId]
      );
      expect(result.rows).toHaveLength(2); // Only metrics with region tag
    });

    test('should query by JSONB key-value pairs', async () => {
      const result = await testPool.query(
        "SELECT * FROM metrics WHERE org_id = $1 AND tags ->> 'environment' = 'production'",
        [testOrgId]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].tags.environment).toBe('production');
    });

    test('should query by JSONB containment', async () => {
      const result = await testPool.query(
        "SELECT * FROM metrics WHERE org_id = $1 AND tags @> $2",
        [testOrgId, { host: 'server-01' }]
      );
      expect(result.rows).toHaveLength(2); // Two metrics from server-01
    });

    test('should update JSONB fields', async () => {
      const insertResult = await testPool.query(`
        INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `, [testOrgId, 'update_test', 100, 'count', { original: true }, new Date()]);

      const metricId = insertResult.rows[0].id;

      // Update using JSONB operators
      await testPool.query(`
        UPDATE metrics 
        SET tags = tags || $1
        WHERE id = $2
      `, [{ updated: true, new_field: 'value' }, metricId]);

      const result = await testPool.query(
        'SELECT tags FROM metrics WHERE id = $1',
        [metricId]
      );

      expect(result.rows[0].tags.original).toBe(true);
      expect(result.rows[0].tags.updated).toBe(true);
      expect(result.rows[0].tags.new_field).toBe('value');
    });
  });

  describe('TimescaleDB Features', () => {
    test('should support time-bucket aggregations', async () => {
      // Insert time series data
      const baseTime = new Date('2024-01-01T10:00:00Z');
      for (let i = 0; i < 60; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 60000);
        await testPool.query(`
          INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [testOrgId, 'cpu_usage', 50 + (i % 50), 'percent', { host: 'server-01' }, timestamp]);
      }

      // Test time_bucket aggregation
      const result = await testPool.query(`
        SELECT 
          time_bucket('5 minutes', timestamp) as bucket,
          AVG(value) as avg_value,
          COUNT(*) as count
        FROM metrics 
        WHERE org_id = $1 AND name = $2
        GROUP BY bucket
        ORDER BY bucket
      `, [testOrgId, 'cpu_usage']);

      expect(result.rows.length).toBeGreaterThan(0);
      result.rows.forEach(row => {
        expect(row.bucket).toBeInstanceOf(Date);
        expect(typeof row.avg_value).toBe('string'); // PostgreSQL returns decimal as string
        expect(typeof row.count).toBe('string'); // PostgreSQL returns bigint as string
      });
    });

    test('should support time-based retention policies', async () => {
      // This would test TimescaleDB retention policies if configured
      // For now, we'll test the basic query structure
      const result = await testPool.query(`
        SELECT schemaname, tablename, retention_policy
        FROM timescaledb_information.retention_policies
        WHERE hypertable_name = 'metrics'
      `);

      // If retention policies are configured, verify the structure
      if (result.rows.length > 0) {
        result.rows.forEach(row => {
          expect(row).toHaveProperty('retention_policy');
          expect(row.tablename).toBe('metrics');
        });
      }
    });
  });

  describe('Performance Tests', () => {
    test('should handle bulk inserts efficiently', async () => {
      const startTime = Date.now();
      const batchSize = 1000;
      
      // Prepare batch data
      const values = [];
      const params = [];
      for (let i = 0; i < batchSize; i++) {
        const paramIndex = i * 7;
        values.push(`($${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`);
        params.push(
          testOrgId,
          `bulk_metric_${i}`,
          Math.random() * 100,
          'count',
          { batch: true, index: i },
          new Date(),
          new Date()
        );
      }

      const query = `
        INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
        VALUES ${values.join(', ')}
      `;

      await testPool.query(query, params);
      const endTime = Date.now();

      const insertTime = endTime - startTime;
      expect(insertTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all records were inserted
      const countResult = await testPool.query(
        'SELECT COUNT(*) FROM metrics WHERE org_id = $1 AND tags @> $2',
        [testOrgId, { batch: true }]
      );
      expect(parseInt(countResult.rows[0].count)).toBe(batchSize);
    });

    test('should execute complex queries within performance limits', async () => {
      // Insert test data for complex query
      const baseTime = new Date('2024-01-01T10:00:00Z');
      for (let i = 0; i < 100; i++) {
        const timestamp = new Date(baseTime.getTime() + i * 60000);
        await testPool.query(`
          INSERT INTO metrics (org_id, name, value, unit, tags, timestamp, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          testOrgId, 
          i % 3 === 0 ? 'cpu_usage' : i % 3 === 1 ? 'memory_usage' : 'disk_usage',
          Math.random() * 100,
          'percent',
          { host: `server-${(i % 5) + 1}`, environment: i < 50 ? 'production' : 'staging' },
          timestamp
        ]);
      }

      const startTime = Date.now();
      
      // Complex aggregation query
      const result = await testPool.query(`
        SELECT 
          name,
          tags ->> 'host' as host,
          tags ->> 'environment' as environment,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          COUNT(*) as count
        FROM metrics 
        WHERE org_id = $1 
          AND timestamp >= $2 
          AND timestamp <= $3
        GROUP BY name, tags ->> 'host', tags ->> 'environment'
        ORDER BY avg_value DESC
      `, [testOrgId, new Date('2024-01-01T10:00:00Z'), new Date('2024-01-01T11:40:00Z')]);

      const queryTime = Date.now() - startTime;
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});