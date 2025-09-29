/**
 * Enhanced Activity Detail Modal
 * Comprehensive view of activity details with tabbed interface
 * Displays all context data, performance charts, error details, and related activities
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  X,
  User,
  Clock,
  Timer,
  Activity,
  Terminal,
  FileText,
  GitBranch,
  Cpu,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Download,
  Tag,
  Zap,
  Info,
  TrendingUp,
  BarChart3,
  Calendar,
  Settings,
  Database,
  Network,
  Shield,
  Share,
  RefreshCw,
  Eye,
  Target,
  Code,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Link,
  MapPin,
  Layers
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ActivityItem } from '../../types/api'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

interface ActivityDetailModalProps {
  activity: ActivityItem | null
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

type TabId = 'overview' | 'performance' | 'context' | 'errors' | 'artifacts' | 'timeline' | 'related'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
  count?: number
}

const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [isSharing, setIsSharing] = useState(false)
  const [relatedActivities, setRelatedActivities] = useState<ActivityItem[]>([])

  // Helper functions
  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-blue-500 animate-pulse" />
      case 'queued':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }, [])

  const getActionIcon = useCallback((actionType: string) => {
    switch (actionType) {
      case 'command_execution':
        return <Terminal className="w-5 h-5 text-blue-500" />
      case 'agent_interaction':
        return <User className="w-5 h-5 text-purple-500" />
      case 'file_operation':
        return <FileText className="w-5 h-5 text-green-500" />
      case 'git_operation':
        return <GitBranch className="w-5 h-5 text-orange-500" />
      case 'test_execution':
        return <Activity className="w-5 h-5 text-indigo-500" />
      case 'tool_usage':
        return <Cpu className="w-5 h-5 text-red-500" />
      default:
        return <Activity className="w-5 h-5 text-gray-500" />
    }
  }, [])

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200 dark:text-red-400 dark:bg-red-900/30 dark:border-red-800'
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-200 dark:text-orange-400 dark:bg-orange-900/30 dark:border-orange-800'
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/30 dark:border-yellow-800'
      case 'low':
        return 'text-green-600 bg-green-100 border-green-200 dark:text-green-400 dark:bg-green-900/30 dark:border-green-800'
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-900/30 dark:border-gray-800'
    }
  }, [])

  const formatDuration = useCallback((durationMs?: number) => {
    if (!durationMs) return 'N/A'
    if (durationMs < 1000) return `${durationMs}ms`
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(2)}s`
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }, [])

  const formatBytes = useCallback((bytes?: number) => {
    if (!bytes) return 'N/A'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }, [])

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast.success('Copied to clipboard')
    }
  }, [])

  // Memoized calculations
  const performanceMetrics = useMemo(() => {
    if (!activity?.metrics) return null

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
  }, [activity?.metrics, activity?.duration_ms])

  const businessImpact = useMemo(() => {
    if (!activity) return null

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

  // Tab configuration
  const tabs: Tab[] = useMemo(() => {
    if (!activity) return []

    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: <Info className="w-4 h-4" />
      },
      {
        id: 'performance',
        label: 'Performance',
        icon: <BarChart3 className="w-4 h-4" />,
        count: performanceMetrics ? Object.values(performanceMetrics).filter(v => v > 0).length : 0
      },
      {
        id: 'context',
        label: 'Context',
        icon: <Settings className="w-4 h-4" />,
        count: activity.execution_context ? Object.values(activity.execution_context).filter(v => v != null).length : 0
      },
      {
        id: 'errors',
        label: 'Errors',
        icon: <AlertTriangle className="w-4 h-4" />,
        count: activity.error_details ? 1 : 0
      },
      {
        id: 'artifacts',
        label: 'Artifacts',
        icon: <FileText className="w-4 h-4" />,
        count: activity.artifacts?.length || 0
      },
      {
        id: 'timeline',
        label: 'Timeline',
        icon: <Calendar className="w-4 h-4" />
      },
      {
        id: 'related',
        label: 'Related',
        icon: <Network className="w-4 h-4" />,
        count: relatedActivities.length
      }
    ]
  }, [activity, performanceMetrics, relatedActivities.length])

  // Share activity
  const shareActivity = useCallback(async () => {
    if (!activity) return

    setIsSharing(true)
    try {
      const shareData = {
        title: `Activity: ${activity.action.name}`,
        text: `${activity.user.name} ${activity.action.description} - Status: ${activity.status}`,
        url: window.location.href
      }

      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await copyToClipboard(`${shareData.title}\n${shareData.text}\n${shareData.url}`)
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error)
        toast.error('Failed to share activity')
      }
    } finally {
      setIsSharing(false)
    }
  }, [activity, copyToClipboard])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('overview')
      setRelatedActivities([])
    }
  }, [isOpen])

  // Tab content renderer
  const renderTabContent = useCallback(() => {
    if (!activity) return null

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Activity Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Action Type</label>
                    <div className="flex items-center space-x-2 mt-1">
                      {getActionIcon(activity.action.type)}
                      <span className="text-sm text-slate-900 dark:text-white">
                        {(activity.action.type || '').replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusIcon(activity.status)}
                      <span className="text-sm text-slate-900 dark:text-white capitalize">
                        {(activity.status || '').replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Duration</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Timer className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-900 dark:text-white">
                        {formatDuration(activity.duration_ms)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Target</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Target className="w-4 h-4 text-slate-500" />
                      <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                        {activity.target.name}
                      </code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                <p className="text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 p-3 rounded-lg mt-1">
                  {activity.action.description}
                </p>
              </div>
            </div>

            {/* Business Impact */}
            {businessImpact && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Business Impact
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Risk Level:</span>
                    <span className={clsx(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      businessImpact.riskLevel === 'critical' ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' :
                      businessImpact.riskLevel === 'high' ? 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30' :
                      businessImpact.riskLevel === 'medium' ? 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                      'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                    )}>
                      {businessImpact.riskLevel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Business Value:</span>
                    <span className="text-sm font-mono">{businessImpact.businessValue}/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Time to Impact:</span>
                    <span className="text-sm">{businessImpact.timeToImpact}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Automation:</span>
                    <span className="text-sm">{activity.is_automated ? 'Automated' : 'Manual'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            {performanceMetrics && (
              <div className="grid grid-cols-3 gap-4">
                {performanceMetrics.executionTime > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Timer className="w-5 h-5 text-blue-500" />
                      <span className="text-xs text-blue-600 dark:text-blue-400">Duration</span>
                    </div>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-100 mt-1">
                      {formatDuration(performanceMetrics.executionTime)}
                    </p>
                  </div>
                )}

                {performanceMetrics.memoryUsage > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <HardDrive className="w-5 h-5 text-purple-500" />
                      <span className="text-xs text-purple-600 dark:text-purple-400">Memory</span>
                    </div>
                    <p className="text-lg font-semibold text-purple-900 dark:text-purple-100 mt-1">
                      {formatBytes(performanceMetrics.memoryUsage)}
                    </p>
                  </div>
                )}

                {(performanceMetrics.inputTokens > 0 || performanceMetrics.outputTokens > 0) && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Eye className="w-5 h-5 text-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400">Tokens</span>
                    </div>
                    <p className="text-lg font-semibold text-green-900 dark:text-green-100 mt-1">
                      {(performanceMetrics.inputTokens + performanceMetrics.outputTokens).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case 'performance':
        return (
          <div className="space-y-6">
            {performanceMetrics ? (
              <>
                {/* Performance Overview */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">Execution Metrics</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-600 dark:text-slate-300">Execution Time:</span>
                        <span className="font-mono text-sm">{formatDuration(performanceMetrics.executionTime)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-600 dark:text-slate-300">Memory Usage:</span>
                        <span className="font-mono text-sm">{formatBytes(performanceMetrics.memoryUsage)}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-600 dark:text-slate-300">CPU Usage:</span>
                        <span className="font-mono text-sm">{performanceMetrics.cpuUsage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">Token Usage</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-600 dark:text-slate-300">Input Tokens:</span>
                        <span className="font-mono text-sm">{performanceMetrics.inputTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-600 dark:text-slate-300">Output Tokens:</span>
                        <span className="font-mono text-sm">{performanceMetrics.outputTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-sm text-slate-600 dark:text-slate-300">Total Tokens:</span>
                        <span className="font-mono text-sm">
                          {(performanceMetrics.inputTokens + performanceMetrics.outputTokens).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Token Efficiency */}
                {performanceMetrics.inputTokens > 0 && performanceMetrics.outputTokens > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                    <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-4">Token Efficiency</h3>
                    <div className="flex items-center space-x-6">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-blue-800 dark:text-blue-200">
                          Output/Input Ratio: {(performanceMetrics.outputTokens / performanceMetrics.inputTokens).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-300">
                        Efficiency: {performanceMetrics.outputTokens > performanceMetrics.inputTokens ? 'High' : 'Standard'}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No performance metrics available</p>
              </div>
            )}
          </div>
        )

      case 'context':
        return (
          <div className="space-y-6">
            {activity.execution_context ? (
              <>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center">
                    <Settings className="w-5 h-5 mr-2" />
                    Execution Environment
                  </h3>
                  <div className="space-y-3">
                    {activity.execution_context.environment && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Environment:</span>
                        <span className="px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {activity.execution_context.environment}
                        </span>
                      </div>
                    )}

                    {activity.execution_context.git_branch && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Git Branch:</span>
                        <div className="flex items-center space-x-2">
                          <GitBranch className="w-4 h-4 text-orange-500" />
                          <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                            {activity.execution_context.git_branch}
                          </code>
                          <button
                            onClick={() => copyToClipboard(activity.execution_context.git_branch!)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {activity.execution_context.git_commit && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Git Commit:</span>
                        <div className="flex items-center space-x-2">
                          <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                            {activity.execution_context.git_commit.substring(0, 8)}
                          </code>
                          <button
                            onClick={() => copyToClipboard(activity.execution_context.git_commit!)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {activity.execution_context.session_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Session ID:</span>
                        <div className="flex items-center space-x-2">
                          <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                            {activity.execution_context.session_id.substring(0, 8)}...
                          </code>
                          <button
                            onClick={() => copyToClipboard(activity.execution_context.session_id!)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {activity.execution_context.project_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Project ID:</span>
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4 text-green-500" />
                          <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                            {activity.execution_context.project_id}
                          </code>
                          <button
                            onClick={() => copyToClipboard(activity.execution_context.project_id!)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Context */}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center">
                      <Database className="w-5 h-5 mr-2" />
                      Additional Metadata
                    </h3>
                    <pre className="text-sm bg-slate-100 dark:bg-slate-700 p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(activity.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Settings className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No execution context available</p>
              </div>
            )}
          </div>
        )

      case 'errors':
        return (
          <div className="space-y-6">
            {activity.error_details ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <h3 className="text-lg font-medium text-red-900 dark:text-red-100 mb-4 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Error Details
                </h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Error Message</p>
                    <p className="text-sm text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-3 rounded">
                      {activity.error_details.message}
                    </p>
                  </div>

                  {activity.error_details.code && (
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Error Code</p>
                      <code className="px-3 py-2 text-sm bg-red-100 dark:bg-red-900/30 rounded font-mono block">
                        {activity.error_details.code}
                      </code>
                    </div>
                  )}

                  {activity.error_details.stack_trace && (
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Stack Trace</p>
                      <pre className="text-xs bg-red-100 dark:bg-red-900/30 p-3 rounded overflow-x-auto">
                        {activity.error_details.stack_trace}
                      </pre>
                    </div>
                  )}

                  {activity.error_details.recovery_suggestions && activity.error_details.recovery_suggestions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">Recovery Suggestions</p>
                      <ul className="list-disc list-inside space-y-1">
                        {activity.error_details.recovery_suggestions.map((suggestion, index) => (
                          <li key={index} className="text-sm text-red-700 dark:text-red-300">{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No errors detected</p>
              </div>
            )}
          </div>
        )

      case 'artifacts':
        return (
          <div className="space-y-6">
            {activity.artifacts && activity.artifacts.length > 0 ? (
              <div className="space-y-4">
                {activity.artifacts.map((artifact, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{artifact.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {artifact.type} {artifact.size_bytes && `• ${formatBytes(artifact.size_bytes)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => window.open(artifact.url, '_blank')}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        aria-label="Open artifact"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const a = document.createElement('a')
                          a.href = artifact.url
                          a.download = artifact.name
                          a.click()
                        }}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        aria-label="Download artifact"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No artifacts available</p>
              </div>
            )}
          </div>
        )

      case 'timeline':
        return (
          <div className="space-y-6">
            <div className="relative">
              <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

              {/* Start */}
              <div className="flex items-start space-x-3 mb-6">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <PlayCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Activity Started</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {format(
                      typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp,
                      'PPpp'
                    )}
                  </p>
                </div>
              </div>

              {/* Environment Setup */}
              {activity.execution_context?.environment && (
                <div className="flex items-start space-x-3 mb-6">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Environment Setup</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activity.execution_context.environment}
                    </p>
                  </div>
                </div>
              )}

              {/* Execution */}
              <div className="flex items-start space-x-3 mb-6">
                <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Execution Phase</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activity.action.description}
                  </p>
                </div>
              </div>

              {/* Completion */}
              <div className="flex items-start space-x-3">
                <div className={clsx(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  activity.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                  activity.status === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-yellow-100 dark:bg-yellow-900/30'
                )}>
                  {activity.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : activity.status === 'error' ? (
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <PauseCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Activity {activity.status === 'success' ? 'Completed' :
                             activity.status === 'error' ? 'Failed' : 'In Progress'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activity.duration_ms ? `Duration: ${formatDuration(activity.duration_ms)}` : 'Ongoing'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'related':
        return (
          <div className="space-y-6">
            {relatedActivities.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Related activities from {activity.user.name}
                </p>
                {relatedActivities.map((relatedActivity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(relatedActivity.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {relatedActivity.action.description || relatedActivity.action.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {formatDistanceToNow(
                          typeof relatedActivity.timestamp === 'string' ? new Date(relatedActivity.timestamp) : relatedActivity.timestamp,
                          { addSuffix: true }
                        )}
                        {relatedActivity.duration_ms && ` • ${formatDuration(relatedActivity.duration_ms)}`}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => copyToClipboard(relatedActivity.id)}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        aria-label="Copy activity ID"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Network className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No related activities found</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }, [activeTab, activity, performanceMetrics, businessImpact, relatedActivities, getStatusIcon, getActionIcon, formatDuration, formatBytes, copyToClipboard])

  if (!activity || !isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="activity-modal-title"
        aria-describedby="activity-modal-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-4">
            {getActionIcon(activity.action.type)}
            <div>
              <h2 id="activity-modal-title" className="text-xl font-semibold text-slate-900 dark:text-white">
                {activity.action.name}
              </h2>
              <p id="activity-modal-description" className="text-sm text-slate-500 dark:text-slate-400">
                {activity.user.name} • {format(
                  typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp,
                  'PPpp'
                )} • {formatDistanceToNow(
                  typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp,
                  { addSuffix: true }
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Priority Badge */}
            <span className={clsx(
              'px-3 py-1 text-sm font-medium rounded-full border',
              getPriorityColor(activity.priority)
            )}>
              {(activity.priority || 'medium').charAt(0).toUpperCase() + (activity.priority || 'medium').slice(1)}
            </span>

            {activity.is_automated && (
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                <Zap className="w-3 h-3 mr-1 inline" />
                Automated
              </span>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-1 ml-3">
              <button
                onClick={shareActivity}
                disabled={isSharing}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Share activity"
                title="Share activity"
              >
                <Share className="w-4 h-4" />
              </button>

              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Refresh activity data"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => copyToClipboard(activity.id)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Copy activity ID"
                title="Copy ID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2" />

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <nav className="flex space-x-8 px-6" aria-label="Activity details tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300'
                )}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}

export default ActivityDetailModal