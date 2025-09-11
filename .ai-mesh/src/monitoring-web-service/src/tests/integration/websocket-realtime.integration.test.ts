/**
 * WebSocket Real-time Integration Tests
 * End-to-end tests for real-time communication between client and server
 */

import { Server } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { io as SocketIOClient, Socket } from 'socket.io-client'
import express from 'express'
import { WebSocketService } from '../../services/websocket.service'
import { ActivityDataService } from '../../services/activity-data.service'
import { JWTService } from '../../auth/jwt.service'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { ActivityItem } from '../../types/api'

// Test configuration
const TEST_PORT = 3001
const TEST_HOST = 'localhost'

describe('WebSocket Real-time Integration', () => {
  let httpServer: Server
  let webSocketService: WebSocketService
  let activityDataService: ActivityDataService
  let clientSocket: Socket
  let prisma: PrismaClient
  let redis: Redis

  const testUser = {
    id: 'test-user-1',
    name: 'Test User',
    email: 'test@example.com',
    tenantId: 'test-tenant-1',
  }

  const mockActivity: ActivityItem = {
    id: 'activity-integration-test',
    user: {
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
    },
    action: {
      type: 'tool_usage',
      name: 'Integration Test Tool',
      description: 'Testing real-time activity updates',
      category: 'testing',
    },
    target: {
      name: 'integration-test.txt',
      type: 'file',
    },
    status: 'success',
    timestamp: new Date(),
    duration_ms: 250,
    execution_context: {
      session_id: 'integration-test-session',
    },
    tags: ['integration', 'testing'],
    priority: 'medium',
    is_automated: false,
  }

  beforeAll(async () => {
    // Setup test database and Redis
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'sqlite://./test.db',
        },
      },
    })

    redis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      db: 1, // Use test database
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    })

    // Initialize services
    activityDataService = new ActivityDataService(prisma)

    // Setup HTTP server
    const app = express()
    httpServer = app.listen(TEST_PORT)

    // Initialize WebSocket service
    webSocketService = new WebSocketService(httpServer)
    await webSocketService.initialize()

    // Generate test JWT token
    const testToken = await JWTService.generateToken({
      userId: testUser.id,
      email: testUser.email,
      tenantId: testUser.tenantId,
    })

    // Setup client socket with authentication
    clientSocket = SocketIOClient(`http://${TEST_HOST}:${TEST_PORT}`, {
      auth: {
        token: testToken,
      },
      transports: ['websocket'],
      forceNew: true,
    })

    // Wait for connection
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Client connection timeout'))
      }, 5000)

      clientSocket.on('connect', () => {
        clearTimeout(timeout)
        resolve()
      })

      clientSocket.on('connect_error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  })

  afterAll(async () => {
    // Cleanup
    if (clientSocket?.connected) {
      clientSocket.disconnect()
    }

    if (webSocketService) {
      await webSocketService.shutdown()
    }

    if (httpServer) {
      httpServer.close()
    }

    if (prisma) {
      await prisma.$disconnect()
    }

    if (redis) {
      redis.disconnect()
    }
  })

  beforeEach(async () => {
    // Clear test data
    await redis.flushdb()
    
    // Ensure clean state
    if (clientSocket?.connected) {
      // Unsubscribe from all rooms
      clientSocket.emit('unsubscribe', ['activities', 'user-activity', 'tool-metrics'])
    }
  })

  describe('Connection Management', () => {
    it('establishes WebSocket connection with authentication', async () => {
      expect(clientSocket.connected).toBe(true)
      expect(clientSocket.id).toBeDefined()
    })

    it('rejects unauthenticated connections', async () => {
      const unauthorizedSocket = SocketIOClient(`http://${TEST_HOST}:${TEST_PORT}`, {
        auth: {
          token: 'invalid-token',
        },
        transports: ['websocket'],
        forceNew: true,
      })

      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          expect(unauthorizedSocket.connected).toBe(false)
          unauthorizedSocket.disconnect()
          resolve()
        }, 1000)

        unauthorizedSocket.on('connect', () => {
          clearTimeout(timeout)
          unauthorizedSocket.disconnect()
          throw new Error('Should not connect with invalid token')
        })

        unauthorizedSocket.on('connect_error', (error) => {
          clearTimeout(timeout)
          expect(error.message).toContain('Authentication failed')
          unauthorizedSocket.disconnect()
          resolve()
        })
      })
    })

    it('handles connection heartbeat', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.emit('ping', { timestamp: Date.now() })

        clientSocket.on('pong', (data) => {
          expect(data.timestamp).toBeDefined()
          expect(data.server_time).toBeDefined()
          resolve()
        })

        setTimeout(() => {
          throw new Error('Ping/pong timeout')
        }, 1000)
      })
    })
  })

  describe('Room Subscription Management', () => {
    it('subscribes to activity rooms', async () => {
      return new Promise<void>((resolve) => {
        const rooms = ['activities', 'user-activity', 'tool-metrics']

        clientSocket.emit('subscribe', rooms)

        clientSocket.on('subscription_confirmed', (data) => {
          expect(data.rooms).toEqual(expect.arrayContaining(rooms))
          expect(data.tenant_id).toBe(testUser.tenantId)
          resolve()
        })

        setTimeout(() => {
          throw new Error('Subscription confirmation timeout')
        }, 2000)
      })
    })

    it('unsubscribes from rooms', async () => {
      // First subscribe
      clientSocket.emit('subscribe', ['activities'])

      await new Promise<void>((resolve) => {
        clientSocket.on('subscription_confirmed', () => resolve())
      })

      // Then unsubscribe
      return new Promise<void>((resolve) => {
        clientSocket.emit('unsubscribe', ['activities'])

        clientSocket.on('unsubscription_confirmed', (data) => {
          expect(data.rooms).toContain('activities')
          resolve()
        })

        setTimeout(() => {
          throw new Error('Unsubscription confirmation timeout')
        }, 2000)
      })
    })

    it('validates room permissions', async () => {
      return new Promise<void>((resolve) => {
        // Try to subscribe to admin-only room as regular user
        const adminRooms = ['admin-metrics', 'system-logs']
        
        clientSocket.emit('subscribe', adminRooms)

        clientSocket.on('subscription_error', (data) => {
          expect(data.error).toContain('Insufficient permissions')
          expect(data.denied_rooms).toEqual(expect.arrayContaining(adminRooms))
          resolve()
        })

        setTimeout(() => {
          throw new Error('Permission validation timeout')
        }, 2000)
      })
    })
  })

  describe('Real-time Activity Broadcasting', () => {
    beforeEach(async () => {
      // Subscribe to activities room
      clientSocket.emit('subscribe', ['activities'])
      
      await new Promise<void>((resolve) => {
        clientSocket.on('subscription_confirmed', () => resolve())
      })
    })

    it('receives activity updates in real-time', async () => {
      return new Promise<void>((resolve) => {
        clientSocket.on('activity_update', (data) => {
          expect(data.type).toBe('new_activity')
          expect(data.activity).toMatchObject({
            id: mockActivity.id,
            user: expect.objectContaining({
              id: mockActivity.user.id,
              name: mockActivity.user.name,
            }),
            action: expect.objectContaining({
              type: mockActivity.action.type,
              name: mockActivity.action.name,
            }),
            status: mockActivity.status,
          })
          expect(data.timestamp).toBeDefined()
          resolve()
        })

        // Broadcast activity from server
        setTimeout(() => {
          webSocketService.broadcastActivity(mockActivity)
        }, 100)
      })
    })

    it('receives personal notifications', async () => {
      return new Promise<void>((resolve) => {
        const notification = {
          message: 'Your task completed successfully',
          activity_id: mockActivity.id,
          priority: 'high',
        }

        clientSocket.on('personal_notification', (data) => {
          expect(data.message).toBe(notification.message)
          expect(data.activity_id).toBe(notification.activity_id)
          expect(data.priority).toBe(notification.priority)
          expect(data.timestamp).toBeDefined()
          resolve()
        })

        // Send personal notification from server
        setTimeout(() => {
          webSocketService.broadcastToUser(testUser.id, 'personal_notification', notification)
        }, 100)
      })
    })

    it('receives system metrics updates', async () => {
      // Subscribe to system metrics
      clientSocket.emit('subscribe', ['system-metrics'])

      await new Promise<void>((resolve) => {
        clientSocket.on('subscription_confirmed', () => resolve())
      })

      return new Promise<void>((resolve) => {
        const metrics = {
          active_users: 5,
          active_sessions: 3,
          activity_count_last_hour: 150,
          average_response_time: 250,
        }

        clientSocket.on('system_metrics', (data) => {
          expect(data.metrics).toEqual(metrics)
          expect(data.timestamp).toBeDefined()
          resolve()
        })

        // Broadcast metrics from server
        setTimeout(() => {
          webSocketService.broadcastMetrics(metrics)
        }, 100)
      })
    })

    it('filters activities by tenant', async () => {
      // Create another client with different tenant
      const otherTenantToken = await JWTService.generateToken({
        userId: 'other-user',
        email: 'other@example.com',
        tenantId: 'other-tenant',
      })

      const otherClientSocket = SocketIOClient(`http://${TEST_HOST}:${TEST_PORT}`, {
        auth: {
          token: otherTenantToken,
        },
        transports: ['websocket'],
        forceNew: true,
      })

      await new Promise<void>((resolve) => {
        otherClientSocket.on('connect', () => resolve())
      })

      // Subscribe both clients to activities
      otherClientSocket.emit('subscribe', ['activities'])

      let receivedCount = 0
      const expectedCount = 1 // Only original client should receive

      clientSocket.on('activity_update', () => {
        receivedCount++
      })

      otherClientSocket.on('activity_update', () => {
        receivedCount++
        throw new Error('Other tenant should not receive activities')
      })

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(receivedCount).toBe(expectedCount)
          otherClientSocket.disconnect()
          resolve()
        }, 500)

        // Broadcast activity to specific tenant
        webSocketService.broadcastToTenant(testUser.tenantId, 'activity_update', {
          type: 'new_activity',
          activity: mockActivity,
        })
      })
    })
  })

  describe('High-Frequency Updates', () => {
    beforeEach(async () => {
      clientSocket.emit('subscribe', ['activities'])
      
      await new Promise<void>((resolve) => {
        clientSocket.on('subscription_confirmed', () => resolve())
      })
    })

    it('handles rapid activity updates', async () => {
      const updateCount = 50
      let receivedCount = 0

      return new Promise<void>((resolve) => {
        clientSocket.on('activity_update', (data) => {
          receivedCount++
          expect(data.type).toBe('new_activity')
          
          if (receivedCount === updateCount) {
            resolve()
          }
        })

        // Send rapid updates
        for (let i = 0; i < updateCount; i++) {
          setTimeout(() => {
            webSocketService.broadcastActivity({
              ...mockActivity,
              id: `rapid-update-${i}`,
              timestamp: new Date(),
            })
          }, i * 10) // 10ms intervals
        }
      })
    })

    it('handles concurrent client connections', async () => {
      const clientCount = 10
      const clients: Socket[] = []
      let connectionsEstablished = 0

      // Create multiple client connections
      const connectionPromises = Array.from({ length: clientCount }, async (_, i) => {
        const token = await JWTService.generateToken({
          userId: `concurrent-user-${i}`,
          email: `user${i}@example.com`,
          tenantId: testUser.tenantId,
        })

        const client = SocketIOClient(`http://${TEST_HOST}:${TEST_PORT}`, {
          auth: { token },
          transports: ['websocket'],
          forceNew: true,
        })

        clients.push(client)

        return new Promise<void>((resolve) => {
          client.on('connect', () => {
            connectionsEstablished++
            client.emit('subscribe', ['activities'])
            resolve()
          })
        })
      })

      await Promise.all(connectionPromises)
      expect(connectionsEstablished).toBe(clientCount)

      // Broadcast to all clients and verify reception
      return new Promise<void>((resolve) => {
        let totalReceived = 0
        const expectedTotal = clientCount + 1 // Including original client

        const handleActivityUpdate = () => {
          totalReceived++
          if (totalReceived === expectedTotal) {
            resolve()
          }
        }

        clientSocket.on('activity_update', handleActivityUpdate)
        clients.forEach(client => {
          client.on('activity_update', handleActivityUpdate)
        })

        // Broadcast activity
        webSocketService.broadcastActivity({
          ...mockActivity,
          id: 'concurrent-test-activity',
        })

        // Cleanup after test
        setTimeout(() => {
          clients.forEach(client => client.disconnect())
        }, 1000)
      })
    })
  })

  describe('Error Handling and Recovery', () => {
    it('handles client disconnection gracefully', async () => {
      // Monitor server-side connection count
      const initialConnections = webSocketService.getConnectionCount()
      
      // Create temporary client
      const tempToken = await JWTService.generateToken({
        userId: 'temp-user',
        email: 'temp@example.com',
        tenantId: testUser.tenantId,
      })

      const tempClient = SocketIOClient(`http://${TEST_HOST}:${TEST_PORT}`, {
        auth: { token: tempToken },
        transports: ['websocket'],
        forceNew: true,
      })

      await new Promise<void>((resolve) => {
        tempClient.on('connect', () => {
          expect(webSocketService.getConnectionCount()).toBe(initialConnections + 1)
          resolve()
        })
      })

      // Disconnect client
      return new Promise<void>((resolve) => {
        tempClient.on('disconnect', () => {
          setTimeout(() => {
            expect(webSocketService.getConnectionCount()).toBe(initialConnections)
            resolve()
          }, 100) // Allow time for cleanup
        })

        tempClient.disconnect()
      })
    })

    it('recovers from Redis connection failures', async () => {
      // Simulate Redis disconnection
      const originalPublish = redis.publish.bind(redis)
      const publishSpy = jest.spyOn(redis, 'publish')
      publishSpy.mockRejectedValue(new Error('Redis connection lost'))

      // Should still handle local broadcasting
      return new Promise<void>((resolve) => {
        clientSocket.emit('subscribe', ['activities'])

        clientSocket.on('activity_update', (data) => {
          expect(data.activity.id).toBe('redis-failure-test')
          resolve()
        })

        setTimeout(() => {
          webSocketService.broadcastActivity({
            ...mockActivity,
            id: 'redis-failure-test',
          })
        }, 100)

        // Restore original function after test
        setTimeout(() => {
          publishSpy.mockRestore()
        }, 500)
      })
    })

    it('handles malformed message data', async () => {
      clientSocket.emit('subscribe', ['activities'])

      return new Promise<void>((resolve) => {
        let errorLogged = false

        // Mock console.error to catch error handling
        const originalConsoleError = console.error
        console.error = (...args: any[]) => {
          if (args[0]?.includes('Failed to broadcast')) {
            errorLogged = true
          }
        }

        clientSocket.on('activity_update', () => {
          throw new Error('Should not receive malformed data')
        })

        setTimeout(() => {
          // Restore console.error
          console.error = originalConsoleError
          
          // Verify error was handled gracefully
          expect(errorLogged).toBe(true)
          resolve()
        }, 500)

        // Attempt to broadcast malformed data
        try {
          webSocketService.broadcastActivity(null as any)
        } catch (error) {
          // Should be handled gracefully
        }
      })
    })
  })

  describe('Performance Monitoring', () => {
    it('tracks connection metrics accurately', async () => {
      const metrics = await webSocketService.getConnectionMetrics()

      expect(metrics).toEqual({
        total_connections: expect.any(Number),
        active_users: expect.any(Number),
        connections_by_tenant: expect.any(Object),
        average_connection_duration: expect.any(Number),
        peak_connections_today: expect.any(Number),
      })

      expect(metrics.total_connections).toBeGreaterThanOrEqual(1)
      expect(metrics.connections_by_tenant[testUser.tenantId]).toBeGreaterThanOrEqual(1)
    })

    it('measures message latency', async () => {
      clientSocket.emit('subscribe', ['activities'])

      return new Promise<void>((resolve) => {
        const startTime = Date.now()

        clientSocket.on('activity_update', () => {
          const latency = Date.now() - startTime
          expect(latency).toBeLessThan(100) // Should be very fast in test environment
          resolve()
        })

        webSocketService.broadcastActivity({
          ...mockActivity,
          id: 'latency-test',
        })
      })
    })

    it('provides health status information', async () => {
      const health = await webSocketService.getHealthStatus()

      expect(health).toEqual({
        status: 'healthy',
        websocket_server: 'running',
        redis_connection: expect.any(String),
        active_connections: expect.any(Number),
        memory_usage: expect.any(Number),
        uptime_seconds: expect.any(Number),
      })

      expect(health.status).toBe('healthy')
      expect(health.websocket_server).toBe('running')
      expect(health.active_connections).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Data Integration', () => {
    it('integrates with activity data service', async () => {
      // Create activity in database
      const dbActivity = await activityDataService.createActivity({
        user_id: testUser.id,
        action_type: 'tool_usage',
        action_name: 'Database Integration Test',
        target_name: 'test-file.txt',
        status: 'success',
        duration_ms: 300,
        session_id: 'db-integration-session',
      })

      expect(dbActivity).toBeDefined()
      expect(dbActivity.id).toBeDefined()

      // Subscribe to activities
      clientSocket.emit('subscribe', ['activities'])

      return new Promise<void>((resolve) => {
        clientSocket.on('activity_update', (data) => {
          expect(data.activity.id).toBe(dbActivity.id)
          expect(data.activity.action.name).toBe('Database Integration Test')
          resolve()
        })

        // Broadcast the database activity
        setTimeout(() => {
          webSocketService.broadcastActivity(dbActivity as ActivityItem)
        }, 100)
      })
    })
  })

  describe('Security Features', () => {
    it('sanitizes sensitive data in broadcasts', async () => {
      const sensitiveActivity = {
        ...mockActivity,
        id: 'security-test',
        execution_context: {
          session_id: 'test-session',
          api_key: 'secret-key-12345',
          password: 'secret-password',
        },
      }

      clientSocket.emit('subscribe', ['activities'])

      return new Promise<void>((resolve) => {
        clientSocket.on('activity_update', (data) => {
          expect(data.activity.execution_context.session_id).toBe('test-session')
          expect(data.activity.execution_context.api_key).toBe('[REDACTED]')
          expect(data.activity.execution_context.password).toBe('[REDACTED]')
          resolve()
        })

        webSocketService.broadcastActivity(sensitiveActivity)
      })
    })

    it('validates payload sizes', async () => {
      const largeActivity = {
        ...mockActivity,
        id: 'large-payload-test',
        target: {
          ...mockActivity.target,
          metadata: {
            large_data: 'x'.repeat(1024 * 1024), // 1MB payload
          },
        },
      }

      clientSocket.emit('subscribe', ['activities'])

      return new Promise<void>((resolve) => {
        let warningLogged = false
        const originalConsoleWarn = console.warn

        console.warn = (...args: any[]) => {
          if (args[0]?.includes('payload exceeds size limit')) {
            warningLogged = true
          }
        }

        setTimeout(() => {
          console.warn = originalConsoleWarn
          expect(warningLogged).toBe(true)
          resolve()
        }, 500)

        webSocketService.broadcastActivity(largeActivity)
      })
    })
  })
})