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

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const subscribedRoomsRef = useRef<string[]>([])
  const reconnectAttemptsRef = useRef(0)

  const maxReconnectAttempts = 10
  const baseReconnectDelay = 1000

  const connect = () => {
    if (!user?.organization_id) return

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:3001'}/ws`
      const token = localStorage.getItem('access_token')
      
      wsRef.current = new WebSocket(`${wsUrl}?token=${token}`)

      wsRef.current.onopen = () => {
        console.log('WebSocket connected')
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }))
        reconnectAttemptsRef.current = 0

        // Re-subscribe to previously subscribed rooms
        if (subscribedRoomsRef.current.length > 0) {
          subscribe(subscribedRoomsRef.current)
        }
      }

      wsRef.current.onmessage = (event) => {
        try {
          const eventData: WebSocketEvent = JSON.parse(event.data)
          setState(prev => ({ ...prev, lastEvent: eventData }))
          
          // Emit custom events for specific event types
          if (eventData.type === 'dashboard_update') {
            window.dispatchEvent(new CustomEvent('dashboard_update', { detail: eventData }))
          } else if (eventData.type === 'metric_ingested') {
            window.dispatchEvent(new CustomEvent('metric_ingested', { detail: eventData }))
          } else if (eventData.type === 'alert_triggered') {
            window.dispatchEvent(new CustomEvent('alert_triggered', { detail: eventData }))
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setState(prev => ({ ...prev, isConnected: false, isConnecting: false }))

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1
            connect()
          }, delay)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setState(prev => ({ 
          ...prev, 
          error: 'WebSocket connection failed. Please check your connection and try again.',
          isConnecting: false
        }))
      }
    } catch (error) {
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

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    setState(prev => ({ ...prev, isConnected: false, isConnecting: false }))
    subscribedRoomsRef.current = []
  }

  const subscribe = (rooms: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      subscribedRoomsRef.current = rooms
      return
    }

    wsRef.current.send(JSON.stringify({
      type: 'subscribe',
      data: {
        rooms,
        user_id: user?.id,
      },
    }))

    subscribedRoomsRef.current = [...new Set([...subscribedRoomsRef.current, ...rooms])]
  }

  const unsubscribe = (rooms: string[]) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: 'unsubscribe',
      data: { rooms },
    }))

    subscribedRoomsRef.current = subscribedRoomsRef.current.filter(room => !rooms.includes(room))
  }

  const emit = (event: string, data: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    wsRef.current.send(JSON.stringify({
      type: event,
      data,
    }))
  }

  const reconnect = () => {
    disconnect()
    reconnectAttemptsRef.current = 0
    connect()
  }

  // Initialize connection when user is authenticated
  useEffect(() => {
    if (user?.organization_id) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [user?.organization_id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const value: WebSocketContextValue = {
    ...state,
    subscribe,
    unsubscribe,
    emit,
    reconnect,
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}