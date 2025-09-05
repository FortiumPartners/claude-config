import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import '@testing-library/jest-dom'

import ProductivityTrendsWidget from '../../components/dashboard/ProductivityTrendsWidget'
import metricsSlice from '../../store/slices/metricsSlice'
import uiSlice from '../../store/slices/uiSlice'

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart">
      <div data-testid="chart-data">{JSON.stringify(data)}</div>
      <div data-testid="chart-options">{JSON.stringify(options)}</div>
    </div>
  ),
}))

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      metrics: metricsSlice,
      ui: uiSlice,
    },
    preloadedState: {
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

const renderWidget = (props = {}, store = createTestStore()) => {
  const defaultProps = {
    config: {
      chartType: 'line' as const,
      metricType: 'productivity_score',
      timeRange: '30d' as const,
    },
    isEditing: false,
    onRemove: jest.fn(),
    ...props,
  }

  return render(
    <Provider store={store}>
      <ProductivityTrendsWidget {...defaultProps} />
    </Provider>
  )
}

describe('ProductivityTrendsWidget', () => {
  it('renders widget with title and description', () => {
    renderWidget()
    
    expect(screen.getByText('Productivity Trends')).toBeInTheDocument()
    expect(screen.getByText('30-day productivity score trend')).toBeInTheDocument()
  })

  it('displays productivity score and trend', () => {
    renderWidget()
    
    // Should show current productivity score (generated in widget)
    expect(screen.getByText(/\d+%/)).toBeInTheDocument()
    
    // Should show trend comparison
    expect(screen.getByText(/vs last week/)).toBeInTheDocument()
  })

  it('renders line chart component', () => {
    renderWidget()
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('shows remove button when in edit mode', () => {
    const onRemove = jest.fn()
    renderWidget({ isEditing: true, onRemove })
    
    const removeButton = screen.getByRole('button')
    expect(removeButton).toBeInTheDocument()
    
    fireEvent.click(removeButton)
    expect(onRemove).toHaveBeenCalled()
  })

  it('does not show remove button when not in edit mode', () => {
    renderWidget({ isEditing: false })
    
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('displays loading state when metrics are loading', () => {
    const store = createTestStore({
      metrics: {
        isLoading: true,
      },
    })
    
    renderWidget({}, store)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('handles different chart types', () => {
    renderWidget({ config: { chartType: 'area' } })
    
    const chartElement = screen.getByTestId('chart-data')
    const chartData = JSON.parse(chartElement.textContent || '{}')
    
    // Should have fill enabled for area chart
    expect(chartData.datasets[0].fill).toBe(true)
  })

  it('adapts to dark theme', () => {
    const store = createTestStore({
      ui: {
        theme: 'dark',
      },
    })
    
    renderWidget({}, store)
    
    const chartOptions = screen.getByTestId('chart-options')
    const options = JSON.parse(chartOptions.textContent || '{}')
    
    // Should have dark theme colors
    expect(options.plugins.tooltip.backgroundColor).toBe('#1e293b')
  })

  it('shows trend icons correctly', () => {
    renderWidget()
    
    // Should have either trending up, down, or stable icon
    const trendElements = document.querySelectorAll('[data-testid*="trend"], .lucide-trending')
    expect(trendElements.length).toBeGreaterThan(0)
  })

  it('displays no data message when chart data is unavailable', () => {
    // Mock the useEffect to not set chart data
    jest.spyOn(React, 'useEffect').mockImplementation((fn) => {
      // Don't execute the effect that sets chart data
    })
    
    renderWidget()
    
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })
})

describe('ProductivityTrendsWidget Data Processing', () => {
  it('generates sample data correctly', () => {
    renderWidget()
    
    const chartElement = screen.getByTestId('chart-data')
    const chartData = JSON.parse(chartElement.textContent || '{}')
    
    // Should have labels and data
    expect(chartData.labels).toBeDefined()
    expect(chartData.datasets).toBeDefined()
    expect(chartData.datasets[0].data).toBeDefined()
    
    // Should have 30 days of data
    expect(chartData.labels.length).toBe(30)
    expect(chartData.datasets[0].data.length).toBe(30)
  })

  it('calculates trend correctly', () => {
    renderWidget()
    
    // Should calculate and display percentage change
    const trendElement = screen.getByText(/vs last week/)
    expect(trendElement).toBeInTheDocument()
    
    // Should show either positive or negative change
    const changeText = trendElement.textContent
    expect(changeText).toMatch(/[+-]?\d+\.?\d*%/)
  })

  it('handles empty productivity trends data', () => {
    const store = createTestStore({
      metrics: {
        productivityTrends: [],
      },
    })
    
    renderWidget({}, store)
    
    // Should still render with generated sample data
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })
})