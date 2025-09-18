import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useCurrentTenant } from '../contexts/TenantContext'
import { activitiesApi } from '../services/api'
import { ActivityItem, ActivityFilter } from '../types/api'

export interface ActivityStreamConfig {
  // WebSocket configuration
  realTimeEnabled?: boolean
  subscriptions?: string[]
  
  // Data fetching configuration
  initialLoadSize?: number
  maxCacheSize?: number
  autoRefreshInterval?: number
  
  // Performance configuration
  debounceMs?: number
  bufferSize?: number
  enableVirtualization?: boolean
  
  // Filtering configuration
  defaultFilters?: Partial<ActivityFilter>
  
  // Callback configuration
  onActivityReceived?: (activity: ActivityItem) => void
  onError?: (error: Error) => void
  onConnectionChange?: (connected: boolean) => void
}

export interface ActivityStreamState {
  activities: ActivityItem[]
  filteredActivities: ActivityItem[]
  isLoading: boolean
  isConnected: boolean
  hasMore: boolean
  error: string | null
  updateCount: number
  lastUpdate: Date | null
  totalCount: number
}

export interface ActivityStreamActions {
  // Data management
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  clearCache: () => void
  
  // Filtering
  applyFilters: (filters: Partial<ActivityFilter>) => void
  clearFilters: () => void
  
  // Real-time subscription management
  subscribe: (rooms: string[]) => void
  unsubscribe: (rooms: string[]) => void
  
  // Activity management
  getActivity: (id: string) => ActivityItem | undefined
  markActivityAsRead: (id: string) => void
  
  // Performance utilities
  getVirtualizedItems: (startIndex: number, endIndex: number) => ActivityItem[]
}

const DEFAULT_CONFIG: Required<ActivityStreamConfig> = {
  realTimeEnabled: true,
  subscriptions: ['activities', 'tool-metrics', 'user-activity'],
  initialLoadSize: 50,
  maxCacheSize: 500,
  autoRefreshInterval: 0, // Disabled by default for real-time
  debounceMs: 300,
  bufferSize: 10,
  enableVirtualization: true,
  defaultFilters: { show_automated: true },
  onActivityReceived: () => {},
  onError: () => {},
  onConnectionChange: () => {},
}

/**
 * Enhanced hook for managing real-time activity streams with optimal performance
 */
export const useActivityStream = (
  config: ActivityStreamConfig = {}
): ActivityStreamState & ActivityStreamActions => {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config])
  
  const { isConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe } = useWebSocket()
  const currentTenant = useCurrentTenant()
  
  // State management
  const [state, setState] = useState<ActivityStreamState>({
    activities: [],
    filteredActivities: [],
    isLoading: false,
    isConnected: false,
    hasMore: true,
    error: null,
    updateCount: 0,
    lastUpdate: null,
    totalCount: 0,
  })
  
  // Refs for performance optimization
  const activitiesRef = useRef<ActivityItem[]>([])
  const filtersRef = useRef<Partial<ActivityFilter>>(mergedConfig.defaultFilters)
  const subscriptionsRef = useRef<string[]>([])
  const loadingRef = useRef<boolean>(false)
  const bufferRef = useRef<ActivityItem[]>([])
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Connection state sync
  useEffect(() => {
    setState(prev => ({ ...prev, isConnected }))
    mergedConfig.onConnectionChange(isConnected)
  }, [isConnected, mergedConfig])

  // Debounced filter application
  const applyFiltersDebounced = useCallback((filters: Partial<ActivityFilter>) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      filtersRef.current = { ...filtersRef.current, ...filters }
      
      const filteredActivities = activitiesRef.current.filter(activity => {
        // Apply search query filter
        if (filtersRef.current.search_query) {
          const query = filtersRef.current.search_query.toLowerCase()
          if (
            !activity.user.name.toLowerCase().includes(query) &&
            !activity.action.name.toLowerCase().includes(query) &&
            !activity.target.name.toLowerCase().includes(query) &&
            !(activity.action.description?.toLowerCase().includes(query))
          ) {
            return false
          }
        }
        
        // Apply user filter
        if (filtersRef.current.user_ids?.length && 
            !filtersRef.current.user_ids.includes(activity.user.id)) {
          return false
        }
        
        // Apply action type filter
        if (filtersRef.current.action_types?.length && 
            !filtersRef.current.action_types.includes(activity.action.type)) {
          return false
        }
        
        // Apply status filter
        if (filtersRef.current.status_filters?.length && 
            !filtersRef.current.status_filters.includes(activity.status)) {
          return false
        }
        
        // Apply priority filter
        if (filtersRef.current.priority_levels?.length && 
            !filtersRef.current.priority_levels.includes(activity.priority)) {
          return false
        }
        
        // Apply automated filter
        if (filtersRef.current.show_automated === false && activity.is_automated) {
          return false
        }
        
        // Apply duration filters
        if (filtersRef.current.min_duration && activity.duration_ms && 
            activity.duration_ms < filtersRef.current.min_duration) {
          return false
        }
        
        if (filtersRef.current.max_duration && activity.duration_ms && 
            activity.duration_ms > filtersRef.current.max_duration) {
          return false
        }
        
        // Apply date range filter
        if (filtersRef.current.date_range) {
          const activityDate = new Date(activity.timestamp)
          if (activityDate < filtersRef.current.date_range.start || 
              activityDate > filtersRef.current.date_range.end) {
            return false
          }
        }
        
        // Apply tags filter
        if (filtersRef.current.tags?.length && activity.tags) {
          const hasMatchingTag = filtersRef.current.tags.some(tag => 
            activity.tags?.includes(tag)
          )
          if (!hasMatchingTag) {
            return false
          }
        }
        
        return true
      })
      
      setState(prev => ({
        ...prev,
        filteredActivities,
        totalCount: filteredActivities.length,
      }))
    }, mergedConfig.debounceMs)
  }, [mergedConfig.debounceMs])

  // Initial data loading
  const loadInitialData = useCallback(async () => {
    if (loadingRef.current) return
    
    loadingRef.current = true
    setState(prev => ({ ...prev, isLoading: true, error: null }))
    
    try {
      const response = await activitiesApi.list({
        limit: mergedConfig.initialLoadSize,
        sort: 'timestamp',
        order: 'desc',
        ...filtersRef.current,
      })
      
      const activities = response.data.data
      activitiesRef.current = activities
      
      setState(prev => ({
        ...prev,
        activities,
        filteredActivities: activities,
        totalCount: response.data.pagination.total,
        hasMore: response.data.pagination.has_next,
        lastUpdate: new Date(),
        isLoading: false,
      }))
      
      // Apply initial filters
      applyFiltersDebounced({})
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load activities'
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }))
      mergedConfig.onError(new Error(errorMessage))
    } finally {
      loadingRef.current = false
    }
  }, [mergedConfig.initialLoadSize, mergedConfig.onError, applyFiltersDebounced])

  // Load more activities for pagination
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !state.hasMore) return
    
    loadingRef.current = true
    
    try {
      const response = await activitiesApi.list({
        limit: 25,
        offset: activitiesRef.current.length,
        sort: 'timestamp',
        order: 'desc',
        ...filtersRef.current,
      })
      
      const newActivities = response.data.data
      const allActivities = [...activitiesRef.current, ...newActivities]
      
      // Respect cache size limit
      if (allActivities.length > mergedConfig.maxCacheSize) {
        allActivities.splice(mergedConfig.maxCacheSize)
      }
      
      activitiesRef.current = allActivities
      
      setState(prev => ({
        ...prev,
        activities: allActivities,
        hasMore: response.data.pagination.has_next && allActivities.length < mergedConfig.maxCacheSize,
      }))
      
      // Reapply filters
      applyFiltersDebounced({})
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load more activities'
      setState(prev => ({ ...prev, error: errorMessage }))
      mergedConfig.onError(new Error(errorMessage))
    } finally {
      loadingRef.current = false
    }
  }, [state.hasMore, mergedConfig.maxCacheSize, mergedConfig.onError, applyFiltersDebounced])

  // Process incoming real-time activities
  const processRealTimeActivity = useCallback((activity: ActivityItem) => {
    // Add to buffer for batch processing
    bufferRef.current.push(activity)
    
    // Process buffer when it reaches the configured size
    if (bufferRef.current.length >= mergedConfig.bufferSize) {
      const activitiesToProcess = [...bufferRef.current]
      bufferRef.current = []
      
      // Add new activities to the front of the list
      const updatedActivities = [...activitiesToProcess, ...activitiesRef.current]
      
      // Respect cache size limit
      if (updatedActivities.length > mergedConfig.maxCacheSize) {
        updatedActivities.splice(mergedConfig.maxCacheSize)
      }
      
      activitiesRef.current = updatedActivities
      
      setState(prev => ({
        ...prev,
        activities: updatedActivities,
        updateCount: prev.updateCount + activitiesToProcess.length,
        lastUpdate: new Date(),
      }))
      
      // Reapply filters
      applyFiltersDebounced({})
      
      // Call activity received callback
      activitiesToProcess.forEach(mergedConfig.onActivityReceived)
    }
  }, [mergedConfig.bufferSize, mergedConfig.maxCacheSize, mergedConfig.onActivityReceived, applyFiltersDebounced])

  // WebSocket event handling
  useEffect(() => {
    if (!mergedConfig.realTimeEnabled || !isConnected) return
    
    const handleActivityEvent = (event: CustomEvent) => {
      const { data } = event.detail
      
      // Handle metric_ingested events from Claude Code tools
      if (event.type === 'metric_ingested') {
        const activity: ActivityItem = {
          id: `${data.tool_name}-${Date.now()}-${Math.random()}`,
          user: {
            id: data.user_id || 'unknown',
            name: data.user_name || 'Unknown User',
            email: data.user_email || 'unknown@example.com',
            avatar_url: data.user_avatar,
          },
          action: {
            type: 'tool_usage',
            name: `${data.tool_name} Tool`,
            description: `Executed ${data.tool_name} tool`,
            category: 'command_execution',
          },
          target: {
            name: data.file_path || data.command || `Session: ${data.session_id}`,
            type: 'command',
            metadata: data,
          },
          status: data.success ? 'success' : 'error',
          timestamp: new Date(data.timestamp || Date.now()),
          duration_ms: data.execution_time_ms,
          execution_context: {
            session_id: data.session_id,
          },
          metrics: {
            input_tokens: data.input_tokens,
            output_tokens: data.output_tokens,
            memory_usage: data.memory_usage,
          },
          error_details: !data.success && data.error_message ? {
            message: data.error_message,
            recovery_suggestions: [],
          } : undefined,
          tags: data.tags || [],
          priority: 'medium',
          is_automated: true,
        }
        
        processRealTimeActivity(activity)
      }
      
      // Handle direct activity stream events
      if (event.type === 'activity_stream' && data.activity) {
        processRealTimeActivity(data.activity)
      }
    }
    
    // Register event listeners
    window.addEventListener('metric_ingested', handleActivityEvent)
    window.addEventListener('activity_stream', handleActivityEvent)
    window.addEventListener('dashboard_update', handleActivityEvent)
    
    return () => {
      window.removeEventListener('metric_ingested', handleActivityEvent)
      window.removeEventListener('activity_stream', handleActivityEvent)
      window.removeEventListener('dashboard_update', handleActivityEvent)
    }
  }, [mergedConfig.realTimeEnabled, isConnected, processRealTimeActivity])

  // WebSocket subscription management
  const subscribe = useCallback((rooms: string[]) => {
    if (!isConnected) {
      subscriptionsRef.current = rooms
      return
    }
    
    const tenantRooms = rooms.map(room => 
      currentTenant?.id ? `${currentTenant.id}:${room}` : room
    )
    
    wsSubscribe(tenantRooms)
    subscriptionsRef.current = rooms
  }, [isConnected, currentTenant?.id, wsSubscribe])

  const unsubscribe = useCallback((rooms: string[]) => {
    if (!isConnected) return
    
    const tenantRooms = rooms.map(room => 
      currentTenant?.id ? `${currentTenant.id}:${room}` : room
    )
    
    wsUnsubscribe(tenantRooms)
    subscriptionsRef.current = subscriptionsRef.current.filter(room => !rooms.includes(room))
  }, [isConnected, currentTenant?.id, wsUnsubscribe])

  // Auto-subscription to default rooms
  useEffect(() => {
    if (isConnected && mergedConfig.subscriptions.length > 0) {
      subscribe(mergedConfig.subscriptions)
    }
  }, [isConnected, mergedConfig.subscriptions, subscribe])

  // Auto-refresh interval setup
  useEffect(() => {
    if (mergedConfig.autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        if (!loadingRef.current) {
          loadInitialData()
        }
      }, mergedConfig.autoRefreshInterval)
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [mergedConfig.autoRefreshInterval, loadInitialData])

  // Initial data load
  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  // Action implementations
  const refresh = useCallback(async () => {
    await loadInitialData()
  }, [loadInitialData])

  const clearCache = useCallback(() => {
    activitiesRef.current = []
    bufferRef.current = []
    setState(prev => ({
      ...prev,
      activities: [],
      filteredActivities: [],
      updateCount: 0,
      hasMore: true,
      error: null,
    }))
  }, [])

  const applyFilters = useCallback((filters: Partial<ActivityFilter>) => {
    applyFiltersDebounced(filters)
  }, [applyFiltersDebounced])

  const clearFilters = useCallback(() => {
    filtersRef.current = mergedConfig.defaultFilters
    applyFiltersDebounced({})
  }, [mergedConfig.defaultFilters, applyFiltersDebounced])

  const getActivity = useCallback((id: string): ActivityItem | undefined => {
    return activitiesRef.current.find(activity => activity.id === id)
  }, [])

  const markActivityAsRead = useCallback((id: string) => {
    // This could trigger an API call to mark as read
    // For now, just update local state if needed
    console.log('Mark activity as read:', id)
  }, [])

  const getVirtualizedItems = useCallback((startIndex: number, endIndex: number): ActivityItem[] => {
    return state.filteredActivities.slice(startIndex, Math.min(endIndex + 1, state.filteredActivities.length))
  }, [state.filteredActivities])

  return {
    // State
    ...state,
    
    // Actions
    refresh,
    loadMore,
    clearCache,
    applyFilters,
    clearFilters,
    subscribe,
    unsubscribe,
    getActivity,
    markActivityAsRead,
    getVirtualizedItems,
  }
}

export default useActivityStream