/**
 * Enhanced Activity Item Component
 * Displays rich activity context including performance metrics, status indicators, and business impact
 * Supports both compact and detailed view modes for different use cases
 */

import React, { useState, useMemo, useCallback } from 'react'
import {
  Activity,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  XCircle,
  Zap,
  BarChart3,
  AlertTriangle,
  FileText,
  GitBranch,
  TrendingUp,
  TrendingDown,
  Cpu,
  HardDrive,
  Network,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Tag,
  Users,
  Target
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import { ActivityItem as ActivityItemType } from '../../types/api'

export interface EnhancedActivityItemProps {
  activity: ActivityItemType
  compact?: boolean
  showAvatar?: boolean
  showTimestamp?: boolean
  showPerformance?: boolean
  showContext?: boolean
  showTags?: boolean
  showBusinessImpact?: boolean
  clickable?: boolean
  onActivityClick?: (activity: ActivityItemType) => void
  className?: string
}

const ActivityItem: React.FC<EnhancedActivityItemProps> = ({
  activity,
  compact = false,
  showAvatar = true,
  showTimestamp = true,
  showPerformance = true,
  showContext = true,
  showTags = true,
  showBusinessImpact = true,
  clickable = true,
  onActivityClick,
  className
}) => {
  const [expanded, setExpanded] = useState(false)

  // Memoized calculations for performance metrics and status
  const performanceMetrics = useMemo(() => {
    if (!activity.metrics) return null

    const metrics = activity.metrics
    return {
      executionTime: activity.duration_ms || 0,
      memoryUsage: metrics.memory_usage || 0,
      cpuUsage: metrics.cpu_usage || 0,
      inputTokens: metrics.input_tokens || 0,
      outputTokens: metrics.output_tokens || 0,
      errorCount: metrics.error_count || 0,
      warningCount: metrics.warning_count || 0
    }
  }, [activity.metrics, activity.duration_ms])

  const businessImpact = useMemo(() => {
    // Enhanced business impact from backend enrichment
    if (activity.metadata?.enrichment) {
      return {
        riskLevel: activity.metadata.enrichment.riskLevel || 'low',
        businessValue: activity.metadata.enrichment.businessValue || 50,
        timeToImpact: activity.metadata.enrichment.timeToImpact || 'medium-term',
        stakeholders: activity.metadata.enrichment.stakeholders || []
      }
    }

    // Fallback to basic assessment
    return {
      riskLevel: activity.priority === 'critical' ? 'critical' :
                activity.priority === 'high' ? 'high' : 'low',
      businessValue: activity.is_automated ? 70 : 50,
      timeToImpact: 'medium-term',
      stakeholders: []
    }
  }, [activity])

  const activityContext = useMemo(() => {
    return {
      environment: activity.execution_context?.environment || 'development',
      gitBranch: activity.execution_context?.git_branch,
      gitCommit: activity.execution_context?.git_commit,
      projectId: activity.execution_context?.project_id,
      sessionId: activity.execution_context?.session_id
    }
  }, [activity.execution_context])

  // Helper functions
  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" aria-label="Success" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" aria-label="Error" />
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-500 animate-pulse" aria-label="In Progress" />
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" aria-label="Queued" />
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-500" aria-label="Cancelled" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" aria-label="Unknown" />
    }
  }, [])

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
      case 'in_progress':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30'
      case 'queued':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
      case 'cancelled':
        return 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900/30'
      default:
        return 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/70'
    }
  }, [])

  const getRiskLevelColor = useCallback((riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
      case 'high':
        return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30'
      case 'low':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30'
    }
  }, [])

  const getInitials = useCallback((name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase()
  }, [])

  const formatDuration = useCallback((ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }, [])

  const formatMemory = useCallback((mb: number) => {
    if (mb < 1024) return `${mb.toFixed(1)}MB`
    return `${(mb / 1024).toFixed(1)}GB`
  }, [])

  // Event handlers
  const handleClick = useCallback(() => {
    if (clickable && onActivityClick) {
      onActivityClick(activity)
    }
  }, [clickable, onActivityClick, activity])

  const handleToggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }, [expanded])

  return (
    <div
      className={clsx(
        'rounded-lg border transition-all',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
        getStatusColor(activity.status),
        clickable && 'cursor-pointer',
        compact ? 'p-2' : 'p-3',
        className
      )}
      onClick={handleClick}
      tabIndex={clickable ? 0 : -1}
      role={clickable ? 'button' : 'article'}
      aria-label={clickable ? `View details for ${activity.user.name} ${activity.action.name} ${activity.target.name}` : undefined}
    >
      <div className="flex items-start space-x-3">
        {/* User Avatar */}
        {showAvatar && (
          <div className="flex-shrink-0">
            {activity.user.avatar_url ? (
              <img
                src={activity.user.avatar_url}
                alt={activity.user.name}
                className={clsx('rounded-full', compact ? 'w-6 h-6' : 'w-8 h-8')}
              />
            ) : (
              <div className={clsx(
                'bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center',
                compact ? 'w-6 h-6' : 'w-8 h-8'
              )}>
                <span className={clsx('text-white font-medium', compact ? 'text-xs' : 'text-sm')}>
                  {getInitials(activity.user.name)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Activity Content */}
        <div className="flex-1 min-w-0">
          {/* Main Activity Description */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <p className={clsx('text-slate-900 dark:text-white truncate', compact ? 'text-sm' : 'text-sm')}>
                <span className="font-medium">{activity.user.name}</span>{' '}
                {activity.action.description || activity.action.name}{' '}
                {!compact && (
                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-600 px-1.5 py-0.5 rounded">
                    {activity.target.name}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {getStatusIcon(activity.status)}
              {activity.is_automated && (
                <Zap className="w-3 h-3 text-blue-500" title="Automated" />
              )}
              {showBusinessImpact && businessImpact.riskLevel !== 'low' && (
                <span className={clsx(
                  'px-1.5 py-0.5 text-xs font-medium rounded-full',
                  getRiskLevelColor(businessImpact.riskLevel)
                )}>
                  {businessImpact.riskLevel}
                </span>
              )}
              {!compact && (
                <button
                  onClick={handleToggleExpanded}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                  aria-label={expanded ? 'Collapse details' : 'Expand details'}
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Compact Target Display */}
          {compact && (
            <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {activity.target.name}
            </div>
          )}

          {/* Activity Metadata - Always Visible */}
          {!compact && (
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center space-x-3">
                {showTimestamp && (
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    <time dateTime={typeof activity.timestamp === 'string' ? activity.timestamp : activity.timestamp.toISOString()}>
                      {formatDistanceToNow(
                        typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp,
                        { addSuffix: true }
                      )}
                    </time>
                  </div>
                )}

                {showPerformance && performanceMetrics && performanceMetrics.executionTime > 0 && (
                  <div className="flex items-center space-x-1">
                    <BarChart3 className="w-3 h-3" />
                    <span>{formatDuration(performanceMetrics.executionTime)}</span>
                  </div>
                )}

                {showContext && activityContext.environment && (
                  <div className="flex items-center space-x-1">
                    <Target className="w-3 h-3" />
                    <span>{activityContext.environment}</span>
                  </div>
                )}
              </div>

              {(activity.priority === 'high' || activity.priority === 'critical') && (
                <span className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  activity.priority === 'critical'
                    ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    : 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
                )}>
                  {activity.priority}
                </span>
              )}
            </div>
          )}

          {/* Expanded Details */}
          {expanded && !compact && (
            <div className="mt-3 space-y-3 border-t border-slate-200 dark:border-slate-600 pt-3">
              {/* Performance Metrics */}
              {showPerformance && performanceMetrics && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Performance Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {performanceMetrics.executionTime > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Duration:</span>
                        <span className="font-mono">{formatDuration(performanceMetrics.executionTime)}</span>
                      </div>
                    )}
                    {performanceMetrics.memoryUsage > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Memory:</span>
                        <span className="font-mono">{formatMemory(performanceMetrics.memoryUsage)}</span>
                      </div>
                    )}
                    {performanceMetrics.inputTokens > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Input Tokens:</span>
                        <span className="font-mono">{performanceMetrics.inputTokens.toLocaleString()}</span>
                      </div>
                    )}
                    {performanceMetrics.outputTokens > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 dark:text-slate-300">Output Tokens:</span>
                        <span className="font-mono">{performanceMetrics.outputTokens.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Execution Context */}
              {showContext && (activityContext.gitBranch || activityContext.projectId) && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2 flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Execution Context
                  </h4>
                  <div className="space-y-2 text-sm">
                    {activityContext.gitBranch && (
                      <div className="flex items-center space-x-2">
                        <GitBranch className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-600 dark:text-slate-300">Branch:</span>
                        <span className="font-mono bg-slate-100 dark:bg-slate-600 px-1.5 py-0.5 rounded text-xs">
                          {activityContext.gitBranch}
                        </span>
                      </div>
                    )}
                    {activityContext.projectId && (
                      <div className="flex items-center space-x-2">
                        <Target className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-600 dark:text-slate-300">Project:</span>
                        <span className="font-mono bg-slate-100 dark:bg-slate-600 px-1.5 py-0.5 rounded text-xs">
                          {activityContext.projectId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Business Impact */}
              {showBusinessImpact && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Business Impact
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Risk Level:</span>
                      <span className={clsx(
                        'px-2 py-1 text-xs font-medium rounded-full',
                        getRiskLevelColor(businessImpact.riskLevel)
                      )}>
                        {businessImpact.riskLevel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Business Value:</span>
                      <span className="font-mono">{businessImpact.businessValue}/100</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Time to Impact:</span>
                      <span className="text-xs">{businessImpact.timeToImpact}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Automation:</span>
                      <span className="text-xs">{activity.is_automated ? 'Automated' : 'Manual'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {activity.error_details && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-red-900 dark:text-red-100 mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Error Details
                  </h4>
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <p className="font-medium">{activity.error_details.message}</p>
                    {activity.error_details.recovery_suggestions && activity.error_details.recovery_suggestions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1">Recovery Suggestions:</p>
                        <ul className="list-disc list-inside text-xs space-y-1">
                          {activity.error_details.recovery_suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {showTags && activity.tags && activity.tags.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Tag className="w-3 h-3 text-slate-500" />
                  <div className="flex flex-wrap gap-1">
                    {activity.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Artifacts */}
              {activity.artifacts && activity.artifacts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Artifacts
                  </h4>
                  <div className="space-y-1">
                    {activity.artifacts.map((artifact, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{artifact.name}</span>
                          <span className="text-xs text-slate-500">{artifact.type}</span>
                          {artifact.size_bytes && (
                            <span className="text-xs text-slate-500">
                              ({(artifact.size_bytes / 1024).toFixed(1)}KB)
                            </span>
                          )}
                        </div>
                        <a
                          href={artifact.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ActivityItem