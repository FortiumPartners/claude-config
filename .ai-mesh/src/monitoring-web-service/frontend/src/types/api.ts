// API Types - Frontend representation of backend types
export interface User {
  id: string
  organization_id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'manager' | 'developer'
  is_active: boolean
  last_login?: Date
  created_at: Date
  updated_at: Date
  avatar_url?: string
  preferences?: Record<string, any>
}

export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, any>
  subscription_tier: 'free' | 'pro' | 'enterprise'
  is_active: boolean
  created_at: Date
  updated_at: Date
}

export interface Team {
  id: string
  organization_id: string
  name: string
  description?: string
  settings?: Record<string, any>
  created_at: Date
  updated_at: Date
  members?: TeamMember[]
  member_count?: number
}

export interface TeamMember {
  id: string
  user_id: string
  team_id: string
  role: 'lead' | 'member'
  joined_at: Date
  user?: User
}

// Metrics Types
export interface CommandExecution {
  id: string
  organization_id: string
  user_id: string
  team_id?: string
  project_id?: string
  command_name: string
  command_args?: Record<string, any>
  execution_time_ms: number
  status: 'success' | 'error' | 'timeout' | 'cancelled'
  error_message?: string
  context?: Record<string, any>
  executed_at: Date
  recorded_at: Date
}

export interface AgentInteraction {
  id: string
  organization_id: string
  user_id: string
  team_id?: string
  project_id?: string
  command_execution_id?: string
  agent_name: string
  interaction_type: string
  input_tokens?: number
  output_tokens?: number
  execution_time_ms: number
  status: 'success' | 'error' | 'timeout' | 'cancelled'
  error_message?: string
  metadata?: Record<string, any>
  occurred_at: Date
  recorded_at: Date
}

export interface UserSession {
  id: string
  organization_id: string
  user_id: string
  session_start: Date
  session_end?: Date
  duration_minutes?: number
  commands_executed: number
  agents_used: string[]
  productivity_score?: number
  context?: Record<string, any>
  recorded_at: Date
}

export type ProductivityMetricType = 
  | 'commands_per_hour'
  | 'error_rate'
  | 'session_duration'
  | 'productivity_score'
  | 'code_quality_score'
  | 'response_time'
  | 'task_completion_time'
  | 'agent_usage_frequency'

export interface ProductivityMetric {
  id: string
  organization_id: string
  user_id?: string
  team_id?: string
  project_id?: string
  metric_type: ProductivityMetricType
  metric_value: number
  metric_unit?: string
  dimensions?: Record<string, any>
  recorded_at: Date
}

// Dashboard Configuration
export interface DashboardConfig {
  id: string
  name: string
  user_id: string
  organization_id: string
  layout: DashboardWidget[]
  filters: DashboardFilters
  is_default: boolean
  is_shared: boolean
  created_at: Date
  updated_at: Date
}

export interface DashboardWidget {
  id: string
  type: 'chart' | 'metric' | 'table' | 'alert'
  title: string
  position: { x: number; y: number; w: number; h: number }
  config: Record<string, any>
  data_source: string
}

export interface DashboardFilters {
  date_range: {
    start: Date
    end: Date
    preset?: 'today' | '7d' | '30d' | '90d' | 'custom'
  }
  team_ids?: string[]
  user_ids?: string[]
  metric_types?: ProductivityMetricType[]
}

// Analytics Types
export interface ProductivityTrend {
  time_bucket: Date
  organization_id: string
  user_id?: string
  team_id?: string
  metric_type: ProductivityMetricType
  value: number
  change_percent?: number
  trend: 'up' | 'down' | 'stable'
}

export interface TeamComparison {
  team_id: string
  team_name: string
  metrics: Record<ProductivityMetricType, {
    value: number
    rank: number
    percentile: number
    trend: 'up' | 'down' | 'stable'
  }>
  member_count: number
  period: string
}

export interface Alert {
  id: string
  organization_id: string
  name: string
  description: string
  rule_type: 'threshold' | 'anomaly' | 'comparison'
  rule_config: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  is_active: boolean
  last_triggered?: Date
  created_at: Date
}

export interface AlertTrigger {
  id: string
  alert_id: string
  triggered_at: Date
  value: number
  threshold: number
  affected_users: string[]
  resolved_at?: Date
  resolution_notes?: string
}

// API Response Types
export interface ApiResponse<T> {
  data: T
  message?: string
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

// API Request Types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: User
  organization: Organization
}

export interface MetricsQueryParams {
  start_date: string
  end_date: string
  user_id?: string
  team_id?: string
  metric_types?: ProductivityMetricType[]
  aggregation?: '1m' | '5m' | '15m' | '1h' | '1d' | '1w'
  limit?: number
  offset?: number
}

export interface ReportExportRequest {
  format: 'pdf' | 'csv' | 'xlsx'
  report_type: 'productivity' | 'agents' | 'teams'
  filters: {
    start_date: string
    end_date: string
    team_ids?: string[]
    user_ids?: string[]
    metric_types?: ProductivityMetricType[]
  }
}

export interface ReportExportResponse {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  download_url?: string
  estimated_completion?: Date
}

// WebSocket Event Types
export interface WebSocketEvent {
  type: string
  data: any
  timestamp: Date
}

export interface DashboardUpdateEvent extends WebSocketEvent {
  type: 'dashboard_update'
  data: {
    dashboard_id: string
    widget_id: string
    data: any
  }
}

export interface MetricIngestedEvent extends WebSocketEvent {
  type: 'metric_ingested'
  data: {
    metric_type: ProductivityMetricType
    user_id: string
    team_id?: string
    count: number
  }
}

export interface AlertTriggeredEvent extends WebSocketEvent {
  type: 'alert_triggered'
  data: AlertTrigger & {
    alert_name: string
    rule_name: string
  }
}