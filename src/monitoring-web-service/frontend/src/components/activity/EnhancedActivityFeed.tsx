/**
 * Enhanced Activity Feed Component - TRD-007
 * Virtualized activity feed for high performance with 1000+ items
 * Uses react-window for efficient rendering and real-time updates
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { VariableSizeList as List, ListChildComponentProps } from 'react-window'
import {
  Search,
  Filter,
  RefreshCw,
  Settings,
  Activity,
  Clock,
  Users,
  AlertCircle,
  ChevronDown,
  X,
  Loader2,
  WifiOff,
  Zap,
  Eye,
  EyeOff
} from 'lucide-react'
import { clsx } from 'clsx'
import { useActivityStream } from '../../hooks/useActivityStream'
import { ActivityItem as ActivityItemType, ActivityFilter } from '../../types/api'
import ActivityItem from './ActivityItem'
import ActivityDetailModal from './ActivityDetailModal'

interface EnhancedActivityFeedProps {
  /** Feed configuration */
  className?: string
  height?: number
  /** Real-time configuration */
  realTimeEnabled?: boolean
  autoRefresh?: boolean
  /** UI configuration */
  showFilters?: boolean
  showHeader?: boolean
  showStats?: boolean
  compact?: boolean
  /** Performance configuration */
  initialLoadSize?: number
  maxCacheSize?: number
  virtualizationEnabled?: boolean
  /** Event handlers */
  onActivityClick?: (activity: ActivityItemType) => void
  onActivitySelect?: (activities: ActivityItemType[]) => void
  onError?: (error: Error) => void
}

interface FilterPanelState {
  isOpen: boolean
  searchQuery: string
  selectedUsers: string[]
  selectedStatuses: string[]
  selectedPriorities: string[]
  showAutomated: boolean
  dateRange?: { start: Date; end: Date }
}

const DEFAULT_ITEM_HEIGHT = 120
const COMPACT_ITEM_HEIGHT = 80
const EXPANDED_ITEM_HEIGHT = 240

const EnhancedActivityFeed: React.FC<EnhancedActivityFeedProps> = ({
  className,
  height = 600,
  realTimeEnabled = true,
  autoRefresh = false,
  showFilters = true,
  showHeader = true,
  showStats = true,
  compact = false,
  initialLoadSize = 50,
  maxCacheSize = 1000,
  virtualizationEnabled = true,
  onActivityClick,
  onActivitySelect,
  onError
}) => {
  // Activity stream hook with optimized configuration
  const {
    activities,
    filteredActivities,
    isLoading,
    isConnected,
    hasMore,
    error,
    updateCount,
    lastUpdate,
    totalCount,
    refresh,
    loadMore,
    applyFilters,
    clearFilters,
    getVirtualizedItems
  } = useActivityStream({
    realTimeEnabled,
    initialLoadSize,
    maxCacheSize,
    enableVirtualization: virtualizationEnabled,
    autoRefreshInterval: autoRefresh ? 30000 : 0, // 30 seconds if enabled
    onError
  })

  // Component state
  const [selectedActivity, setSelectedActivity] = useState<ActivityItemType | null>(null)
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [filterPanel, setFilterPanel] = useState<FilterPanelState>({
    isOpen: false,
    searchQuery: '',
    selectedUsers: [],
    selectedStatuses: [],
    selectedPriorities: [],
    showAutomated: true,
    dateRange: undefined
  })

  // Refs for virtualization
  const listRef = useRef<List>(null)
  const itemHeightsRef = useRef<Map<string, number>>(new Map())

  // Calculate item height based on expansion state and content
  const getItemHeight = useCallback((index: number) => {
    const activity = filteredActivities[index]
    if (!activity) return compact ? COMPACT_ITEM_HEIGHT : DEFAULT_ITEM_HEIGHT

    // Check if item is expanded
    const isExpanded = expandedItems.has(activity.id)

    // Base height
    let height = compact ? COMPACT_ITEM_HEIGHT : DEFAULT_ITEM_HEIGHT

    // Add height for expanded content
    if (isExpanded) {
      height = EXPANDED_ITEM_HEIGHT

      // Add extra height for error details, artifacts, etc.
      if (activity.error_details) height += 80
      if (activity.artifacts && activity.artifacts.length > 0) height += activity.artifacts.length * 40
      if (activity.tags && activity.tags.length > 0) height += 30
    }

    // Cache the calculated height
    itemHeightsRef.current.set(activity.id, height)
    return height
  }, [filteredActivities, expandedItems, compact])

  // Reset item heights when data changes
  useEffect(() => {
    itemHeightsRef.current.clear()
    if (listRef.current) {
      listRef.current.resetAfterIndex(0)
    }
  }, [filteredActivities])

  // Handle activity click
  const handleActivityClick = useCallback((activity: ActivityItemType) => {
    if (onActivityClick) {
      onActivityClick(activity)
    } else {
      setSelectedActivity(activity)
    }
  }, [onActivityClick])

  // Handle activity selection (for bulk operations)
  const handleActivitySelect = useCallback((activity: ActivityItemType, selected: boolean) => {
    setSelectedActivities(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(activity.id)
      } else {
        newSet.delete(activity.id)
      }

      // Notify parent component
      if (onActivitySelect) {
        const selectedItems = filteredActivities.filter(a => newSet.has(a.id))
        onActivitySelect(selectedItems)
      }

      return newSet
    })
  }, [filteredActivities, onActivitySelect])

  // Handle item expansion toggle
  const handleToggleExpanded = useCallback((activityId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(activityId)) {
        newSet.delete(activityId)
      } else {
        newSet.add(activityId)
      }
      return newSet
    })

    // Trigger height recalculation
    setTimeout(() => {
      if (listRef.current) {
        const index = filteredActivities.findIndex(a => a.id === activityId)
        if (index >= 0) {
          listRef.current.resetAfterIndex(index)
        }
      }
    }, 0)
  }, [filteredActivities])

  // Apply filters to the activity stream
  const applyCurrentFilters = useCallback(() => {
    const filters: Partial<ActivityFilter> = {}

    if (filterPanel.searchQuery) {
      filters.search_query = filterPanel.searchQuery
    }

    if (filterPanel.selectedUsers.length > 0) {
      filters.user_ids = filterPanel.selectedUsers
    }

    if (filterPanel.selectedStatuses.length > 0) {
      filters.status_filters = filterPanel.selectedStatuses as any
    }

    if (filterPanel.selectedPriorities.length > 0) {
      filters.priority_levels = filterPanel.selectedPriorities as any
    }

    if (!filterPanel.showAutomated) {
      filters.show_automated = false
    }

    if (filterPanel.dateRange) {
      filters.date_range = filterPanel.dateRange
    }

    applyFilters(filters)
  }, [filterPanel, applyFilters])

  // Apply filters when filter panel state changes
  useEffect(() => {
    applyCurrentFilters()
  }, [applyCurrentFilters])

  // Extract unique values for filter options
  const filterOptions = useMemo(() => {
    const users = Array.from(new Set(activities.map(a => a.user.name)))
      .map(name => {
        const user = activities.find(a => a.user.name === name)?.user
        return { id: user?.id || name, name }
      })

    const statuses = Array.from(new Set(activities.map(a => a.status)))
    const priorities = Array.from(new Set(activities.map(a => a.priority)))

    return { users, statuses, priorities }
  }, [activities])

  // Statistics
  const stats = useMemo(() => {
    const total = filteredActivities.length
    const successful = filteredActivities.filter(a => a.status === 'success').length
    const failed = filteredActivities.filter(a => a.status === 'error').length
    const automated = filteredActivities.filter(a => a.is_automated).length
    const recentCount = filteredActivities.filter(a => {
      const timestamp = new Date(a.timestamp)
      return Date.now() - timestamp.getTime() < 60000 // Last minute
    }).length

    return { total, successful, failed, automated, recentCount }
  }, [filteredActivities])

  // Virtualized row renderer
  const Row: React.FC<ListChildComponentProps> = ({ index, style }) => {
    const activity = filteredActivities[index]
    if (!activity) return null

    const isSelected = selectedActivities.has(activity.id)
    const isExpanded = expandedItems.has(activity.id)

    return (
      <div style={style}>
        <div className="px-2 py-1">
          <ActivityItem
            activity={activity}
            compact={compact}
            clickable={true}
            onActivityClick={handleActivityClick}
            className={clsx(
              isSelected && 'ring-2 ring-blue-500',
              'transition-all duration-200'
            )}
          />

          {/* Expansion toggle for detailed view */}
          {!compact && (
            <div className="flex items-center justify-between mt-2 px-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleExpanded(activity.id)
                }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center space-x-1"
              >
                <ChevronDown className={clsx('w-3 h-3 transition-transform', isExpanded && 'rotate-180')} />
                <span>{isExpanded ? 'Less' : 'More'} details</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleActivitySelect(activity, !isSelected)
                  }}
                  className={clsx(
                    'w-4 h-4 rounded border-2 transition-colors',
                    isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-slate-300 dark:border-slate-600 hover:border-blue-400'
                  )}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700', className)}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Activity Feed</h2>

            {/* Connection status */}
            <div className="flex items-center space-x-1">
              {realTimeEnabled && (
                <>
                  {isConnected ? (
                    <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs">Live</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1 text-slate-500">
                      <WifiOff className="w-3 h-3" />
                      <span className="text-xs">Offline</span>
                    </div>
                  )}
                </>
              )}

              {updateCount > 0 && (
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                  {updateCount} updates
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick filter toggles */}
            <button
              onClick={() => setFilterPanel(prev => ({ ...prev, showAutomated: !prev.showAutomated }))}
              className={clsx(
                'p-2 rounded-lg transition-colors text-xs flex items-center space-x-1',
                filterPanel.showAutomated
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
              title={filterPanel.showAutomated ? 'Hide automated activities' : 'Show automated activities'}
            >
              {filterPanel.showAutomated ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <Zap className="w-3 h-3" />
            </button>

            {/* Filter toggle */}
            {showFilters && (
              <button
                onClick={() => setFilterPanel(prev => ({ ...prev, isOpen: !prev.isOpen }))}
                className={clsx(
                  'p-2 rounded-lg transition-colors',
                  filterPanel.isOpen
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <Filter className="w-4 h-4" />
              </button>
            )}

            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      )}

      {/* Statistics */}
      {showStats && (
        <div className="grid grid-cols-5 gap-4 p-4 bg-slate-50 dark:bg-slate-700/50">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">{stats.successful}</div>
            <div className="text-xs text-slate-500">Success</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">{stats.failed}</div>
            <div className="text-xs text-slate-500">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600">{stats.automated}</div>
            <div className="text-xs text-slate-500">Automated</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-600">{stats.recentCount}</div>
            <div className="text-xs text-slate-500">Recent</div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && filterPanel.isOpen && (
        <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-700/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={filterPanel.searchQuery}
                  onChange={(e) => setFilterPanel(prev => ({ ...prev, searchQuery: e.target.value }))}
                  placeholder="Search activities..."
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
              <select
                multiple
                value={filterPanel.selectedStatuses}
                onChange={(e) => setFilterPanel(prev => ({
                  ...prev,
                  selectedStatuses: Array.from(e.target.selectedOptions, option => option.value)
                }))}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-white"
                size={3}
              >
                {filterOptions.statuses.map(status => (
                  <option key={status} value={status} className="py-1">
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Priority</label>
              <select
                multiple
                value={filterPanel.selectedPriorities}
                onChange={(e) => setFilterPanel(prev => ({
                  ...prev,
                  selectedPriorities: Array.from(e.target.selectedOptions, option => option.value)
                }))}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-white"
                size={3}
              >
                {filterOptions.priorities.map(priority => (
                  <option key={priority} value={priority} className="py-1">
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {filteredActivities.length} of {activities.length} activities
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setFilterPanel({
                    isOpen: false,
                    searchQuery: '',
                    selectedUsers: [],
                    selectedStatuses: [],
                    selectedPriorities: [],
                    showAutomated: true,
                    dateRange: undefined
                  })
                  clearFilters()
                }}
                className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Clear All
              </button>
              <button
                onClick={() => setFilterPanel(prev => ({ ...prev, isOpen: false }))}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Failed to load activities</p>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
              <button
                onClick={refresh}
                className="mt-2 text-sm text-red-700 dark:text-red-300 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity List */}
      <div className="flex-1 relative">
        {isLoading && filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading activities...</span>
            </div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No activities found</p>
              {Object.keys(filterPanel).some(key =>
                key !== 'isOpen' && filterPanel[key as keyof FilterPanelState] &&
                (Array.isArray(filterPanel[key as keyof FilterPanelState])
                  ? (filterPanel[key as keyof FilterPanelState] as any[]).length > 0
                  : filterPanel[key as keyof FilterPanelState] !== true)
              ) && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : virtualizationEnabled ? (
          <List
            ref={listRef}
            height={height - (showHeader ? 64 : 0) - (showStats ? 80 : 0) - (filterPanel.isOpen ? 200 : 0)}
            itemCount={filteredActivities.length}
            itemSize={getItemHeight}
            className="scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
            onItemsRendered={({ visibleStopIndex }) => {
              // Load more items when approaching the end
              if (hasMore && !isLoading && visibleStopIndex >= filteredActivities.length - 10) {
                loadMore()
              }
            }}
          >
            {Row}
          </List>
        ) : (
          <div className="overflow-y-auto" style={{ height: height - (showHeader ? 64 : 0) - (showStats ? 80 : 0) - (filterPanel.isOpen ? 200 : 0) }}>
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="px-2 py-1">
                <ActivityItem
                  activity={activity}
                  compact={compact}
                  clickable={true}
                  onActivityClick={handleActivityClick}
                  className={clsx(
                    selectedActivities.has(activity.id) && 'ring-2 ring-blue-500',
                    'transition-all duration-200'
                  )}
                />
              </div>
            ))}

            {/* Load more button for non-virtualized mode */}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected items indicator */}
      {selectedActivities.size > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700 dark:text-blue-300">
              {selectedActivities.size} activities selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setSelectedActivities(new Set())
                  if (onActivitySelect) onActivitySelect([])
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        onRefresh={() => {
          if (selectedActivity) {
            refresh()
          }
        }}
      />
    </div>
  )
}

export default EnhancedActivityFeed