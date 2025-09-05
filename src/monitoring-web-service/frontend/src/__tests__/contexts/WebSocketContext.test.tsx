import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import '@testing-library/jest-dom'

import { WebSocketProvider, useWebSocket } from '../../contexts/WebSocketContext'
import { AuthProvider } from '../../contexts/AuthContext'
import authSlice from '../../store/slices/authSlice'
import uiSlice from '../../store/slices/uiSlice'

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
}

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}))

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      ui: uiSlice,
    },
    preloadedState: {
      auth: {
        user: {
          id: 'user-1',
          organization_id: 'org-1',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'admin',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        organization: null,
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      ui: {
        theme: 'light',
        sidebarOpen: true,
        sidebarCollapsed: false,
        notifications: [],
        modals: {
          addWidget: false,
          editWidget: false,
          dashboardSettings: false,
          userProfile: false,
          exportReport: false,
        },
        globalLoading: false,
        globalSearch: '',
        compactMode: false,
        animationsEnabled: true,
        connectionStatus: 'connected',
        screenSize: 'desktop',
      },
      ...initialState,
    },
  })
}

// Test component that uses WebSocket context
const TestComponent: React.FC = () => {
  const { isConnected, isConnecting, error, subscribe, unsubscribe, emit, reconnect } = useWebSocket()
  
  return (
    <div>
      <div data-testid="connection-status">{isConnected ? 'connected' : 'disconnected'}</div>
      <div data-testid="connecting-status">{isConnecting ? 'connecting' : 'not-connecting'}</div>
      <div data-testid="error-status">{error || 'no-error'}</div>
      <button onClick={() => subscribe(['test-room'])} data-testid="subscribe-btn">
        Subscribe
      </button>
      <button onClick={() => unsubscribe(['test-room'])} data-testid="unsubscribe-btn">
        Unsubscribe
      </button>
      <button onClick={() => emit('test-event', { data: 'test' })} data-testid="emit-btn">
        Emit
      </button>
      <button onClick={reconnect} data-testid="reconnect-btn">
        Reconnect
      </button>
    </div>
  )
}

const renderWithProviders = (store = createTestStore()) => {
  return render(
    <Provider store={store}>
      <AuthProvider>
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      </AuthProvider>
    </Provider>
  )
}

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('WebSocketProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket.connected = false
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  it('provides initial WebSocket context values', () => {
    renderWithProviders()
    
    expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
    expect(screen.getByTestId('connecting-status')).toHaveTextContent('not-connecting')
    expect(screen.getByTestId('error-status')).toHaveTextContent('no-error')
  })

  it('throws error when useWebSocket is used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error
    console.error = jest.fn()
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useWebSocket must be used within a WebSocketProvider')
    
    console.error = originalError
  })

  it('attempts connection when user is authenticated', () => {
    const { io } = require('socket.io-client')
    
    renderWithProviders()
    
    expect(io).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3001'),
      expect.objectContaining({
        auth: expect.objectContaining({
          token: 'mock-token',
          user_id: 'user-1',
          organization_id: 'org-1',
        }),
        transports: ['websocket', 'polling'],
        upgrade: true,
        timeout: 20000,
        autoConnect: true,
      })
    )
  })

  it('handles socket connection events', () => {
    renderWithProviders()
    
    // Simulate connection
    act(() => {
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      if (connectHandler) {
        connectHandler()
      }
    })
    
    expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
  })

  it('handles socket disconnection events', () => {
    renderWithProviders()
    
    // First connect
    act(() => {
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')?.[1]
      if (connectHandler) {
        connectHandler()
      }
    })
    
    // Then disconnect
    act(() => {
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')?.[1]
      if (disconnectHandler) {
        disconnectHandler('io server disconnect')
      }
    })
    
    expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
  })

  it('handles connection errors', () => {
    renderWithProviders()
    
    act(() => {
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')?.[1]
      if (errorHandler) {
        errorHandler(new Error('Connection failed'))
      }
    })
    
    expect(screen.getByTestId('error-status')).toHaveTextContent('Connection failed')
    expect(screen.getByTestId('connecting-status')).toHaveTextContent('not-connecting')
  })
})

describe('WebSocket event handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  it('handles dashboard_update events', () => {
    renderWithProviders()
    
    const mockEventData = {
      dashboard_id: 'dashboard-1',
      widget_id: 'widget-1',
      data: { value: 100 },
    }
    
    // Create spy for custom event dispatch
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent')
    
    act(() => {
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'dashboard_update')?.[1]
      if (eventHandler) {
        eventHandler(mockEventData)
      }
    })
    
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dashboard_update',
        detail: expect.objectContaining({
          type: 'dashboard_update',
          data: mockEventData,
        }),
      })
    )
    
    dispatchEventSpy.mockRestore()
  })

  it('handles metric_ingested events', () => {
    renderWithProviders()
    
    const mockEventData = {
      metric_type: 'productivity_score',
      user_id: 'user-1',
      team_id: 'team-1',
      count: 5,
    }
    
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent')
    
    act(() => {
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'metric_ingested')?.[1]
      if (eventHandler) {
        eventHandler(mockEventData)
      }
    })
    
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'metric_ingested',
        detail: expect.objectContaining({
          type: 'metric_ingested',
          data: mockEventData,
        }),
      })
    )
    
    dispatchEventSpy.mockRestore()
  })

  it('handles alert_triggered events', () => {
    renderWithProviders()
    
    const mockEventData = {
      alert_id: 'alert-1',
      rule_name: 'High error rate',
      severity: 'high',
      metric_value: 25,
      threshold: 20,
      affected_users: ['user-1', 'user-2'],
    }
    
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent')
    
    act(() => {
      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'alert_triggered')?.[1]
      if (eventHandler) {
        eventHandler(mockEventData)
      }
    })
    
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alert_triggered',
        detail: expect.objectContaining({
          type: 'alert_triggered',
          data: mockEventData,
        }),
      })
    )
    
    dispatchEventSpy.mockRestore()
  })
})

describe('WebSocket methods', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSocket.connected = true
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  it('subscribes to rooms when connected', () => {
    renderWithProviders()
    
    act(() => {
      screen.getByTestId('subscribe-btn').click()
    })
    
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', {
      rooms: ['test-room'],
      user_id: 'user-1',
    })
  })

  it('unsubscribes from rooms when connected', () => {
    renderWithProviders()
    
    act(() => {
      screen.getByTestId('unsubscribe-btn').click()
    })
    
    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', {
      rooms: ['test-room'],
    })
  })

  it('emits events when connected', () => {
    renderWithProviders()
    
    act(() => {
      screen.getByTestId('emit-btn').click()
    })
    
    expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' })
  })

  it('does not emit when disconnected', () => {
    mockSocket.connected = false
    renderWithProviders()
    
    act(() => {
      screen.getByTestId('emit-btn').click()
    })
    
    expect(mockSocket.emit).not.toHaveBeenCalled()
  })

  it('handles reconnection', () => {
    renderWithProviders()
    
    act(() => {
      screen.getByTestId('reconnect-btn').click()
    })
    
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })
})