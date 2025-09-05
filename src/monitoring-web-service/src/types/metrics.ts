/**
 * Core Metrics Models and Types for TimescaleDB
 * Task 3.1: Core Metrics Models and Schemas
 */

export interface BaseEntity {
  id: string;
  organization_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface TimestampedEntity {
  id: string;
  organization_id: string;
  recorded_at: Date;
}

// Command Execution Metrics
export interface CommandExecution extends TimestampedEntity {
  user_id: string;
  team_id?: string;
  project_id?: string;
  command_name: string;
  command_args?: Record<string, any>;
  execution_time_ms: number;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  error_message?: string;
  context?: Record<string, any>;
  executed_at: Date;
}

export interface CommandExecutionCreate {
  user_id: string;
  team_id?: string;
  project_id?: string;
  command_name: string;
  command_args?: Record<string, any>;
  execution_time_ms: number;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  error_message?: string;
  context?: Record<string, any>;
}

// Agent Interaction Metrics
export interface AgentInteraction extends TimestampedEntity {
  user_id: string;
  team_id?: string;
  project_id?: string;
  command_execution_id?: string;
  agent_name: string;
  interaction_type: string;
  input_tokens?: number;
  output_tokens?: number;
  execution_time_ms: number;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  error_message?: string;
  metadata?: Record<string, any>;
  occurred_at: Date;
}

export interface AgentInteractionCreate {
  user_id: string;
  team_id?: string;
  project_id?: string;
  command_execution_id?: string;
  agent_name: string;
  interaction_type: string;
  input_tokens?: number;
  output_tokens?: number;
  execution_time_ms: number;
  status: 'success' | 'error' | 'timeout' | 'cancelled';
  error_message?: string;
  metadata?: Record<string, any>;
}

// User Session Metrics
export interface UserSession extends TimestampedEntity {
  user_id: string;
  session_start: Date;
  session_end?: Date;
  duration_minutes?: number;
  commands_executed: number;
  agents_used: string[];
  productivity_score?: number;
  context?: Record<string, any>;
}

export interface UserSessionCreate {
  user_id: string;
  context?: Record<string, any>;
}

export interface UserSessionUpdate {
  session_end?: Date;
  duration_minutes?: number;
  commands_executed?: number;
  agents_used?: string[];
  productivity_score?: number;
  context?: Record<string, any>;
}

// Productivity Metrics
export type ProductivityMetricType = 
  | 'commands_per_hour'
  | 'error_rate'
  | 'session_duration'
  | 'productivity_score'
  | 'code_quality_score'
  | 'response_time'
  | 'task_completion_time'
  | 'agent_usage_frequency';

export interface ProductivityMetric extends TimestampedEntity {
  user_id?: string;
  team_id?: string;
  project_id?: string;
  metric_type: ProductivityMetricType;
  metric_value: number;
  metric_unit?: string;
  dimensions?: Record<string, any>;
  recorded_at: Date;
}

export interface ProductivityMetricCreate {
  user_id?: string;
  team_id?: string;
  project_id?: string;
  metric_type: ProductivityMetricType;
  metric_value: number;
  metric_unit?: string;
  dimensions?: Record<string, any>;
}

// Batch Metrics Collection
export interface MetricsBatch {
  organization_id: string;
  command_executions?: CommandExecutionCreate[];
  agent_interactions?: AgentInteractionCreate[];
  user_sessions?: UserSessionCreate[];
  productivity_metrics?: ProductivityMetricCreate[];
  timestamp: Date;
  batch_id?: string;
}

// Query Parameters
export interface MetricsQueryParams {
  organization_id: string;
  user_id?: string;
  team_id?: string;
  project_id?: string;
  start_date: Date;
  end_date: Date;
  metric_types?: ProductivityMetricType[];
  limit?: number;
  offset?: number;
  aggregation_window?: '1m' | '5m' | '15m' | '1h' | '1d' | '1w';
}

// Aggregated Metrics Results
export interface AggregatedMetrics {
  time_bucket: Date;
  organization_id: string;
  user_id?: string;
  team_id?: string;
  project_id?: string;
  command_count: number;
  avg_execution_time: number;
  error_rate: number;
  agent_usage_count: Record<string, number>;
  productivity_score?: number;
}

// Real-time Processing Types
export interface MetricsStreamEvent {
  type: 'command_execution' | 'agent_interaction' | 'user_session' | 'productivity_metric';
  organization_id: string;
  user_id: string;
  data: CommandExecutionCreate | AgentInteractionCreate | UserSessionCreate | ProductivityMetricCreate;
  timestamp: Date;
  source: string;
}

// Performance Requirements Types
export interface PerformanceMetrics {
  ingestion_rate: number; // events per second
  processing_latency_ms: number;
  query_response_time_ms: number;
  memory_usage_mb: number;
  cpu_usage_percent: number;
  active_connections: number;
}

// Rate Limiting Types
export interface RateLimitConfig {
  window_ms: number;
  max_requests: number;
  identifier: 'organization_id' | 'user_id' | 'ip_address';
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset_time: Date;
  retry_after?: number;
}