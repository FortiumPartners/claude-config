import { DatabaseConnection } from './connection';
import { timescaleConfig } from './config';

export class DatabaseSchema {
  constructor(private db: DatabaseConnection) {}

  async createExtensions(): Promise<void> {
    await this.db.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE EXTENSION IF NOT EXISTS "timescaledb";
    `);
  }

  async createOrganizationsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        
        CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
        CONSTRAINT organizations_name_length CHECK (char_length(name) >= 2)
      );
      
      CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
      CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at);
      CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NOT NULL;
    `);
  }

  async createUsersTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255),
        full_name VARCHAR(255),
        avatar_url TEXT,
        role VARCHAR(50) DEFAULT 'developer',
        permissions JSONB DEFAULT '[]',
        preferences JSONB DEFAULT '{}',
        last_login_at TIMESTAMPTZ,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        
        UNIQUE(organization_id, email),
        CONSTRAINT users_email_format CHECK (email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'),
        CONSTRAINT users_role_valid CHECK (role IN ('admin', 'manager', 'developer', 'viewer')),
        CONSTRAINT users_failed_attempts_range CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 10)
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(organization_id, role);
      CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
    `);
  }

  async createTeamsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        
        UNIQUE(organization_id, name),
        CONSTRAINT teams_name_length CHECK (char_length(name) >= 2)
      );
      
      CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
      CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(organization_id, name);
    `);
  }

  async createTeamMembersTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        
        UNIQUE(team_id, user_id),
        CONSTRAINT team_members_role_valid CHECK (role IN ('admin', 'member'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
      CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_team_members_organization_id ON team_members(organization_id);
    `);
  }

  async createProjectsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        repository_url TEXT,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        
        UNIQUE(organization_id, name),
        CONSTRAINT projects_name_length CHECK (char_length(name) >= 2)
      );
      
      CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
      CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
      CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(organization_id, name);
    `);
  }

  async createCommandExecutionsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS command_executions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        command_name VARCHAR(255) NOT NULL,
        command_args JSONB,
        execution_time_ms INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        context JSONB DEFAULT '{}',
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT command_executions_status_valid CHECK (status IN ('success', 'error', 'timeout', 'cancelled')),
        CONSTRAINT command_executions_time_positive CHECK (execution_time_ms >= 0)
      );
      
      -- Convert to TimescaleDB hypertable
      SELECT create_hypertable('command_executions', 'executed_at', 
                               chunk_time_interval => INTERVAL '${timescaleConfig.chunkTimeInterval}',
                               if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_command_executions_organization_id_time 
        ON command_executions(organization_id, executed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_command_executions_user_id_time 
        ON command_executions(user_id, executed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_command_executions_command_name 
        ON command_executions(organization_id, command_name, executed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_command_executions_status 
        ON command_executions(organization_id, status, executed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_command_executions_team_project 
        ON command_executions(organization_id, team_id, project_id, executed_at DESC);
    `);
  }

  async createAgentInteractionsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS agent_interactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        command_execution_id UUID REFERENCES command_executions(id) ON DELETE SET NULL,
        agent_name VARCHAR(255) NOT NULL,
        interaction_type VARCHAR(100) NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        execution_time_ms INTEGER NOT NULL,
        status VARCHAR(50) NOT NULL,
        error_message TEXT,
        metadata JSONB DEFAULT '{}',
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT agent_interactions_status_valid CHECK (status IN ('success', 'error', 'timeout', 'cancelled')),
        CONSTRAINT agent_interactions_time_positive CHECK (execution_time_ms >= 0),
        CONSTRAINT agent_interactions_tokens_positive CHECK (
          (input_tokens IS NULL OR input_tokens >= 0) AND 
          (output_tokens IS NULL OR output_tokens >= 0)
        )
      );
      
      -- Convert to TimescaleDB hypertable
      SELECT create_hypertable('agent_interactions', 'occurred_at', 
                               chunk_time_interval => INTERVAL '${timescaleConfig.chunkTimeInterval}',
                               if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_agent_interactions_organization_id_time 
        ON agent_interactions(organization_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_interactions_user_id_time 
        ON agent_interactions(user_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_interactions_agent_name 
        ON agent_interactions(organization_id, agent_name, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_interactions_command_execution 
        ON agent_interactions(command_execution_id, occurred_at DESC);
    `);
  }

  async createUserSessionsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        session_end TIMESTAMPTZ,
        duration_minutes INTEGER,
        commands_executed INTEGER DEFAULT 0,
        agents_used JSONB DEFAULT '[]',
        productivity_score DECIMAL(5,2),
        context JSONB DEFAULT '{}',
        
        CONSTRAINT user_sessions_duration_positive CHECK (
          duration_minutes IS NULL OR duration_minutes >= 0
        ),
        CONSTRAINT user_sessions_commands_positive CHECK (commands_executed >= 0),
        CONSTRAINT user_sessions_score_range CHECK (
          productivity_score IS NULL OR (productivity_score >= 0 AND productivity_score <= 100)
        )
      );
      
      -- Convert to TimescaleDB hypertable
      SELECT create_hypertable('user_sessions', 'session_start', 
                               chunk_time_interval => INTERVAL '${timescaleConfig.chunkTimeInterval}',
                               if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_user_sessions_organization_id_time 
        ON user_sessions(organization_id, session_start DESC);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_time 
        ON user_sessions(user_id, session_start DESC);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active 
        ON user_sessions(organization_id, session_end) WHERE session_end IS NULL;
    `);
  }

  async createProductivityMetricsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS productivity_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        metric_type VARCHAR(100) NOT NULL,
        metric_value DECIMAL(15,6) NOT NULL,
        metric_unit VARCHAR(50),
        dimensions JSONB DEFAULT '{}',
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT productivity_metrics_type_valid CHECK (
          metric_type IN (
            'commands_per_hour', 'error_rate', 'session_duration', 
            'productivity_score', 'code_quality_score', 'response_time',
            'task_completion_time', 'agent_usage_frequency'
          )
        )
      );
      
      -- Convert to TimescaleDB hypertable
      SELECT create_hypertable('productivity_metrics', 'recorded_at', 
                               chunk_time_interval => INTERVAL '${timescaleConfig.chunkTimeInterval}',
                               if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_productivity_metrics_organization_id_time 
        ON productivity_metrics(organization_id, recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_productivity_metrics_user_id_time 
        ON productivity_metrics(user_id, recorded_at DESC) WHERE user_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_productivity_metrics_type 
        ON productivity_metrics(organization_id, metric_type, recorded_at DESC);
      CREATE INDEX IF NOT EXISTS idx_productivity_metrics_team_project 
        ON productivity_metrics(organization_id, team_id, project_id, recorded_at DESC);
    `);
  }

  async initializeSchema(): Promise<void> {
    try {
      await this.createExtensions();
      await this.createOrganizationsTable();
      await this.createUsersTable();
      await this.createTeamsTable();
      await this.createTeamMembersTable();
      await this.createProjectsTable();
      await this.createCommandExecutionsTable();
      await this.createAgentInteractionsTable();
      await this.createUserSessionsTable();
      await this.createProductivityMetricsTable();
      
      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  async dropSchema(): Promise<void> {
    const tables = [
      'productivity_metrics',
      'user_sessions',
      'agent_interactions',
      'command_executions',
      'projects',
      'team_members',
      'teams',
      'users',
      'organizations',
    ];

    for (const table of tables) {
      await this.db.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    
    console.log('Database schema dropped successfully');
  }
}
