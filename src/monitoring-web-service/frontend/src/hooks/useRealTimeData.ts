import { useEffect, useRef, useState, useCallback } from 'react'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useAppDispatch, useAppSelector } from '../store'
import { updateRealTimeMetrics, updateDashboardData } from '../store/slices/metricsSlice'
import { addNotification } from '../store/slices/uiSlice'
import toast from 'react-hot-toast'

export interface RealTimeDataConfig {
  dataType: 'metrics' | 'dashboard' | 'alerts' | 'activity' | 'custom'
  updateInterval?: number // milliseconds
  autoReconnect?: boolean
  enableNotifications?: boolean
  customEvents?: string[]
  onDataUpdate?: (data: any) => void
  onError?: (error: Error) => void
}

export interface RealTimeDataState<T = any> {
  data: T | null
  lastUpdate: Date | null
  isConnected: boolean
  error: string | null
  updateCount: number
}

/**
 * Hook for managing real-time data updates via WebSocket
 */
export const useRealTimeData = <T = any>(
  widgetId: string,
  config: RealTimeDataConfig
): RealTimeDataState<T> & {
  refresh: () => void
  subscribe: (rooms: string[]) => void
  unsubscribe: (rooms: string[]) => void
} => {
  const { 
    isConnected, 
    subscribe: wsSubscribe, 
    unsubscribe: wsUnsubscribe, 
    lastEvent 
  } = useWebSocket()
  
  const dispatch = useAppDispatch()
  const { currentTenant } = useAppSelector((state) => state.auth)
  
  const [state, setState] = useState<RealTimeDataState<T>>({
    data: null,
    lastUpdate: null,
    isConnected: false,
    error: null,
    updateCount: 0,
  })

  const configRef = useRef(config)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const subscribedRoomsRef = useRef<string[]>([])

  // Update config ref when config changes
  useEffect(() => {
    configRef.current = config
  }, [config])

  // Handle WebSocket connection state
  useEffect(() => {
    setState(prev => ({ ...prev, isConnected }))
  }, [isConnected])

  // Process incoming WebSocket events
  useEffect(() => {
    if (!lastEvent || !isConnected) return

    const processEvent = async () => {
      try {
        const { type, data, timestamp } = lastEvent

        // Filter events based on data type
        const shouldProcess = (() => {
          switch (configRef.current.dataType) {
            case 'metrics':
              return type === 'metric_ingested' || type === 'dashboard_update'
            case 'dashboard':
              return type === 'dashboard_update'
            case 'alerts':
              return type === 'alert_triggered'
            case 'activity':
              return type === 'user_activity' || type === 'system_activity'
            case 'custom':
              return configRef.current.customEvents?.includes(type) || false
            default:
              return true
          }
        })()

        if (!shouldProcess) return

        // Update local state
        setState(prev => ({
          ...prev,
          data: data as T,
          lastUpdate: new Date(timestamp),
          updateCount: prev.updateCount + 1,
          error: null,
        }))

        // Update global store based on data type
        switch (configRef.current.dataType) {
          case 'metrics':
            dispatch(updateRealTimeMetrics({ widgetId, data, timestamp }))
            break
          case 'dashboard':
            dispatch(updateDashboardData(data))
            break
          case 'alerts':
            if (configRef.current.enableNotifications) {
              dispatch(addNotification({
                id: `alert-${Date.now()}`,
                type: 'warning',
                title: 'Alert Triggered',
                message: data.message || 'A system alert has been triggered',
                timestamp: new Date(timestamp),
                read: false,
              }))
              toast.error(data.message || 'Alert triggered', {
                duration: 6000,
              })
            }
            break
        }

        // Call custom data handler
        if (configRef.current.onDataUpdate) {
          configRef.current.onDataUpdate(data)
        }

      } catch (error: any) {
        console.error(`Real-time data processing error for ${widgetId}:`, error)
        setState(prev => ({
          ...prev,
          error: error.message || 'Failed to process real-time data',
        }))

        if (configRef.current.onError) {
          configRef.current.onError(error)
        }
      }
    }

    processEvent()
  }, [lastEvent, isConnected, dispatch, widgetId])

  // Subscribe to real-time rooms
  const subscribe = useCallback((rooms: string[]) => {
    if (!isConnected) {
      subscribedRoomsRef.current = rooms
      return
    }

    const tenantRooms = rooms.map(room => 
      currentTenant?.id ? `${currentTenant.id}:${room}` : room
    )

    wsSubscribe(tenantRooms)
    subscribedRoomsRef.current = rooms
  }, [isConnected, wsSubscribe, currentTenant?.id])

  // Unsubscribe from real-time rooms
  const unsubscribe = useCallback((rooms: string[]) => {
    if (!isConnected) return

    const tenantRooms = rooms.map(room => 
      currentTenant?.id ? `${currentTenant.id}:${room}` : room
    )

    wsUnsubscribe(tenantRooms)
    subscribedRoomsRef.current = subscribedRoomsRef.current.filter(
      room => !rooms.includes(room)
    )
  }, [isConnected, wsUnsubscribe, currentTenant?.id])

  // Refresh data (placeholder for manual refresh)
  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
    
    // Re-subscribe to rooms if needed
    if (subscribedRoomsRef.current.length > 0) {
      subscribe(subscribedRoomsRef.current)
    }
  }, [subscribe])

  // Setup periodic updates if configured
  useEffect(() => {
    if (!config.updateInterval || config.updateInterval <= 0) return

    intervalRef.current = setInterval(() => {
      refresh()
    }, config.updateInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [config.updateInterval, refresh])

  // Auto-reconnect logic
  useEffect(() => {
    if (!config.autoReconnect || isConnected) return

    const reconnectDelay = 5000 // 5 seconds
    const timeoutId = setTimeout(() => {
      if (subscribedRoomsRef.current.length > 0) {
        subscribe(subscribedRoomsRef.current)
      }
    }, reconnectDelay)

    return () => clearTimeout(timeoutId)
  }, [isConnected, config.autoReconnect, subscribe])

  // Subscribe to initial rooms when connection is established
  useEffect(() => {
    if (isConnected && subscribedRoomsRef.current.length > 0) {
      subscribe(subscribedRoomsRef.current)
    }
  }, [isConnected, subscribe])

  return {
    ...state,
    refresh,
    subscribe,
    unsubscribe,
  }
}

/**
 * Hook for real-time metrics data
 */
export const useRealTimeMetrics = (widgetId: string) => {
  return useRealTimeData(widgetId, {
    dataType: 'metrics',
    autoReconnect: true,
    enableNotifications: false,
  })
}

/**
 * Hook for real-time dashboard updates
 */
export const useRealTimeDashboard = (widgetId: string) => {
  return useRealTimeData(widgetId, {
    dataType: 'dashboard',
    autoReconnect: true,
    enableNotifications: false,
  })
}

/**
 * Hook for real-time alerts
 */
export const useRealTimeAlerts = (widgetId: string) => {
  return useRealTimeData(widgetId, {
    dataType: 'alerts',
    autoReconnect: true,
    enableNotifications: true,
  })
}

/**
 * Hook for real-time activity monitoring
 */
export const useRealTimeActivity = (widgetId: string) => {
  return useRealTimeData(widgetId, {
    dataType: 'activity',
    updateInterval: 30000, // 30 seconds
    autoReconnect: true,
    enableNotifications: false,
  })
}

/**
 * Hook for custom real-time data with specific events
 */
export const useCustomRealTimeData = <T = any>(
  widgetId: string,
  events: string[],
  config?: Partial<RealTimeDataConfig>
) => {
  return useRealTimeData<T>(widgetId, {
    dataType: 'custom',
    customEvents: events,
    autoReconnect: true,
    enableNotifications: false,
    ...config,
  })
}

/**
 * Hook for managing widget-specific real-time subscriptions
 */
export const useWidgetRealTime = (
  widgetId: string,
  subscriptions: string[],
  config?: Partial<RealTimeDataConfig>
) => {
  const realTimeData = useRealTimeData(widgetId, {
    dataType: 'custom',
    autoReconnect: true,
    enableNotifications: false,
    ...config,
  })

  // Subscribe to widget-specific rooms on mount
  useEffect(() => {
    if (subscriptions.length > 0) {
      realTimeData.subscribe(subscriptions)
    }

    return () => {
      if (subscriptions.length > 0) {
        realTimeData.unsubscribe(subscriptions)
      }
    }
  }, [subscriptions, realTimeData.subscribe, realTimeData.unsubscribe])

  return realTimeData
}

/**
 * Connection status indicator hook
 */
export const useConnectionStatus = () => {
  const { isConnected, isConnecting, error } = useWebSocket()
  
  const getStatus = (): 'connected' | 'connecting' | 'disconnected' | 'error' => {
    if (error) return 'error'
    if (isConnecting) return 'connecting'
    if (isConnected) return 'connected'
    return 'disconnected'
  }

  const getStatusText = (): string => {
    switch (getStatus()) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'error':
        return 'Connection Error'
      default:
        return 'Disconnected'
    }
  }

  const getStatusColor = (): string => {
    switch (getStatus()) {
      case 'connected':
        return 'text-green-500'
      case 'connecting':
        return 'text-yellow-500 animate-pulse'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-red-500'
    }
  }

  return {
    status: getStatus(),
    statusText: getStatusText(),
    statusColor: getStatusColor(),
    isConnected,
    isConnecting,
    error,
  }
}