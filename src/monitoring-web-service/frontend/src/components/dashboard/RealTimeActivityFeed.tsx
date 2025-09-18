import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react'
import { FixedSizeList as List, ListChildComponentProps } from 'react-window'
import { 
  Activity, 
  User, 
  Terminal, 
  GitBranch, 
  Code, 
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  FileText,
  Cpu,
  Timer,
  ChevronRight,
  XCircle,
  Tag,
  AlertTriangle,
  ExternalLink,
  HardDrive,
  Filter,
  Search,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  ArrowDown,
  Maximize2,
  MoreHorizontal,
  Download
} from 'lucide-react'
import BaseWidget, { BaseWidgetConfig } from './BaseWidget'
import { useCurrentTenant } from '../../contexts/TenantContext'
import { clsx } from 'clsx'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ActivityItem, ActivityFilter } from '../../types/api'
import { useActivityStream } from '../../hooks/useActivityStream'
import ActivityFilterPanel from './ActivityFilterPanel'
import ActivityDetailModal from './ActivityDetailModal'

// Virtual list item component props
interface VirtualActivityItemProps extends ListChildComponentProps {
  data: {
    activities: ActivityItem[]
    onActivitySelect?: (activity: ActivityItem) => void
    showUserAvatars?: boolean
    compactView?: boolean
    showTimestamps?: boolean
  }
}

interface RealTimeActivityFeedProps {
  config: BaseWidgetConfig & {
    maxEvents?: number
    autoScroll?: boolean
    showFilters?: boolean
    showSearch?: boolean
    showUserAvatars?: boolean
    groupByTime?: boolean
    enableVirtualScrolling?: boolean
    itemHeight?: number
    compactView?: boolean
    showStats?: boolean
    refreshInterval?: number
    enableExport?: boolean
  }
  isEditing?: boolean
  onRemove?: () => void
  onActivitySelect?: (activity: ActivityItem) => void
  onExpand?: () => void
}

// Enhanced Virtual list item component
const VirtualActivityItem: React.FC<VirtualActivityItemProps> = ({
  index,
  style,
  data: { activities, onActivitySelect, showUserAvatars, compactView, showTimestamps }
}) => {
  const activity = activities[index]
  
  const getStatusIcon = useCallback((status: string = '') => {
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

  const getActionIcon = useCallback((actionType: string = '') => {
    switch (actionType) {
      case 'command_execution':
        return <Terminal className="w-4 h-4 text-blue-500" />
      case 'agent_interaction':
        return <User className="w-4 h-4 text-purple-500" />
      case 'file_operation':
        return <FileText className="w-4 h-4 text-green-500" />
      case 'git_operation':
        return <GitBranch className="w-4 h-4 text-orange-500" />
      case 'test_execution':
        return <Activity className="w-4 h-4 text-indigo-500" />
      case 'tool_usage':
        return <Cpu className="w-4 h-4 text-red-500" />
      default:
        return <Activity className="w-4 h-4 text-gray-500" />
    }
  }, [])

  const getStatusColor = useCallback((status: string = '') => {
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

  const getInitials = useCallback((name: string = 'Unknown User') => {
    return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase()
  }, [])

  const formatDuration = useCallback((durationMs?: number) => {
    if (!durationMs) return null
    if (durationMs < 1000) return `${durationMs}ms`
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`
    return `${Math.floor(durationMs / 60000)}m ${Math.floor((durationMs % 60000) / 1000)}s`
  }, [])

  const handleClick = useCallback(() => {
    if (onActivitySelect) {
      onActivitySelect(activity)
    }
  }, [activity, onActivitySelect])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleClick()
    }
  }, [handleClick])

  return (
    <div style={style} className="px-2 py-1">
      <div
        className={clsx(
          'flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
          getStatusColor(activity.status)
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`Activity: ${activity.user.name} ${activity.action.name} ${activity.target.name}, status: ${activity.status}`}
      >
        {/* User Avatar */}
        {showUserAvatars && (
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
          {/* Main Activity Description */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              {getActionIcon(activity.action.type)}
              <p className="text-sm text-slate-900 dark:text-white">
                <span className="font-medium">{activity.user.name}</span>{' '}
                {activity.action.description || activity.action.name}{' '}
                <span className="font-mono text-xs bg-slate-100 dark:bg-slate-600 px-1.5 py-0.5 rounded">
                  {activity.target.name}
                </span>
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(activity.status)}
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          {/* Activity Metadata */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400">
              {/* Timestamp */}
              <div className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                <time dateTime={typeof activity.timestamp === 'string' ? activity.timestamp : new Date(activity.timestamp).toISOString()}>
                  {formatDistanceToNow(typeof activity.timestamp === 'string' ? new Date(activity.timestamp) : activity.timestamp, { addSuffix: true })}
                </time>
              </div>
              
              {/* Duration */}
              {activity.duration_ms && (
                <div className="flex items-center">
                  <Timer className="w-3 h-3 mr-1" />
                  {formatDuration(activity.duration_ms)}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Priority Badge */}
              {activity.priority === 'high' || activity.priority === 'critical' && (
                <span className={clsx(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  activity.priority === 'critical' ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' :
                  'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30'
                )}>
                  {(activity.priority || 'medium').charAt(0).toUpperCase() + (activity.priority || 'medium').slice(1)}
                </span>
              )}
              
              {/* Error Indicator */}
              {activity.error_details && (
                <AlertTriangle className="w-4 h-4 text-red-500" aria-label="Has errors" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const RealTimeActivityFeed: React.FC<RealTimeActivityFeedProps> = ({
  config,
  isEditing,
  onRemove,
  onActivitySelect,
  onExpand,
}) => {
  const currentTenant = useCurrentTenant()
  const feedRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<List>(null)
  
  // State management
  const [showFilters, setShowFilters] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentFilter, setCurrentFilter] = useState<Partial<ActivityFilter>>({
    show_automated: true,
  })

  // Enhanced activity stream with optimizations
  const {
    activities: allActivities,
    filteredActivities,
    isLoading,
    isConnected,
    error,
    updateCount,
    lastUpdate,
    totalCount,
    hasMore,
    refresh,
    loadMore,
    applyFilters,
    clearFilters,
    getVirtualizedItems,
  } = useActivityStream({
    realTimeEnabled: true,
    subscriptions: [
      'activities',
      'tool-metrics',
      'user-activity',
      'system-activity',
      'command-execution',
      'agent-interaction'
    ],
    initialLoadSize: config.maxEvents || 100,
    maxCacheSize: (config.maxEvents || 100) * 2,
    autoRefreshInterval: config.refreshInterval || 0,
    debounceMs: 200,
    enableVirtualization: config.enableVirtualScrolling !== false,
    defaultFilters: currentFilter,
    onActivityReceived: (activity) => {
      // Auto-scroll to top for new activities
      if (config.autoScroll && listRef.current) {
        listRef.current.scrollToItem(0, 'start')
      }
    },
    onError: (error) => console.error('Activity feed error:', error),
  })

  // Apply search query to filtered activities
  const searchFilteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return filteredActivities
    
    const query = searchQuery.toLowerCase().trim()
    return filteredActivities.filter(activity =>
      activity.user.name.toLowerCase().includes(query) ||
      activity.action.name.toLowerCase().includes(query) ||
      activity.action.description?.toLowerCase().includes(query) ||
      activity.target.name.toLowerCase().includes(query) ||
      activity.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  }, [filteredActivities, searchQuery])

  // Virtual scrolling item data with enhanced configuration
  const virtualItemData = useMemo(() => ({
    activities: searchFilteredActivities,
    onActivitySelect: onActivitySelect || ((activity: ActivityItem) => {
      setSelectedActivity(activity)
      setIsModalOpen(true)
    }),
    showUserAvatars: config.showUserAvatars !== false,
    compactView: config.compactView,
    showTimestamps: true,
  }), [searchFilteredActivities, onActivitySelect, config.showUserAvatars, config.compactView])

  // Activity statistics
  const activityStats = useMemo(() => {
    const stats = {
      total: totalCount,
      displayed: searchFilteredActivities.length,
      success: searchFilteredActivities.filter(a => a.status === 'success').length,
      error: searchFilteredActivities.filter(a => a.status === 'error').length,
      inProgress: searchFilteredActivities.filter(a => a.status === 'in_progress').length,
      automated: searchFilteredActivities.filter(a => a.is_automated).length,
    }
    
    return {
      ...stats,
      successRate: stats.displayed > 0 ? Math.round((stats.success / stats.displayed) * 100) : 0,
      automationRate: stats.displayed > 0 ? Math.round((stats.automated / stats.displayed) * 100) : 0,
    }
  }, [totalCount, searchFilteredActivities])

  // Event handlers
  const handleFilterChange = useCallback((newFilters: Partial<ActivityFilter>) => {
    setCurrentFilter(prev => ({ ...prev, ...newFilters }))
    applyFilters(newFilters)
  }, [applyFilters])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleClearAll = useCallback(() => {
    setSearchQuery('')
    setCurrentFilter({ show_automated: true })
    clearFilters()
  }, [clearFilters])

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      loadMore()
    }
  }, [hasMore, isLoading, loadMore])

  const handleExport = useCallback(async () => {
    if (!config.enableExport) return
    
    try {
      const csvContent = [
        'Timestamp,User,Action,Target,Status,Duration (ms),Priority,Automated',
        ...searchFilteredActivities.map(activity => [
          typeof activity.timestamp === 'string' ? activity.timestamp : new Date(activity.timestamp).toISOString(),
          activity.user.name,
          activity.action.name,
          activity.target.name,
          activity.status,
          activity.duration_ms || '',
          activity.priority,
          activity.is_automated ? 'Yes' : 'No'
        ].join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `activity-feed-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }, [config.enableExport, searchFilteredActivities])

  return (
    <>
      <BaseWidget
        title="Real-Time Activity Feed"
        subtitle={`${activityStats.displayed} activities • ${updateCount} updates`}
        icon={<Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
        config={{
          ...config,
          refreshInterval: 0, // Real-time updates
        }}
        isEditing={isEditing}
        onRemove={onRemove}
        onRefresh={refresh}
        actions={
          <div className="flex items-center space-x-2">
            {/* Statistics */}
            {config.showStats && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">{activityStats.successRate}%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="w-3 h-3 text-slate-500" />
                  <span>{activityStats.displayed}</span>
                </div>
                {activityStats.automated > 0 && (
                  <div className="flex items-center space-x-1">
                    <Zap className="w-3 h-3 text-blue-500" />
                    <span className="text-blue-600 dark:text-blue-400">{activityStats.automationRate}%</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Search Toggle */}
            {config.showSearch !== false && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={clsx(
                  'p-2 rounded-lg transition-colors',
                  showSearch || searchQuery 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'
                )}
                aria-label="Toggle search"
                title="Search activities"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            
            {/* Filter Toggle */}
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
                title="Filter activities"
              >
                <Filter className="w-4 h-4" />
              </button>
            )}
            
            {/* Export */}
            {config.enableExport && (
              <button
                onClick={handleExport}
                disabled={searchFilteredActivities.length === 0}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Export activities"
                title="Export to CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            
            {/* Refresh */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Refresh activities"
              title="Refresh"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
            
            {/* Expand */}
            {onExpand && (
              <button
                onClick={onExpand}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors"
                aria-label="Expand feed"
                title="Expand"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center space-x-1">
              <div className={clsx(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        }
      >
        <div className="h-full flex flex-col">
          {/* Search Bar */}
          {showSearch && config.showSearch !== false && (
            <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search activities, users, actions..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                    aria-label="Clear search"
                  >
                    <XCircle className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Filter Panel */}
          {showFilters && config.showFilters !== false && (
            <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
              <ActivityFilterPanel
                filter={currentFilter}
                onFilterChange={handleFilterChange}
                activities={allActivities}
                collapsed={false}
                onToggle={() => setShowFilters(false)}
              />
            </div>
          )}
          
          {/* Activity Content */}
          <div className="flex-1 overflow-hidden">
            {error ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center">
                  <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <p className="text-sm text-red-600 dark:text-red-400">Error loading activities</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{error}</p>
                  <button
                    onClick={refresh}
                    className="mt-3 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : searchFilteredActivities.length === 0 ? (
              <div className="flex items-center justify-center h-full p-4 text-slate-500 dark:text-slate-400">
                <div className="text-center">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {isLoading ? 'Loading activities...' :
                     totalCount === 0 ? 'No recent activity' :
                     searchQuery ? 'No activities match your search' :
                     'No activities match your filters'}
                  </p>
                  {(searchQuery || (totalCount > 0 && searchFilteredActivities.length === 0)) && (
                    <button
                      onClick={handleClearAll}
                      className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </div>
            ) : config.enableVirtualScrolling !== false && searchFilteredActivities.length > 20 ? (
              <div className="h-full">
                <List
                  ref={listRef}
                  height={400}
                  itemCount={searchFilteredActivities.length}
                  itemSize={config.itemHeight || (config.compactView ? 80 : 120)}
                  itemData={virtualItemData}
                  overscanCount={10}
                  className="scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
                >
                  {VirtualActivityItem}
                </List>
                
                {/* Load More & Stats */}
                <div className="flex-shrink-0 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center space-x-4">
                      <span>
                        Showing {activityStats.displayed} of {activityStats.total} activit{activityStats.total === 1 ? 'y' : 'ies'}
                      </span>
                      {lastUpdate && (
                        <span>Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}</span>
                      )}
                    </div>
                    
                    {hasMore && (
                      <button
                        onClick={handleLoadMore}
                        disabled={isLoading}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded transition-colors disabled:opacity-50"
                      >
                        <ArrowDown className="w-3 h-3" />
                        <span>Load More</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div 
                ref={feedRef}
                className="h-full overflow-y-auto p-4 space-y-2"
              >
                {searchFilteredActivities.map((activity, index) => (
                  <VirtualActivityItem
                    key={activity.id}
                    index={index}
                    style={{}}
                    data={virtualItemData}
                  />
                ))}
                
                {/* Load More for regular scrolling */}
                {hasMore && (
                  <div className="flex justify-center py-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={isLoading}
                      className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowDown className="w-4 h-4" />
                      )}
                      <span>{isLoading ? 'Loading...' : 'Load More'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </BaseWidget>

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

export default RealTimeActivityFeed