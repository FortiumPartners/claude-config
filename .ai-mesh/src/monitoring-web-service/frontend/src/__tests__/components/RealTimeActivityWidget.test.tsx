/**
 * Real-Time Activity Widget Component Tests
 * Tests for component rendering, interactions, and real-time updates
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import RealTimeActivityWidget from '../../components/dashboard/RealTimeActivityWidget'
import { ActivityItem, ActivityFilter } from '../../types/api'
import * as useActivityStreamModule from '../../hooks/useActivityStream'

// Mock dependencies
vi.mock('../../hooks/useActivityStream')
vi.mock('../../contexts/WebSocketContext', () => ({
  useWebSocket: () => ({
    isConnected: true,
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  }),
}))

vi.mock('../../contexts/TenantContext', () => ({
  useCurrentTenant: () => ({
    id: 'tenant-1',
    name: 'Test Tenant',
  }),
}))

vi.mock('../../services/api', () => ({
  activitiesApi: {
    list: vi.fn(),
    export: vi.fn(),
  },
}))

const mockUseActivityStream = vi.mocked(useActivityStreamModule.useActivityStream)

describe('RealTimeActivityWidget', () => {
  const mockActivities: ActivityItem[] = [
    {
      id: 'activity-1',
      user: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
      },
      action: {
        type: 'tool_usage',
        name: 'Read Tool',
        description: 'File read operation',
        category: 'file_operation',
      },
      target: {
        name: 'test.txt',
        type: 'file',
        metadata: { size: 1024 },
      },
      status: 'success',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      duration_ms: 150,
      execution_context: {
        session_id: 'session-1',
      },
      tags: ['development', 'file'],
      priority: 'medium',
      is_automated: false,
    },
    {
      id: 'activity-2',
      user: {
        id: 'user-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
      },
      action: {
        type: 'command_execution',
        name: 'Git Commit',
        description: 'Created git commit',
        category: 'version_control',
      },
      target: {
        name: 'repository',
        type: 'git_repo',
        metadata: { branch: 'main' },
      },
      status: 'error',
      timestamp: new Date('2024-01-01T10:05:00Z'),
      duration_ms: 2000,
      execution_context: {
        session_id: 'session-2',
      },
      tags: ['git', 'automation'],
      priority: 'high',
      is_automated: true,
      error_details: {
        message: 'Git repository not found',
        recovery_suggestions: ['Initialize git repository', 'Check repository path'],
      },
    },
  ]

  const defaultConfig = {
    showTimestamp: true,
    maxItems: 20,
    showAvatars: true,
    showFilters: true,
    enableRealTime: true,
    compactView: false,
    showStats: true,
    autoRefresh: 0,
  }

  const mockActivityStreamReturn = {
    activities: mockActivities,
    filteredActivities: mockActivities,
    isLoading: false,
    isConnected: true,
    hasMore: false,
    error: null,
    updateCount: 2,
    lastUpdate: new Date('2024-01-01T10:05:00Z'),
    totalCount: 2,
    refresh: vi.fn(),
    loadMore: vi.fn(),
    clearCache: vi.fn(),
    applyFilters: vi.fn(),
    clearFilters: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActivity: vi.fn(),
    markActivityAsRead: vi.fn(),
    getVirtualizedItems: vi.fn(),
  }

  beforeEach(() => {
    mockUseActivityStream.mockReturnValue(mockActivityStreamReturn)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('renders widget with default configuration', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('Real-time Activity')).toBeInTheDocument()
      expect(screen.getByText('Live updates')).toBeInTheDocument()
      expect(screen.getByText('2 updates')).toBeInTheDocument()
    })

    it('shows activity list with correct data', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('File read operation')).toBeInTheDocument()
      expect(screen.getByText('Created git commit')).toBeInTheDocument()
    })

    it('displays user avatars when enabled', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const avatar = screen.getByAltText('John Doe')
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg')

      // Check initials for user without avatar
      expect(screen.getByText('JS')).toBeInTheDocument() // Jane Smith initials
    })

    it('hides avatars when disabled', () => {
      render(
        <RealTimeActivityWidget 
          config={{ ...defaultConfig, showAvatars: false }} 
        />
      )

      expect(screen.queryByAltText('John Doe')).not.toBeInTheDocument()
      expect(screen.queryByText('JS')).not.toBeInTheDocument()
    })

    it('shows activity statistics', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('50%')).toBeInTheDocument() // Success rate (1/2)
      expect(screen.getByText('2')).toBeInTheDocument() // Total activities
      expect(screen.getByText('1')).toBeInTheDocument() // Automated activities
    })

    it('displays status icons correctly', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      // Success icon for activity-1
      const successIcon = screen.getByLabelText('Success')
      expect(successIcon).toBeInTheDocument()

      // Error icon for activity-2
      const errorIcon = screen.getByLabelText('Error')
      expect(errorIcon).toBeInTheDocument()

      // Automation icon for activity-2
      const automationIcon = screen.getByTitle('Automated')
      expect(automationIcon).toBeInTheDocument()
    })

    it('shows timestamps when enabled', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      // Check for relative timestamps
      expect(screen.getAllByText(/ago/)).toHaveLength(2)
    })

    it('hides timestamps when disabled', () => {
      render(
        <RealTimeActivityWidget 
          config={{ ...defaultConfig, showTimestamp: false }} 
        />
      )

      expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
    })
  })

  describe('Compact View Mode', () => {
    it('renders in compact mode', () => {
      render(
        <RealTimeActivityWidget 
          config={{ ...defaultConfig, compactView: true }} 
        />
      )

      // In compact mode, target names should not be shown
      expect(screen.queryByText('test.txt')).not.toBeInTheDocument()
      expect(screen.queryByText('repository')).not.toBeInTheDocument()
    })

    it('shows full details in normal mode', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('test.txt')).toBeInTheDocument()
      expect(screen.getByText('repository')).toBeInTheDocument()
    })
  })

  describe('Filtering Functionality', () => {
    it('shows filter panel when enabled', async () => {
      const user = userEvent.setup()
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const filterButton = screen.getByLabelText('Toggle filters')
      await user.click(filterButton)

      await waitFor(() => {
        expect(screen.getByTestId('activity-filter-panel')).toBeInTheDocument()
      })
    })

    it('applies filters when changed', async () => {
      const user = userEvent.setup()
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const filterButton = screen.getByLabelText('Toggle filters')
      await user.click(filterButton)

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search activities...')
        return user.type(searchInput, 'git')
      })

      expect(mockActivityStreamReturn.applyFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          search_query: 'git',
        })
      )
    })

    it('clears filters when requested', async () => {
      const user = userEvent.setup()
      
      // Mock filtered state
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        filteredActivities: [],
        totalCount: 0,
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      const clearFiltersButton = screen.getByText('Clear filters')
      await user.click(clearFiltersButton)

      expect(mockActivityStreamReturn.clearFilters).toHaveBeenCalled()
    })
  })

  describe('Real-time Updates', () => {
    it('shows connection status indicator', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      // Connected indicator (green dot on Activity icon)
      const activityIcon = screen.getByText('Real-time Activity').closest('div')
      expect(within(activityIcon!).getByText('Live updates')).toBeInTheDocument()
    })

    it('shows offline indicator when disconnected', () => {
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        isConnected: false,
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('Offline mode')).toBeInTheDocument()
      expect(screen.getByText('Offline')).toBeInTheDocument() // Bottom indicator
    })

    it('updates activity count on new activities', () => {
      const { rerender } = render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('2 updates')).toBeInTheDocument()

      // Simulate new activities
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        updateCount: 5,
      })

      rerender(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('5 updates')).toBeInTheDocument()
    })
  })

  describe('Activity Interactions', () => {
    it('opens detail modal when activity is clicked', async () => {
      const user = userEvent.setup()
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const activityRow = screen.getByText('John Doe').closest('[role="button"]')
      await user.click(activityRow!)

      await waitFor(() => {
        expect(screen.getByTestId('activity-detail-modal')).toBeInTheDocument()
      })
    })

    it('closes detail modal', async () => {
      const user = userEvent.setup()
      render(<RealTimeActivityWidget config={defaultConfig} />)

      // Open modal
      const activityRow = screen.getByText('John Doe').closest('[role="button"]')
      await user.click(activityRow!)

      await waitFor(() => {
        expect(screen.getByTestId('activity-detail-modal')).toBeInTheDocument()
      })

      // Close modal
      const closeButton = screen.getByLabelText('Close modal')
      await user.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByTestId('activity-detail-modal')).not.toBeInTheDocument()
      })
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const activityRows = screen.getAllByRole('button')
      const firstActivity = activityRows.find(el => 
        el.getAttribute('aria-label')?.includes('John Doe')
      )

      await user.tab() // Navigate to first activity
      expect(firstActivity).toHaveFocus()

      await user.keyboard('{Enter}') // Open modal

      await waitFor(() => {
        expect(screen.getByTestId('activity-detail-modal')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('displays error state', () => {
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        error: 'Failed to load activities',
        activities: [],
        filteredActivities: [],
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('Error loading activities')).toBeInTheDocument()
      expect(screen.getByText('Failed to load activities')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    it('retries on error button click', async () => {
      const user = userEvent.setup()
      
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        error: 'Network error',
        activities: [],
        filteredActivities: [],
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      const retryButton = screen.getByText('Try Again')
      await user.click(retryButton)

      expect(mockActivityStreamReturn.refresh).toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    it('shows loading state', () => {
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        isLoading: true,
        activities: [],
        filteredActivities: [],
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('Loading activities...')).toBeInTheDocument()
    })

    it('shows empty state', () => {
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        activities: [],
        filteredActivities: [],
        totalCount: 0,
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('No recent activity')).toBeInTheDocument()
    })
  })

  describe('Widget Controls', () => {
    it('refreshes data on refresh button click', async () => {
      const user = userEvent.setup()
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const refreshButton = screen.getByLabelText('Refresh activities')
      await user.click(refreshButton)

      expect(mockActivityStreamReturn.refresh).toHaveBeenCalled()
    })

    it('shows loading spinner on refresh', async () => {
      const user = userEvent.setup()
      
      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        isLoading: true,
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      const refreshButton = screen.getByLabelText('Refresh activities')
      expect(refreshButton).toBeDisabled()
      
      // Check for spinning animation class
      const refreshIcon = within(refreshButton).getByRole('img', { hidden: true })
      expect(refreshIcon).toHaveClass('animate-spin')
    })

    it('calls onExpand when expand button is clicked', async () => {
      const onExpand = vi.fn()
      const user = userEvent.setup()
      
      render(
        <RealTimeActivityWidget 
          config={defaultConfig} 
          onExpand={onExpand}
        />
      )

      const expandButton = screen.getByLabelText('Expand widget')
      await user.click(expandButton)

      expect(onExpand).toHaveBeenCalled()
    })

    it('calls onRemove when in editing mode', async () => {
      const onRemove = vi.fn()
      const user = userEvent.setup()
      
      render(
        <RealTimeActivityWidget 
          config={defaultConfig}
          isEditing={true}
          onRemove={onRemove}
        />
      )

      const removeButton = screen.getByLabelText('Remove widget')
      await user.click(removeButton)

      expect(onRemove).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByLabelText('Toggle filters')).toBeInTheDocument()
      expect(screen.getByLabelText('Refresh activities')).toBeInTheDocument()
      expect(screen.getByLabelText('Success')).toBeInTheDocument()
      expect(screen.getByLabelText('Error')).toBeInTheDocument()
    })

    it('supports screen readers', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const activityButton = screen.getByLabelText(
        'View details for John Doe File read operation test.txt'
      )
      expect(activityButton).toBeInTheDocument()
    })

    it('provides time information accessibly', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      const timeElement = screen.getByText(/ago/).closest('time')
      expect(timeElement).toHaveAttribute('dateTime', '2024-01-01T10:00:00.000Z')
    })
  })

  describe('Performance Optimizations', () => {
    it('limits displayed activities to maxItems', () => {
      const manyActivities = Array.from({ length: 50 }, (_, i) => ({
        ...mockActivities[0],
        id: `activity-${i}`,
        user: { ...mockActivities[0].user, name: `User ${i}` },
      }))

      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        activities: manyActivities,
        filteredActivities: manyActivities,
      })

      render(
        <RealTimeActivityWidget 
          config={{ ...defaultConfig, maxItems: 5 }} 
        />
      )

      // Should only render 5 activities
      const activityRows = screen.getAllByRole('button').filter(
        button => button.getAttribute('aria-label')?.includes('View details')
      )
      expect(activityRows).toHaveLength(5)
    })

    it('uses virtualization for large lists when enabled', () => {
      const manyActivities = Array.from({ length: 100 }, (_, i) => ({
        ...mockActivities[0],
        id: `activity-${i}`,
      }))

      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        activities: manyActivities,
        filteredActivities: manyActivities,
        getVirtualizedItems: vi.fn().mockReturnValue(manyActivities.slice(0, 10)),
      })

      render(
        <RealTimeActivityWidget 
          config={{ ...defaultConfig, compactView: false }} 
        />
      )

      expect(mockActivityStreamReturn.getVirtualizedItems).toHaveBeenCalled()
    })
  })

  describe('Priority Indicators', () => {
    it('shows priority badges for high and critical priority', () => {
      const highPriorityActivity = {
        ...mockActivities[0],
        priority: 'high' as const,
      }

      const criticalPriorityActivity = {
        ...mockActivities[1],
        priority: 'critical' as const,
      }

      mockUseActivityStream.mockReturnValue({
        ...mockActivityStreamReturn,
        activities: [highPriorityActivity, criticalPriorityActivity],
        filteredActivities: [highPriorityActivity, criticalPriorityActivity],
      })

      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.getByText('high')).toBeInTheDocument()
      expect(screen.getByText('critical')).toBeInTheDocument()
    })

    it('does not show priority badges for normal priority', () => {
      render(<RealTimeActivityWidget config={defaultConfig} />)

      expect(screen.queryByText('medium')).not.toBeInTheDocument()
    })
  })
})