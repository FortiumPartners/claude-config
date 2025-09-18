/**
 * Real-time Activity Performance Tests
 * High-load and stress tests for activity streaming and WebSocket performance
 */

import { Server } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { io as SocketIOClient, Socket } from 'socket.io-client'
import express from 'express'
import { performance } from 'perf_hooks'
import { WebSocketService } from '../../services/websocket.service'
import { ActivityDataService } from '../../services/activity-data.service'
import { JWTService } from '../../auth/jwt.service'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'
import { ActivityItem } from '../../types/api'

// Performance test configuration
const PERFORMANCE_TEST_PORT = 3002
const PERFORMANCE_TEST_HOST = 'localhost'

// Performance thresholds (from TRD requirements)
const PERFORMANCE_THRESHOLDS = {
  CONNECTION_TIME_MS: 500,
  MESSAGE_LATENCY_MS: 100,
  THROUGHPUT_MESSAGES_PER_SECOND: 1000,
  CONCURRENT_CONNECTIONS: 1000,
  MEMORY_USAGE_MB: 500,
  DATABASE_QUERY_MS: 50,
  CACHE_HIT_RATIO: 0.8,
  ERROR_RATE: 0.01, // 1%
}

interface PerformanceMetrics {
  connectionTime: number
  messageLatency: number[]
  throughput: number
  memoryUsage: number
  errorCount: number
  totalMessages: number
  connectionCount: number
  startTime: number
  endTime: number
}

describe('Real-time Activity Performance Tests', () => {
  let httpServer: Server
  let webSocketService: WebSocketService
  let activityDataService: ActivityDataService
  let prisma: PrismaClient
  let redis: Redis

  const testTenantId = 'performance-test-tenant'
  
  beforeAll(async () => {
    // Setup test services
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.PERFORMANCE_TEST_DATABASE_URL || 'sqlite://./performance-test.db',
        },
      },
    })

    redis = new Redis({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      db: 2, // Use performance test database
      maxRetriesPerRequest: 3,
    })

    activityDataService = new ActivityDataService(prisma)

    // Setup HTTP server
    const app = express()
    httpServer = app.listen(PERFORMANCE_TEST_PORT)

    // Initialize WebSocket service
    webSocketService = new WebSocketService(httpServer)
    await webSocketService.initialize()

    // Pre-warm the system
    await warmupSystem()
  })

  afterAll(async () => {
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
    // Clear Redis cache for consistent testing
    await redis.flushdb()
    // Reset performance monitoring
    await webSocketService.resetPerformanceMetrics()
  })

  describe('Connection Performance', () => {
    it('establishes connections within threshold', async () => {
      const connectionCount = 100
      const startTime = performance.now()
      const clients: Socket[] = []

      const connectionPromises = Array.from({ length: connectionCount }, async (_, i) => {
        const token = await JWTService.generateToken({
          userId: `perf-user-${i}`,
          email: `perf${i}@example.com`,
          tenantId: testTenantId,
        })

        const connectionStart = performance.now()
        
        const client = SocketIOClient(`http://${PERFORMANCE_TEST_HOST}:${PERFORMANCE_TEST_PORT}`, {
          auth: { token },
          transports: ['websocket'],
          forceNew: true,
        })

        clients.push(client)

        return new Promise<number>((resolve) => {
          client.on('connect', () => {
            const connectionTime = performance.now() - connectionStart
            resolve(connectionTime)
          })
        })
      })

      const connectionTimes = await Promise.all(connectionPromises)
      const totalTime = performance.now() - startTime
      const averageConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionCount

      console.log(`Connection Performance Metrics:`)
      console.log(`- Total connections: ${connectionCount}`)
      console.log(`- Total time: ${totalTime.toFixed(2)}ms`)
      console.log(`- Average connection time: ${averageConnectionTime.toFixed(2)}ms`)
      console.log(`- Max connection time: ${Math.max(...connectionTimes).toFixed(2)}ms`)
      console.log(`- Min connection time: ${Math.min(...connectionTimes).toFixed(2)}ms`)

      expect(averageConnectionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONNECTION_TIME_MS)
      expect(Math.max(...connectionTimes)).toBeLessThan(PERFORMANCE_THRESHOLDS.CONNECTION_TIME_MS * 2)

      // Cleanup
      clients.forEach(client => client.disconnect())
    })

    it('handles concurrent connection bursts', async () => {
      const burstSize = 50
      const burstCount = 10
      const totalConnections = burstSize * burstCount
      const clients: Socket[] = []

      const burstTimes: number[] = []

      for (let burst = 0; burst < burstCount; burst++) {
        const burstStart = performance.now()

        const burstPromises = Array.from({ length: burstSize }, async (_, i) => {
          const userId = `burst-${burst}-user-${i}`
          const token = await JWTService.generateToken({
            userId,
            email: `${userId}@example.com`,
            tenantId: testTenantId,
          })

          const client = SocketIOClient(`http://${PERFORMANCE_TEST_HOST}:${PERFORMANCE_TEST_PORT}`, {
            auth: { token },
            transports: ['websocket'],
            forceNew: true,
          })

          clients.push(client)

          return new Promise<void>((resolve) => {
            client.on('connect', () => resolve())
          })
        })

        await Promise.all(burstPromises)
        const burstTime = performance.now() - burstStart
        burstTimes.push(burstTime)

        // Small delay between bursts
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const averageBurstTime = burstTimes.reduce((a, b) => a + b, 0) / burstCount

      console.log(`Burst Connection Metrics:`)
      console.log(`- Burst size: ${burstSize}`)
      console.log(`- Burst count: ${burstCount}`)
      console.log(`- Total connections: ${totalConnections}`)
      console.log(`- Average burst time: ${averageBurstTime.toFixed(2)}ms`)

      expect(averageBurstTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONNECTION_TIME_MS * burstSize / 10)

      // Cleanup
      clients.forEach(client => client.disconnect())
    })
  })

  describe('Message Throughput Performance', () => {
    let clients: Socket[] = []

    beforeEach(async () => {
      // Setup clients for throughput testing
      const clientCount = 50

      const setupPromises = Array.from({ length: clientCount }, async (_, i) => {
        const token = await JWTService.generateToken({
          userId: `throughput-user-${i}`,
          email: `throughput${i}@example.com`,
          tenantId: testTenantId,
        })

        const client = SocketIOClient(`http://${PERFORMANCE_TEST_HOST}:${PERFORMANCE_TEST_PORT}`, {
          auth: { token },
          transports: ['websocket'],
          forceNew: true,
        })

        clients.push(client)

        return new Promise<void>((resolve) => {
          client.on('connect', () => {
            client.emit('subscribe', ['activities'])
            resolve()
          })
        })
      })

      await Promise.all(setupPromises)
    })

    afterEach(() => {
      clients.forEach(client => client.disconnect())
      clients = []
    })

    it('achieves target message throughput', async () => {
      const messagesToSend = 10000
      const testDurationMs = 10000 // 10 seconds
      let messagesSent = 0
      let totalLatency = 0
      const latencies: number[] = []

      const metrics: PerformanceMetrics = {
        connectionTime: 0,
        messageLatency: [],
        throughput: 0,
        memoryUsage: 0,
        errorCount: 0,
        totalMessages: 0,
        connectionCount: clients.length,
        startTime: performance.now(),
        endTime: 0,
      }

      // Setup message receivers
      const receivedCounts = new Map<string, number>()
      clients.forEach((client, index) => {
        receivedCounts.set(client.id || `client-${index}`, 0)
        
        client.on('activity_update', (data) => {
          if (data.timestamp && data.test_message_id) {
            const latency = performance.now() - data.timestamp
            latencies.push(latency)
            totalLatency += latency
          }
          receivedCounts.set(client.id || `client-${index}`, 
            (receivedCounts.get(client.id || `client-${index}`) || 0) + 1)
        })
      })

      const startTime = performance.now()
      const interval = setInterval(() => {
        if (messagesSent >= messagesToSend || performance.now() - startTime >= testDurationMs) {
          clearInterval(interval)
          return
        }

        const activity: ActivityItem = {
          id: `perf-activity-${messagesSent}`,
          user: {
            id: `perf-user-${messagesSent % 10}`,
            name: `Performance User ${messagesSent % 10}`,
            email: `perf${messagesSent % 10}@example.com`,
          },
          action: {
            type: 'tool_usage',
            name: 'Performance Test Tool',
            description: `Performance test message ${messagesSent}`,
            category: 'testing',
          },
          target: {
            name: `perf-target-${messagesSent}`,
            type: 'test',
          },
          status: 'success',
          timestamp: new Date(),
          duration_ms: 10,
          execution_context: {
            session_id: `perf-session-${messagesSent}`,
            test_message_id: messagesSent,
            timestamp: performance.now(),
          },
          tags: ['performance', 'test'],
          priority: 'low',
          is_automated: true,
        }

        webSocketService.broadcastActivity(activity)
        messagesSent++
      }, 1) // Send as fast as possible

      // Wait for test completion
      await new Promise<void>((resolve) => {
        const checkCompletion = () => {
          if (messagesSent >= messagesToSend || performance.now() - startTime >= testDurationMs) {
            setTimeout(resolve, 1000) // Wait for messages to be processed
          } else {
            setTimeout(checkCompletion, 100)
          }
        }
        checkCompletion()
      })

      metrics.endTime = performance.now()
      metrics.totalMessages = messagesSent
      metrics.messageLatency = latencies
      const testDuration = (metrics.endTime - metrics.startTime) / 1000
      metrics.throughput = messagesSent / testDuration

      const totalReceived = Array.from(receivedCounts.values()).reduce((a, b) => a + b, 0)
      const avgLatency = latencies.length > 0 ? totalLatency / latencies.length : 0

      console.log(`Throughput Performance Metrics:`)
      console.log(`- Messages sent: ${messagesSent}`)
      console.log(`- Total received: ${totalReceived}`)
      console.log(`- Test duration: ${testDuration.toFixed(2)}s`)
      console.log(`- Throughput: ${metrics.throughput.toFixed(2)} msg/s`)
      console.log(`- Average latency: ${avgLatency.toFixed(2)}ms`)
      console.log(`- Max latency: ${latencies.length > 0 ? Math.max(...latencies).toFixed(2) : 0}ms`)
      console.log(`- Client count: ${clients.length}`)

      expect(metrics.throughput).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT_MESSAGES_PER_SECOND / 2)
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.MESSAGE_LATENCY_MS)
    })

    it('maintains performance under high-frequency updates', async () => {
      const updateFrequency = 100 // messages per second
      const testDurationSeconds = 5
      const totalMessages = updateFrequency * testDurationSeconds
      
      let messagesReceived = 0
      const latencies: number[] = []

      // Setup receivers
      clients.forEach(client => {
        client.on('activity_update', (data) => {
          messagesReceived++
          if (data.timestamp) {
            latencies.push(performance.now() - data.timestamp)
          }
        })
      })

      const startTime = performance.now()
      let messagesSent = 0

      const sendInterval = setInterval(() => {
        if (messagesSent >= totalMessages) {
          clearInterval(sendInterval)
          return
        }

        webSocketService.broadcastActivity({
          id: `high-freq-${messagesSent}`,
          user: { id: 'hf-user', name: 'High Frequency User', email: 'hf@test.com' },
          action: { type: 'tool_usage', name: 'HF Test', category: 'test' },
          target: { name: `target-${messagesSent}`, type: 'test' },
          status: 'success',
          timestamp: new Date(),
          execution_context: { 
            session_id: 'hf-session',
            timestamp: performance.now(),
          },
          tags: ['high-frequency'],
          priority: 'low',
          is_automated: true,
        } as ActivityItem)

        messagesSent++
      }, 1000 / updateFrequency)

      // Wait for test completion
      await new Promise(resolve => setTimeout(resolve, testDurationSeconds * 1000 + 2000))

      const actualDuration = (performance.now() - startTime) / 1000
      const actualThroughput = messagesSent / actualDuration
      const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0

      console.log(`High-Frequency Update Metrics:`)
      console.log(`- Target frequency: ${updateFrequency} msg/s`)
      console.log(`- Actual throughput: ${actualThroughput.toFixed(2)} msg/s`)
      console.log(`- Messages sent: ${messagesSent}`)
      console.log(`- Messages received: ${messagesReceived}`)
      console.log(`- Average latency: ${avgLatency.toFixed(2)}ms`)

      expect(actualThroughput).toBeGreaterThan(updateFrequency * 0.9) // Within 10% of target
      expect(avgLatency).toBeLessThan(PERFORMANCE_THRESHOLDS.MESSAGE_LATENCY_MS * 2)
    })
  })

  describe('Database Performance', () => {
    it('achieves target database query performance', async () => {
      const queryCount = 1000
      const batchSize = 50
      const queryTimes: number[] = []

      // Create test activities in batches
      for (let batch = 0; batch < queryCount / batchSize; batch++) {
        const batchStart = performance.now()
        
        const activities = Array.from({ length: batchSize }, (_, i) => ({
          user_id: `db-perf-user-${batch * batchSize + i}`,
          action_type: 'tool_usage',
          action_name: 'Database Performance Test',
          target_name: `perf-target-${batch * batchSize + i}`,
          status: 'success',
          duration_ms: Math.floor(Math.random() * 1000),
          session_id: `db-perf-session-${batch}`,
        }))

        await activityDataService.createActivitiesBatch(activities)
        queryTimes.push(performance.now() - batchStart)
      }

      const avgBatchTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length
      const avgQueryTime = avgBatchTime / batchSize

      console.log(`Database Performance Metrics:`)
      console.log(`- Total queries: ${queryCount}`)
      console.log(`- Batch size: ${batchSize}`)
      console.log(`- Average query time: ${avgQueryTime.toFixed(2)}ms`)
      console.log(`- Average batch time: ${avgBatchTime.toFixed(2)}ms`)

      expect(avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MS)

      // Test read performance
      const readStart = performance.now()
      const activities = await activityDataService.getActivities({
        limit: 1000,
        offset: 0,
        sort: 'timestamp',
        order: 'desc',
      })
      const readTime = performance.now() - readStart

      console.log(`- Read 1000 activities in: ${readTime.toFixed(2)}ms`)
      expect(readTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MS * 10)
      expect(activities.data.length).toBeLessThanOrEqual(1000)
    })

    it('tests cache hit ratio performance', async () => {
      const userId = 'cache-perf-user'
      const queryCount = 100
      let cacheHits = 0

      // Warm up cache
      await activityDataService.getActivitiesWithCache(userId, {
        limit: 50,
        offset: 0,
      })

      const queryTimes: number[] = []

      for (let i = 0; i < queryCount; i++) {
        const queryStart = performance.now()
        
        // Mix of cached and uncached queries
        const result = await activityDataService.getActivitiesWithCache(userId, {
          limit: 50,
          offset: i % 2 === 0 ? 0 : i, // Half will hit cache, half will miss
        })
        
        const queryTime = performance.now() - queryStart
        queryTimes.push(queryTime)

        // Cached queries should be much faster
        if (queryTime < 10) { // Assume cache hit if < 10ms
          cacheHits++
        }
      }

      const cacheHitRatio = cacheHits / queryCount
      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryCount

      console.log(`Cache Performance Metrics:`)
      console.log(`- Total queries: ${queryCount}`)
      console.log(`- Cache hits: ${cacheHits}`)
      console.log(`- Cache hit ratio: ${(cacheHitRatio * 100).toFixed(1)}%`)
      console.log(`- Average query time: ${avgQueryTime.toFixed(2)}ms`)

      expect(cacheHitRatio).toBeGreaterThan(0.4) // At least 40% cache hits in this test
      expect(avgQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MS)
    })
  })

  describe('Memory Performance', () => {
    it('manages memory usage under load', async () => {
      const getMemoryUsage = () => {
        const used = process.memoryUsage()
        return {
          rss: used.rss / 1024 / 1024, // MB
          heapTotal: used.heapTotal / 1024 / 1024, // MB
          heapUsed: used.heapUsed / 1024 / 1024, // MB
          external: used.external / 1024 / 1024, // MB
        }
      }

      const initialMemory = getMemoryUsage()
      console.log('Initial memory usage:', initialMemory)

      // Create load
      const clientCount = 200
      const clients: Socket[] = []
      const memorySnapshots: any[] = []

      // Create many connections
      const connectionPromises = Array.from({ length: clientCount }, async (_, i) => {
        const token = await JWTService.generateToken({
          userId: `memory-test-user-${i}`,
          email: `memory${i}@example.com`,
          tenantId: testTenantId,
        })

        const client = SocketIOClient(`http://${PERFORMANCE_TEST_HOST}:${PERFORMANCE_TEST_PORT}`, {
          auth: { token },
          transports: ['websocket'],
          forceNew: true,
        })

        clients.push(client)

        return new Promise<void>((resolve) => {
          client.on('connect', () => {
            client.emit('subscribe', ['activities', 'user-activity', 'tool-metrics'])
            resolve()
          })
        })
      })

      await Promise.all(connectionPromises)
      
      // Take memory snapshot after connections
      const connectionsMemory = getMemoryUsage()
      memorySnapshots.push({ phase: 'connections', memory: connectionsMemory })

      // Generate high activity
      for (let i = 0; i < 5000; i++) {
        const activity: ActivityItem = {
          id: `memory-test-activity-${i}`,
          user: {
            id: `memory-user-${i % 50}`,
            name: `Memory Test User ${i % 50}`,
            email: `memory${i % 50}@example.com`,
          },
          action: {
            type: 'tool_usage',
            name: 'Memory Test Tool',
            description: `Memory test activity ${i}`,
            category: 'testing',
          },
          target: {
            name: `memory-target-${i}`,
            type: 'test',
          },
          status: 'success',
          timestamp: new Date(),
          duration_ms: 15,
          execution_context: {
            session_id: `memory-session-${i % 10}`,
          },
          tags: ['memory', 'test', `tag-${i % 20}`],
          priority: 'low',
          is_automated: true,
        }

        webSocketService.broadcastActivity(activity)

        // Take periodic memory snapshots
        if (i % 1000 === 0) {
          memorySnapshots.push({ 
            phase: `activities-${i}`, 
            memory: getMemoryUsage() 
          })
        }
      }

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      const finalMemory = getMemoryUsage()
      memorySnapshots.push({ phase: 'final', memory: finalMemory })

      console.log('Memory Usage Progression:')
      memorySnapshots.forEach(snapshot => {
        console.log(`${snapshot.phase}: ${snapshot.memory.heapUsed.toFixed(2)}MB heap, ${snapshot.memory.rss.toFixed(2)}MB RSS`)
      })

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed

      console.log(`Memory Performance Metrics:`)
      console.log(`- Initial heap: ${initialMemory.heapUsed.toFixed(2)}MB`)
      console.log(`- Final heap: ${finalMemory.heapUsed.toFixed(2)}MB`)
      console.log(`- Memory increase: ${memoryIncrease.toFixed(2)}MB`)
      console.log(`- RSS: ${finalMemory.rss.toFixed(2)}MB`)

      expect(finalMemory.heapUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB)
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB / 2)

      // Cleanup
      clients.forEach(client => client.disconnect())
    })

    it('handles memory cleanup after disconnections', async () => {
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024

      // Create and destroy clients multiple times
      for (let cycle = 0; cycle < 5; cycle++) {
        const clients: Socket[] = []
        
        // Create clients
        const setupPromises = Array.from({ length: 50 }, async (_, i) => {
          const token = await JWTService.generateToken({
            userId: `cleanup-cycle-${cycle}-user-${i}`,
            email: `cleanup${cycle}${i}@example.com`,
            tenantId: testTenantId,
          })

          const client = SocketIOClient(`http://${PERFORMANCE_TEST_HOST}:${PERFORMANCE_TEST_PORT}`, {
            auth: { token },
            transports: ['websocket'],
            forceNew: true,
          })

          clients.push(client)

          return new Promise<void>((resolve) => {
            client.on('connect', () => resolve())
          })
        })

        await Promise.all(setupPromises)

        // Generate some activity
        for (let i = 0; i < 100; i++) {
          webSocketService.broadcastActivity({
            id: `cleanup-activity-${cycle}-${i}`,
            user: { id: 'cleanup-user', name: 'Cleanup User', email: 'cleanup@test.com' },
            action: { type: 'tool_usage', name: 'Cleanup Test', category: 'test' },
            target: { name: `cleanup-target-${i}`, type: 'test' },
            status: 'success',
            timestamp: new Date(),
            tags: ['cleanup'],
            priority: 'low',
            is_automated: true,
          } as ActivityItem)
        }

        // Disconnect all clients
        clients.forEach(client => client.disconnect())
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        const cycleMemory = process.memoryUsage().heapUsed / 1024 / 1024
        console.log(`Cycle ${cycle} memory: ${cycleMemory.toFixed(2)}MB`)
      }

      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024
      const memoryIncrease = finalMemory - initialMemory

      console.log(`Memory Cleanup Metrics:`)
      console.log(`- Initial memory: ${initialMemory.toFixed(2)}MB`)
      console.log(`- Final memory: ${finalMemory.toFixed(2)}MB`)
      console.log(`- Memory increase: ${memoryIncrease.toFixed(2)}MB`)

      // Memory increase should be minimal after cleanup cycles
      expect(memoryIncrease).toBeLessThan(50) // Less than 50MB increase
    })
  })

  describe('Error Rate and Reliability', () => {
    it('maintains low error rate under stress', async () => {
      const totalOperations = 1000
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      // Setup error tracking
      const originalConsoleError = console.error
      console.error = (...args: any[]) => {
        errors.push(args.join(' '))
      }

      const clients: Socket[] = []

      // Create connections
      const connectionPromises = Array.from({ length: 50 }, async (_, i) => {
        try {
          const token = await JWTService.generateToken({
            userId: `stress-user-${i}`,
            email: `stress${i}@example.com`,
            tenantId: testTenantId,
          })

          const client = SocketIOClient(`http://${PERFORMANCE_TEST_HOST}:${PERFORMANCE_TEST_PORT}`, {
            auth: { token },
            transports: ['websocket'],
            forceNew: true,
          })

          clients.push(client)

          return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Connection timeout'))
            }, 5000)

            client.on('connect', () => {
              clearTimeout(timeout)
              successCount++
              resolve()
            })

            client.on('connect_error', (error) => {
              clearTimeout(timeout)
              errorCount++
              reject(error)
            })
          })
        } catch (error) {
          errorCount++
          throw error
        }
      })

      // Execute operations with error handling
      const operationPromises = Array.from({ length: totalOperations }, async (_, i) => {
        try {
          // Mix of operations that might fail
          if (i % 4 === 0) {
            // Database operation
            await activityDataService.createActivity({
              user_id: `stress-db-user-${i}`,
              action_type: 'stress_test',
              action_name: 'Stress Test Action',
              target_name: `stress-target-${i}`,
              status: 'success',
              duration_ms: Math.floor(Math.random() * 100),
            })
          } else if (i % 4 === 1) {
            // WebSocket broadcast
            webSocketService.broadcastActivity({
              id: `stress-activity-${i}`,
              user: { id: `stress-user-${i % 50}`, name: 'Stress User', email: 'stress@test.com' },
              action: { type: 'tool_usage', name: 'Stress Test', category: 'test' },
              target: { name: `stress-target-${i}`, type: 'test' },
              status: 'success',
              timestamp: new Date(),
              tags: ['stress'],
              priority: 'low',
              is_automated: true,
            } as ActivityItem)
          } else if (i % 4 === 2) {
            // Cache operation
            await activityDataService.getActivitiesWithCache(`stress-user-${i % 10}`, {
              limit: 10,
              offset: 0,
            })
          } else {
            // Redis operation
            await redis.set(`stress-key-${i}`, `stress-value-${i}`, 'EX', 60)
            await redis.get(`stress-key-${i}`)
          }
          
          successCount++
        } catch (error) {
          errorCount++
          errors.push(`Operation ${i}: ${error}`)
        }
      })

      await Promise.allSettled([...connectionPromises, ...operationPromises])

      const errorRate = errorCount / (successCount + errorCount)

      console.log(`Reliability Metrics:`)
      console.log(`- Total operations: ${totalOperations}`)
      console.log(`- Successful operations: ${successCount}`)
      console.log(`- Failed operations: ${errorCount}`)
      console.log(`- Error rate: ${(errorRate * 100).toFixed(2)}%`)
      console.log(`- Sample errors: ${errors.slice(0, 5).join('; ')}`)

      // Restore console.error
      console.error = originalConsoleError

      expect(errorRate).toBeLessThan(PERFORMANCE_THRESHOLDS.ERROR_RATE)

      // Cleanup
      clients.forEach(client => client.disconnect())
    })
  })

  async function warmupSystem(): Promise<void> {
    // Pre-warm database connections
    await prisma.$queryRaw`SELECT 1`
    
    // Pre-warm Redis connection
    await redis.ping()
    
    // Pre-warm WebSocket service
    const warmupToken = await JWTService.generateToken({
      userId: 'warmup-user',
      email: 'warmup@example.com',
      tenantId: 'warmup-tenant',
    })

    const warmupClient = SocketIOClient(`http://${PERFORMANCE_TEST_HOST}:${PERFORMANCE_TEST_PORT}`, {
      auth: { token: warmupToken },
      transports: ['websocket'],
      forceNew: true,
    })

    await new Promise<void>((resolve) => {
      warmupClient.on('connect', () => {
        warmupClient.disconnect()
        resolve()
      })
    })

    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 100))
  }
})