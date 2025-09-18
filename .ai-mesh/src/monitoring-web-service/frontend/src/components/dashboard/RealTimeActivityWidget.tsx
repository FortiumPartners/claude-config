import React, { useState, useCallback, useMemo } from 'react'
import { 
  Activity, 
  X, 
  Clock, 
  User, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Filter,
  RefreshCw,
  Settings,
  Maximize2,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { clsx } from 'clsx'
import { useActivityStream } from '../../hooks/useActivityStream'
import { ActivityItem, ActivityFilter } from '../../types/api'
import ActivityFilterPanel from './ActivityFilterPanel'
import ActivityDetailModal from './ActivityDetailModal'

interface RealTimeActivityWidgetProps {
  config: {
    showTimestamp?: boolean
    maxItems?: number
    showAvatars?: boolean
    showFilters?: boolean
    enableRealTime?: boolean
    compactView?: boolean
    showStats?: boolean
    autoRefresh?: number
  }
  isEditing?: boolean
  onRemove?: () => void
  onExpand?: () => void
}

const RealTimeActivityWidget: React.FC<RealTimeActivityWidgetProps> = ({
  config,
  isEditing,
  onRemove,
  onExpand,
}) => {
  // State management
  const [showFilters, setShowFilters] = useState(false)
  const [currentFilter, setCurrentFilter] = useState<Partial<ActivityFilter>>({
    show_automated: config.enableRealTime !== false,
  })
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Activity stream hook with configuration
  const {
    activities: allActivities,
    filteredActivities,
    isLoading,
    isConnected,
    error,
    updateCount,
    lastUpdate,
    totalCount,
    refresh,
    applyFilters,
    clearFilters,
  } = useActivityStream({
    realTimeEnabled: config.enableRealTime !== false,
    subscriptions: ['activities', 'tool-metrics', 'user-activity', 'system-activity'],
    initialLoadSize: config.maxItems || 20,
    maxCacheSize: (config.maxItems || 20) * 2,
    autoRefreshInterval: config.autoRefresh || 0,
    debounceMs: 300,
    enableVirtualization: !config.compactView,
    defaultFilters: currentFilter,
    onError: (error) => console.error('Activity stream error:', error),
  })

  // Display activities (limited by config)
  const displayActivities = useMemo(() => {
    const activities = filteredActivities.slice(0, config.maxItems || 20)
    return activities
  }, [filteredActivities, config.maxItems])

  // Activity stats
  const activityStats = useMemo(() => {
    const stats = {
      total: totalCount,
      success: displayActivities.filter(a => a.status === 'success').length,
      error: displayActivities.filter(a => a.status === 'error').length,
      inProgress: displayActivities.filter(a => a.status === 'in_progress').length,
      automated: displayActivities.filter(a => a.is_automated).length,
    }
    
    return {
      ...stats,
      successRate: stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0,
    }
  }, [displayActivities, totalCount])

  // Icon helpers
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

  const getInitials = useCallback((name: string) => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase()
  }, [])

  // Event handlers
  const handleActivityClick = useCallback((activity: ActivityItem) => {
    setSelectedActivity(activity)
    setIsModalOpen(true)
  }, [])

  const handleFilterChange = useCallback((newFilters: Partial<ActivityFilter>) => {
    setCurrentFilter(prev => ({ ...prev, ...newFilters }))
    applyFilters(newFilters)
  }, [applyFilters])

  const handleRefresh = useCallback(() => {
    refresh()
  }, [refresh])

  const handleClearFilters = useCallback(() => {
    setCurrentFilter({ show_automated: config.enableRealTime !== false })
    clearFilters()
  }, [clearFilters, config.enableRealTime])

  return (
    <>
      <div className="h-full bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col relative">
        {/* Remove button for editing mode */}
        {isEditing && onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 z-10 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
            aria-label="Remove widget"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Activity className="w-5 h-5 text-blue-500" />
                {isConnected && config.enableRealTime !== false && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Real-time Activity
                </h3>
                <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    {isConnected && config.enableRealTime !== false ? 'Live updates' : 'Offline mode'}
                  </span>
                  {updateCount > 0 && (
                    <>
                      <span>•</span>
                      <span>{updateCount} updates</span>
                    </>
                  )}
                  {lastUpdate && (
                    <>
                      <span>•</span>
                      <span>Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center space-x-1">
              {config.showStats && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs">
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">{activityStats.successRate}%</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="w-3 h-3 text-slate-500" />
                    <span>{activityStats.total}</span>
                  </div>
                  {activityStats.automated > 0 && (
                    <div className="flex items-center space-x-1">
                      <Zap className="w-3 h-3 text-blue-500" />
                      <span className="text-blue-600 dark:text-blue-400">{activityStats.automated}</span>
                    </div>
                  )}
                </div>
              )}
              
              {config.showFilters !== false && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={clsx(
                    'p-2 rounded-lg transition-colors',
                    showFilters 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'
                  )}
                  aria-label="Toggle filters"
                  title="Toggle filters"
                >
                  <Filter className="w-4 h-4" />
                </button>
              )}
              
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Refresh activities"
                title="Refresh"
              >
                <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
              
              {onExpand && (
                <button
                  onClick={onExpand}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors"
                  aria-label="Expand widget"
                  title="Expand"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {/* Filter panel */}
          {showFilters && config.showFilters !== false && (
            <div className="mt-4">
              <ActivityFilterPanel
                filter={currentFilter}
                onFilterChange={handleFilterChange}
                activities={allActivities}
                collapsed={false}
                onToggle={() => setShowFilters(false)}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="flex items-center justify-center h-full p-4">
              <div className="text-center">
                <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                <p className="text-sm text-red-600 dark:text-red-400">Error loading activities</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-3 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : displayActivities.length === 0 ? (
            <div className="flex items-center justify-center h-full p-4 text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {isLoading ? 'Loading activities...' : 
                   totalCount === 0 ? 'No recent activity' :
                   'No activities match your filters'}
                </p>
                {totalCount > 0 && displayActivities.length === 0 && (
                  <button
                    onClick={handleClearFilters}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-4 space-y-3">
              {displayActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={clsx(
                    'flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
                    getStatusColor(activity.status)
                  )}
                  onClick={() => handleActivityClick(activity)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${activity.user.name} ${activity.action.name} ${activity.target.name}`}
                >
                  {/* User Avatar */}
                  {config.showAvatars !== false && (
                    <div className="flex-shrink-0">
                      {activity.user.avatar_url ? (
                        <img
                          src={activity.user.avatar_url}
                          alt={activity.user.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {getInitials(activity.user.name)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Activity Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <p className="text-sm text-slate-900 dark:text-white truncate">
                          <span className="font-medium">{activity.user.name}</span>{' '}
                          {activity.action.description || activity.action.name}{' '}
                          {!config.compactView && (
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
                      </div>
                    </div>
                    
                    {/* Activity Metadata */}
                    {!config.compactView && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
                          {config.showTimestamp !== false && (
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              <time dateTime={activity.timestamp.toISOString()}>
                                {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                              </time>
                            </div>
                          )}
                          
                          {activity.duration_ms && (
                            <div className="flex items-center">
                              <span>
                                {activity.duration_ms < 1000 
                                  ? `${activity.duration_ms}ms`
                                  : `${(activity.duration_ms / 1000).toFixed(1)}s`
                                }
                              </span>
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connection status indicator */}
        {!isConnected && config.enableRealTime !== false && (
          <div className="absolute bottom-4 right-4">
            <div className="bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-full px-2 py-1">
              <span className="text-xs text-yellow-800 dark:text-yellow-300">Offline</span>
            </div>
          </div>
        )}
      </div>

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedActivity(null)
        }}
      />
    </>
  )
}

export default RealTimeActivityWidget