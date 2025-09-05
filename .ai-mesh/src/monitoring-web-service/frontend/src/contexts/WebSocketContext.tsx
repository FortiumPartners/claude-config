import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
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
  socket: Socket | null
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

  const socketRef = useRef<Socket | null>(null)
  const subscribedRoomsRef = useRef<string[]>([])

  const connect = () => {
    if (!user?.organization_id) return

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3001'
      const token = localStorage.getItem('access_token')
      
      socketRef.current = io(wsUrl, {
        auth: {
          token,
          user_id: user.id,
          organization_id: user.organization_id,
        },
        transports: ['websocket', 'polling'],
        upgrade: true,
        timeout: 20000,
        autoConnect: true,
      })

      // Connection event handlers
      socketRef.current.on('connect', () => {
        console.log('Socket.io connected')
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false, error: null }))

        // Re-subscribe to previously subscribed rooms
        if (subscribedRoomsRef.current.length > 0) {
          subscribe(subscribedRoomsRef.current)
        }
      })

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket.io disconnected:', reason)
        setState(prev => ({ ...prev, isConnected: false, isConnecting: false }))
      })

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket.io connection error:', error)
        setState(prev => ({ 
          ...prev, 
          error: 'Connection failed. Please check your connection and try again.',
          isConnecting: false
        }))
      })

      // Real-time event handlers
      socketRef.current.on('dashboard_update', (data: DashboardUpdateEvent['data']) => {
        const event: DashboardUpdateEvent = {
          type: 'dashboard_update',
          data,
          timestamp: new Date()
        }
        setState(prev => ({ ...prev, lastEvent: event }))
        window.dispatchEvent(new CustomEvent('dashboard_update', { detail: event }))
      })

      socketRef.current.on('metric_ingested', (data: MetricIngestedEvent['data']) => {
        const event: MetricIngestedEvent = {
          type: 'metric_ingested',
          data,
          timestamp: new Date()
        }
        setState(prev => ({ ...prev, lastEvent: event }))
        window.dispatchEvent(new CustomEvent('metric_ingested', { detail: event }))
      })

      socketRef.current.on('alert_triggered', (data: AlertTriggeredEvent['data']) => {
        const event: AlertTriggeredEvent = {
          type: 'alert_triggered',
          data,
          timestamp: new Date()
        }
        setState(prev => ({ ...prev, lastEvent: event }))
        window.dispatchEvent(new CustomEvent('alert_triggered', { detail: event }))
      })

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to establish Socket.io connection',
        isConnecting: false
      }))
    }
  }

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }

    setState(prev => ({ ...prev, isConnected: false, isConnecting: false }))
    subscribedRoomsRef.current = []
  }

  const subscribe = (rooms: string[]) => {
    if (!socketRef.current?.connected) {
      subscribedRoomsRef.current = rooms
      return
    }

    socketRef.current.emit('subscribe', {
      rooms,
      user_id: user?.id,
    })

    subscribedRoomsRef.current = [...new Set([...subscribedRoomsRef.current, ...rooms])]
  }

  const unsubscribe = (rooms: string[]) => {
    if (!socketRef.current?.connected) return

    socketRef.current.emit('unsubscribe', { rooms })
    subscribedRoomsRef.current = subscribedRoomsRef.current.filter(room => !rooms.includes(room))
  }

  const emit = (event: string, data: any) => {
    if (!socketRef.current?.connected) return
    socketRef.current.emit(event, data)
  }

  const reconnect = () => {
    disconnect()
    setTimeout(connect, 1000) // Brief delay before reconnecting
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
    socket: socketRef.current,
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}