/**
 * Activity Data Service Unit Tests
 * Tests for activity data management, caching, and filtering
 */

import { ActivityDataService } from '../../../services/activity-data.service'
import { PrismaClient } from '@prisma/client'
import { ActivityItem, ActivityFilter } from '../../../types/api'

// Mock dependencies
jest.mock('@prisma/client')
jest.mock('ioredis')

const mockPrisma = {
  activity: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
} as any

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  mget: jest.fn(),
  pipeline: jest.fn().mockReturnValue({
    set: jest.fn(),
    expire: jest.fn(),
    exec: jest.fn(),
  }),
}

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis)
})

describe('ActivityDataService', () => {
  let service: ActivityDataService
  let mockActivities: ActivityItem[]

  beforeEach(() => {
    service = new ActivityDataService(mockPrisma)
    
    // Reset all mocks
    jest.clearAllMocks()
    
    // Mock data
    mockActivities = [
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
        metrics: {
          input_tokens: 100,
          output_tokens: 50,
          memory_usage: 1024,
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
          metadata: { branch: 'main', commit: 'abc123' },
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
  })

  describe('Activity Retrieval', () => {
    beforeEach(() => {
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities)
      mockPrisma.activity.count.mockResolvedValue(mockActivities.length)
    })

    it('should retrieve activities with pagination', async () => {
      const result = await service.getActivities({
        limit: 10,
        offset: 0,
        sort: 'timestamp',
        order: 'desc',
      })

      expect(result.data).toEqual(mockActivities)
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.has_next).toBe(false)
      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        orderBy: { timestamp: 'desc' },
        include: {
          user: true,
          action: true,
          target: true,
          execution_context: true,
          metrics: true,
          error_details: true,
        },
      })
    })

    it('should apply filters correctly', async () => {
      const filters: Partial<ActivityFilter> = {
        user_ids: ['user-1'],
        action_types: ['tool_usage'],
        status_filters: ['success'],
        priority_levels: ['medium'],
        show_automated: false,
        search_query: 'read',
        date_range: {
          start: new Date('2024-01-01T00:00:00Z'),
          end: new Date('2024-01-01T23:59:59Z'),
        },
      }

      await service.getActivities({ ...filters, limit: 10, offset: 0 })

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith({
        take: 10,
        skip: 0,
        where: {
          user_id: { in: ['user-1'] },
          action_type: { in: ['tool_usage'] },
          status: { in: ['success'] },
          priority: { in: ['medium'] },
          is_automated: false,
          AND: [
            {
              OR: [
                { user: { name: { contains: 'read', mode: 'insensitive' } } },
                { action: { name: { contains: 'read', mode: 'insensitive' } } },
                { target: { name: { contains: 'read', mode: 'insensitive' } } },
                { action: { description: { contains: 'read', mode: 'insensitive' } } },
              ],
            },
          ],
          timestamp: {
            gte: new Date('2024-01-01T00:00:00Z'),
            lte: new Date('2024-01-01T23:59:59Z'),
          },
        },
        include: expect.any(Object),
      })
    })

    it('should handle duration filters', async () => {
      const filters: Partial<ActivityFilter> = {
        min_duration: 100,
        max_duration: 1000,
      }

      await service.getActivities({ ...filters, limit: 10, offset: 0 })

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            duration_ms: {
              gte: 100,
              lte: 1000,
            },
          }),
        })
      )
    })

    it('should handle tag filters', async () => {
      const filters: Partial<ActivityFilter> = {
        tags: ['development', 'automation'],
      }

      await service.getActivities({ ...filters, limit: 10, offset: 0 })

      expect(mockPrisma.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: {
              hasSome: ['development', 'automation'],
            },
          }),
        })
      )
    })
  })

  describe('Activity Caching', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue('OK')
    })

    it('should cache activity data', async () => {
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities)
      mockPrisma.activity.count.mockResolvedValue(2)

      const cacheKey = 'activities:user-1:limit-10:offset-0'
      
      const result = await service.getActivitiesWithCache('user-1', {
        limit: 10,
        offset: 0,
      })

      expect(mockRedis.set).toHaveBeenCalledWith(
        cacheKey,
        JSON.stringify(result),
        'EX',
        300 // 5 minutes TTL
      )
    })

    it('should return cached data when available', async () => {
      const cachedResult = {
        data: mockActivities,
        pagination: { total: 2, has_next: false, page: 1, limit: 10 },
      }

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult))

      const result = await service.getActivitiesWithCache('user-1', {
        limit: 10,
        offset: 0,
      })

      expect(result).toEqual(cachedResult)
      expect(mockPrisma.activity.findMany).not.toHaveBeenCalled()
    })

    it('should invalidate cache on activity updates', async () => {
      mockRedis.keys.mockResolvedValue(['activities:user-1:*', 'activities:user-2:*'])
      mockRedis.del.mockResolvedValue(2)

      await service.invalidateUserCache('user-1')

      expect(mockRedis.keys).toHaveBeenCalledWith('activities:user-1:*')
      expect(mockRedis.del).toHaveBeenCalledWith(['activities:user-1:*', 'activities:user-2:*'])
    })

    it('should handle cache errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities)
      mockPrisma.activity.count.mockResolvedValue(2)

      const result = await service.getActivitiesWithCache('user-1', {
        limit: 10,
        offset: 0,
      })

      expect(result.data).toEqual(mockActivities)
      expect(mockPrisma.activity.findMany).toHaveBeenCalled()
    })
  })

  describe('Activity Creation', () => {
    it('should create new activity', async () => {
      const newActivity = {
        user_id: 'user-1',
        action_type: 'tool_usage',
        action_name: 'Write Tool',
        target_name: 'output.txt',
        status: 'success',
        duration_ms: 200,
      }

      const createdActivity = { id: 'activity-3', ...newActivity }
      mockPrisma.activity.create.mockResolvedValue(createdActivity)

      const result = await service.createActivity(newActivity)

      expect(result).toEqual(createdActivity)
      expect(mockPrisma.activity.create).toHaveBeenCalledWith({
        data: newActivity,
        include: {
          user: true,
          action: true,
          target: true,
          execution_context: true,
          metrics: true,
          error_details: true,
        },
      })
    })

    it('should validate activity data before creation', async () => {
      const invalidActivity = {
        // Missing required fields
        user_id: '',
        status: 'invalid_status',
      }

      await expect(service.createActivity(invalidActivity as any)).rejects.toThrow(
        'Invalid activity data'
      )
    })
  })

  describe('Activity Updates', () => {
    it('should update activity status', async () => {
      const updatedActivity = { ...mockActivities[0], status: 'error' }
      mockPrisma.activity.update.mockResolvedValue(updatedActivity)

      const result = await service.updateActivityStatus('activity-1', 'error')

      expect(result.status).toBe('error')
      expect(mockPrisma.activity.update).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
        data: { status: 'error' },
        include: expect.any(Object),
      })
    })

    it('should add error details on failure', async () => {
      const errorDetails = {
        message: 'File not found',
        stack: 'Error stack trace',
        recovery_suggestions: ['Check file path', 'Verify permissions'],
      }

      mockPrisma.activity.update.mockResolvedValue({
        ...mockActivities[0],
        status: 'error',
        error_details: errorDetails,
      })

      const result = await service.updateActivityWithError('activity-1', errorDetails)

      expect(result.status).toBe('error')
      expect(result.error_details).toEqual(errorDetails)
    })
  })

  describe('Performance Metrics', () => {
    it('should calculate activity statistics', async () => {
      mockPrisma.activity.findMany.mockResolvedValue(mockActivities)

      const stats = await service.getActivityStatistics('user-1', {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z'),
      })

      expect(stats).toEqual({
        total_activities: 2,
        success_count: 2,
        error_count: 0,
        in_progress_count: 0,
        automated_count: 1,
        manual_count: 1,
        success_rate: 100,
        average_duration_ms: 1075,
        total_duration_ms: 2150,
        activities_by_type: {
          tool_usage: 1,
          command_execution: 1,
        },
        activities_by_priority: {
          medium: 1,
          high: 1,
        },
      })
    })

    it('should track performance trends', async () => {
      const trendData = [
        { date: '2024-01-01', count: 10, avg_duration: 500 },
        { date: '2024-01-02', count: 15, avg_duration: 450 },
        { date: '2024-01-03', count: 12, avg_duration: 600 },
      ]

      mockPrisma.activity.findMany.mockResolvedValue(trendData as any)

      const trends = await service.getActivityTrends('user-1', {
        period: 'daily',
        start: new Date('2024-01-01'),
        end: new Date('2024-01-03'),
      })

      expect(trends).toHaveLength(3)
      expect(trends[0]).toEqual({
        period: '2024-01-01',
        activity_count: 10,
        average_duration: 500,
        success_rate: expect.any(Number),
      })
    })
  })

  describe('Batch Operations', () => {
    it('should process batch activity creation', async () => {
      const batchActivities = [
        { user_id: 'user-1', action_type: 'tool_usage', target_name: 'file1.txt' },
        { user_id: 'user-1', action_type: 'tool_usage', target_name: 'file2.txt' },
      ]

      mockPrisma.activity.create.mockResolvedValueOnce({ id: 'activity-3' })
      mockPrisma.activity.create.mockResolvedValueOnce({ id: 'activity-4' })

      const results = await service.createActivitiesBatch(batchActivities)

      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('activity-3')
      expect(results[1].id).toBe('activity-4')
      expect(mockPrisma.activity.create).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures in batch operations', async () => {
      const batchActivities = [
        { user_id: 'user-1', action_type: 'tool_usage', target_name: 'file1.txt' },
        { user_id: '', action_type: 'invalid', target_name: '' }, // Invalid activity
      ]

      mockPrisma.activity.create.mockResolvedValueOnce({ id: 'activity-3' })
      mockPrisma.activity.create.mockRejectedValueOnce(new Error('Validation failed'))

      const results = await service.createActivitiesBatch(batchActivities, {
        continueOnError: true,
      })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('activity-3')
    })
  })

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockPrisma.activity.findMany.mockRejectedValue(new Error('Database unavailable'))

      await expect(
        service.getActivities({ limit: 10, offset: 0 })
      ).rejects.toThrow('Database unavailable')
    })

    it('should handle malformed filter data', async () => {
      const invalidFilters = {
        date_range: 'not-a-date-range',
        user_ids: 'not-an-array',
      }

      await expect(
        service.getActivities({ ...invalidFilters as any, limit: 10, offset: 0 })
      ).rejects.toThrow('Invalid filter parameters')
    })

    it('should validate pagination parameters', async () => {
      await expect(
        service.getActivities({ limit: -1, offset: 0 })
      ).rejects.toThrow('Invalid pagination parameters')

      await expect(
        service.getActivities({ limit: 1001, offset: 0 })
      ).rejects.toThrow('Limit exceeds maximum allowed value')
    })
  })

  describe('Memory Management', () => {
    it('should limit memory usage for large result sets', async () => {
      // Create a large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        ...mockActivities[0],
        id: `activity-${i}`,
      }))

      mockPrisma.activity.findMany.mockResolvedValue(largeDataset)

      const result = await service.getActivities({
        limit: 10000,
        offset: 0,
        streamingEnabled: true,
      })

      // Should implement streaming or chunking for large datasets
      expect(result.data.length).toBeLessThanOrEqual(1000) // Max chunk size
    })

    it('should cleanup cached data periodically', async () => {
      mockRedis.keys.mockResolvedValue(['activities:old-key-1', 'activities:old-key-2'])
      mockRedis.del.mockResolvedValue(2)

      await service.cleanupExpiredCache()

      expect(mockRedis.keys).toHaveBeenCalledWith('activities:*')
      expect(mockRedis.del).toHaveBeenCalled()
    })
  })
})