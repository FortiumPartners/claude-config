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
  ChevronDown,
  ChevronRight,
  Tag,
  Zap,
  Info,
  TrendingUp,
  TrendingDown,
  Eye,
  Share,
  RefreshCw,
  Settings,
  BarChart3,
  Calendar,
  MapPin,
  Database,
  Network,
  Shield
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ActivityItem } from '../../types/api'
import { activitiesApi } from '../../services/api'
import { clsx } from 'clsx'
import toast from 'react-hot-toast'

interface ActivityDetailModalProps {
  activity: ActivityItem | null
  isOpen: boolean
  onClose: () => void
  onRefresh?: () => void
}

interface ActivityMetrics {
  input_tokens?: number
  output_tokens?: number
  memory_usage?: number
  cpu_usage?: number
  execution_phases?: Array<{
    name: string
    duration_ms: number
    status: string
  }>
}

interface ActivityArtifacts {
  type: 'log' | 'output' | 'screenshot' | 'report'
  name: string
  url: string
  size_bytes?: number
}[]

interface ExpandableSection {
  title: string
  icon: React.ReactNode
  content: React.ReactNode
  defaultExpanded?: boolean
}

const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  isOpen,
  onClose,
  onRefresh
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'execution-details': true,
    'performance-metrics': true,
    'context': false,
    'artifacts': false,
    'error-details': true,
    'related-activities': false,
    'timeline': false
  })
  
  // Enhanced state for additional data
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false)
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false)
  const [enhancedMetrics, setEnhancedMetrics] = useState<ActivityMetrics | null>(null)
  const [artifacts, setArtifacts] = useState<ActivityArtifacts>([])
  const [relatedActivities, setRelatedActivities] = useState<ActivityItem[]>([])
  const [isSharing, setIsSharing] = useState(false)

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const getStatusIcon = (status: string = '') => {
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
  }

  const getActionIcon = (actionType: string = '') => {
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
  }

  const getPriorityColor = (priority: string = 'medium') => {
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
  }

  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return 'N/A'
    if (durationMs < 1000) return `${durationMs}ms`
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(2)}s`
    const minutes = Math.floor(durationMs / 60000)
    const seconds = Math.floor((durationMs % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  const copyToClipboard = async (text: string) => {
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
  }

  // Load enhanced metrics when activity changes
  const loadEnhancedMetrics = useCallback(async (activityId: string) => {
    if (isLoadingMetrics) return
    
    setIsLoadingMetrics(true)
    try {
      const response = await activitiesApi.getMetrics(activityId)
      setEnhancedMetrics(response.data.data)
    } catch (error) {
      console.error('Failed to load enhanced metrics:', error)
      toast.error('Failed to load performance metrics')
    } finally {
      setIsLoadingMetrics(false)
    }
  }, [isLoadingMetrics])

  // Load artifacts when activity changes
  const loadArtifacts = useCallback(async (activityId: string) => {
    if (isLoadingArtifacts) return
    
    setIsLoadingArtifacts(true)
    try {
      const response = await activitiesApi.getArtifacts(activityId)
      setArtifacts(response.data.data)
    } catch (error) {
      console.error('Failed to load artifacts:', error)
      // Don't show error toast for missing artifacts as it's optional
    } finally {
      setIsLoadingArtifacts(false)
    }
  }, [isLoadingArtifacts])

  // Load related activities
  const loadRelatedActivities = useCallback(async (activity: ActivityItem) => {
    try {
      const response = await activitiesApi.list({
        user_ids: [activity.user.id],
        action_types: [activity.action.type],
        limit: 5,
        sort: 'timestamp',
        order: 'desc'
      })
      
      // Filter out the current activity
      const related = response.data.data.filter(a => a.id !== activity.id)
      setRelatedActivities(related)
    } catch (error) {
      console.error('Failed to load related activities:', error)
    }
  }, [])

  // Share activity details
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
        // Fallback to copying URL
        await copyToClipboard(`${shareData.title}\n${shareData.text}\n${shareData.url}`)
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error)
        toast.error('Failed to share activity')
      }
    } finally {
      setIsSharing(false)
    }
  }, [activity, copyToClipboard])

  // Download activity logs
  const downloadLogs = useCallback(async () => {
    if (!activity) return
    
    try {
      const response = await activitiesApi.downloadLogs(activity.id)
      const blob = response.data
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `activity-${activity.id}-logs.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success('Logs downloaded')
    } catch (error) {
      console.error('Download logs failed:', error)
      toast.error('Failed to download logs')
    }
  }, [activity])

  // Load additional data when activity changes
  useEffect(() => {
    if (activity && isOpen) {
      loadEnhancedMetrics(activity.id)
      loadArtifacts(activity.id)
      loadRelatedActivities(activity)
    }
  }, [activity, isOpen, loadEnhancedMetrics, loadArtifacts, loadRelatedActivities])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEnhancedMetrics(null)
      setArtifacts([])
      setRelatedActivities([])
    }
  }, [isOpen])

  const sections: ExpandableSection[] = useMemo(() => {
    if (!activity) return []

    const sectionList: ExpandableSection[] = [
      {
        title: 'Execution Details',
        icon: <Terminal className="w-4 h-4" />,
        defaultExpanded: true,
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Action Type</label>
                <div className="flex items-center space-x-2">
                  {getActionIcon(activity.action.type)}
                  <span className="text-sm text-slate-900 dark:text-white">{(activity.action.type || '').replace('_', ' ')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(activity.status)}
                  <span className="text-sm text-slate-900 dark:text-white capitalize">{(activity.status || '').replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <p className="text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 p-3 rounded-lg">
                {activity.action.description}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Target</label>
                <div className="flex items-center space-x-2">
                  <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                    {activity.target.name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(activity.target.name)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                    aria-label="Copy target name"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Duration</label>
                <div className="flex items-center space-x-2">
                  <Timer className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-900 dark:text-white">{formatDuration(activity.duration_ms)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      }
    ]

    // Enhanced Performance Metrics section
    if ((activity.metrics && Object.values(activity.metrics).some(val => val != null)) || enhancedMetrics) {
      sectionList.push({
        title: 'Performance Metrics',
        icon: isLoadingMetrics ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />,
        defaultExpanded: true,
        content: (
          <div className="space-y-6">
            {/* Basic Metrics */}
            <div className="grid grid-cols-2 gap-4">
              {(activity.metrics?.input_tokens || enhancedMetrics?.input_tokens) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Input Tokens</label>
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {(enhancedMetrics?.input_tokens || activity.metrics?.input_tokens || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              
              {(activity.metrics?.output_tokens || enhancedMetrics?.output_tokens) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Output Tokens</label>
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {(enhancedMetrics?.output_tokens || activity.metrics?.output_tokens || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              
              {(activity.metrics?.memory_usage || enhancedMetrics?.memory_usage) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Memory Usage</label>
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-purple-500" />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {formatBytes(enhancedMetrics?.memory_usage || activity.metrics?.memory_usage)}
                    </span>
                  </div>
                </div>
              )}
              
              {(activity.metrics?.cpu_usage || enhancedMetrics?.cpu_usage) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CPU Usage</label>
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-slate-900 dark:text-white">
                      {(enhancedMetrics?.cpu_usage || activity.metrics?.cpu_usage || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Execution Phases */}
            {enhancedMetrics?.execution_phases && enhancedMetrics.execution_phases.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Execution Phases</label>
                <div className="space-y-2">
                  {enhancedMetrics.execution_phases.map((phase, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={clsx(
                          'w-3 h-3 rounded-full',
                          phase.status === 'success' ? 'bg-green-500' :
                          phase.status === 'error' ? 'bg-red-500' :
                          phase.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        )} />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{phase.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Timer className="w-3 h-3 text-slate-500" />
                        <span className="text-xs text-slate-500">{formatDuration(phase.duration_ms)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Token Efficiency */}
            {(enhancedMetrics?.input_tokens || activity.metrics?.input_tokens) && 
             (enhancedMetrics?.output_tokens || activity.metrics?.output_tokens) && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Token Efficiency</label>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Ratio: {((enhancedMetrics?.output_tokens || activity.metrics?.output_tokens || 0) / 
                               (enhancedMetrics?.input_tokens || activity.metrics?.input_tokens || 1)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Total: {((enhancedMetrics?.input_tokens || activity.metrics?.input_tokens || 0) + 
                               (enhancedMetrics?.output_tokens || activity.metrics?.output_tokens || 0)).toLocaleString()} tokens
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })
    }

    // Execution Context section
    if (activity.execution_context && Object.values(activity.execution_context).some(val => val != null)) {
      sectionList.push({
        title: 'Execution Context',
        icon: <Info className="w-4 h-4" />,
        content: (
          <div className="space-y-3">
            {activity.execution_context.git_branch && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Git Branch</span>
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-orange-500" />
                  <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                    {activity.execution_context.git_branch}
                  </code>
                </div>
              </div>
            )}
            
            {activity.execution_context.git_commit && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Git Commit</span>
                <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                  {activity.execution_context.git_commit.substring(0, 8)}
                </code>
              </div>
            )}
            
            {activity.execution_context.environment && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Environment</span>
                <span className="px-2 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                  {activity.execution_context.environment}
                </span>
              </div>
            )}
            
            {activity.execution_context.session_id && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Session ID</span>
                <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                  {activity.execution_context.session_id.substring(0, 8)}...
                </code>
              </div>
            )}
          </div>
        )
      })
    }

    // Error Details section
    if (activity.error_details) {
      sectionList.push({
        title: 'Error Details',
        icon: <AlertTriangle className="w-4 h-4" />,
        defaultExpanded: true,
        content: (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">Error Message</p>
              <p className="text-sm text-red-700 dark:text-red-300">{activity.error_details.message}</p>
            </div>
            
            {activity.error_details.code && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Error Code</p>
                <code className="px-2 py-1 text-sm bg-slate-100 dark:bg-slate-700 rounded font-mono">
                  {activity.error_details.code}
                </code>
              </div>
            )}
            
            {activity.error_details.recovery_suggestions && activity.error_details.recovery_suggestions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recovery Suggestions</p>
                <ul className="list-disc list-inside space-y-1">
                  {activity.error_details.recovery_suggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-slate-600 dark:text-slate-400">{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })
    }

    // Enhanced Artifacts section
    if ((activity.artifacts && activity.artifacts.length > 0) || artifacts.length > 0) {
      const allArtifacts = [...(activity.artifacts || []), ...artifacts]
      sectionList.push({
        title: 'Artifacts',
        icon: isLoadingArtifacts ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />,
        content: (
          <div className="space-y-3">
            {allArtifacts.map((artifact, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{artifact.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {artifact.type} • {artifact.size_bytes ? formatBytes(artifact.size_bytes) : 'Unknown size'}
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
            
            {/* Download logs button */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={downloadLogs}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Activity Logs</span>
              </button>
            </div>
          </div>
        )
      })
    }

    // Related Activities section
    if (relatedActivities.length > 0) {
      sectionList.push({
        title: 'Related Activities',
        icon: <Network className="w-4 h-4" />,
        content: (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Recent similar activities by {activity.user.name}
            </p>
            {relatedActivities.map((relatedActivity, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(relatedActivity.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {relatedActivity.action.description || relatedActivity.action.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {formatDistanceToNow(typeof relatedActivity.timestamp === 'string' ? new Date(relatedActivity.timestamp) : relatedActivity.timestamp, { addSuffix: true })} • 
                    {relatedActivity.duration_ms && ` ${formatDuration(relatedActivity.duration_ms)}`}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={() => {
                      // This would typically open the related activity in a new modal
                      // For now, we'll just copy its ID
                      copyToClipboard(relatedActivity.id)
                    }}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                    aria-label="Copy activity ID"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      })
    }

    // Timeline section
    if (activity.execution_context || activity.tags?.length || activity.error_details) {
      sectionList.push({
        title: 'Timeline & Context',
        icon: <Calendar className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
              
              {/* Start */}
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Activity Started</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {format(typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp, 'PPpp')}
                  </p>
                </div>
              </div>
              
              {/* Environment Info */}
              {activity.execution_context?.environment && (
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                    <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Environment</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activity.execution_context.environment}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Completion */}
              <div className="flex items-start space-x-3">
                <div className={clsx(
                  'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
                  activity.status === 'success' ? 'bg-green-100 dark:bg-green-900/30' :
                  activity.status === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-yellow-100 dark:bg-yellow-900/30'
                )}>
                  {getStatusIcon(activity.status)}
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

            {/* Tags */}
            {activity.tags && activity.tags.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {activity.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })
    }

    return sectionList
  }, [activity])

  if (!activity || !isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="activity-modal-title"
        aria-describedby="activity-modal-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-4">
            {getActionIcon(activity.action.type)}
            <div>
              <h2 id="activity-modal-title" className="text-xl font-semibold text-slate-900 dark:text-white">
                {activity.action.name}
              </h2>
              <p id="activity-modal-description" className="text-sm text-slate-500 dark:text-slate-400">
                {activity.user.name} • {format(typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp, 'PPpp')} • {formatDistanceToNow(typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp, { addSuffix: true })}
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
              {/* Share */}
              <button
                onClick={shareActivity}
                disabled={isSharing}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Share activity"
                title="Share activity"
              >
                <Share className="w-4 h-4" />
              </button>
              
              {/* Refresh */}
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
              
              {/* Copy ID */}
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

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          <div className="space-y-6">
            {/* User and Basic Info */}
            <div className="flex items-start space-x-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex-shrink-0">
                {activity.user.avatar_url ? (
                  <img
                    src={activity.user.avatar_url}
                    alt={activity.user.name}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-medium">
                      {activity.user.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">{activity.user.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{activity.user.email}</p>
                {activity.tags && activity.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activity.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expandable Sections */}
            <div className="space-y-4">
              {sections.map((section, index) => {
                const sectionId = section.title.toLowerCase().replace(/\s+/g, '-')
                const isExpanded = expandedSections[sectionId] ?? section.defaultExpanded ?? false
                
                return (
                  <div key={index} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                    <button
                      onClick={() => toggleSection(sectionId)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center space-x-3">
                        {section.icon}
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                          {section.title}
                        </h3>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                        {section.content}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ActivityDetailModal