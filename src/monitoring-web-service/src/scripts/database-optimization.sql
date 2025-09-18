-- Database Performance Optimization Script
-- Sprint 8 Task 8.1: Database query optimization and indexing
-- 
-- This script implements comprehensive database optimizations including:
-- - Multi-tenant optimized indexes
-- - Query performance improvements  
-- - Connection pool optimizations
-- - Monitoring and alerting setup

-- ============================================================================
-- PERFORMANCE INDEXES FOR MULTI-TENANT ARCHITECTURE
-- ============================================================================

-- Master tenant registry optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_domain 
ON tenants(domain) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tenants_schema_name 
ON tenants(schema_name) WHERE is_active = true;

-- Performance template for per-tenant schemas
-- This template will be applied to each tenant schema during creation

-- ============================================================================
-- USERS TABLE OPTIMIZATIONS  
-- ============================================================================

-- Template indexes for tenant_template.users (applied to each tenant)
-- Email lookup optimization (frequent login queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON tenant_template.users(email) WHERE is_active = true;

-- SSO provider lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_sso_provider_id 
ON tenant_template.users(sso_provider, sso_user_id) WHERE is_active = true;

-- Role-based filtering optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active 
ON tenant_template.users(role, is_active);

-- Last login tracking for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login 
ON tenant_template.users(last_login DESC) WHERE is_active = true;

-- ============================================================================
-- METRICS SESSIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Most critical index: user + time range queries for dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_user_time 
ON tenant_template.metrics_sessions(user_id, session_start DESC) 
WHERE session_end IS NOT NULL;

-- Organization-wide analytics (covers user rollup queries)  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_start_time 
ON tenant_template.metrics_sessions(session_start DESC)
WHERE session_end IS NOT NULL;

-- Productivity score analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_productivity 
ON tenant_template.metrics_sessions(productivity_score DESC, session_start DESC)
WHERE productivity_score IS NOT NULL;

-- Duration-based analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_duration 
ON tenant_template.metrics_sessions(total_duration_ms DESC, session_start DESC)
WHERE total_duration_ms IS NOT NULL;

-- Active sessions monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_active 
ON tenant_template.metrics_sessions(user_id, session_start DESC)
WHERE session_end IS NULL;

-- Daily/hourly aggregation support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_date_trunc 
ON tenant_template.metrics_sessions(DATE_TRUNC('day', session_start), user_id);

-- ============================================================================
-- TOOL METRICS TABLE OPTIMIZATIONS  
-- ============================================================================

-- Session-based tool analysis (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_metrics_session_tool 
ON tenant_template.tool_metrics(session_id, tool_name);

-- Tool popularity and performance analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_metrics_tool_time 
ON tenant_template.tool_metrics(tool_name, created_at DESC);

-- Performance analysis by tool
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_metrics_tool_duration 
ON tenant_template.tool_metrics(tool_name, total_duration_ms DESC);

-- Success rate analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_metrics_tool_success 
ON tenant_template.tool_metrics(tool_name, success_rate DESC)
WHERE success_rate IS NOT NULL;

-- Error analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_metrics_errors 
ON tenant_template.tool_metrics(tool_name, error_count DESC, created_at DESC)
WHERE error_count > 0;

-- Cross-session tool usage patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_metrics_execution_count 
ON tenant_template.tool_metrics(tool_name, execution_count DESC, created_at DESC);

-- ============================================================================
-- DASHBOARD CONFIGURATIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- User dashboard lookup (most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_configs_user_name 
ON tenant_template.dashboard_configs(user_id, dashboard_name);

-- Default dashboard identification
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_configs_user_default 
ON tenant_template.dashboard_configs(user_id) WHERE is_default = true;

-- Dashboard modification tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dashboard_configs_updated 
ON tenant_template.dashboard_configs(updated_at DESC);

-- ============================================================================
-- COMPOSITE INDEXES FOR COMPLEX ANALYTICS QUERIES
-- ============================================================================

-- Comprehensive user activity analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_user_activity_analysis 
ON tenant_template.metrics_sessions(
  user_id, 
  session_start DESC, 
  productivity_score DESC, 
  total_duration_ms DESC
) WHERE session_end IS NOT NULL;

-- Tool performance correlation analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_performance_correlation 
ON tenant_template.tool_metrics(
  tool_name,
  success_rate DESC,
  total_duration_ms,
  created_at DESC
) WHERE success_rate IS NOT NULL;

-- Time-series aggregation optimization  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_timeseries_agg 
ON tenant_template.metrics_sessions(
  DATE_TRUNC('hour', session_start),
  user_id
) WHERE session_end IS NOT NULL;

-- ============================================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ============================================================================

-- Failed sessions analysis (partial index for efficiency)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_failed 
ON tenant_template.metrics_sessions(user_id, session_start DESC)
WHERE productivity_score IS NULL OR productivity_score < 50;

-- Long-running sessions identification
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_long_running 
ON tenant_template.metrics_sessions(total_duration_ms DESC, session_start DESC)
WHERE total_duration_ms > 3600000; -- > 1 hour

-- High-error tools identification  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_metrics_high_error 
ON tenant_template.tool_metrics(tool_name, error_count DESC, created_at DESC)
WHERE error_count > 5;

-- Recent activity (last 24 hours) - frequently accessed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_sessions_recent 
ON tenant_template.metrics_sessions(session_start DESC, user_id)
WHERE session_start > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- MATERIALIZED VIEWS FOR EXPENSIVE AGGREGATIONS
-- ============================================================================

-- Daily user productivity summary
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_template.mv_daily_user_productivity AS
SELECT 
  user_id,
  DATE(session_start) as activity_date,
  COUNT(*) as session_count,
  SUM(total_duration_ms) as total_duration_ms,
  AVG(productivity_score) as avg_productivity_score,
  MIN(session_start) as first_session,
  MAX(session_start) as last_session
FROM tenant_template.metrics_sessions
WHERE session_end IS NOT NULL
GROUP BY user_id, DATE(session_start);

-- Create unique index on materialized view for efficient querying
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_productivity_user_date 
ON tenant_template.mv_daily_user_productivity(user_id, activity_date);

-- Tool usage summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_template.mv_tool_usage_summary AS
SELECT 
  tool_name,
  COUNT(*) as usage_count,
  SUM(execution_count) as total_executions,
  AVG(total_duration_ms) as avg_duration_ms,
  AVG(success_rate) as avg_success_rate,
  COUNT(CASE WHEN error_count > 0 THEN 1 END) as error_sessions,
  DATE_TRUNC('day', created_at) as usage_date
FROM tenant_template.tool_metrics
GROUP BY tool_name, DATE_TRUNC('day', created_at);

-- Create unique index on tool usage materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tool_usage_tool_date 
ON tenant_template.mv_tool_usage_summary(tool_name, usage_date);

-- ============================================================================
-- QUERY PERFORMANCE FUNCTIONS
-- ============================================================================

-- Function to refresh materialized views (called daily via cron/scheduler)
CREATE OR REPLACE FUNCTION tenant_template.refresh_performance_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_template.mv_daily_user_productivity;
  REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_template.mv_tool_usage_summary;
END;
$$ LANGUAGE plpgsql;

-- Function for efficient user productivity analysis
CREATE OR REPLACE FUNCTION tenant_template.get_user_productivity_trend(
  p_user_id UUID,
  p_days_back INTEGER DEFAULT 30
) RETURNS TABLE (
  activity_date DATE,
  session_count BIGINT,
  total_duration_ms BIGINT,
  avg_productivity_score NUMERIC,
  productivity_trend TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.activity_date,
    mp.session_count,
    mp.total_duration_ms,
    mp.avg_productivity_score,
    CASE 
      WHEN LAG(mp.avg_productivity_score) OVER (ORDER BY mp.activity_date) IS NULL THEN 'baseline'
      WHEN mp.avg_productivity_score > LAG(mp.avg_productivity_score) OVER (ORDER BY mp.activity_date) THEN 'improving'
      WHEN mp.avg_productivity_score < LAG(mp.avg_productivity_score) OVER (ORDER BY mp.activity_date) THEN 'declining'
      ELSE 'stable'
    END as productivity_trend
  FROM tenant_template.mv_daily_user_productivity mp
  WHERE mp.user_id = p_user_id
    AND mp.activity_date >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
  ORDER BY mp.activity_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function for tool performance analysis
CREATE OR REPLACE FUNCTION tenant_template.get_tool_performance_analysis(
  p_tool_name TEXT DEFAULT NULL,
  p_days_back INTEGER DEFAULT 7
) RETURNS TABLE (
  tool_name TEXT,
  usage_count BIGINT,
  avg_duration_ms NUMERIC,
  avg_success_rate NUMERIC,
  error_rate NUMERIC,
  performance_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tu.tool_name,
    SUM(tu.usage_count) as usage_count,
    AVG(tu.avg_duration_ms) as avg_duration_ms,
    AVG(tu.avg_success_rate) as avg_success_rate,
    CASE 
      WHEN SUM(tu.usage_count) > 0 THEN 
        (SUM(tu.error_sessions)::NUMERIC / SUM(tu.usage_count)::NUMERIC) * 100
      ELSE 0
    END as error_rate,
    -- Performance score: weighted combination of speed, success rate, and usage
    CASE 
      WHEN AVG(tu.avg_duration_ms) > 0 AND AVG(tu.avg_success_rate) > 0 THEN
        (AVG(tu.avg_success_rate) * 0.6) + 
        ((1000.0 / GREATEST(AVG(tu.avg_duration_ms), 1)) * 0.3) +
        (LEAST(LN(SUM(tu.usage_count) + 1) * 10, 100) * 0.1)
      ELSE 0
    END as performance_score
  FROM tenant_template.mv_tool_usage_summary tu
  WHERE (p_tool_name IS NULL OR tu.tool_name = p_tool_name)
    AND tu.usage_date >= CURRENT_DATE - INTERVAL '1 day' * p_days_back
  GROUP BY tu.tool_name
  ORDER BY performance_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CONNECTION POOLING OPTIMIZATIONS
-- ============================================================================

-- Enable connection pooling statistics
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = 'all';

-- Optimize connection settings for high-concurrency workload
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Optimize for multi-tenant workload
ALTER SYSTEM SET random_page_cost = 1.1; -- SSD optimization
ALTER SYSTEM SET effective_io_concurrency = 200; -- SSD optimization

-- ============================================================================
-- MONITORING QUERIES FOR PERFORMANCE ANALYSIS
-- ============================================================================

-- View for monitoring slow queries
CREATE OR REPLACE VIEW tenant_template.v_slow_query_analysis AS
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation,
  most_common_vals,
  most_common_freqs
FROM pg_stats 
WHERE schemaname = 'tenant_template'
ORDER BY tablename, attname;

-- View for index usage analysis
CREATE OR REPLACE VIEW tenant_template.v_index_usage_analysis AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'tenant_template'
ORDER BY idx_scan DESC;

-- View for table access patterns
CREATE OR REPLACE VIEW tenant_template.v_table_access_patterns AS
SELECT 
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_tup_hot_upd
FROM pg_stat_user_tables
WHERE schemaname = 'tenant_template'
ORDER BY seq_scan + idx_scan DESC;

-- ============================================================================
-- AUTOMATED MAINTENANCE PROCEDURES
-- ============================================================================

-- Function to analyze and optimize table statistics
CREATE OR REPLACE FUNCTION tenant_template.optimize_table_statistics()
RETURNS void AS $$
DECLARE
  table_rec RECORD;
BEGIN
  -- Analyze all tables in the tenant schema for updated statistics
  FOR table_rec IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'tenant_template'
  LOOP
    EXECUTE format('ANALYZE tenant_template.%I', table_rec.tablename);
  END LOOP;
  
  -- Update extended statistics for multi-column correlations
  ANALYZE tenant_template.metrics_sessions;
  ANALYZE tenant_template.tool_metrics;
  ANALYZE tenant_template.users;
  ANALYZE tenant_template.dashboard_configs;
END;
$$ LANGUAGE plpgsql;

-- Function to identify and suggest missing indexes
CREATE OR REPLACE FUNCTION tenant_template.suggest_missing_indexes()
RETURNS TABLE (
  suggested_index TEXT,
  table_name TEXT,
  seq_scans BIGINT,
  reasoning TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    format('CREATE INDEX CONCURRENTLY idx_%s_%s ON %s.%s (%s);',
           pst.relname, 
           replace(array_to_string(array_agg(DISTINCT pss.attname ORDER BY pss.attname), '_'), ' ', ''),
           pst.schemaname,
           pst.relname,
           array_to_string(array_agg(DISTINCT pss.attname ORDER BY pss.attname), ', ')
    ) as suggested_index,
    pst.relname::TEXT as table_name,
    pst.seq_scan as seq_scans,
    format('Table %s has %s sequential scans, consider indexing frequently filtered columns',
           pst.relname, pst.seq_scan) as reasoning
  FROM pg_stat_user_tables pst
  LEFT JOIN pg_stats pss ON pst.relname = pss.tablename 
    AND pst.schemaname = pss.schemaname
  WHERE pst.schemaname = 'tenant_template'
    AND pst.seq_scan > 1000  -- Tables with high sequential scan count
    AND pst.idx_scan < pst.seq_scan  -- More seq scans than index scans
    AND pss.n_distinct > 10  -- Columns with reasonable selectivity
  GROUP BY pst.relname, pst.schemaname, pst.seq_scan
  ORDER BY pst.seq_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE MONITORING ALERTS
-- ============================================================================

-- Function to check for performance issues and generate alerts
CREATE OR REPLACE FUNCTION tenant_template.check_performance_alerts()
RETURNS TABLE (
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  recommendation TEXT
) AS $$
BEGIN
  -- Check for tables with high sequential scan ratio
  RETURN QUERY
  SELECT 
    'high_seq_scan_ratio'::TEXT as alert_type,
    'warning'::TEXT as severity,
    format('Table %s has high sequential scan ratio: %s seq scans vs %s index scans',
           relname, seq_scan, COALESCE(idx_scan, 0)) as message,
    'Consider adding appropriate indexes for frequently queried columns'::TEXT as recommendation
  FROM pg_stat_user_tables
  WHERE schemaname = 'tenant_template'
    AND seq_scan > 100
    AND (idx_scan IS NULL OR seq_scan > idx_scan * 2);

  -- Check for unused indexes
  RETURN QUERY
  SELECT 
    'unused_index'::TEXT as alert_type,
    'info'::TEXT as severity,
    format('Index %s on table %s has low usage: %s scans',
           indexname, tablename, COALESCE(idx_scan, 0)) as message,
    'Consider dropping unused indexes to improve write performance'::TEXT as recommendation
  FROM pg_stat_user_indexes
  WHERE schemaname = 'tenant_template'
    AND (idx_scan IS NULL OR idx_scan < 10)
    AND indexname NOT LIKE '%_pkey';

  -- Check for bloated tables (estimate based on statistics)
  RETURN QUERY
  SELECT 
    'table_bloat'::TEXT as alert_type,
    'warning'::TEXT as severity,
    format('Table %s may have bloat: %s dead tuples vs %s live tuples',
           relname, n_dead_tup, n_tup_ins + n_tup_upd - n_tup_del) as message,
    'Consider running VACUUM or VACUUM FULL during maintenance window'::TEXT as recommendation
  FROM pg_stat_user_tables
  WHERE schemaname = 'tenant_template'
    AND n_dead_tup > 1000
    AND n_dead_tup > (n_tup_ins + n_tup_upd - n_tup_del) * 0.1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SCRIPT COMPLETION SUMMARY
-- ============================================================================

-- Create summary function to show optimization results
CREATE OR REPLACE FUNCTION tenant_template.optimization_summary()
RETURNS TABLE (
  optimization_type TEXT,
  item_count BIGINT,
  description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'indexes_created'::TEXT,
    COUNT(*)::BIGINT,
    'Performance indexes created for efficient querying'::TEXT
  FROM pg_indexes 
  WHERE schemaname = 'tenant_template' 
    AND indexname LIKE 'idx_%'
  
  UNION ALL
  
  SELECT 
    'materialized_views'::TEXT,
    COUNT(*)::BIGINT,
    'Materialized views for expensive aggregations'::TEXT
  FROM pg_matviews 
  WHERE schemaname = 'tenant_template'
    AND matviewname LIKE 'mv_%'
  
  UNION ALL
  
  SELECT 
    'performance_functions'::TEXT,
    COUNT(*)::BIGINT,
    'Performance analysis and optimization functions'::TEXT
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'tenant_template'
    AND p.proname IN ('refresh_performance_views', 'get_user_productivity_trend', 
                      'get_tool_performance_analysis', 'optimize_table_statistics',
                      'suggest_missing_indexes', 'check_performance_alerts');
END;
$$ LANGUAGE plpgsql;

-- Display optimization summary
SELECT * FROM tenant_template.optimization_summary();

-- Final performance analysis
ANALYZE;

COMMENT ON SCHEMA tenant_template IS 'Optimized schema template for multi-tenant External Metrics Web Service - Sprint 8 Task 8.1 Complete';