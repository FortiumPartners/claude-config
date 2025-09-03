import { DatabaseConnection } from './connection';
import { timescaleConfig } from './config';

export class TimescaleFeatures {
  constructor(private db: DatabaseConnection) {}

  async enableCompression(): Promise<void> {
    if (!timescaleConfig.compressionEnabled) {
      console.log('Compression is disabled in configuration');
      return;
    }

    const compressionPolicies = [
      {
        table: 'command_executions',
        after: `INTERVAL '${timescaleConfig.compressionAfterDays} days'`,
      },
      {
        table: 'agent_interactions', 
        after: `INTERVAL '${timescaleConfig.compressionAfterDays} days'`,
      },
      {
        table: 'user_sessions',
        after: `INTERVAL '${timescaleConfig.compressionAfterDays} days'`,
      },
      {
        table: 'productivity_metrics',
        after: `INTERVAL '${timescaleConfig.compressionAfterDays} days'`,
      },
    ];

    for (const policy of compressionPolicies) {
      await this.db.query(`
        SELECT add_compression_policy('${policy.table}', ${policy.after})
        WHERE NOT EXISTS (
          SELECT 1 FROM timescaledb_information.compression_settings 
          WHERE hypertable_name = '${policy.table}'
        );
      `);
    }

    console.log('Compression policies enabled for time-series tables');
  }

  async setupRetentionPolicies(): Promise<void> {
    const retentionPolicies = [
      {
        table: 'command_executions',
        retention: `INTERVAL '${timescaleConfig.retentionDays} days'`,
      },
      {
        table: 'agent_interactions',
        retention: `INTERVAL '${timescaleConfig.retentionDays} days'`,
      },
      {
        table: 'user_sessions',
        retention: `INTERVAL '${timescaleConfig.retentionDays} days'`,
      },
      {
        table: 'productivity_metrics',
        retention: `INTERVAL '${timescaleConfig.retentionDays} days'`,
      },
    ];

    for (const policy of retentionPolicies) {
      await this.db.query(`
        SELECT add_retention_policy('${policy.table}', ${policy.retention})
        WHERE NOT EXISTS (
          SELECT 1 FROM timescaledb_information.drop_chunks_policies 
          WHERE hypertable_name = '${policy.table}'
        );
      `);
    }

    console.log('Data retention policies configured');
  }

  async createContinuousAggregates(): Promise<void> {
    if (!timescaleConfig.continuousAggregates) {
      console.log('Continuous aggregates are disabled in configuration');
      return;
    }

    // Hourly command execution aggregates
    await this.db.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS command_executions_hourly
      WITH (timescaledb.continuous) AS
      SELECT 
        organization_id,
        user_id,
        team_id,
        project_id,
        command_name,
        time_bucket('1 hour', executed_at) AS bucket,
        COUNT(*) as execution_count,
        AVG(execution_time_ms) as avg_execution_time,
        MIN(execution_time_ms) as min_execution_time,
        MAX(execution_time_ms) as max_execution_time,
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'error') as error_count,
        (COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*)) as success_rate
      FROM command_executions
      GROUP BY organization_id, user_id, team_id, project_id, command_name, bucket;
    `);

    // Daily user productivity aggregates
    await this.db.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS user_productivity_daily
      WITH (timescaledb.continuous) AS
      SELECT 
        organization_id,
        user_id,
        team_id,
        time_bucket('1 day', session_start) AS bucket,
        COUNT(*) as session_count,
        AVG(duration_minutes) as avg_session_duration,
        SUM(duration_minutes) as total_duration_minutes,
        AVG(commands_executed) as avg_commands_per_session,
        SUM(commands_executed) as total_commands,
        AVG(productivity_score) as avg_productivity_score
      FROM user_sessions
      WHERE session_end IS NOT NULL
      GROUP BY organization_id, user_id, team_id, bucket;
    `);

    // Daily agent usage aggregates  
    await this.db.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS agent_usage_daily
      WITH (timescaledb.continuous) AS
      SELECT 
        organization_id,
        user_id,
        team_id,
        project_id,
        agent_name,
        time_bucket('1 day', occurred_at) AS bucket,
        COUNT(*) as interaction_count,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'error') as error_count
      FROM agent_interactions
      GROUP BY organization_id, user_id, team_id, project_id, agent_name, bucket;
    `);

    // Weekly team performance aggregates
    await this.db.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS team_performance_weekly
      WITH (timescaledb.continuous) AS
      SELECT 
        ce.organization_id,
        ce.team_id,
        time_bucket('1 week', ce.executed_at) AS bucket,
        COUNT(DISTINCT ce.user_id) as active_users,
        COUNT(*) as total_commands,
        AVG(ce.execution_time_ms) as avg_command_time,
        COUNT(*) FILTER (WHERE ce.status = 'success') as successful_commands,
        COUNT(DISTINCT ce.project_id) as active_projects,
        AVG(pm.metric_value) FILTER (WHERE pm.metric_type = 'productivity_score') as avg_team_productivity
      FROM command_executions ce
      LEFT JOIN productivity_metrics pm ON pm.team_id = ce.team_id 
        AND date_trunc('week', pm.recorded_at) = date_trunc('week', ce.executed_at)
        AND pm.metric_type = 'productivity_score'
      WHERE ce.team_id IS NOT NULL
      GROUP BY ce.organization_id, ce.team_id, bucket;
    `);

    console.log('Continuous aggregates created for analytics');
  }

  async setupRefreshPolicies(): Promise<void> {
    if (!timescaleConfig.continuousAggregates) {
      return;
    }

    const refreshPolicies = [
      {
        view: 'command_executions_hourly',
        interval: '1 hour',
        delay: '30 minutes',
      },
      {
        view: 'user_productivity_daily', 
        interval: '1 day',
        delay: '1 hour',
      },
      {
        view: 'agent_usage_daily',
        interval: '1 day', 
        delay: '1 hour',
      },
      {
        view: 'team_performance_weekly',
        interval: '1 day',
        delay: '2 hours',
      },
    ];

    for (const policy of refreshPolicies) {
      await this.db.query(`
        SELECT add_continuous_aggregate_policy('${policy.view}',
          start_offset => NULL,
          end_offset => INTERVAL '${policy.delay}',
          schedule_interval => INTERVAL '${policy.interval}'
        )
        WHERE NOT EXISTS (
          SELECT 1 FROM timescaledb_information.continuous_aggregate_policies 
          WHERE view_name = '${policy.view}'
        );
      `);
    }

    console.log('Refresh policies configured for continuous aggregates');
  }

  async createIndexOptimizations(): Promise<void> {
    // Time-series optimized indexes for common query patterns
    const indexes = [
      {
        table: 'command_executions',
        index: 'idx_ce_org_user_time_desc',
        definition: '(organization_id, user_id, executed_at DESC)',
      },
      {
        table: 'command_executions',
        index: 'idx_ce_org_team_command_time', 
        definition: '(organization_id, team_id, command_name, executed_at DESC)',
      },
      {
        table: 'agent_interactions',
        index: 'idx_ai_org_agent_time_desc',
        definition: '(organization_id, agent_name, occurred_at DESC)',
      },
      {
        table: 'user_sessions',
        index: 'idx_us_org_user_start_desc',
        definition: '(organization_id, user_id, session_start DESC)',
      },
      {
        table: 'productivity_metrics',
        index: 'idx_pm_org_type_time_desc',
        definition: '(organization_id, metric_type, recorded_at DESC)',
      },
    ];

    for (const idx of indexes) {
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS ${idx.index} 
        ON ${idx.table} ${idx.definition};
      `);
    }

    console.log('Time-series optimized indexes created');
  }

  async getHypertableInfo(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        h.table_name,
        h.table_schema,
        h.num_dimensions,
        h.chunk_time_interval,
        h.created,
        pg_size_pretty(pg_total_relation_size(format('%I.%I', h.table_schema, h.table_name))) as table_size
      FROM timescaledb_information.hypertables h
      WHERE h.table_schema = 'public'
      ORDER BY h.table_name;
    `);
    
    return result.rows;
  }

  async getChunkInfo(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        c.hypertable_name,
        c.chunk_name,
        c.range_start,
        c.range_end,
        pg_size_pretty(pg_total_relation_size(format('%I.%I', c.chunk_schema, c.chunk_name))) as chunk_size
      FROM timescaledb_information.chunks c
      WHERE c.hypertable_schema = 'public'
      ORDER BY c.hypertable_name, c.range_start DESC
      LIMIT 50;
    `);
    
    return result.rows;
  }

  async getCompressionStats(): Promise<any[]> {
    const result = await this.db.query(`
      SELECT 
        cs.hypertable_name,
        cs.compression_enabled,
        cs.compressed_row_count,
        cs.uncompressed_row_count,
        CASE 
          WHEN cs.uncompressed_row_count > 0 
          THEN ROUND((cs.compressed_row_count::numeric / cs.uncompressed_row_count::numeric) * 100, 2)
          ELSE 0 
        END as compression_ratio
      FROM timescaledb_information.compression_settings cs
      WHERE cs.hypertable_schema = 'public'
      ORDER BY cs.hypertable_name;
    `);
    
    return result.rows;
  }

  async initializeTimescaleFeatures(): Promise<void> {
    try {
      await this.createIndexOptimizations();
      await this.enableCompression();
      await this.setupRetentionPolicies();
      await this.createContinuousAggregates();
      await this.setupRefreshPolicies();
      
      console.log('TimescaleDB features initialized successfully');
    } catch (error) {
      console.error('Failed to initialize TimescaleDB features:', error);
      throw error;
    }
  }
}
