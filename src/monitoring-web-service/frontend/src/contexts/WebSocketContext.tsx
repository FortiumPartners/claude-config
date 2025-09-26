import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  WebSocketEvent,
  DashboardUpdateEvent,
  MetricIngestedEvent,
  AlertTriggeredEvent,
  ActivityStreamEvent,
  ActivityBatchEvent,
  ActivityItem
} from '../types/api'

interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastEvent: WebSocketEvent | null
}

interface WebSocketContextValue extends WebSocketState {
  subscribe: (rooms: string[]) => void
  unsubscribe: (rooms: string[]) => void
  emit: (event: string, data: any) => void
  reconnect: () => void
  socket: WebSocket | null
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined)

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user } = useAuth()
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastEvent: null,
  })

  const socketRef = useRef<WebSocket | null>(null)
  const subscribedRoomsRef = useRef<string[]>([])
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = () => {
    if (!user) return

    // Prevent multiple concurrent connections
    if (socketRef.current && (socketRef.current.readyState === WebSocket.CONNECTING || socketRef.current.readyState === WebSocket.OPEN)) {
      return
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Get the WebSocket URL - handle both proxy and direct connection
      const getWsUrl = () => {
        const wsUrl = import.meta.env.VITE_WS_URL
        if (wsUrl?.startsWith('/')) {
          // Proxy mode - construct WebSocket URL with current host
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const host = window.location.hostname
          const port = '3001' // Backend WebSocket port
          return `${protocol}//${host}:${port}${wsUrl}`
        }
        return wsUrl || 'ws://localhost:3001/ws'
      }

      const token = localStorage.getItem('access_token')
      let wsUrl = getWsUrl()

      // Add JWT token as query parameter for authentication
      if (token) {
        const separator = wsUrl.includes('?') ? '&' : '?'
        wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`
      }

      console.log('Connecting to WebSocket:', wsUrl.replace(/token=[^&]+/, 'token=***'))

      // Create WebSocket connection
      socketRef.current = new WebSocket(wsUrl)

      // Connection opened
      socketRef.current.onopen = () => {
        console.log('WebSocket connected')
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }))
        reconnectAttemptsRef.current = 0

        // Authentication is handled via token query parameter during connection
        // No need to send additional authentication message

        // Re-subscribe to previously subscribed rooms
        if (subscribedRoomsRef.current.length > 0) {
          subscribe(subscribedRoomsRef.current)
        }
      }

      // Message received
      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          // Only log data events and errors, not acknowledgments
          if (['dashboard_update', 'metric_ingested', 'alert_triggered', 'error', 'authenticated'].includes(message.type)) {
            console.log('WebSocket message received:', message)
          }

          // Handle different message types
          switch (message.type) {
            case 'authenticated':
              console.log('WebSocket authenticated successfully')
              break

            // Subscription acknowledgments (server responses to client subscribe/unsubscribe)
            case 'subscribe':
              // Server acknowledging subscription request - no action needed
              break
            case 'unsubscribe':
              // Server acknowledging unsubscription request - no action needed
              break
            case 'subscribed':
              console.log('✅ Subscribed to:', message.data?.rooms || message.data)
              break
            case 'unsubscribed':
              console.log('❌ Unsubscribed from:', message.data?.rooms || message.data)
              break

            // Data events
            case 'dashboard_update':
              const dashboardEvent: DashboardUpdateEvent = {
                type: 'dashboard_update',
                data: message.data,
                timestamp: new Date().toISOString()
              }
              setState(prev => ({ ...prev, lastEvent: dashboardEvent }))
              window.dispatchEvent(new CustomEvent('dashboard_update', { detail: dashboardEvent }))
              break
            case 'metric_ingested':
              const metricEvent: MetricIngestedEvent = {
                type: 'metric_ingested',
                data: message.data,
                timestamp: new Date().toISOString()
              }
              setState(prev => ({ ...prev, lastEvent: metricEvent }))
              window.dispatchEvent(new CustomEvent('metric_ingested', { detail: metricEvent }))
              break
            case 'alert_triggered':
              const alertEvent: AlertTriggeredEvent = {
                type: 'alert_triggered',
                data: message.data,
                timestamp: new Date().toISOString()
              }
              setState(prev => ({ ...prev, lastEvent: alertEvent }))
              window.dispatchEvent(new CustomEvent('alert_triggered', { detail: alertEvent }))
              break

            // Enhanced Activity Stream Events (TRD-008)
            case 'activity_created':
            case 'activity_updated':
            case 'activity_completed':
            case 'activity_correlated':
              const activityStreamEvent: ActivityStreamEvent = {
                type: 'activity_stream',
                data: {
                  action: message.type.replace('activity_', '') as 'created' | 'updated' | 'completed',
                  activity: message.data.activity,
                  user_id: message.data.userId || message.data.user_id,
                  organization_id: message.data.organizationId || message.data.organization_id
                },
                timestamp: message.data.timestamp || new Date().toISOString()
              }
              setState(prev => ({ ...prev, lastEvent: activityStreamEvent }))
              window.dispatchEvent(new CustomEvent('activity_stream', { detail: activityStreamEvent }))
              break

            case 'activity_batch_update':
              const activityBatchEvent: ActivityBatchEvent = {
                type: 'activity_batch',
                data: {
                  activities: message.data.activities,
                  total_count: message.data.totalCount || message.data.total_count,
                  has_more: message.data.hasMore || message.data.has_more,
                  cursor: message.data.cursor
                },
                timestamp: new Date().toISOString()
              }
              setState(prev => ({ ...prev, lastEvent: activityBatchEvent }))
              window.dispatchEvent(new CustomEvent('activity_batch', { detail: activityBatchEvent }))
              break

            // Enhanced Activity Intelligence Events
            case 'activity_pattern_detected':
              console.log('🧠 Activity pattern detected:', message.data)
              window.dispatchEvent(new CustomEvent('activity_pattern', { detail: {
                type: 'activity_pattern',
                data: message.data,
                timestamp: new Date().toISOString()
              }}))
              break

            case 'activity_anomaly_detected':
              console.log('⚠️ Activity anomaly detected:', message.data)
              window.dispatchEvent(new CustomEvent('activity_anomaly', { detail: {
                type: 'activity_anomaly',
                data: message.data,
                timestamp: new Date().toISOString()
              }}))
              break

            case 'activity_correlation_update':
              console.log('🔗 Activity correlation update:', message.data)
              window.dispatchEvent(new CustomEvent('activity_correlation', { detail: {
                type: 'activity_correlation',
                data: message.data,
                timestamp: new Date().toISOString()
              }}))
              break

            // Server messages
            case 'ping':
              // Respond to server ping with pong
              if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: 'pong' }))
              }
              break
            case 'pong':
              // Server pong response - no action needed
              break
            case 'error':
              console.error('WebSocket server error:', message.data)
              setState(prev => ({ ...prev, error: message.data.message || 'Server error' }))
              break

            // Connection status messages
            case 'connected':
              console.log('Server confirmed connection')
              break
            case 'disconnected':
              console.log('Server notified disconnection')
              break

            // Generic server responses
            case 'response':
              // Handle generic server response messages
              if (message.data?.success !== undefined) {
                if (message.data.success) {
                  console.log('✅ Server response:', message.data.message || 'Operation successful')
                } else {
                  console.warn('⚠️ Server response error:', message.data.message || message.data.error)
                }
              } else {
                // Generic response without success indicator
                console.log('📨 Server response:', message.data)
              }
              break

            default:
              // Only log truly unknown message types, filter out common server responses
              if (!['ack', 'ok', 'success', 'heartbeat', 'status', 'response'].includes(message.type)) {
                console.log('Unknown WebSocket message type:', message.type, message)
              }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      // Connection closed
      socketRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setState(prev => ({ ...prev, isConnected: false, isConnecting: false }))

        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          console.log(`Attempting to reconnect in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setState(prev => ({ ...prev, error: 'Max reconnection attempts reached. Please refresh the page.' }))
        }
      }

      // Connection error
      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection failed. Please check your connection and try again.',
          isConnecting: false
        }))
      }

    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to establish WebSocket connection',
        isConnecting: false
      }))
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.close(1000, 'Intentional disconnect')
      socketRef.current = null
    }

    setState(prev => ({ ...prev, isConnected: false, isConnecting: false }))
  }

  const subscribe = (rooms: string[]) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'subscribe',
        data: { rooms }
      }))
      subscribedRoomsRef.current = [...new Set([...subscribedRoomsRef.current, ...rooms])]
    }
  }

  const unsubscribe = (rooms: string[]) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        data: { rooms }
      }))
      subscribedRoomsRef.current = subscribedRoomsRef.current.filter(room => !rooms.includes(room))
    }
  }

  const emit = (event: string, data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: event,
        data
      }))
    }
  }

  const reconnect = () => {
    disconnect()
    reconnectAttemptsRef.current = 0
    setTimeout(connect, 1000)
  }

  // Connect when user is available
  useEffect(() => {
    if (user) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [user])

  const contextValue: WebSocketContextValue = {
    ...state,
    subscribe,
    unsubscribe,
    emit,
    reconnect,
    socket: socketRef.current,
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}