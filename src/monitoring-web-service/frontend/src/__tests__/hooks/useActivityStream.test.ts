/**
 * useActivityStream Hook Tests
 * Tests for activity stream management, filtering, and real-time updates
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useActivityStream } from '../../hooks/useActivityStream'
import { ActivityItem, ActivityFilter } from '../../types/api'
import * as apiModule from '../../services/api'

// Mock dependencies
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
  },
}))

const mockActivitiesApi = vi.mocked(apiModule.activitiesApi)

describe('useActivityStream', () => {
  const mockActivities: ActivityItem[] = [
    {
      id: 'activity-1',
      user: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
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
      },
      status: 'success',
      timestamp: new Date('2024-01-01T10:05:00Z'),
      duration_ms: 2000,
      execution_context: {
        session_id: 'session-2',
      },
      tags: ['git', 'automation'],
      priority: 'high',
      is_automated: true,
    },
  ]

  const mockApiResponse = {
    data: {
      data: mockActivities,
      pagination: {
        total: 2,
        has_next: false,
        page: 1,
        limit: 50,
      },
    },
  }

  beforeEach(() => {
    mockActivitiesApi.list.mockResolvedValue(mockApiResponse)
    vi.clearAllMocks()

    // Mock global event listeners
    global.addEventListener = vi.fn()
    global.removeEventListener = vi.fn()
    global.window = global as any
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('Initial State and Configuration', () => {
    it('initializes with default configuration', async () => {
      const { result } = renderHook(() => useActivityStream())

      expect(result.current.isLoading).toBe(true)
      expect(result.current.activities).toEqual([])
      expect(result.current.filteredActivities).toEqual([])
      expect(result.current.error).toBeNull()
      expect(result.current.updateCount).toBe(0)
      expect(result.current.totalCount).toBe(0)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('applies custom configuration', async () => {
      const config = {
        initialLoadSize: 10,
        maxCacheSize: 100,
        realTimeEnabled: false,
        subscriptions: ['custom-room'],
        defaultFilters: { show_automated: false },
      }

      const { result } = renderHook(() => useActivityStream(config))

      expect(mockActivitiesApi.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          show_automated: false,
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('loads initial data on mount', async () => {
      const { result } = renderHook(() => useActivityStream())

      expect(mockActivitiesApi.list).toHaveBeenCalledWith({
        limit: 50,
        sort: 'timestamp',
        order: 'desc',
        show_automated: true,
      })

      await waitFor(() => {
        expect(result.current.activities).toEqual(mockActivities)
        expect(result.current.filteredActivities).toEqual(mockActivities)
        expect(result.current.totalCount).toBe(2)
      })
    })
  })

  describe('Data Loading', () => {
    it('handles successful data loading', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.activities).toEqual(mockActivities)
        expect(result.current.error).toBeNull()
      })
    })

    it('handles API errors', async () => {
      const errorMessage = 'Network error'
      mockActivitiesApi.list.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBe(errorMessage)
        expect(result.current.activities).toEqual([])
      })
    })

    it('refreshes data when requested', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      act(() => {
        result.current.refresh()
      })

      expect(result.current.isLoading).toBe(true)
      expect(mockActivitiesApi.list).toHaveBeenCalledTimes(2)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('loads more data for pagination', async () => {
      // Mock response with more data available
      const paginatedResponse = {
        ...mockApiResponse,
        data: {
          ...mockApiResponse.data,
          pagination: {
            ...mockApiResponse.data.pagination,
            has_next: true,
          },
        },
      }

      mockActivitiesApi.list.mockResolvedValueOnce(paginatedResponse)

      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.hasMore).toBe(true)
      })

      // Mock second page response
      const secondPageActivities = [
        {
          ...mockActivities[0],
          id: 'activity-3',
          user: { ...mockActivities[0].user, name: 'User 3' },
        },
      ]

      mockActivitiesApi.list.mockResolvedValueOnce({
        data: {
          data: secondPageActivities,
          pagination: {
            total: 3,
            has_next: false,
            page: 2,
            limit: 25,
          },
        },
      })

      act(() => {
        result.current.loadMore()
      })

      await waitFor(() => {
        expect(result.current.activities).toHaveLength(3)
        expect(result.current.hasMore).toBe(false)
      })

      expect(mockActivitiesApi.list).toHaveBeenLastCalledWith({
        limit: 25,
        offset: 2,
        sort: 'timestamp',
        order: 'desc',
        show_automated: true,
      })
    })
  })

  describe('Filtering', () => {
    beforeEach(async () => {
      // Wait for initial load to complete
      const { result } = renderHook(() => useActivityStream())
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('applies search query filter', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })

      act(() => {
        result.current.applyFilters({ search_query: 'git' })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
        expect(result.current.filteredActivities[0].id).toBe('activity-2')
      })
    })

    it('applies user filter', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })

      act(() => {
        result.current.applyFilters({ user_ids: ['user-1'] })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
        expect(result.current.filteredActivities[0].user.id).toBe('user-1')
      })
    })

    it('applies status filter', async () => {
      const activitiesWithError = [
        ...mockActivities,
        {
          ...mockActivities[0],
          id: 'activity-error',
          status: 'error' as const,
        },
      ]

      mockActivitiesApi.list.mockResolvedValueOnce({
        data: {
          data: activitiesWithError,
          pagination: { total: 3, has_next: false, page: 1, limit: 50 },
        },
      })

      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(3)
      })

      act(() => {
        result.current.applyFilters({ status_filters: ['error'] })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
        expect(result.current.filteredActivities[0].status).toBe('error')
      })
    })

    it('applies automated activity filter', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })

      act(() => {
        result.current.applyFilters({ show_automated: false })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
        expect(result.current.filteredActivities[0].is_automated).toBe(false)
      })
    })

    it('applies duration filters', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })

      act(() => {
        result.current.applyFilters({ 
          min_duration: 1000,
          max_duration: 5000,
        })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
        expect(result.current.filteredActivities[0].duration_ms).toBe(2000)
      })
    })

    it('applies date range filter', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })

      act(() => {
        result.current.applyFilters({
          date_range: {
            start: new Date('2024-01-01T10:02:00Z'),
            end: new Date('2024-01-01T10:10:00Z'),
          },
        })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
        expect(result.current.filteredActivities[0].id).toBe('activity-2')
      })
    })

    it('applies tag filters', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })

      act(() => {
        result.current.applyFilters({ tags: ['git'] })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
        expect(result.current.filteredActivities[0].tags).toContain('git')
      })
    })

    it('clears filters when requested', async () => {
      const { result } = renderHook(() => useActivityStream({
        defaultFilters: { show_automated: true },
      }))

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })

      // Apply filters
      act(() => {
        result.current.applyFilters({ search_query: 'git' })
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(1)
      })

      // Clear filters
      act(() => {
        result.current.clearFilters()
      })

      await waitFor(() => {
        expect(result.current.filteredActivities).toHaveLength(2)
      })
    })

    it('debounces filter applications', async () => {
      vi.useFakeTimers()
      
      const { result } = renderHook(() => useActivityStream({
        debounceMs: 300,
      }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Apply multiple filters quickly
      act(() => {
        result.current.applyFilters({ search_query: 'a' })
        result.current.applyFilters({ search_query: 'ab' })
        result.current.applyFilters({ search_query: 'abc' })
      })

      // Should still have original results before debounce
      expect(result.current.filteredActivities).toHaveLength(2)

      // Fast-forward debounce timer
      act(() => {
        vi.advanceTimersByTime(300)
      })

      await waitFor(() => {
        // Should apply the final filter
        expect(result.current.filteredActivities).toHaveLength(0) // No matches for 'abc'
      })

      vi.useRealTimers()
    })
  })

  describe('Real-time Updates', () => {
    it('processes real-time activity events', async () => {
      const { result } = renderHook(() => useActivityStream({
        realTimeEnabled: true,
        bufferSize: 1, // Process immediately
      }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const newActivity: ActivityItem = {
        ...mockActivities[0],
        id: 'real-time-activity',
        user: { ...mockActivities[0].user, name: 'Real-time User' },
      }

      // Simulate real-time event
      const eventHandlers = (global.addEventListener as jest.Mock).mock.calls
      const metricIngestedHandler = eventHandlers.find(
        call => call[0] === 'metric_ingested'
      )?.[1]

      if (metricIngestedHandler) {
        act(() => {
          metricIngestedHandler({
            type: 'metric_ingested',
            detail: {
              data: {
                tool_name: 'Read',
                user_id: 'real-time-user',
                user_name: 'Real-time User',
                success: true,
                timestamp: Date.now(),
                execution_time_ms: 100,
                session_id: 'session-rt',
              },
            },
          })
        })
      }

      await waitFor(() => {
        expect(result.current.activities.length).toBeGreaterThan(2)
        expect(result.current.updateCount).toBeGreaterThan(0)
      })
    })

    it('buffers real-time updates for performance', async () => {
      const { result } = renderHook(() => useActivityStream({
        realTimeEnabled: true,
        bufferSize: 3, // Buffer 3 activities before processing
      }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const initialCount = result.current.activities.length

      // Send 2 activities (should be buffered)
      const eventHandlers = (global.addEventListener as jest.Mock).mock.calls
      const activityStreamHandler = eventHandlers.find(
        call => call[0] === 'activity_stream'
      )?.[1]

      if (activityStreamHandler) {
        for (let i = 0; i < 2; i++) {
          act(() => {
            activityStreamHandler({
              type: 'activity_stream',
              detail: {
                data: {
                  activity: {
                    ...mockActivities[0],
                    id: `buffered-${i}`,
                  },
                },
              },
            })
          })
        }

        // Should still have original count (buffered)
        expect(result.current.activities.length).toBe(initialCount)

        // Send third activity to trigger buffer flush
        act(() => {
          activityStreamHandler({
            type: 'activity_stream',
            detail: {
              data: {
                activity: {
                  ...mockActivities[0],
                  id: 'buffered-trigger',
                },
              },
            },
          })
        })

        await waitFor(() => {
          expect(result.current.activities.length).toBe(initialCount + 3)
        })
      }
    })
  })

  describe('Cache Management', () => {
    it('respects maximum cache size', async () => {
      const { result } = renderHook(() => useActivityStream({
        maxCacheSize: 3,
      }))

      await waitFor(() => {
        expect(result.current.activities).toHaveLength(2)
      })

      // Add more activities via real-time updates
      const moreActivities = Array.from({ length: 5 }, (_, i) => ({
        ...mockActivities[0],
        id: `cache-test-${i}`,
      }))

      act(() => {
        // Simulate buffer flush with many activities
        moreActivities.forEach(activity => {
          result.current.activities.unshift(activity)
        })
      })

      await waitFor(() => {
        expect(result.current.activities.length).toBeLessThanOrEqual(3)
      })
    })

    it('clears cache when requested', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.activities).toHaveLength(2)
      })

      act(() => {
        result.current.clearCache()
      })

      expect(result.current.activities).toHaveLength(0)
      expect(result.current.filteredActivities).toHaveLength(0)
      expect(result.current.updateCount).toBe(0)
    })
  })

  describe('Auto-refresh', () => {
    it('sets up auto-refresh interval', async () => {
      vi.useFakeTimers()

      const { result } = renderHook(() => useActivityStream({
        autoRefreshInterval: 5000,
      }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockActivitiesApi.list).toHaveBeenCalledTimes(1)

      // Fast-forward 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockActivitiesApi.list).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('cleans up intervals on unmount', () => {
      vi.useFakeTimers()
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      const { unmount } = renderHook(() => useActivityStream({
        autoRefreshInterval: 5000,
      }))

      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe('Utility Functions', () => {
    it('finds activities by ID', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.activities).toHaveLength(2)
      })

      const foundActivity = result.current.getActivity('activity-1')
      expect(foundActivity).toBeDefined()
      expect(foundActivity?.id).toBe('activity-1')

      const notFound = result.current.getActivity('non-existent')
      expect(notFound).toBeUndefined()
    })

    it('provides virtualized items', async () => {
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.activities).toHaveLength(2)
      })

      const virtualizedItems = result.current.getVirtualizedItems(0, 1)
      expect(virtualizedItems).toHaveLength(2) // All items within range
    })

    it('marks activities as read', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation()
      const { result } = renderHook(() => useActivityStream())

      await waitFor(() => {
        expect(result.current.activities).toHaveLength(2)
      })

      act(() => {
        result.current.markActivityAsRead('activity-1')
      })

      expect(consoleSpy).toHaveBeenCalledWith('Mark activity as read:', 'activity-1')

      consoleSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      const onError = vi.fn()
      mockActivitiesApi.list.mockRejectedValue(new Error('Network failed'))

      const { result } = renderHook(() => useActivityStream({
        onError,
      }))

      await waitFor(() => {
        expect(result.current.error).toBe('Network failed')
        expect(onError).toHaveBeenCalledWith(new Error('Network failed'))
      })
    })

    it('handles malformed real-time data', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation()
      const { result } = renderHook(() => useActivityStream({
        realTimeEnabled: true,
      }))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Simulate malformed event
      const eventHandlers = (global.addEventListener as jest.Mock).mock.calls
      const handler = eventHandlers.find(call => call[0] === 'metric_ingested')?.[1]

      if (handler) {
        act(() => {
          handler({
            type: 'metric_ingested',
            detail: null, // Malformed data
          })
        })
      }

      // Should not crash the application
      expect(result.current.activities).toHaveLength(2)

      consoleSpy.mockRestore()
    })
  })

  describe('Memory Management', () => {
    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useActivityStream({
        realTimeEnabled: true,
      }))

      expect(global.addEventListener).toHaveBeenCalledTimes(3) // Three event types

      unmount()

      expect(global.removeEventListener).toHaveBeenCalledTimes(3)
    })

    it('cleans up timers on unmount', () => {
      vi.useFakeTimers()
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      const { unmount } = renderHook(() => useActivityStream({
        debounceMs: 300,
        autoRefreshInterval: 5000,
      }))

      unmount()

      expect(clearTimeoutSpy).toHaveBeenCalled()
      expect(clearIntervalSpy).toHaveBeenCalled()

      vi.useRealTimers()
    })
  })
})