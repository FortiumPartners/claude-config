/**
 * Enhanced Activity Context Types
 * Defines TypeScript interfaces for enhanced activity data structures
 * Used by both backend services and frontend components
 */

export interface EnhancedActivityContext {
  // Execution Environment
  environment: {
    os: string
    nodeVersion: string
    workingDirectory: string
    gitBranch?: string
    gitCommit?: string
    sessionId?: string
  }

  // Performance Metrics
  performance: {
    executionTimeMs: number
    memoryUsageMB: number
    cpuUsagePercent: number
    diskIOBytes?: number
    networkIOBytes?: number
    queueTimeMs?: number
  }

  // Input/Output Data
  inputs: {
    parameters: Record<string, any>
    files: string[]
    environment: Record<string, string>
    commandLine?: string
  }

  outputs: {
    result: any
    filesModified: Array<{
      path: string
      changeType: 'created' | 'modified' | 'deleted'
      lineCount?: number
      sizeBytes?: number
      diff?: string
    }>
    stdout?: string
    stderr?: string
    artifacts?: Array<{
      type: 'log' | 'output' | 'screenshot' | 'report'
      name: string
      url: string
      sizeBytes?: number
    }>
  }

  // Business Impact Assessment
  impact: {
    category: 'development' | 'testing' | 'deployment' | 'analysis'
    scope: 'local' | 'team' | 'project' | 'organization'
    confidence: number // 0-1 confidence in impact assessment
    automationLevel: 'manual' | 'semi-automated' | 'automated'
  }

  // Error and Recovery Context
  error?: {
    category: 'syntax' | 'runtime' | 'network' | 'permission' | 'timeout' | 'resource'
    severity: 'low' | 'medium' | 'high' | 'critical'
    code: string
    message: string
    stackTrace?: string
    context: Record<string, any>
    relatedActivities: string[]
    recoveryActions: Array<{
      description: string
      automated: boolean
      command?: string
      priority: number
    }>
    documentationLinks: string[]
    similarIssues: Array<{
      activityId: string
      similarity: number
      resolution?: string
    }>
  }

  // Workflow Correlation
  correlation: {
    workflowId?: string
    parentActivityId?: string
    childActivityIds: string[]
    sequenceNumber?: number
    isWorkflowRoot: boolean
    workflowContext?: Record<string, any>
  }
}

export interface ActivityAction {
  type: 'command_execution' | 'agent_interaction' | 'tool_usage' | 'file_operation' | 'git_operation' | 'test_execution'
  name: string
  description: string
  category: string
  automationLevel: 'manual' | 'semi-automated' | 'automated'
}

export interface ActivityTarget {
  name: string
  type: 'file' | 'command' | 'agent' | 'project' | 'repository' | 'test_suite'
  path?: string
  metadata?: Record<string, any>
}

export interface CreateEnhancedActivityRequest {
  userId: string
  action: ActivityAction
  target: ActivityTarget
  context: EnhancedActivityContext
  correlationId?: string
  workflowId?: string
}

export interface EnhancedActivityQueryParams {
  // Pagination
  limit?: number // default: 50, max: 1000
  offset?: number
  cursor?: string

  // Time filtering
  startDate?: string
  endDate?: string
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d'

  // Content filtering
  search?: string // full-text search
  userIds?: string[]
  actionTypes?: string[]
  statusFilters?: ('success' | 'error' | 'in_progress' | 'cancelled')[]
  categories?: string[]

  // Performance filtering
  minDuration?: number
  maxDuration?: number
  minMemoryUsage?: number
  maxMemoryUsage?: number

  // Context filtering
  gitBranch?: string
  projectId?: string
  workflowId?: string
  hasErrors?: boolean
  automationLevel?: ('manual' | 'semi-automated' | 'automated')[]

  // Impact filtering
  impactCategories?: ('development' | 'testing' | 'deployment' | 'analysis')[]
  impactScopes?: ('local' | 'team' | 'project' | 'organization')[]

  // Sorting
  sortBy?: 'timestamp' | 'duration' | 'impact' | 'relevance'
  sortOrder?: 'asc' | 'desc'

  // Include options
  includeContext?: boolean
  includePerformance?: boolean
  includeCorrelations?: boolean
}

export interface ActivityCorrelationResponse {
  rootActivity: EnhancedActivityItem
  relatedActivities: Array<{
    activity: EnhancedActivityItem
    relationship: 'parent' | 'child' | 'sibling' | 'dependency' | 'trigger'
    confidence: number
    causality?: 'cause' | 'effect'
  }>
  workflow?: {
    id: string
    name?: string
    totalActivities: number
    duration: number
    status: 'active' | 'completed' | 'failed'
  }
}

export interface EnhancedActivityItem {
  id: string
  userId: string
  action: ActivityAction
  target: ActivityTarget
  status: 'success' | 'error' | 'in_progress' | 'queued' | 'cancelled'
  timestamp: Date
  duration?: number

  // Enhanced context data
  enhancedContext?: EnhancedActivityContext
  performanceMetrics?: EnhancedActivityContext['performance']
  inputData?: EnhancedActivityContext['inputs']
  outputData?: EnhancedActivityContext['outputs']
  errorDetails?: EnhancedActivityContext['error']
  correlationData?: EnhancedActivityContext['correlation']
  businessImpact?: EnhancedActivityContext['impact']

  // Legacy fields for backward compatibility
  actionName: string
  actionDescription: string
  targetName: string
  targetType: string
  priority: number
  isAutomated: boolean
  metadata?: Record<string, any>
  tags?: string[]
  projectId?: string
  errorMessage?: string
  errorCode?: string
}

export interface WorkflowCorrelation {
  workflowId: string
  name?: string
  description?: string
  rootActivityId?: string
  status: 'active' | 'completed' | 'failed'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface ActivityStreamEvent {
  type: 'activity_created' | 'activity_updated' | 'activity_completed' | 'activity_correlated'
  data: {
    activity: EnhancedActivityItem
    correlation?: WorkflowCorrelation
    performance?: EnhancedActivityContext['performance']
    organizationId: string
    userId: string
  }
  timestamp: string
}

export interface ActivityBatchEvent {
  type: 'activity_batch_update'
  data: {
    activities: EnhancedActivityItem[]
    totalCount: number
    hasMore: boolean
    cursor?: string
    filters?: EnhancedActivityQueryParams
  }
}

export interface ActivityFilter {
  search?: string
  userIds?: string[]
  actionTypes?: string[]
  statusFilters?: string[]
  dateRange?: {
    start: Date
    end: Date
  }
  tags?: string[]
  priorityLevels?: string[]
  showAutomated?: boolean
  minDuration?: number
  maxDuration?: number
  impactCategories?: string[]
  impactScopes?: string[]
  hasErrors?: boolean
  workflowId?: string
}

export interface ActivityInsights {
  organizationId: string
  period: {
    start: Date
    end: Date
  }
  totalActivities: number
  activitiesByType: Record<string, number>
  activitiesByHour: Record<string, number>
  performanceTrends: {
    averageExecutionTime: number
    averageMemoryUsage: number
    errorRate: number
    automationRate: number
  }
  topUsers: Array<{
    userId: string
    userName: string
    activityCount: number
    lastActivity: Date
    averagePerformance: number
  }>
  workflowStats: {
    totalWorkflows: number
    averageWorkflowDuration: number
    completionRate: number
    mostCommonPatterns: Array<{
      pattern: string
      count: number
      averageDuration: number
    }>
  }
}