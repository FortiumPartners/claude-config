import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  Filter,
  X,
  Clock,
  User,
  Tag,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Timer,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Settings,
  Zap,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Bookmark,
  BookmarkPlus,
  Layers,
  Target,
  Filter as FilterIcon,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
  BarChart3
} from 'lucide-react'
import { ActivityFilter, ActivityItem } from '../../types/api'
import { clsx } from 'clsx'
import { format, startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns'

interface ActivityFilterPanelProps {
  filter: ActivityFilter
  onFilterChange: (filter: ActivityFilter) => void
  activities: ActivityItem[]
  className?: string
  collapsed?: boolean
  onToggle?: () => void
  showStats?: boolean
  enablePresets?: boolean
  onPresetSave?: (name: string, filter: ActivityFilter) => void
  savedPresets?: Array<{ name: string; filter: ActivityFilter; id: string }>
}

interface FilterOption {
  label: string
  value: string
  count?: number
  color?: string
  trend?: 'up' | 'down' | 'stable'
  percentage?: number
}

interface DateRangePreset {
  label: string
  start: Date
  end: Date
  key: string
}

interface SortOption {
  label: string
  field: 'timestamp' | 'duration' | 'priority' | 'user' | 'status'
  direction: 'asc' | 'desc'
}

const ActivityFilterPanel: React.FC<ActivityFilterPanelProps> = ({
  filter,
  onFilterChange,
  activities,
  className = '',
  collapsed = false,
  onToggle,
  showStats = true,
  enablePresets = false,
  onPresetSave,
  savedPresets = []
}) => {
  const [searchInput, setSearchInput] = useState(filter.search_query || '')
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false)
  const [showDateRange, setShowDateRange] = useState(false)
  const [showPresets, setShowPresets] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>({ field: 'timestamp', direction: 'desc', label: 'Newest First' })
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Enhanced search with suggestions
  const generateSearchSuggestions = useCallback((query: string) => {
    if (!query || query.length < 2) {
      setSearchSuggestions([])
      return
    }

    const suggestions = new Set<string>()
    const lowerQuery = query.toLowerCase()

    activities.forEach(activity => {
      // Add user names that match
      if (activity.user.name.toLowerCase().includes(lowerQuery)) {
        suggestions.add(activity.user.name)
      }
      
      // Add action names that match
      if (activity.action.name.toLowerCase().includes(lowerQuery)) {
        suggestions.add(activity.action.name)
      }
      
      // Add target names that match
      if (activity.target.name.toLowerCase().includes(lowerQuery)) {
        suggestions.add(activity.target.name)
      }
      
      // Add tags that match
      activity.tags?.forEach(tag => {
        if (tag.toLowerCase().includes(lowerQuery)) {
          suggestions.add(`tag:${tag}`)
        }
      })
    })

    setSearchSuggestions(Array.from(suggestions).slice(0, 8))
  }, [activities])

  // Debounced search handler with suggestions
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    generateSearchSuggestions(value)
    setShowSuggestions(true)
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      onFilterChange({ ...filter, search_query: value || undefined })
      setShowSuggestions(false)
    }, 300)
  }, [filter, onFilterChange, generateSearchSuggestions])

  // Handle search suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setSearchInput(suggestion)
    setShowSuggestions(false)
    onFilterChange({ ...filter, search_query: suggestion })
  }, [filter, onFilterChange])

  // Date range presets
  const dateRangePresets: DateRangePreset[] = useMemo(() => [
    {
      label: 'Today',
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
      key: 'today'
    },
    {
      label: 'Yesterday',
      start: startOfDay(subDays(new Date(), 1)),
      end: endOfDay(subDays(new Date(), 1)),
      key: 'yesterday'
    },
    {
      label: 'Last 7 days',
      start: startOfDay(subDays(new Date(), 7)),
      end: endOfDay(new Date()),
      key: 'week'
    },
    {
      label: 'Last 30 days',
      start: startOfDay(subDays(new Date(), 30)),
      end: endOfDay(new Date()),
      key: 'month'
    },
    {
      label: 'Last 3 months',
      start: startOfDay(subMonths(new Date(), 3)),
      end: endOfDay(new Date()),
      key: 'quarter'
    }
  ], [])

  // Sort options
  const sortOptions: SortOption[] = useMemo(() => [
    { field: 'timestamp', direction: 'desc', label: 'Newest First' },
    { field: 'timestamp', direction: 'asc', label: 'Oldest First' },
    { field: 'duration', direction: 'desc', label: 'Longest Duration' },
    { field: 'duration', direction: 'asc', label: 'Shortest Duration' },
    { field: 'priority', direction: 'desc', label: 'Highest Priority' },
    { field: 'priority', direction: 'asc', label: 'Lowest Priority' },
    { field: 'user', direction: 'asc', label: 'User A-Z' },
    { field: 'status', direction: 'asc', label: 'Status A-Z' }
  ], [])

  // Apply date range filter
  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    onFilterChange({
      ...filter,
      date_range: { start, end }
    })
  }, [filter, onFilterChange])

  // Save preset
  const handlePresetSave = useCallback(() => {
    if (!presetName.trim() || !onPresetSave) return
    
    onPresetSave(presetName.trim(), filter)
    setPresetName('')
    setShowPresets(false)
  }, [presetName, filter, onPresetSave])

  // Load preset
  const handlePresetLoad = useCallback((preset: { filter: ActivityFilter }) => {
    onFilterChange(preset.filter)
    setSearchInput(preset.filter.search_query || '')
    setShowPresets(false)
  }, [onFilterChange])

  // Clear search and suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  // Enhanced filter options with trends and statistics
  const filterOptions = useMemo(() => {
    const actionTypes = new Map<string, number>()
    const statusFilters = new Map<string, number>()
    const users = new Map<string, { name: string; count: number; email?: string }>()
    const priorities = new Map<string, number>()
    const tags = new Map<string, number>()

    // Calculate recent trends (last 24 hours vs previous 24 hours)
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const prev24h = new Date(last24h.getTime() - 24 * 60 * 60 * 1000)

    const recentCounts = new Map<string, number>()
    const previousCounts = new Map<string, number>()

    activities.forEach(activity => {
      const activityTime = new Date(activity.timestamp)
      const isRecent = activityTime >= last24h
      const isPrevious = activityTime >= prev24h && activityTime < last24h

      // Action types
      actionTypes.set(activity.action.type, (actionTypes.get(activity.action.type) || 0) + 1)
      if (isRecent) {
        recentCounts.set(`action:${activity.action.type}`, (recentCounts.get(`action:${activity.action.type}`) || 0) + 1)
      }
      if (isPrevious) {
        previousCounts.set(`action:${activity.action.type}`, (previousCounts.get(`action:${activity.action.type}`) || 0) + 1)
      }
      
      // Status filters
      statusFilters.set(activity.status, (statusFilters.get(activity.status) || 0) + 1)
      if (isRecent) {
        recentCounts.set(`status:${activity.status}`, (recentCounts.get(`status:${activity.status}`) || 0) + 1)
      }
      if (isPrevious) {
        previousCounts.set(`status:${activity.status}`, (previousCounts.get(`status:${activity.status}`) || 0) + 1)
      }
      
      // Users
      users.set(activity.user.id, {
        name: activity.user.name,
        email: activity.user.email,
        count: (users.get(activity.user.id)?.count || 0) + 1
      })
      if (isRecent) {
        recentCounts.set(`user:${activity.user.id}`, (recentCounts.get(`user:${activity.user.id}`) || 0) + 1)
      }
      if (isPrevious) {
        previousCounts.set(`user:${activity.user.id}`, (previousCounts.get(`user:${activity.user.id}`) || 0) + 1)
      }
      
      // Priorities
      priorities.set(activity.priority, (priorities.get(activity.priority) || 0) + 1)
      
      // Tags
      activity.tags?.forEach(tag => {
        tags.set(tag, (tags.get(tag) || 0) + 1)
      })
    })

    // Calculate trends
    const getTrend = (key: string): { trend: 'up' | 'down' | 'stable'; percentage: number } => {
      const recent = recentCounts.get(key) || 0
      const previous = previousCounts.get(key) || 0
      
      if (previous === 0) return { trend: recent > 0 ? 'up' : 'stable', percentage: 0 }
      
      const change = ((recent - previous) / previous) * 100
      
      return {
        trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
        percentage: Math.abs(change)
      }
    }

    const totalActivities = activities.length
    
    return {
      actionTypes: Array.from(actionTypes.entries()).map(([value, count]) => {
        const trendData = getTrend(`action:${value}`)
        return {
          label: value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value,
          count,
          percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
          ...trendData
        }
      }).sort((a, b) => b.count - a.count),
      
      statusFilters: Array.from(statusFilters.entries()).map(([value, count]) => {
        const trendData = getTrend(`status:${value}`)
        return {
          label: value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value,
          count,
          percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
          color: value === 'success' ? 'text-green-600' :
                 value === 'error' ? 'text-red-600' :
                 value === 'in_progress' ? 'text-blue-600' :
                 value === 'queued' ? 'text-yellow-600' :
                 'text-gray-600',
          ...trendData
        }
      }).sort((a, b) => b.count - a.count),
      
      users: Array.from(users.entries()).map(([value, { name, email, count }]) => {
        const trendData = getTrend(`user:${value}`)
        return {
          label: name,
          value,
          count,
          percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
          ...trendData
        }
      }).sort((a, b) => b.count - a.count),
      
      priorities: Array.from(priorities.entries()).map(([value, count]) => ({
        label: value.replace(/\b\w/g, l => l.toUpperCase()),
        value,
        count,
        percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0,
        color: value === 'critical' ? 'text-red-600' :
               value === 'high' ? 'text-orange-600' :
               value === 'medium' ? 'text-yellow-600' :
               'text-green-600'
      })).sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 }
        return (order[a.value as keyof typeof order] || 4) - (order[b.value as keyof typeof order] || 4)
      }),
      
      tags: Array.from(tags.entries()).map(([value, count]) => ({
        label: value,
        value,
        count,
        percentage: totalActivities > 0 ? Math.round((count / totalActivities) * 100) : 0
      })).sort((a, b) => b.count - a.count).slice(0, 20) // Limit to top 20 tags
    }
  }, [activities])

  const handleMultiSelectChange = useCallback((
    filterKey: keyof ActivityFilter,
    value: string,
    currentValues: string[] = []
  ) => {
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value]
    
    onFilterChange({
      ...filter,
      [filterKey]: newValues.length > 0 ? newValues : undefined
    })
  }, [filter, onFilterChange])

  const clearFilters = useCallback(() => {
    setSearchInput('')
    onFilterChange({ show_automated: true })
  }, [onFilterChange])

  const hasActiveFilters = useMemo(() => {
    return !!(
      filter.search_query ||
      filter.user_ids?.length ||
      filter.action_types?.length ||
      filter.status_filters?.length ||
      filter.tags?.length ||
      filter.priority_levels?.length ||
      filter.min_duration ||
      filter.max_duration ||
      filter.show_automated === false
    )
  }, [filter])

  const filteredCount = useMemo(() => {
    return activities.filter(activity => {
      if (filter.search_query) {
        const query = filter.search_query.toLowerCase()
        if (!activity.user.name.toLowerCase().includes(query) &&
            !activity.action.name.toLowerCase().includes(query) &&
            !activity.target.name.toLowerCase().includes(query)) {
          return false
        }
      }
      
      if (filter.user_ids?.length && !filter.user_ids.includes(activity.user.id)) return false
      if (filter.action_types?.length && !filter.action_types.includes(activity.action.type)) return false
      if (filter.status_filters?.length && !filter.status_filters.includes(activity.status)) return false
      if (filter.priority_levels?.length && !filter.priority_levels.includes(activity.priority)) return false
      if (filter.show_automated === false && activity.is_automated) return false
      if (filter.min_duration && activity.duration_ms && activity.duration_ms < filter.min_duration) return false
      if (filter.max_duration && activity.duration_ms && activity.duration_ms > filter.max_duration) return false
      
      return true
    }).length
  }, [activities, filter])

  if (collapsed) {
    return (
      <div className={clsx('bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg', className)}>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          aria-label="Expand filters"
        >
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Filters {hasActiveFilters && `(${filteredCount}/${activities.length})`}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </button>
      </div>
    )
  }

  return (
    <div className={clsx('bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Activity Filters</h3>
          {hasActiveFilters && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
              {filteredCount}/{activities.length}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
          {onToggle && (
            <button
              onClick={onToggle}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              aria-label="Collapse filters"
            >
              <ChevronUp className="w-4 h-4 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Enhanced Search with Suggestions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="activity-search" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Search Activities
            </label>
            {showStats && (
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <BarChart3 className="w-3 h-3" />
                <span>{filteredCount} of {activities.length}</span>
              </div>
            )}
          </div>
          <div className="relative" ref={searchInputRef}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="activity-search"
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchInput.length >= 2 && setShowSuggestions(true)}
              placeholder="Search by user, action, target, or tag:value..."
              className="w-full pl-10 pr-10 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="off"
            />
            {searchInput && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {/* Search Suggestions */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 flex items-center space-x-2"
                  >
                    {suggestion.startsWith('tag:') ? (
                      <Tag className="w-3 h-3 text-blue-500" />
                    ) : (
                      <Search className="w-3 h-3 text-slate-400" />
                    )}
                    <span className="text-slate-900 dark:text-white">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* Sort Options */}
              <div className="relative">
                <select
                  value={`${sortBy.field}-${sortBy.direction}`}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split('-') as [SortOption['field'], SortOption['direction']]
                    const option = sortOptions.find(o => o.field === field && o.direction === direction)
                    if (option) setSortBy(option)
                  }}
                  className="text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {sortOptions.map((option) => (
                    <option key={`${option.field}-${option.direction}`} value={`${option.field}-${option.direction}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Toggle */}
              <button
                onClick={() => setShowDateRange(!showDateRange)}
                className={clsx(
                  'inline-flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors',
                  showDateRange || filter.date_range
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
                )}
              >
                <Calendar className="w-3 h-3" />
                <span>Date Range</span>
              </button>
            </div>

            {/* Filter Presets */}
            {enablePresets && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 rounded transition-colors"
                >
                  <Bookmark className="w-3 h-3" />
                  <span>Presets</span>
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={() => setShowPresets(true)}
                    className="p-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                    title="Save current filters as preset"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Date Range Filter */}
        {showDateRange && (
          <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Date Range</label>
              <button
                onClick={() => setShowDateRange(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Close date range"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Date Range Presets */}
            <div className="flex flex-wrap gap-2">
              {dateRangePresets.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handleDateRangeChange(preset.start, preset.end)}
                  className={clsx(
                    'px-2 py-1 text-xs rounded-full border transition-colors',
                    filter.date_range && 
                    filter.date_range.start.getTime() === preset.start.getTime() &&
                    filter.date_range.end.getTime() === preset.end.getTime()
                      ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600 dark:hover:bg-slate-600'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400">From</label>
                <input
                  type="datetime-local"
                  value={filter.date_range?.start ? format(filter.date_range.start, "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => {
                    if (e.target.value && filter.date_range) {
                      handleDateRangeChange(new Date(e.target.value), filter.date_range.end)
                    }
                  }}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400">To</label>
                <input
                  type="datetime-local"
                  value={filter.date_range?.end ? format(filter.date_range.end, "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) => {
                    if (e.target.value && filter.date_range) {
                      handleDateRangeChange(filter.date_range.start, new Date(e.target.value))
                    }
                  }}
                  className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {filter.date_range && (
              <button
                onClick={() => onFilterChange({ ...filter, date_range: undefined })}
                className="flex items-center space-x-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Clear Date Range</span>
              </button>
            )}
          </div>
        )}

        {/* Filter Presets */}
        {showPresets && enablePresets && (
          <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter Presets</label>
              <button
                onClick={() => setShowPresets(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Close presets"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Save Current Filter */}
            {hasActiveFilters && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Enter preset name..."
                  className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handlePresetSave}
                  disabled={!presetName.trim()}
                  className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3 h-3" />
                  <span>Save Preset</span>
                </button>
              </div>
            )}

            {/* Saved Presets */}
            {savedPresets.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs text-slate-600 dark:text-slate-400">Saved Presets</label>
                {savedPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetLoad(preset)}
                    className="w-full flex items-center justify-between p-2 text-left text-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    <span className="text-slate-900 dark:text-white">{preset.name}</span>
                    <Bookmark className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Enhanced Quick Filters */}
        <div className="grid grid-cols-2 gap-4">
          {/* Status Filter with Trends */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {filterOptions.statusFilters.map((option) => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filter.status_filters?.includes(option.value) || false}
                    onChange={() => handleMultiSelectChange('status_filters', option.value, filter.status_filters)}
                    className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-between flex-1">
                    <div className="flex items-center space-x-1">
                      <span className={clsx('text-sm', option.color || 'text-slate-700 dark:text-slate-300')}>
                        {option.label}
                      </span>
                      <span className="text-xs text-slate-500">({option.count})</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {showStats && option.percentage !== undefined && (
                        <span className="text-xs text-slate-400">{option.percentage}%</span>
                      )}
                      {option.trend && option.trend !== 'stable' && (
                        <div className={clsx(
                          'flex items-center space-x-1',
                          option.trend === 'up' ? 'text-green-500' : 'text-red-500'
                        )}>
                          {option.trend === 'up' ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {option.percentage && (
                            <span className="text-xs">{option.percentage.toFixed(0)}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Action Type Filter with Trends */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Action Type</label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {filterOptions.actionTypes.map((option) => (
                <label key={option.value} className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={filter.action_types?.includes(option.value) || false}
                    onChange={() => handleMultiSelectChange('action_types', option.value, filter.action_types)}
                    className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-between flex-1">
                    <div className="flex items-center space-x-1">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{option.label}</span>
                      <span className="text-xs text-slate-500">({option.count})</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {showStats && option.percentage !== undefined && (
                        <span className="text-xs text-slate-400">{option.percentage}%</span>
                      )}
                      {option.trend && option.trend !== 'stable' && (
                        <div className={clsx(
                          'flex items-center space-x-1',
                          option.trend === 'up' ? 'text-green-500' : 'text-red-500'
                        )}>
                          {option.trend === 'up' ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {option.percentage && (
                            <span className="text-xs">{option.percentage.toFixed(0)}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div>
          <button
            onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
            className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Filters</span>
            {isAdvancedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Advanced Filters */}
        {isAdvancedExpanded && (
          <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            {/* Enhanced Users Filter with Trends */}
            {filterOptions.users.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Users</label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {filterOptions.users.map((option) => (
                    <label key={option.value} className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={filter.user_ids?.includes(option.value) || false}
                        onChange={() => handleMultiSelectChange('user_ids', option.value, filter.user_ids)}
                        className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center justify-between flex-1">
                        <div className="flex items-center space-x-2">
                          <User className="w-3 h-3 text-slate-400" />
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-700 dark:text-slate-300">{option.label}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500">({option.count})</span>
                          {showStats && option.percentage !== undefined && (
                            <span className="text-xs text-slate-400">{option.percentage}%</span>
                          )}
                          {option.trend && option.trend !== 'stable' && (
                            <div className={clsx(
                              'flex items-center space-x-1',
                              option.trend === 'up' ? 'text-green-500' : 'text-red-500'
                            )}>
                              {option.trend === 'up' ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {option.percentage && (
                                <span className="text-xs">{option.percentage.toFixed(0)}%</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Priority Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Priority</label>
              <div className="space-y-1">
                {filterOptions.priorities.map((option) => (
                  <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.priority_levels?.includes(option.value) || false}
                      onChange={() => handleMultiSelectChange('priority_levels', option.value, filter.priority_levels)}
                      className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex items-center space-x-1 flex-1">
                      <span className={clsx('text-sm', option.color || 'text-slate-700 dark:text-slate-300')}>
                        {option.label}
                      </span>
                      <span className="text-xs text-slate-500">({option.count})</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Duration Range */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Duration Range (ms)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number"
                    placeholder="Min duration"
                    value={filter.min_duration || ''}
                    onChange={(e) => onFilterChange({
                      ...filter,
                      min_duration: e.target.value ? parseInt(e.target.value, 10) : undefined
                    })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Max duration"
                    value={filter.max_duration || ''}
                    onChange={(e) => onFilterChange({
                      ...filter,
                      max_duration: e.target.value ? parseInt(e.target.value, 10) : undefined
                    })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Show Automated Toggle */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="show-automated"
                checked={filter.show_automated !== false}
                onChange={(e) => onFilterChange({
                  ...filter,
                  show_automated: e.target.checked ? true : false
                })}
                className="w-4 h-4 text-blue-600 border-slate-300 dark:border-slate-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="show-automated" className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300">
                <Zap className="w-4 h-4" />
                <span>Show automated activities</span>
              </label>
            </div>

            {/* Tags Filter */}
            {filterOptions.tags.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tags</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {filterOptions.tags.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleMultiSelectChange('tags', option.value, filter.tags)}
                      className={clsx(
                        'inline-flex items-center space-x-1 px-2 py-1 text-xs rounded-full border transition-colors',
                        filter.tags?.includes(option.value)
                          ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600'
                      )}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{option.label}</span>
                      <span className="text-slate-500">({option.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityFilterPanel