import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { WebSocketEvent, DashboardUpdateEvent, MetricIngestedEvent, AlertTriggeredEvent } from '../types/api'

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
          console.log('WebSocket message received:', message)

          // Handle different message types
          switch (message.type) {
            case 'authenticated':
              console.log('WebSocket authenticated successfully')
              break
            case 'dashboard_update':
              const dashboardEvent: DashboardUpdateEvent = {
                type: 'dashboard_update',
                data: message.data,
                timestamp: new Date()
              }
              setState(prev => ({ ...prev, lastEvent: dashboardEvent }))
              window.dispatchEvent(new CustomEvent('dashboard_update', { detail: dashboardEvent }))
              break
            case 'metric_ingested':
              const metricEvent: MetricIngestedEvent = {
                type: 'metric_ingested',
                data: message.data,
                timestamp: new Date()
              }
              setState(prev => ({ ...prev, lastEvent: metricEvent }))
              window.dispatchEvent(new CustomEvent('metric_ingested', { detail: metricEvent }))
              break
            case 'alert_triggered':
              const alertEvent: AlertTriggeredEvent = {
                type: 'alert_triggered',
                data: message.data,
                timestamp: new Date()
              }
              setState(prev => ({ ...prev, lastEvent: alertEvent }))
              window.dispatchEvent(new CustomEvent('alert_triggered', { detail: alertEvent }))
              break
            case 'error':
              console.error('WebSocket server error:', message.data)
              setState(prev => ({ ...prev, error: message.data.message || 'Server error' }))
              break
            default:
              console.log('Unknown WebSocket message type:', message.type)
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