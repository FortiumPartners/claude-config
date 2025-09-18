/**
 * WebSocket Service Unit Tests
 * Tests for real-time communication, connection management, and event handling
 */

import { WebSocketService } from '../../../services/websocket.service'
import { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { ActivityItem } from '../../../types/api'

// Mock dependencies
jest.mock('socket.io')
jest.mock('@socket.io/redis-adapter')
jest.mock('ioredis')
jest.mock('../../../auth/jwt.service')

const mockHttpServer = {
  listen: jest.fn(),
  close: jest.fn(),
} as any

const mockSocket = {
  id: 'socket-123',
  userId: 'user-1',
  tenantId: 'tenant-1',
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
  handshake: {
    auth: {
      token: 'valid-jwt-token',
    },
    headers: {},
  },
  request: {
    headers: {},
  },
}

const mockIO = {
  adapter: jest.fn(),
  engine: {
    generateId: jest.fn().mockReturnValue('socket-123'),
  },
  use: jest.fn(),
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  sockets: {
    sockets: new Map([['socket-123', mockSocket]]),
  },
  close: jest.fn(),
}

const mockRedis = {
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  publish: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
}

jest.mock('../../../auth/jwt.service', () => ({
  JWTService: {
    verifyToken: jest.fn(),
  },
}))

import { JWTService } from '../../../auth/jwt.service'

describe('WebSocketService', () => {
  let service: WebSocketService
  let mockActivity: ActivityItem

  beforeEach(() => {
    service = new WebSocketService(mockHttpServer)
    
    // Reset all mocks
    jest.clearAllMocks()
    
    // Setup mock implementations
    ;(SocketIOServer as jest.MockedClass<typeof SocketIOServer>).mockImplementation(() => mockIO as any)
    ;(Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis as any)
    
    // Mock JWT verification
    ;(JWTService.verifyToken as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      email: 'user@example.com',
    })

    // Mock activity data
    mockActivity = {
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
      timestamp: new Date(),
      duration_ms: 150,
      execution_context: {
        session_id: 'session-1',
      },
      tags: ['development'],
      priority: 'medium',
      is_automated: false,
    }
  })

  describe('Service Initialization', () => {
    it('should initialize WebSocket server correctly', async () => {
      await service.initialize()

      expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: process.env.FRONTEND_URL || 'http://localhost:3000',
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true,
      })
    })

    it('should setup Redis adapter for scaling', async () => {
      const mockAdapter = jest.fn()
      ;(createAdapter as jest.Mock).mockReturnValue(mockAdapter)

      await service.initialize()

      expect(createAdapter).toHaveBeenCalled()
      expect(mockIO.adapter).toHaveBeenCalledWith(mockAdapter)
    })

    it('should register authentication middleware', async () => {
      await service.initialize()

      expect(mockIO.use).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should setup connection event handlers', async () => {
      await service.initialize()

      expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function))
    })
  })

  describe('Authentication', () => {
    let authMiddleware: any

    beforeEach(async () => {
      await service.initialize()
      authMiddleware = (mockIO.use as jest.Mock).mock.calls[0][0]
    })

    it('should authenticate valid JWT tokens', async () => {
      const next = jest.fn()

      await authMiddleware(mockSocket, next)

      expect(JWTService.verifyToken).toHaveBeenCalledWith('valid-jwt-token')
      expect(mockSocket.userId).toBe('user-1')
      expect(mockSocket.tenantId).toBe('tenant-1')
      expect(next).toHaveBeenCalledWith()
    })

    it('should reject invalid JWT tokens', async () => {
      const next = jest.fn()
      ;(JWTService.verifyToken as jest.Mock).mockRejectedValue(new Error('Invalid token'))

      await authMiddleware(mockSocket, next)

      expect(next).toHaveBeenCalledWith(new Error('Authentication failed'))
    })

    it('should reject missing tokens', async () => {
      const next = jest.fn()
      mockSocket.handshake.auth.token = undefined

      await authMiddleware(mockSocket, next)

      expect(next).toHaveBeenCalledWith(new Error('Authentication failed'))
    })

    it('should handle API key authentication', async () => {
      const next = jest.fn()
      mockSocket.handshake.auth = {}
      mockSocket.handshake.headers['x-api-key'] = 'valid-api-key'
      
      // Mock API key verification
      ;(JWTService.verifyToken as jest.Mock).mockImplementation((token) => {
        if (token === 'valid-api-key') {
          return Promise.resolve({
            userId: 'api-user',
            tenantId: 'api-tenant',
            type: 'api_key',
          })
        }
        throw new Error('Invalid API key')
      })

      await authMiddleware(mockSocket, next)

      expect(mockSocket.userId).toBe('api-user')
      expect(mockSocket.tenantId).toBe('api-tenant')
      expect(next).toHaveBeenCalledWith()
    })
  })

  describe('Connection Management', () => {
    let connectionHandler: any

    beforeEach(async () => {
      await service.initialize()
      connectionHandler = (mockIO.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1]
    })

    it('should handle new connections', async () => {
      await connectionHandler(mockSocket)

      expect(service.getConnectedUsers()).toContain('user-1')
      expect(service.getConnectionCount()).toBe(1)
    })

    it('should join user to tenant room', async () => {
      await connectionHandler(mockSocket)

      expect(mockSocket.join).toHaveBeenCalledWith('tenant-1')
      expect(mockSocket.join).toHaveBeenCalledWith('user-1')
    })

    it('should setup socket event handlers', async () => {
      await connectionHandler(mockSocket)

      expect(mockSocket.on).toHaveBeenCalledWith('subscribe', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('ping', expect.any(Function))
    })

    it('should handle socket disconnection', async () => {
      await connectionHandler(mockSocket)
      
      const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'disconnect'
      )[1]

      await disconnectHandler('transport close')

      expect(service.getConnectionCount()).toBe(0)
      expect(service.getConnectedUsers()).not.toContain('user-1')
    })
  })

  describe('Room Management', () => {
    let subscribeHandler: any
    let unsubscribeHandler: any

    beforeEach(async () => {
      await service.initialize()
      const connectionHandler = (mockIO.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1]
      await connectionHandler(mockSocket)

      subscribeHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'subscribe'
      )[1]
      unsubscribeHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        call => call[0] === 'unsubscribe'
      )[1]
    })

    it('should subscribe to activity streams', async () => {
      const rooms = ['activities', 'user-activity', 'tool-metrics']

      await subscribeHandler(rooms)

      rooms.forEach(room => {
        expect(mockSocket.join).toHaveBeenCalledWith(`tenant-1:${room}`)
      })
    })

    it('should unsubscribe from rooms', async () => {
      const rooms = ['activities', 'user-activity']

      await unsubscribeHandler(rooms)

      rooms.forEach(room => {
        expect(mockSocket.leave).toHaveBeenCalledWith(`tenant-1:${room}`)
      })
    })

    it('should validate room permissions', async () => {
      // Test admin-only rooms
      const adminRooms = ['admin-metrics', 'system-logs']
      mockSocket.userRole = 'user' // Not admin

      await subscribeHandler(adminRooms)

      // Should not join admin rooms for regular users
      adminRooms.forEach(room => {
        expect(mockSocket.join).not.toHaveBeenCalledWith(`tenant-1:${room}`)
      })
    })

    it('should handle malformed room names', async () => {
      const invalidRooms = ['', null, undefined, 'room/with/invalid/chars']

      await subscribeHandler(invalidRooms)

      // Should filter out invalid room names
      expect(mockSocket.join).not.toHaveBeenCalledWith('tenant-1:')
      expect(mockSocket.join).not.toHaveBeenCalledWith('tenant-1:room/with/invalid/chars')
    })
  })

  describe('Event Broadcasting', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should broadcast activity updates', async () => {
      await service.broadcastActivity(mockActivity)

      expect(mockIO.to).toHaveBeenCalledWith(`tenant-1:activities`)
      expect(mockIO.emit).toHaveBeenCalledWith('activity_update', {
        type: 'new_activity',
        activity: mockActivity,
        timestamp: expect.any(Date),
      })
    })

    it('should broadcast to specific users', async () => {
      await service.broadcastToUser('user-1', 'personal_notification', {
        message: 'Your task completed successfully',
        activity_id: mockActivity.id,
      })

      expect(mockIO.to).toHaveBeenCalledWith('user-1')
      expect(mockIO.emit).toHaveBeenCalledWith('personal_notification', {
        message: 'Your task completed successfully',
        activity_id: mockActivity.id,
        timestamp: expect.any(Date),
      })
    })

    it('should broadcast system metrics', async () => {
      const metrics = {
        active_users: 5,
        active_sessions: 3,
        activity_count_last_hour: 150,
        average_response_time: 250,
      }

      await service.broadcastMetrics(metrics)

      expect(mockIO.to).toHaveBeenCalledWith('tenant-1:system-metrics')
      expect(mockIO.emit).toHaveBeenCalledWith('system_metrics', {
        metrics,
        timestamp: expect.any(Date),
      })
    })

    it('should handle broadcast errors gracefully', async () => {
      mockIO.to.mockImplementation(() => {
        throw new Error('Socket.IO error')
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await service.broadcastActivity(mockActivity)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to broadcast activity:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should track connection metrics', async () => {
      // Simulate multiple connections
      const connections = Array.from({ length: 5 }, (_, i) => ({
        ...mockSocket,
        id: `socket-${i}`,
        userId: `user-${i}`,
      }))

      for (const conn of connections) {
        await service.handleConnection(conn as any)
      }

      const metrics = await service.getConnectionMetrics()

      expect(metrics).toEqual({
        total_connections: 5,
        active_users: 5,
        connections_by_tenant: {
          'tenant-1': 5,
        },
        average_connection_duration: expect.any(Number),
        peak_connections_today: expect.any(Number),
      })
    })

    it('should track message throughput', async () => {
      const startTime = Date.now()
      
      // Send multiple messages
      for (let i = 0; i < 100; i++) {
        await service.broadcastActivity({
          ...mockActivity,
          id: `activity-${i}`,
        })
      }

      const metrics = await service.getThroughputMetrics()

      expect(metrics.messages_sent_last_minute).toBe(100)
      expect(metrics.average_latency_ms).toBeLessThan(100)
    })

    it('should detect performance bottlenecks', async () => {
      // Simulate slow message processing
      mockIO.emit.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 1000))
      })

      const warnings = await service.checkPerformanceWarnings()

      expect(warnings).toContainEqual({
        type: 'high_latency',
        threshold_ms: 500,
        current_ms: expect.any(Number),
        recommendation: 'Consider optimizing message serialization or reducing payload size',
      })
    })
  })

  describe('Error Handling and Recovery', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should handle Redis connection failures', async () => {
      const errorHandler = (mockRedis.on as jest.Mock).mock.calls.find(
        call => call[0] === 'error'
      )[1]

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await errorHandler(new Error('Redis connection lost'))

      expect(consoleSpy).toHaveBeenCalledWith(
        'Redis error:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should implement connection health checks', async () => {
      const health = await service.getHealthStatus()

      expect(health).toEqual({
        status: 'healthy',
        websocket_server: 'running',
        redis_connection: 'connected',
        active_connections: expect.any(Number),
        memory_usage: expect.any(Number),
        uptime_seconds: expect.any(Number),
      })
    })

    it('should cleanup resources on shutdown', async () => {
      await service.shutdown()

      expect(mockIO.close).toHaveBeenCalled()
      expect(mockRedis.disconnect).toHaveBeenCalled()
    })

    it('should handle malformed messages', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Simulate malformed activity data
      await service.broadcastActivity(null as any)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Attempted to broadcast invalid activity data:',
        null
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Security Features', () => {
    beforeEach(async () => {
      await service.initialize()
    })

    it('should rate limit connection attempts', async () => {
      const rateLimitedSocket = {
        ...mockSocket,
        request: {
          ...mockSocket.request,
          connection: {
            remoteAddress: '192.168.1.1',
          },
        },
      }

      // Attempt multiple connections from same IP
      for (let i = 0; i < 20; i++) {
        await service.handleConnection(rateLimitedSocket as any)
      }

      // Should reject excess connections
      const result = await service.handleConnection(rateLimitedSocket as any)
      expect(result).toBeNull() // Connection rejected
    })

    it('should validate message payload sizes', async () => {
      const largeActivity = {
        ...mockActivity,
        target: {
          ...mockActivity.target,
          metadata: {
            large_data: 'x'.repeat(1024 * 1024), // 1MB of data
          },
        },
      }

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      await service.broadcastActivity(largeActivity)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Activity payload exceeds size limit:',
        expect.any(Number)
      )

      consoleSpy.mockRestore()
    })

    it('should sanitize sensitive data', async () => {
      const sensitiveActivity = {
        ...mockActivity,
        execution_context: {
          session_id: 'session-1',
          api_key: 'secret-api-key',
          password: 'secret-password',
        },
      }

      await service.broadcastActivity(sensitiveActivity)

      const broadcastedData = (mockIO.emit as jest.Mock).mock.calls[0][1]
      
      expect(broadcastedData.activity.execution_context.api_key).toBe('[REDACTED]')
      expect(broadcastedData.activity.execution_context.password).toBe('[REDACTED]')
      expect(broadcastedData.activity.execution_context.session_id).toBe('session-1') // Non-sensitive
    })
  })
})