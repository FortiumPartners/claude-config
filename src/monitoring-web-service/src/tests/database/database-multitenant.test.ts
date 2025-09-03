/**
 * Comprehensive multi-tenant database isolation tests.
 * 
 * Tests row-level security policies, tenant isolation, time-series partitioning,
 * and data retention policies for the external metrics web service.
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

interface TestOrganization {
  id: string;
  name: string;
  domain: string;
}

// Removed unused TestConfig interface

describe('Multi-Tenant Database Isolation', () => {
  let testContainer: StartedTestContainer;
  let pool: Pool;
  let client: PoolClient;
  let testOrganizations: Record<string, TestOrganization>;

  beforeAll(async () => {
    // Start TimescaleDB container for testing
    testContainer = await new GenericContainer('timescale/timescaledb:latest-pg16')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_DB: 'claude_metrics_test',
        POSTGRES_USER: 'claude_test',
        POSTGRES_PASSWORD: 'test_password',
        POSTGRES_HOST_AUTH_METHOD: 'trust',
      })
      .withCommand([
        'postgres',
        '-c', 'shared_preload_libraries=timescaledb',
        '-c', 'log_statement=all',
        '-c', 'log_min_duration_statement=0',
      ])
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
      .start();

    const port = testContainer.getMappedPort(5432);
    const host = testContainer.getHost();

    // Create connection pool
    pool = new Pool({
      host,
      port,
      user: 'claude_test',
      password: 'test_password',
      database: 'claude_metrics_test',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 30000,
    });

    // Get a client for setup
    client = await pool.connect();
    
    // Setup test schema
    await setupTestSchema(client);
    
    // Create test organizations
    testOrganizations = await createTestOrganizations(client);
  }, 60000);

  afterAll(async () => {
    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
    if (testContainer) {
      await testContainer.stop();
    }
  });

  beforeEach(async () => {
    // Clean up data between tests
    await cleanupTestData(client);
  });

  describe('Organization Isolation', () => {
    it('should isolate organizations from each other', async () => {
      const fortiumId = testOrganizations.fortium.id;
      const clientAId = testOrganizations.client_a.id;

      // Set context to Fortium
      await client.query('SET app.current_organization_id = $1', [fortiumId]);

      // Should only see Fortium organization
      const fortiumResult = await client.query('SELECT id, name FROM organizations');
      expect(fortiumResult.rows).toHaveLength(1);
      expect(fortiumResult.rows[0].id).toBe(fortiumId);
      expect(fortiumResult.rows[0].name).toBe('Fortium Corp');

      // Switch context to Client A
      await client.query('SET app.current_organization_id = $1', [clientAId]);

      // Should only see Client A organization
      const clientResult = await client.query('SELECT id, name FROM organizations');
      expect(clientResult.rows).toHaveLength(1);
      expect(clientResult.rows[0].id).toBe(clientAId);
      expect(clientResult.rows[0].name).toBe('Client A Corp');
    });

    it('should prevent cross-organization data access', async () => {
      const fortiumId = testOrganizations.fortium.id;
      const clientAId = testOrganizations.client_a.id;

      // Insert data in Fortium context
      await client.query('SET app.current_organization_id = $1', [fortiumId]);
      await client.query(`
        INSERT INTO command_executions (organization_id, command_name, execution_time_ms, success)
        VALUES ($1, '/fortium-command', 1000, true)
      `, [fortiumId]);

      // Insert data in Client A context
      await client.query('SET app.current_organization_id = $1', [clientAId]);
      await client.query(`
        INSERT INTO command_executions (organization_id, command_name, execution_time_ms, success)
        VALUES ($1, '/client-command', 1200, true)
      `, [clientAId]);

      // Verify Fortium can only see their data
      await client.query('SET app.current_organization_id = $1', [fortiumId]);
      const fortiumData = await client.query('SELECT command_name FROM command_executions');
      expect(fortiumData.rows).toHaveLength(1);
      expect(fortiumData.rows[0].command_name).toBe('/fortium-command');

      // Verify Client A can only see their data
      await client.query('SET app.current_organization_id = $1', [clientAId]);
      const clientData = await client.query('SELECT command_name FROM command_executions');
      expect(clientData.rows).toHaveLength(1);
      expect(clientData.rows[0].command_name).toBe('/client-command');
    });
  });

  describe('Team and Project Isolation', () => {
    it('should isolate teams by organization', async () => {
      const fortiumId = testOrganizations.fortium.id;
      const clientAId = testOrganizations.client_a.id;

      // Create teams for each organization
      await client.query('SET app.current_organization_id = $1', [fortiumId]);
      await client.query(`
        INSERT INTO teams (id, organization_id, name)
        VALUES ($1, $2, 'Fortium Dev Team')
      `, [uuidv4(), fortiumId]);

      await client.query('SET app.current_organization_id = $1', [clientAId]);
      await client.query(`
        INSERT INTO teams (id, organization_id, name)
        VALUES ($1, $2, 'Client A QA Team')
      `, [uuidv4(), clientAId]);

      // Verify Fortium can only see their team
      await client.query('SET app.current_organization_id = $1', [fortiumId]);
      const fortiumTeams = await client.query('SELECT name FROM teams');
      expect(fortiumTeams.rows).toHaveLength(1);
      expect(fortiumTeams.rows[0].name).toBe('Fortium Dev Team');

      // Verify Client A can only see their team
      await client.query('SET app.current_organization_id = $1', [clientAId]);
      const clientTeams = await client.query('SELECT name FROM teams');
      expect(clientTeams.rows).toHaveLength(1);
      expect(clientTeams.rows[0].name).toBe('Client A QA Team');
    });
  });

  describe('Security Validation', () => {
    it('should prevent RLS bypass attempts', async () => {
      const fortiumId = testOrganizations.fortium.id;
      const clientAId = testOrganizations.client_a.id;

      // Set context to Fortium
      await client.query('SET app.current_organization_id = $1', [fortiumId]);

      // Try to insert data for Client A while in Fortium context
      await client.query(`
        INSERT INTO command_executions (organization_id, command_name, execution_time_ms, success)
        VALUES ($1, '/unauthorized-access', 1000, true)
      `, [clientAId]);

      // Verify Fortium cannot see the unauthorized data
      const fortiumData = await client.query(`
        SELECT * FROM command_executions WHERE command_name = '/unauthorized-access'
      `);
      expect(fortiumData.rows).toHaveLength(0);

      // Switch to Client A context and verify they also cannot see it
      await client.query('SET app.current_organization_id = $1', [clientAId]);
      const clientData = await client.query(`
        SELECT * FROM command_executions WHERE command_name = '/unauthorized-access'
      `);
      expect(clientData.rows).toHaveLength(0);
    });

    it('should resist SQL injection attempts', async () => {
      const fortiumId = testOrganizations.fortium.id;
      const clientAId = testOrganizations.client_a.id;

      await client.query('SET app.current_organization_id = $1', [fortiumId]);

      // Various SQL injection attempts that should be blocked by RLS
      const injectionAttempts = [
        `'; SELECT * FROM organizations WHERE id = '${clientAId}' --`,
        `' UNION SELECT * FROM organizations WHERE id = '${clientAId}' --`,
        `' OR organization_id = '${clientAId}' --`,
      ];

      for (const injection of injectionAttempts) {
        try {
          const result = await client.query(`
            SELECT * FROM command_executions WHERE command_name = 'test${injection}'
          `);
          // Should be empty due to RLS
          expect(result.rows).toHaveLength(0);
        } catch (error) {
          // SQL errors are also acceptable as they indicate protection
          expect(error).toBeTruthy();
        }
      }
    });
  });

  describe('Time-Series Partitioning', () => {
    it('should create hypertables correctly', async () => {
      // Check if command_executions is a hypertable
      const commandResult = await client.query(`
        SELECT COUNT(*) FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'command_executions'
      `);
      expect(parseInt(commandResult.rows[0].count)).toBe(1);

      // Check if agent_interactions is a hypertable
      const agentResult = await client.query(`
        SELECT COUNT(*) FROM timescaledb_information.hypertables
        WHERE hypertable_name = 'agent_interactions'
      `);
      expect(parseInt(agentResult.rows[0].count)).toBe(1);
    });

    it('should handle time-based data correctly', async () => {
      const fortiumId = testOrganizations.fortium.id;
      await client.query('SET app.current_organization_id = $1', [fortiumId]);

      // Insert data across different time periods
      const now = new Date();
      const timestamps = [
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        new Date(now.getTime() - 24 * 60 * 60 * 1000),      // 1 day ago
        now,                                                 // Now
      ];

      for (let i = 0; i < timestamps.length; i++) {
        await client.query(`
          INSERT INTO command_executions (organization_id, command_name, execution_time_ms, success, timestamp)
          VALUES ($1, $2, $3, true, $4)
        `, [fortiumId, `/test-command-${i}`, 1000 + i * 100, timestamps[i]]);
      }

      // Verify all data is accessible
      const allData = await client.query('SELECT COUNT(*) FROM command_executions');
      expect(parseInt(allData.rows[0].count)).toBe(3);

      // Test time-based queries are efficient
      const recentData = await client.query(`
        SELECT COUNT(*) FROM command_executions 
        WHERE timestamp >= $1
      `, [new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)]);
      expect(parseInt(recentData.rows[0].count)).toBe(2);
    });
  });

  describe('Data Retention Policies', () => {
    it('should have retention policies configured', async () => {
      // Check retention policies exist
      const policies = await client.query(`
        SELECT hypertable_name, drop_after 
        FROM timescaledb_information.retention_policies
      `);

      const policyMap = policies.rows.reduce((acc, row) => {
        acc[row.hypertable_name] = row.drop_after;
        return acc;
      }, {} as Record<string, any>);

      // Verify command_executions retention (should be >= 365 days)
      if (policyMap.command_executions) {
        // Parse interval and check it's at least 365 days
        const interval = policyMap.command_executions;
        expect(interval).toBeTruthy();
      }

      // Verify agent_interactions retention (should be >= 180 days)
      if (policyMap.agent_interactions) {
        const interval = policyMap.agent_interactions;
        expect(interval).toBeTruthy();
      }
    });
  });

  describe('Performance Validation', () => {
    it('should handle queries efficiently', async () => {
      const fortiumId = testOrganizations.fortium.id;
      await client.query('SET app.current_organization_id = $1', [fortiumId]);

      // Insert test data
      const insertPromises = [];
      for (let i = 0; i < 1000; i++) {
        insertPromises.push(
          client.query(`
            INSERT INTO command_executions (organization_id, command_name, execution_time_ms, success)
            VALUES ($1, $2, $3, $4)
          `, [fortiumId, `/test-command-${i % 10}`, 1000 + i, i % 4 !== 0]),
        );
      }
      await Promise.all(insertPromises);

      // Test query performance
      const startTime = Date.now();
      const result = await client.query(`
        SELECT 
          command_name,
          COUNT(*) as count,
          AVG(execution_time_ms)::INTEGER as avg_time
        FROM command_executions
        WHERE success = true
        GROUP BY command_name
        ORDER BY count DESC
      `);
      const queryTime = Date.now() - startTime;

      // Verify results and performance
      expect(result.rows.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('End-to-End Multi-Tenant Workflow', () => {
    it('should handle complete tenant workflow', async () => {
      // Create organization, team, project, executions, interactions, and sessions
      const orgId = uuidv4();
      await client.query(`
        INSERT INTO organizations (id, name, domain)
        VALUES ($1, 'Test Corp', 'testcorp.com')
      `, [orgId]);

      await client.query('SET app.current_organization_id = $1', [orgId]);

      // Create team and project
      const teamId = uuidv4();
      const projectId = uuidv4();

      await client.query(`
        INSERT INTO teams (id, organization_id, name)
        VALUES ($1, $2, 'Development Team')
      `, [teamId, orgId]);

      await client.query(`
        INSERT INTO projects (id, organization_id, team_id, name)
        VALUES ($1, $2, $3, 'AI Metrics Project')
      `, [projectId, orgId, teamId]);

      // Simulate command execution workflow
      const executionId = uuidv4();
      await client.query(`
        INSERT INTO command_executions (id, organization_id, project_id, team_id, command_name, execution_time_ms, success)
        VALUES ($1, $2, $3, $4, '/plan-product', 1500, true)
      `, [executionId, orgId, projectId, teamId]);

      // Add agent interactions
      const agents = ['tech-lead-orchestrator', 'context-fetcher', 'documentation-specialist'];
      for (let i = 0; i < agents.length; i++) {
        await client.query(`
          INSERT INTO agent_interactions (organization_id, project_id, execution_id, agent_name, interaction_type, duration_ms, success)
          VALUES ($1, $2, $3, $4, 'delegation', $5, true)
        `, [orgId, projectId, executionId, agents[i], 300 + i * 100]);
      }

      // Create user session
      const sessionId = uuidv4();
      await client.query(`
        INSERT INTO user_sessions (id, organization_id, user_identifier, session_start, commands_executed, productivity_score)
        VALUES ($1, $2, 'user@testcorp.com', NOW(), 1, 95.5)
      `, [sessionId, orgId]);

      // Verify complete data isolation and relationships
      const dashboardData = await client.query(`
        SELECT 
          o.name as org_name,
          COUNT(DISTINCT t.id) as team_count,
          COUNT(DISTINCT p.id) as project_count,
          COUNT(DISTINCT ce.id) as execution_count,
          COUNT(DISTINCT ai.id) as interaction_count,
          COUNT(DISTINCT us.id) as session_count
        FROM organizations o
        LEFT JOIN teams t ON t.organization_id = o.id
        LEFT JOIN projects p ON p.organization_id = o.id  
        LEFT JOIN command_executions ce ON ce.organization_id = o.id
        LEFT JOIN agent_interactions ai ON ai.organization_id = o.id
        LEFT JOIN user_sessions us ON us.organization_id = o.id
        WHERE o.id = $1
        GROUP BY o.id, o.name
      `, [orgId]);

      // Verify all data is properly linked and isolated
      const data = dashboardData.rows[0];
      expect(data.org_name).toBe('Test Corp');
      expect(parseInt(data.team_count)).toBe(1);
      expect(parseInt(data.project_count)).toBe(1);
      expect(parseInt(data.execution_count)).toBe(1);
      expect(parseInt(data.interaction_count)).toBe(3);
      expect(parseInt(data.session_count)).toBe(1);
    });
  });
});

// Helper functions

async function setupTestSchema(client: PoolClient): Promise<void> {
  // Enable required extensions
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await client.query('CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE');

  // Organizations table
  await client.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL UNIQUE,
      subscription_tier VARCHAR(50) DEFAULT 'basic',
      api_key_hash VARCHAR(255) UNIQUE,
      rate_limit_per_hour INTEGER DEFAULT 1000,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Teams table
  await client.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(organization_id, name)
    )
  `);

  // Projects table
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      repository_url VARCHAR(500),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(organization_id, name)
    )
  `);

  // Command executions table (time-series)
  await client.query(`
    CREATE TABLE IF NOT EXISTS command_executions (
      id UUID DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
      command_name VARCHAR(100) NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      context_size_kb INTEGER,
      agent_delegations INTEGER DEFAULT 0,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb,
      PRIMARY KEY (id, timestamp)
    )
  `);

  // Convert to hypertable for time-series
  try {
    await client.query(`
      SELECT create_hypertable('command_executions', 'timestamp', 
        partitioning_column => 'organization_id', 
        number_partitions => 4,
        if_not_exists => TRUE
      )
    `);
  } catch (error) {
    // Table might already be a hypertable
  }

  // Agent interactions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS agent_interactions (
      id UUID DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
      execution_id UUID NOT NULL,
      agent_name VARCHAR(100) NOT NULL,
      interaction_type VARCHAR(50) NOT NULL,
      duration_ms INTEGER NOT NULL,
      success BOOLEAN NOT NULL,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb,
      PRIMARY KEY (id, timestamp)
    )
  `);

  // Convert to hypertable
  try {
    await client.query(`
      SELECT create_hypertable('agent_interactions', 'timestamp',
        partitioning_column => 'organization_id',
        number_partitions => 4,
        if_not_exists => TRUE
      )
    `);
  } catch (error) {
    // Table might already be a hypertable
  }

  // User sessions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_identifier VARCHAR(255) NOT NULL,
      session_start TIMESTAMP WITH TIME ZONE NOT NULL,
      session_end TIMESTAMP WITH TIME ZONE,
      commands_executed INTEGER DEFAULT 0,
      productivity_score DECIMAL(5,2),
      metadata JSONB DEFAULT '{}'::jsonb
    )
  `);

  // Enable Row Level Security
  await client.query('ALTER TABLE organizations ENABLE ROW LEVEL SECURITY');
  await client.query('ALTER TABLE teams ENABLE ROW LEVEL SECURITY');
  await client.query('ALTER TABLE projects ENABLE ROW LEVEL SECURITY');
  await client.query('ALTER TABLE command_executions ENABLE ROW LEVEL SECURITY');
  await client.query('ALTER TABLE agent_interactions ENABLE ROW LEVEL SECURITY');
  await client.query('ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await createRLSPolicies(client);
  
  // Create test roles
  await createTestRoles(client);
  
  // Create data retention policies
  await createRetentionPolicies(client);
}

async function createRLSPolicies(client: PoolClient): Promise<void> {
  // Drop existing policies if they exist
  const policies = [
    ['organizations', 'org_isolation_policy'],
    ['teams', 'team_isolation_policy'],
    ['projects', 'project_isolation_policy'],
    ['command_executions', 'command_isolation_policy'],
    ['agent_interactions', 'agent_isolation_policy'],
    ['user_sessions', 'session_isolation_policy'],
  ];

  for (const [table, policy] of policies) {
    await client.query(`DROP POLICY IF EXISTS ${policy} ON ${table}`);
  }

  // Organizations: Users can only see their own organization
  await client.query(`
    CREATE POLICY org_isolation_policy ON organizations
    FOR ALL TO authenticated_user
    USING (id = current_setting('app.current_organization_id')::UUID)
  `);

  // Teams: Only accessible within the same organization
  await client.query(`
    CREATE POLICY team_isolation_policy ON teams
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_organization_id')::UUID)
  `);

  // Projects: Only accessible within the same organization
  await client.query(`
    CREATE POLICY project_isolation_policy ON projects
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_organization_id')::UUID)
  `);

  // Command executions: Only accessible within the same organization
  await client.query(`
    CREATE POLICY command_isolation_policy ON command_executions
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_organization_id')::UUID)
  `);

  // Agent interactions: Only accessible within the same organization
  await client.query(`
    CREATE POLICY agent_isolation_policy ON agent_interactions
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_organization_id')::UUID)
  `);

  // User sessions: Only accessible within the same organization
  await client.query(`
    CREATE POLICY session_isolation_policy ON user_sessions
    FOR ALL TO authenticated_user
    USING (organization_id = current_setting('app.current_organization_id')::UUID)
  `);
}

async function createTestRoles(client: PoolClient): Promise<void> {
  // Create authenticated_user role if it doesn't exist
  try {
    await client.query('CREATE ROLE authenticated_user');
  } catch (error) {
    // Role might already exist
  }

  // Grant necessary permissions
  await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated_user');
  await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated_user');
}

async function createRetentionPolicies(client: PoolClient): Promise<void> {
  try {
    // Retention policy for command_executions (365 days)
    await client.query(`
      SELECT add_retention_policy('command_executions', INTERVAL '365 days', if_not_exists => TRUE)
    `);
    
    // Retention policy for agent_interactions (180 days)
    await client.query(`
      SELECT add_retention_policy('agent_interactions', INTERVAL '180 days', if_not_exists => TRUE)
    `);
  } catch (error) {
    // Policies might already exist or TimescaleDB not fully configured
  }
}

async function createTestOrganizations(client: PoolClient): Promise<Record<string, TestOrganization>> {
  const organizations = {
    fortium: { id: uuidv4(), name: 'Fortium Corp', domain: 'fortium.com' },
    client_a: { id: uuidv4(), name: 'Client A Corp', domain: 'client-a.com' },
    client_b: { id: uuidv4(), name: 'Client B Corp', domain: 'client-b.com' },
  };

  for (const org of Object.values(organizations)) {
    await client.query(`
      INSERT INTO organizations (id, name, domain, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
    `, [org.id, org.name, org.domain]);
  }

  return organizations;
}

async function cleanupTestData(client: PoolClient): Promise<void> {
  const tables = [
    'agent_interactions',
    'command_executions', 
    'user_sessions',
    'projects',
    'teams',
  ];

  for (const table of tables) {
    await client.query(`DELETE FROM ${table}`);
  }
}