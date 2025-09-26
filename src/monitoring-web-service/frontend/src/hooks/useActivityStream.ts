import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { useCurrentTenant } from '../contexts/TenantContext';
import { activitiesApi } from '../services/api';
import { ActivityItem, ActivityFilter } from '../types/api';

export interface ActivityStreamConfig {
  // WebSocket configuration
  realTimeEnabled?: boolean;
  subscriptions?: string[];

  // Data fetching configuration
  initialLoadSize?: number;
  maxCacheSize?: number;
  autoRefreshInterval?: number;

  // Performance configuration
  debounceMs?: number;
  bufferSize?: number;
  enableVirtualization?: boolean;

  // Rate limiting configuration
  maxEventsPerSecond?: number;
  maxEventsPerSession?: number;
  autoDisconnectAfter?: number; // seconds
  throttleMs?: number;

  // Filtering configuration
  defaultFilters?: Partial<ActivityFilter>;

  // Callback configuration
  onActivityReceived?: (activity: ActivityItem) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (connected: boolean) => void;
  onRateLimitReached?: () => void;
}

export interface ActivityStreamState {
  activities: ActivityItem[];
  filteredActivities: ActivityItem[];
  isLoading: boolean;
  isConnected: boolean;
  hasMore: boolean;
  error: string | null;
  updateCount: number;
  lastUpdate: string | null;
  totalCount: number;
}

export interface ActivityStreamActions {
  // Data management
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  clearCache: () => void;

  // Filtering
  applyFilters: (filters: Partial<ActivityFilter>) => void;
  clearFilters: () => void;

  // Real-time subscription management
  subscribe: (rooms: string[]) => void;
  unsubscribe: (rooms: string[]) => void;

  // Activity management
  getActivity: (id: string) => ActivityItem | undefined;
  markActivityAsRead: (id: string) => void;

  // Performance utilities
  getVirtualizedItems: (startIndex: number, endIndex: number) => ActivityItem[];
}

const DEFAULT_CONFIG: Required<ActivityStreamConfig> = {
  realTimeEnabled: true,
  subscriptions: ['activities', 'tool-metrics', 'user-activity'],
  initialLoadSize: 50,
  maxCacheSize: 200, // Reduced from 500 to prevent overflow
  autoRefreshInterval: 0, // Disabled by default for real-time
  debounceMs: 500, // Increased debounce
  bufferSize: 3, // Smaller buffer for more controlled processing
  enableVirtualization: true,
  // Rate limiting configuration
  maxEventsPerSecond: 5, // Limit to 5 events per second
  maxEventsPerSession: 5, // Auto-disconnect after 50 events
  autoDisconnectAfter: 120, // Auto-disconnect after 2 minutes
  throttleMs: 200, // Throttle rapid successive events
  defaultFilters: { show_automated: true },
  onActivityReceived: () => {},
  onError: () => {},
  onConnectionChange: () => {},
  onRateLimitReached: () => {},
};

/**
 * Enhanced hook for managing real-time activity streams with optimal performance
 */
export const useActivityStream = (
  config: ActivityStreamConfig = {}
): ActivityStreamState & ActivityStreamActions => {
  // Stabilize config object to prevent infinite re-renders
  const stableConfig = useMemo(() => {
    const merged = { ...DEFAULT_CONFIG, ...config };

    // Stabilize subscriptions array by creating a new array only if content changes
    const subscriptions = config.subscriptions || merged.subscriptions;
    const stableSubscriptions = Array.isArray(subscriptions) ? [...subscriptions] : subscriptions;

    // Extract callbacks to prevent dependency changes
    const callbacks = {
      onActivityReceived: merged.onActivityReceived,
      onError: merged.onError,
      onConnectionChange: merged.onConnectionChange,
      onRateLimitReached: merged.onRateLimitReached,
    };
    return { ...merged, ...callbacks, subscriptions: stableSubscriptions };
  }, [
    config.realTimeEnabled,
    config.initialLoadSize,
    config.maxCacheSize,
    config.autoRefreshInterval,
    config.debounceMs,
    config.bufferSize,
    config.enableVirtualization,
    config.maxEventsPerSecond,
    config.maxEventsPerSession,
    config.autoDisconnectAfter,
    config.throttleMs,
    // Include subscriptions with proper dependency handling
    JSON.stringify(config.subscriptions || DEFAULT_CONFIG.subscriptions),
    // Include defaultFilters with proper dependency handling
    JSON.stringify(config.defaultFilters || DEFAULT_CONFIG.defaultFilters),
    // Don't include callback functions as dependencies - use refs instead
  ]);

  // Use refs for callback functions to prevent dependency issues
  const callbacksRef = useRef({
    onActivityReceived: config.onActivityReceived || (() => {}),
    onError: config.onError || (() => {}),
    onConnectionChange: config.onConnectionChange || (() => {}),
    onRateLimitReached: config.onRateLimitReached || (() => {}),
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onActivityReceived: config.onActivityReceived || (() => {}),
      onError: config.onError || (() => {}),
      onConnectionChange: config.onConnectionChange || (() => {}),
      onRateLimitReached: config.onRateLimitReached || (() => {}),
    };
  }, [config.onActivityReceived, config.onError, config.onConnectionChange, config.onRateLimitReached]);

  const { isConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe } = useWebSocket();
  const currentTenant = useCurrentTenant();

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
  });

  // Refs for performance optimization
  const activitiesRef = useRef<ActivityItem[]>([]);
  const filtersRef = useRef<Partial<ActivityFilter>>(stableConfig.defaultFilters);
  const subscriptionsRef = useRef<string[]>([]);
  const loadingRef = useRef<boolean>(false);
  const bufferRef = useRef<ActivityItem[]>([]);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rate limiting refs
  const eventCountRef = useRef<number>(0);
  const sessionEventCountRef = useRef<number>(0);
  const lastEventTimeRef = useRef<number>(0);
  const rateLimitWindowRef = useRef<number[]>([]);
  const autoDisconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rateLimitReachedRef = useRef<boolean>(false);

  // Connection state sync
  useEffect(() => {
    setState((prev) => ({ ...prev, isConnected }));
    callbacksRef.current.onConnectionChange(isConnected);
  }, [isConnected]);

  // Debounced filter application
  const applyFiltersDebounced = useCallback(
    (filters: Partial<ActivityFilter>) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        filtersRef.current = { ...filtersRef.current, ...filters };

        const filteredActivities = activitiesRef.current.filter((activity) => {
          // Apply search query filter
          if (filtersRef.current.search_query) {
            const query = filtersRef.current.search_query.toLowerCase();
            if (
              !activity.user.name.toLowerCase().includes(query) &&
              !activity.action.name.toLowerCase().includes(query) &&
              !activity.target.name.toLowerCase().includes(query) &&
              !activity.action.description?.toLowerCase().includes(query)
            ) {
              return false;
            }
          }

          // Apply user filter
          if (
            filtersRef.current.user_ids?.length &&
            !filtersRef.current.user_ids.includes(activity.user.id)
          ) {
            return false;
          }

          // Apply action type filter
          if (
            filtersRef.current.action_types?.length &&
            !filtersRef.current.action_types.includes(activity.action.type)
          ) {
            return false;
          }

          // Apply status filter
          if (
            filtersRef.current.status_filters?.length &&
            !filtersRef.current.status_filters.includes(activity.status)
          ) {
            return false;
          }

          // Apply priority filter
          if (
            filtersRef.current.priority_levels?.length &&
            !filtersRef.current.priority_levels.includes(activity.priority)
          ) {
            return false;
          }

          // Apply automated filter
          if (filtersRef.current.show_automated === false && activity.is_automated) {
            return false;
          }

          // Apply duration filters
          if (
            filtersRef.current.min_duration &&
            activity.duration_ms &&
            activity.duration_ms < filtersRef.current.min_duration
          ) {
            return false;
          }

          if (
            filtersRef.current.max_duration &&
            activity.duration_ms &&
            activity.duration_ms > filtersRef.current.max_duration
          ) {
            return false;
          }

          // Apply date range filter
          if (filtersRef.current.date_range) {
            const activityDate = new Date(activity.timestamp);
            if (
              activityDate < filtersRef.current.date_range.start ||
              activityDate > filtersRef.current.date_range.end
            ) {
              return false;
            }
          }

          // Apply tags filter
          if (filtersRef.current.tags?.length && activity.tags) {
            const hasMatchingTag = filtersRef.current.tags.some((tag) =>
              activity.tags?.includes(tag)
            );
            if (!hasMatchingTag) {
              return false;
            }
          }

          return true;
        });

        setState((prev) => ({
          ...prev,
          filteredActivities,
          totalCount: filteredActivities.length,
        }));
      }, stableConfig.debounceMs);
    },
    [stableConfig.debounceMs]
  );

  // Initial data loading
  const loadInitialData = useCallback(async () => {
    if (loadingRef.current) return;

    // Check if tenant is available before making API calls
    if (!currentTenant) {
      console.warn('No tenant available for activity stream - waiting for tenant context');
      setState((prev) => ({
        ...prev,
        error: 'Tenant context not available yet. Please wait...',
        isLoading: false
      }));
      return;
    }

    loadingRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await activitiesApi.list({
        limit: stableConfig.initialLoadSize,
        sort: 'timestamp',
        order: 'desc',
        ...filtersRef.current,
      });

      const activities = response.data.data;
      activitiesRef.current = activities;

      setState((prev) => ({
        ...prev,
        activities,
        filteredActivities: activities,
        totalCount: response.data.pagination.total,
        hasMore: response.data.pagination.has_next,
        lastUpdate: new Date().toISOString(),
        isLoading: false,
      }));

      // Apply initial filters
      applyFiltersDebounced({});
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to load activities';

      // Provide more specific error messaging for tenant issues
      const isTenantError = errorMessage.toLowerCase().includes('tenant');
      const friendlyMessage = isTenantError
        ? 'Tenant configuration issue. Please check your account settings or contact support.'
        : errorMessage;

      setState((prev) => ({ ...prev, error: friendlyMessage, isLoading: false }));
      callbacksRef.current.onError(new Error(errorMessage));
    } finally {
      loadingRef.current = false;
    }
  }, [stableConfig.initialLoadSize, applyFiltersDebounced, currentTenant]);

  // Load more activities for pagination
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !state.hasMore) return;

    loadingRef.current = true;

    try {
      const response = await activitiesApi.list({
        limit: 25,
        offset: activitiesRef.current.length,
        sort: 'timestamp',
        order: 'desc',
        ...filtersRef.current,
      });

      const newActivities = response.data.data;
      const allActivities = [...activitiesRef.current, ...newActivities];

      // Respect cache size limit
      if (allActivities.length > stableConfig.maxCacheSize) {
        allActivities.splice(stableConfig.maxCacheSize);
      }

      activitiesRef.current = allActivities;

      setState((prev) => ({
        ...prev,
        activities: allActivities,
        hasMore:
          response.data.pagination.has_next && allActivities.length < stableConfig.maxCacheSize,
      }));

      // Reapply filters
      applyFiltersDebounced({});
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to load more activities';
      setState((prev) => ({ ...prev, error: errorMessage }));
      callbacksRef.current.onError(new Error(errorMessage));
    } finally {
      loadingRef.current = false;
    }
  }, [state.hasMore, stableConfig.maxCacheSize, applyFiltersDebounced]);

  // Rate limiting check
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();

    // Throttle rapid successive events
    if (now - lastEventTimeRef.current < stableConfig.throttleMs) {
      return false;
    }

    // Check session event limit
    if (sessionEventCountRef.current >= stableConfig.maxEventsPerSession) {
      if (!rateLimitReachedRef.current) {
        console.log('🛑 Activity stream auto-paused: Maximum events per session reached');
        callbacksRef.current.onRateLimitReached();
        rateLimitReachedRef.current = true;

        // Auto-disconnect after reaching session limit
        setTimeout(() => {
          console.log('🔌 Activity stream disconnected: Session limit reached');
          setState((prev) => ({ ...prev, isConnected: false }));
        }, 1000);
      }
      return false;
    }

    // Check events per second rate limit
    const secondAgo = now - 1000;
    rateLimitWindowRef.current = rateLimitWindowRef.current.filter((time) => time > secondAgo);

    if (rateLimitWindowRef.current.length >= stableConfig.maxEventsPerSecond) {
      return false;
    }

    // Update tracking
    rateLimitWindowRef.current.push(now);
    lastEventTimeRef.current = now;
    sessionEventCountRef.current++;

    return true;
  }, [
    stableConfig.throttleMs,
    stableConfig.maxEventsPerSession,
    stableConfig.maxEventsPerSecond,
  ]);

  // Process incoming real-time activities with rate limiting
  const processRealTimeActivity = useCallback(
    (activity: ActivityItem) => {
      // Check rate limits first
      if (!checkRateLimit()) {
        return;
      }

      // Add to buffer for batch processing
      bufferRef.current.push(activity);

      // Process buffer when it reaches the configured size
      if (bufferRef.current.length >= stableConfig.bufferSize) {
        const activitiesToProcess = [...bufferRef.current];
        bufferRef.current = [];

        // Add new activities to the front of the list
        const updatedActivities = [...activitiesToProcess, ...activitiesRef.current];

        // Respect cache size limit
        if (updatedActivities.length > stableConfig.maxCacheSize) {
          updatedActivities.splice(stableConfig.maxCacheSize);
        }

        activitiesRef.current = updatedActivities;

        setState((prev) => ({
          ...prev,
          activities: updatedActivities,
          updateCount: prev.updateCount + activitiesToProcess.length,
          lastUpdate: new Date().toISOString(),
        }));

        // Reapply filters
        applyFiltersDebounced({});

        // Call activity received callback
        activitiesToProcess.forEach(callbacksRef.current.onActivityReceived);
      }
    },
    [
      stableConfig.bufferSize,
      stableConfig.maxCacheSize,
      applyFiltersDebounced,
      checkRateLimit,
    ]
  );

  // TRD-008: Process batch activities efficiently for enhanced real-time updates
  const processBatchActivities = useCallback(
    (activities: ActivityItem[]) => {
      // Skip rate limiting for batch operations as they're already controlled server-side
      if (activities.length === 0) return;

      // Filter out duplicates based on activity ID
      const existingIds = new Set(activitiesRef.current.map(a => a.id));
      const newActivities = activities.filter(activity => !existingIds.has(activity.id));

      if (newActivities.length === 0) return;

      // Add new activities to the front of the list
      const updatedActivities = [...newActivities, ...activitiesRef.current];

      // Respect cache size limit
      if (updatedActivities.length > stableConfig.maxCacheSize) {
        updatedActivities.splice(stableConfig.maxCacheSize);
      }

      activitiesRef.current = updatedActivities;

      setState((prev) => ({
        ...prev,
        activities: updatedActivities,
        updateCount: prev.updateCount + newActivities.length,
        lastUpdate: new Date().toISOString(),
      }));

      // Reapply filters
      applyFiltersDebounced({});

      // Call activity received callback for each new activity
      newActivities.forEach(callbacksRef.current.onActivityReceived);

      console.log(`📦 Processed batch of ${newActivities.length} activities (${activities.length - newActivities.length} duplicates filtered)`);
    },
    [
      stableConfig.maxCacheSize,
      applyFiltersDebounced
    ]
  );

  // WebSocket event handling
  useEffect(() => {
    if (!stableConfig.realTimeEnabled || !isConnected) return;

    const handleActivityEvent = (event: CustomEvent) => {
      const { data } = event.detail;

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
          timestamp: new Date(data.timestamp || Date.now()).toISOString(),
          duration_ms: data.execution_time_ms,
          execution_context: {
            session_id: data.session_id,
          },
          metrics: {
            input_tokens: data.input_tokens,
            output_tokens: data.output_tokens,
            memory_usage: data.memory_usage,
          },
          error_details:
            !data.success && data.error_message
              ? {
                  message: data.error_message,
                  recovery_suggestions: [],
                }
              : undefined,
          tags: data.tags || [],
          priority: 'medium',
          is_automated: true,
        };

        processRealTimeActivity(activity);
      }

      // Handle direct activity stream events
      if (event.type === 'activity_stream' && data.activity) {
        processRealTimeActivity(data.activity);
      }

      // Handle enhanced activity batch events (TRD-008)
      if (event.type === 'activity_batch' && data.activities) {
        // Process batch of activities efficiently
        processBatchActivities(data.activities);
      }

      // Handle activity pattern events
      if (event.type === 'activity_pattern' && data.pattern) {
        console.log('🧠 Activity pattern detected:', data.pattern);
        // Could be used for UI hints or analytics
      }

      // Handle activity anomaly events
      if (event.type === 'activity_anomaly' && data.anomaly) {
        console.log('⚠️ Activity anomaly detected:', data.anomaly);
        // Could trigger user notifications or alerts
      }

      // Handle activity correlation events
      if (event.type === 'activity_correlation' && data.correlation) {
        console.log('🔗 Activity correlation update:', data.correlation);
        // Could be used to show related activities
      }
    };

    // Register event listeners (including enhanced TRD-008 events)
    window.addEventListener('metric_ingested', handleActivityEvent);
    window.addEventListener('activity_stream', handleActivityEvent);
    window.addEventListener('activity_batch', handleActivityEvent);
    window.addEventListener('activity_pattern', handleActivityEvent);
    window.addEventListener('activity_anomaly', handleActivityEvent);
    window.addEventListener('activity_correlation', handleActivityEvent);
    window.addEventListener('dashboard_update', handleActivityEvent);

    return () => {
      window.removeEventListener('metric_ingested', handleActivityEvent);
      window.removeEventListener('activity_stream', handleActivityEvent);
      window.removeEventListener('activity_batch', handleActivityEvent);
      window.removeEventListener('activity_pattern', handleActivityEvent);
      window.removeEventListener('activity_anomaly', handleActivityEvent);
      window.removeEventListener('activity_correlation', handleActivityEvent);
      window.removeEventListener('dashboard_update', handleActivityEvent);
    };
  }, [stableConfig.realTimeEnabled, isConnected, processRealTimeActivity, processBatchActivities]);

  // WebSocket subscription management
  const subscribe = useCallback(
    (rooms: string[]) => {
      if (!isConnected) {
        subscriptionsRef.current = rooms;
        return;
      }

      const tenantRooms = rooms.map((room) =>
        currentTenant?.id ? `${currentTenant.id}:${room}` : room
      );

      wsSubscribe(tenantRooms);
      subscriptionsRef.current = rooms;
    },
    [isConnected, currentTenant?.id, wsSubscribe]
  );

  const unsubscribe = useCallback(
    (rooms: string[]) => {
      if (!isConnected) return;

      const tenantRooms = rooms.map((room) =>
        currentTenant?.id ? `${currentTenant.id}:${room}` : room
      );

      wsUnsubscribe(tenantRooms);
      subscriptionsRef.current = subscriptionsRef.current.filter((room) => !rooms.includes(room));
    },
    [isConnected, currentTenant?.id, wsUnsubscribe]
  );

  // Auto-subscription to default rooms
  useEffect(() => {
    if (isConnected && stableConfig.subscriptions.length > 0) {
      subscribe(stableConfig.subscriptions);

      // Set up auto-disconnect timer
      if (stableConfig.autoDisconnectAfter > 0) {
        autoDisconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔌 Activity stream auto-disconnected: Time limit reached');
          setState((prev) => ({ ...prev, isConnected: false }));
          callbacksRef.current.onRateLimitReached();
        }, stableConfig.autoDisconnectAfter * 1000);
      }
    }

    return () => {
      if (autoDisconnectTimeoutRef.current) {
        clearTimeout(autoDisconnectTimeoutRef.current);
        autoDisconnectTimeoutRef.current = null;
      }
    };
  }, [
    isConnected,
    subscribe,
    stableConfig.autoDisconnectAfter,
    // Include subscriptions array - it's already stable from useMemo
    stableConfig.subscriptions,
  ]);

  // Auto-refresh interval setup
  useEffect(() => {
    if (stableConfig.autoRefreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        if (!loadingRef.current) {
          loadInitialData();
        }
      }, stableConfig.autoRefreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [stableConfig.autoRefreshInterval, loadInitialData]);

  // Initial data load - retry when tenant becomes available
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Retry loading data when tenant becomes available
  useEffect(() => {
    if (currentTenant && state.error && state.error.includes('Tenant context not available')) {
      console.log('Tenant context now available, retrying activity stream load');
      loadInitialData();
    }
  }, [currentTenant, state.error, loadInitialData]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (autoDisconnectTimeoutRef.current) {
        clearTimeout(autoDisconnectTimeoutRef.current);
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  // Action implementations
  const refresh = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  const clearCache = useCallback(() => {
    activitiesRef.current = [];
    bufferRef.current = [];
    setState((prev) => ({
      ...prev,
      activities: [],
      filteredActivities: [],
      updateCount: 0,
      hasMore: true,
      error: null,
    }));
  }, []);

  const applyFilters = useCallback(
    (filters: Partial<ActivityFilter>) => {
      applyFiltersDebounced(filters);
    },
    [applyFiltersDebounced]
  );

  const clearFilters = useCallback(() => {
    filtersRef.current = stableConfig.defaultFilters;
    applyFiltersDebounced({});
  }, [stableConfig.defaultFilters, applyFiltersDebounced]);

  const getActivity = useCallback((id: string): ActivityItem | undefined => {
    return activitiesRef.current.find((activity) => activity.id === id);
  }, []);

  const markActivityAsRead = useCallback((id: string) => {
    // This could trigger an API call to mark as read
    // For now, just update local state if needed
    console.log('Mark activity as read:', id);
  }, []);

  const getVirtualizedItems = useCallback(
    (startIndex: number, endIndex: number): ActivityItem[] => {
      return state.filteredActivities.slice(
        startIndex,
        Math.min(endIndex + 1, state.filteredActivities.length)
      );
    },
    [state.filteredActivities]
  );

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
  };
};

export default useActivityStream;
