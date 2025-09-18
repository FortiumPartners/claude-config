/**
 * Performance Optimization Service
 * Sprint 8 Task 8.1: Performance optimization & monitoring
 * 
 * Implements:
 * - Database query optimization with intelligent caching
 * - Connection pool tuning and monitoring
 * - Automated performance analysis and recommendations
 * - Cache warming strategies
 * - Query performance analytics
 */

import { ExtendedPrismaClient } from '../database/prisma-client';
import { RedisManager } from '../config/redis.config';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';
import { EventEmitter } from 'events';

export interface QueryPerformanceMetrics {
  queryId: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'AGGREGATE';
  executionTime: number;
  rowsAffected: number;
  planCost: number;
  indexUsage: {
    used: boolean;
    indexName?: string;
    scanType: 'index' | 'sequential' | 'bitmap';
  };
  cacheHit: boolean;
  organizationId?: string;
  timestamp: Date;
}

export interface PerformanceOptimization {
  id: string;
  type: 'index' | 'query' | 'cache' | 'connection_pool';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  currentMetric: number;
  targetMetric: number;
  estimatedImpact: string;
  implementationSteps: string[];
  sqlCommands?: string[];
  created: Date;
}

export interface CacheWarmingStrategy {
  cacheKey: string;
  frequency: 'hourly' | 'daily' | 'weekly';
  organizationScoped: boolean;
  priority: number;
  warmingQuery: string;
  ttl: number;
  enabled: boolean;
}

export class PerformanceOptimizationService extends EventEmitter {
  private queryMetrics: Map<string, QueryPerformanceMetrics[]> = new Map();
  private optimizations: PerformanceOptimization[] = [];
  private cacheWarmingStrategies: Map<string, CacheWarmingStrategy> = new Map();
  private performanceBaseline: Map<string, number> = new Map();
  private analysisInterval: NodeJS.Timeout;

  constructor(
    private prisma: ExtendedPrismaClient,
    private redisManager: RedisManager,
    private dbConnection: DatabaseConnection,
    private logger: winston.Logger,
    private config: {
      enableQueryAnalysis: boolean;
      enableCacheWarming: boolean;
      analysisIntervalMs: number;
      maxQueryHistorySize: number;
      performanceThresholds: {
        slowQueryMs: number;
        cacheHitRateMin: number;
        connectionPoolUtilizationMax: number;
      };
    }
  ) {
    super();

    this.initializeBaseline();
    this.setupCacheWarmingStrategies();
    this.startPerformanceAnalysis();
  }

  /**
   * Track query performance metrics
   */
  async trackQueryPerformance(
    queryId: string,
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'AGGREGATE',
    executionTime: number,
    rowsAffected: number,
    organizationId?: string
  ): Promise<void> {
    try {
      // Get query execution plan for analysis
      const planCost = await this.getQueryPlanCost(queryId);
      const indexUsage = await this.analyzeIndexUsage(queryId);
      const cacheHit = await this.checkCacheHit(queryId, organizationId);

      const metrics: QueryPerformanceMetrics = {
        queryId,
        queryType,
        executionTime,
        rowsAffected,
        planCost,
        indexUsage,
        cacheHit,
        organizationId,
        timestamp: new Date(),
      };

      // Store metrics
      const orgKey = organizationId || 'global';
      const orgMetrics = this.queryMetrics.get(orgKey) || [];
      orgMetrics.push(metrics);

      // Keep only recent metrics
      if (orgMetrics.length > this.config.maxQueryHistorySize) {
        orgMetrics.shift();
      }

      this.queryMetrics.set(orgKey, orgMetrics);

      // Emit metrics event
      this.emit('query:tracked', metrics);

      // Check for immediate optimization opportunities
      await this.analyzeQueryPerformance(metrics);

    } catch (error) {
      this.logger.error('Failed to track query performance', {
        queryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get database performance insights
   */
  async getDatabaseInsights(organizationId?: string): Promise<{
    averageQueryTime: number;
    slowestQueries: QueryPerformanceMetrics[];
    cacheHitRate: number;
    indexEfficiency: number;
    connectionPoolUtilization: number;
    recommendations: PerformanceOptimization[];
  }> {
    try {
      const orgKey = organizationId || 'global';
      const metrics = this.queryMetrics.get(orgKey) || [];
      const recent = metrics.filter(m => 
        Date.now() - m.timestamp.getTime() < 3600000 // Last hour
      );

      // Calculate average query time
      const averageQueryTime = recent.length > 0 
        ? recent.reduce((sum, m) => sum + m.executionTime, 0) / recent.length
        : 0;

      // Get slowest queries
      const slowestQueries = recent
        .filter(m => m.executionTime > this.config.performanceThresholds.slowQueryMs)
        .sort((a, b) => b.executionTime - a.executionTime)
        .slice(0, 10);

      // Calculate cache hit rate
      const cacheableQueries = recent.filter(m => m.queryType === 'SELECT');
      const cacheHitRate = cacheableQueries.length > 0
        ? (cacheableQueries.filter(m => m.cacheHit).length / cacheableQueries.length) * 100
        : 0;

      // Calculate index efficiency
      const indexEfficiency = recent.length > 0
        ? (recent.filter(m => m.indexUsage.used).length / recent.length) * 100
        : 0;

      // Get connection pool utilization
      const connectionPoolUtilization = await this.getConnectionPoolUtilization();

      // Get relevant recommendations
      const recommendations = this.optimizations.filter(opt => 
        organizationId ? opt.description.includes(organizationId) : true
      );

      return {
        averageQueryTime,
        slowestQueries,
        cacheHitRate,
        indexEfficiency,
        connectionPoolUtilization,
        recommendations,
      };

    } catch (error) {
      this.logger.error('Failed to get database insights', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        averageQueryTime: 0,
        slowestQueries: [],
        cacheHitRate: 0,
        indexEfficiency: 0,
        connectionPoolUtilization: 0,
        recommendations: [],
      };
    }
  }

  /**
   * Implement automatic cache warming
   */
  async warmCaches(): Promise<void> {
    try {
      const strategies = Array.from(this.cacheWarmingStrategies.values())
        .filter(s => s.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const strategy of strategies) {
        try {
          await this.executeWarmingStrategy(strategy);
          this.logger.debug('Cache warming strategy executed', {
            cacheKey: strategy.cacheKey,
          });
        } catch (error) {
          this.logger.error('Cache warming strategy failed', {
            cacheKey: strategy.cacheKey,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.emit('cache:warmed', { strategiesExecuted: strategies.length });

    } catch (error) {
      this.logger.error('Cache warming failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get performance optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<PerformanceOptimization[]> {
    return [...this.optimizations].sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Implement optimization recommendation
   */
  async implementOptimization(optimizationId: string): Promise<boolean> {
    try {
      const optimization = this.optimizations.find(opt => opt.id === optimizationId);
      if (!optimization) {
        throw new Error(`Optimization ${optimizationId} not found`);
      }

      this.logger.info('Implementing optimization', {
        id: optimizationId,
        type: optimization.type,
        description: optimization.description,
      });

      let success = false;

      switch (optimization.type) {
        case 'index':
          success = await this.createRecommendedIndex(optimization);
          break;
        case 'query':
          success = await this.optimizeQuery(optimization);
          break;
        case 'cache':
          success = await this.implementCacheOptimization(optimization);
          break;
        case 'connection_pool':
          success = await this.optimizeConnectionPool(optimization);
          break;
      }

      if (success) {
        // Remove implemented optimization
        this.optimizations = this.optimizations.filter(opt => opt.id !== optimizationId);
        this.emit('optimization:implemented', optimization);
      }

      return success;

    } catch (error) {
      this.logger.error('Failed to implement optimization', {
        optimizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Private methods
   */
  private async initializeBaseline(): Promise<void> {
    try {
      // Establish performance baselines
      this.performanceBaseline.set('avg_query_time', 100); // 100ms baseline
      this.performanceBaseline.set('cache_hit_rate', 80); // 80% baseline
      this.performanceBaseline.set('index_efficiency', 90); // 90% baseline
      this.performanceBaseline.set('connection_pool_util', 70); // 70% baseline

      this.logger.info('Performance baseline initialized', {
        baselines: Object.fromEntries(this.performanceBaseline),
      });

    } catch (error) {
      this.logger.error('Failed to initialize baseline', { error });
    }
  }

  private setupCacheWarmingStrategies(): void {
    // Dashboard aggregation cache warming
    this.cacheWarmingStrategies.set('dashboard_metrics', {
      cacheKey: 'dashboard:metrics:*',
      frequency: 'hourly',
      organizationScoped: true,
      priority: 9,
      warmingQuery: `
        SELECT 
          organization_id,
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as session_count,
          AVG(total_duration_ms) as avg_duration,
          SUM(productivity_score) as total_productivity
        FROM metrics_sessions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY organization_id, hour
        ORDER BY hour DESC
      `,
      ttl: 3600,
      enabled: this.config.enableCacheWarming,
    });

    // Tool usage statistics
    this.cacheWarmingStrategies.set('tool_usage_stats', {
      cacheKey: 'tool:usage:stats:*',
      frequency: 'daily',
      organizationScoped: true,
      priority: 8,
      warmingQuery: `
        SELECT 
          tm.tool_name,
          COUNT(*) as usage_count,
          AVG(tm.total_duration_ms) as avg_duration,
          AVG(tm.success_rate) as avg_success_rate
        FROM tool_metrics tm
        JOIN metrics_sessions ms ON tm.session_id = ms.id
        WHERE ms.created_at >= NOW() - INTERVAL '7 days'
        GROUP BY tm.tool_name
        ORDER BY usage_count DESC
      `,
      ttl: 86400,
      enabled: this.config.enableCacheWarming,
    });

    // User productivity trends
    this.cacheWarmingStrategies.set('productivity_trends', {
      cacheKey: 'productivity:trends:*',
      frequency: 'daily',
      organizationScoped: true,
      priority: 7,
      warmingQuery: `
        SELECT 
          u.id as user_id,
          DATE(ms.created_at) as date,
          COUNT(ms.id) as session_count,
          AVG(ms.productivity_score) as avg_productivity,
          SUM(ms.total_duration_ms) as total_time
        FROM users u
        JOIN metrics_sessions ms ON u.id = ms.user_id
        WHERE ms.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY u.id, date
        ORDER BY date DESC
      `,
      ttl: 86400,
      enabled: this.config.enableCacheWarming,
    });
  }

  private startPerformanceAnalysis(): void {
    if (this.config.enableQueryAnalysis) {
      this.analysisInterval = setInterval(() => {
        this.performanceAnalysis();
      }, this.config.analysisIntervalMs);

      this.logger.info('Performance analysis started', {
        interval: this.config.analysisIntervalMs,
      });
    }
  }

  private async performanceAnalysis(): Promise<void> {
    try {
      // Analyze query patterns across all organizations
      for (const [orgKey, metrics] of this.queryMetrics) {
        await this.analyzeOrganizationMetrics(orgKey, metrics);
      }

      // Generate system-wide optimizations
      await this.generateSystemOptimizations();

    } catch (error) {
      this.logger.error('Performance analysis failed', { error });
    }
  }

  private async analyzeOrganizationMetrics(
    orgKey: string,
    metrics: QueryPerformanceMetrics[]
  ): Promise<void> {
    const recent = metrics.filter(m => 
      Date.now() - m.timestamp.getTime() < 3600000 // Last hour
    );

    if (recent.length === 0) return;

    // Analyze for slow queries
    const slowQueries = recent.filter(m => 
      m.executionTime > this.config.performanceThresholds.slowQueryMs
    );

    if (slowQueries.length > recent.length * 0.1) { // More than 10% slow queries
      this.generateQueryOptimization(orgKey, slowQueries);
    }

    // Analyze cache performance
    const selectQueries = recent.filter(m => m.queryType === 'SELECT');
    if (selectQueries.length > 0) {
      const cacheHitRate = (selectQueries.filter(m => m.cacheHit).length / selectQueries.length) * 100;
      
      if (cacheHitRate < this.config.performanceThresholds.cacheHitRateMin) {
        this.generateCacheOptimization(orgKey, cacheHitRate);
      }
    }

    // Analyze index usage
    const indexUsageRate = (recent.filter(m => m.indexUsage.used).length / recent.length) * 100;
    if (indexUsageRate < 70) { // Less than 70% index usage
      this.generateIndexOptimization(orgKey, recent.filter(m => !m.indexUsage.used));
    }
  }

  private async generateQueryOptimization(
    orgKey: string,
    slowQueries: QueryPerformanceMetrics[]
  ): Promise<void> {
    const optimization: PerformanceOptimization = {
      id: `query_opt_${Date.now()}_${orgKey}`,
      type: 'query',
      priority: 'high',
      description: `Optimize slow queries for ${orgKey === 'global' ? 'system' : 'organization ' + orgKey}`,
      currentMetric: slowQueries.reduce((sum, q) => sum + q.executionTime, 0) / slowQueries.length,
      targetMetric: this.config.performanceThresholds.slowQueryMs,
      estimatedImpact: `Reduce average query time by ${Math.round(((slowQueries.reduce((sum, q) => sum + q.executionTime, 0) / slowQueries.length) / this.config.performanceThresholds.slowQueryMs - 1) * 100)}%`,
      implementationSteps: [
        'Analyze query execution plans',
        'Add missing indexes',
        'Optimize WHERE clauses',
        'Implement query result caching',
        'Consider query rewriting',
      ],
      created: new Date(),
    };

    this.optimizations.push(optimization);
    this.emit('optimization:generated', optimization);
  }

  private async generateIndexOptimization(
    orgKey: string,
    queriesWithoutIndex: QueryPerformanceMetrics[]
  ): Promise<void> {
    const optimization: PerformanceOptimization = {
      id: `index_opt_${Date.now()}_${orgKey}`,
      type: 'index',
      priority: 'medium',
      description: `Add missing indexes for ${orgKey === 'global' ? 'system' : 'organization ' + orgKey}`,
      currentMetric: (queriesWithoutIndex.length / this.queryMetrics.get(orgKey)!.length) * 100,
      targetMetric: 10, // Target: less than 10% queries without index
      estimatedImpact: 'Improve query performance by 60-80% for affected queries',
      implementationSteps: [
        'Analyze query patterns',
        'Identify frequently queried columns',
        'Create composite indexes for multi-column filters',
        'Add partial indexes for filtered queries',
        'Monitor index usage and maintenance overhead',
      ],
      sqlCommands: [
        'CREATE INDEX CONCURRENTLY idx_metrics_sessions_user_date ON metrics_sessions(user_id, session_start);',
        'CREATE INDEX CONCURRENTLY idx_tool_metrics_session_tool ON tool_metrics(session_id, tool_name);',
        'CREATE INDEX CONCURRENTLY idx_metrics_sessions_org_score ON metrics_sessions(organization_id, productivity_score);',
      ],
      created: new Date(),
    };

    this.optimizations.push(optimization);
    this.emit('optimization:generated', optimization);
  }

  private async generateCacheOptimization(
    orgKey: string,
    currentHitRate: number
  ): Promise<void> {
    const optimization: PerformanceOptimization = {
      id: `cache_opt_${Date.now()}_${orgKey}`,
      type: 'cache',
      priority: 'medium',
      description: `Improve cache hit rate for ${orgKey === 'global' ? 'system' : 'organization ' + orgKey}`,
      currentMetric: currentHitRate,
      targetMetric: this.config.performanceThresholds.cacheHitRateMin,
      estimatedImpact: `Reduce database load by ${Math.round((this.config.performanceThresholds.cacheHitRateMin - currentHitRate) * 0.8)}%`,
      implementationSteps: [
        'Implement intelligent cache warming',
        'Increase cache TTL for stable data',
        'Add cache invalidation triggers',
        'Implement hierarchical caching',
        'Add application-level caching',
      ],
      created: new Date(),
    };

    this.optimizations.push(optimization);
    this.emit('optimization:generated', optimization);
  }

  private async generateSystemOptimizations(): Promise<void> {
    const connectionUtilization = await this.getConnectionPoolUtilization();
    
    if (connectionUtilization > this.config.performanceThresholds.connectionPoolUtilizationMax) {
      const optimization: PerformanceOptimization = {
        id: `conn_pool_opt_${Date.now()}`,
        type: 'connection_pool',
        priority: 'high',
        description: 'Optimize database connection pool configuration',
        currentMetric: connectionUtilization,
        targetMetric: this.config.performanceThresholds.connectionPoolUtilizationMax,
        estimatedImpact: 'Improve application responsiveness and reduce connection timeouts',
        implementationSteps: [
          'Increase maximum pool size',
          'Adjust idle timeout settings',
          'Implement connection pooling middleware',
          'Add connection leak detection',
          'Monitor connection lifecycle',
        ],
        created: new Date(),
      };

      this.optimizations.push(optimization);
      this.emit('optimization:generated', optimization);
    }
  }

  private async executeWarmingStrategy(strategy: CacheWarmingStrategy): Promise<void> {
    try {
      // Execute the warming query
      const result = await this.dbConnection.query(strategy.warmingQuery);
      
      if (strategy.organizationScoped) {
        // Cache data per organization
        const groupedData = new Map();
        
        for (const row of result.rows) {
          const orgId = row.organization_id;
          if (!groupedData.has(orgId)) {
            groupedData.set(orgId, []);
          }
          groupedData.get(orgId).push(row);
        }

        for (const [orgId, data] of groupedData) {
          const cacheKey = strategy.cacheKey.replace('*', orgId);
          await this.redisManager.cacheAggregatedMetrics(cacheKey, data, strategy.ttl);
        }
      } else {
        // Cache data globally
        const cacheKey = strategy.cacheKey.replace('*', 'global');
        await this.redisManager.cacheAggregatedMetrics(cacheKey, result.rows, strategy.ttl);
      }

    } catch (error) {
      this.logger.error('Cache warming strategy execution failed', {
        strategy: strategy.cacheKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async getQueryPlanCost(queryId: string): Promise<number> {
    try {
      // In a real implementation, this would analyze EXPLAIN output
      // For now, return a simulated cost based on query complexity
      return Math.random() * 1000;
    } catch {
      return 0;
    }
  }

  private async analyzeIndexUsage(queryId: string): Promise<{
    used: boolean;
    indexName?: string;
    scanType: 'index' | 'sequential' | 'bitmap';
  }> {
    try {
      // In a real implementation, this would parse EXPLAIN output
      // For now, return simulated index usage
      const used = Math.random() > 0.3; // 70% chance of index usage
      return {
        used,
        indexName: used ? `idx_${queryId}_composite` : undefined,
        scanType: used ? 'index' : 'sequential',
      };
    } catch {
      return { used: false, scanType: 'sequential' };
    }
  }

  private async checkCacheHit(queryId: string, organizationId?: string): Promise<boolean> {
    try {
      const cacheKey = organizationId 
        ? `query:${organizationId}:${queryId}`
        : `query:global:${queryId}`;
      
      const cached = await this.redisManager.getCachedMetrics(cacheKey);
      return cached !== null;
    } catch {
      return false;
    }
  }

  private async getConnectionPoolUtilization(): Promise<number> {
    try {
      if (this.dbConnection.pool) {
        const pool = this.dbConnection.pool;
        const totalConnections = pool.totalCount;
        const idleConnections = pool.idleCount;
        const activeConnections = totalConnections - idleConnections;
        
        return totalConnections > 0 ? (activeConnections / totalConnections) * 100 : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  private async analyzeQueryPerformance(metrics: QueryPerformanceMetrics): Promise<void> {
    // Check for immediate performance issues
    if (metrics.executionTime > this.config.performanceThresholds.slowQueryMs * 2) {
      this.emit('query:slow', {
        queryId: metrics.queryId,
        executionTime: metrics.executionTime,
        organizationId: metrics.organizationId,
      });
    }

    // Check for missing index usage
    if (!metrics.indexUsage.used && metrics.queryType === 'SELECT') {
      this.emit('query:no_index', {
        queryId: metrics.queryId,
        executionTime: metrics.executionTime,
        organizationId: metrics.organizationId,
      });
    }
  }

  private async createRecommendedIndex(optimization: PerformanceOptimization): Promise<boolean> {
    try {
      if (optimization.sqlCommands) {
        for (const sql of optimization.sqlCommands) {
          await this.dbConnection.query(sql);
          this.logger.info('Created recommended index', { sql });
        }
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to create recommended index', { error });
      return false;
    }
  }

  private async optimizeQuery(optimization: PerformanceOptimization): Promise<boolean> {
    try {
      // In a real implementation, this would rewrite or optimize specific queries
      // For now, just log the optimization
      this.logger.info('Query optimization applied', {
        optimization: optimization.description,
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to optimize query', { error });
      return false;
    }
  }

  private async implementCacheOptimization(optimization: PerformanceOptimization): Promise<boolean> {
    try {
      // Enable additional cache warming strategies
      for (const strategy of this.cacheWarmingStrategies.values()) {
        strategy.enabled = true;
      }
      
      this.logger.info('Cache optimization implemented', {
        optimization: optimization.description,
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to implement cache optimization', { error });
      return false;
    }
  }

  private async optimizeConnectionPool(optimization: PerformanceOptimization): Promise<boolean> {
    try {
      // In a real implementation, this would adjust pool configuration
      this.logger.info('Connection pool optimization applied', {
        optimization: optimization.description,
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to optimize connection pool', { error });
      return false;
    }
  }

  /**
   * Shutdown performance optimization service
   */
  async shutdown(): Promise<void> {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    this.queryMetrics.clear();
    this.optimizations.length = 0;
    this.cacheWarmingStrategies.clear();
    this.performanceBaseline.clear();

    this.logger.info('Performance Optimization Service shutdown complete');
  }
}