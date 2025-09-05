import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'

import DashboardPage from '../../pages/dashboard/DashboardPage'
import { WebSocketProvider } from '../../contexts/WebSocketContext'
import { AuthProvider } from '../../contexts/AuthContext'
import dashboardSlice from '../../store/slices/dashboardSlice'
import metricsSlice from '../../store/slices/metricsSlice'
import authSlice from '../../store/slices/authSlice'
import uiSlice from '../../store/slices/uiSlice'

// Mock the chart libraries to avoid canvas issues in tests
jest.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
  Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
}))

jest.mock('react-grid-layout', () => ({
  Responsive: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  ),
  WidthProvider: (component: any) => component,
}))

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      dashboard: dashboardSlice,
      metrics: metricsSlice,
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
        organization: {
          id: 'org-1',
          name: 'Test Organization',
          slug: 'test-org',
          settings: {},
          subscription_tier: 'enterprise',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      ui: {
        sidebarOpen: true,
        sidebarCollapsed: false,
        theme: 'light',
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
      dashboard: {
        currentDashboard: null,
        dashboards: [],
        isLoading: false,
        error: null,
        layout: [],
        isEditing: false,
        isDragEnabled: true,
        selectedWidget: null,
      },
      metrics: {
        productivityMetrics: [],
        productivityTrends: [],
        teamComparisons: [],
        commandExecutions: [],
        agentInteractions: [],
        realtimeMetrics: {},
        lastUpdateTime: null,
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
          preset: '7d',
        },
        selectedTeams: [],
        selectedUsers: [],
        selectedMetricTypes: [],
        isLoading: false,
        isLoadingRealtime: false,
        error: null,
        performanceStats: {
          averageResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          activeUsers: 0,
        },
      },
      ...initialState,
    },
  })
}

const MockWebSocket = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  emit: jest.fn(),
  reconnect: jest.fn(),
  isConnected: true,
  isConnecting: false,
  error: null,
  socket: null,
  lastEvent: null,
}

const MockAuth = {
  user: {
    id: 'user-1',
    organization_id: 'org-1',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'admin' as const,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  },
  organization: null,
  isLoading: false,
  error: null,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  clearError: jest.fn(),
}

const renderDashboard = (store = createTestStore()) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <WebSocketProvider>
            <DashboardPage />
          </WebSocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders dashboard page with default widgets', async () => {
    renderDashboard()
    
    expect(screen.getByText('My Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Monitor your team\'s productivity and performance in real-time')).toBeInTheDocument()
    
    // Check for action buttons
    expect(screen.getByText('Add Widget')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('enables edit mode when edit button is clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()
    
    const editButton = screen.getByText('Edit')
    await user.click(editButton)
    
    expect(screen.getByText('Edit Mode Active')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('shows add widget panel when add widget button is clicked in edit mode', async () => {
    const user = userEvent.setup()
    renderDashboard()
    
    // First enable edit mode
    const editButton = screen.getByText('Edit')
    await user.click(editButton)
    
    // Then click add widget
    const addWidgetButton = screen.getByText('Add Widget')
    await user.click(addWidgetButton)
    
    expect(screen.getByText('Add Widget')).toBeInTheDocument()
    expect(screen.getByText('Productivity Trends')).toBeInTheDocument()
    expect(screen.getByText('Team Comparison')).toBeInTheDocument()
  })

  it('displays connection status when disconnected', () => {
    const store = createTestStore({
      ui: {
        connectionStatus: 'disconnected',
      },
    })
    
    renderDashboard(store)
    
    expect(screen.getByText('Real-time updates disconnected')).toBeInTheDocument()
    expect(screen.getByText('Dashboard data may not be current')).toBeInTheDocument()
  })

  it('renders default dashboard widgets', () => {
    renderDashboard()
    
    // Should render the default widgets created in createDefaultDashboard
    expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
  })

  it('handles loading state', () => {
    const store = createTestStore({
      dashboard: {
        isLoading: true,
      },
    })
    
    renderDashboard(store)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('saves dashboard when save button is clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()
    
    // Enable edit mode
    const editButton = screen.getByText('Edit')
    await user.click(editButton)
    
    // Click save
    const saveButton = screen.getByText('Save')
    await user.click(saveButton)
    
    expect(screen.queryByText('Edit Mode Active')).not.toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })
})

describe('DashboardPage Widget Management', () => {
  it('allows adding new widgets from the widget panel', async () => {
    const user = userEvent.setup()
    renderDashboard()
    
    // Enable edit mode
    await user.click(screen.getByText('Edit'))
    
    // Open add widget panel
    await user.click(screen.getByText('Add Widget'))
    
    // Add a productivity trends widget
    await user.click(screen.getByText('Productivity Trends'))
    
    // Panel should close and widget should be added
    expect(screen.queryByText('Add Widget')).not.toBeInTheDocument()
  })

  it('displays widget types in add widget panel', async () => {
    const user = userEvent.setup()
    renderDashboard()
    
    // Enable edit mode and open widget panel
    await user.click(screen.getByText('Edit'))
    await user.click(screen.getByText('Add Widget'))
    
    // Check all widget types are available
    const widgetTypes = [
      'Productivity Trends',
      'Team Comparison', 
      'Agent Usage',
      'Task Completion',
      'Code Quality',
      'Real-time Activity',
      'Metric Card'
    ]
    
    widgetTypes.forEach(widgetType => {
      expect(screen.getByText(widgetType)).toBeInTheDocument()
    })
  })

  it('closes add widget panel when close button is clicked', async () => {
    const user = userEvent.setup()
    renderDashboard()
    
    // Enable edit mode and open widget panel
    await user.click(screen.getByText('Edit'))
    await user.click(screen.getByText('Add Widget'))
    
    // Close the panel
    const closeButton = screen.getByRole('button', { name: '' })
    await user.click(closeButton)
    
    expect(screen.queryByText('Track productivity metrics over time')).not.toBeInTheDocument()
  })
})