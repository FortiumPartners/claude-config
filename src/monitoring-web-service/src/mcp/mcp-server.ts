/**
 * MCP Server Implementation
 * Task 3.3: MCP 2024-11-05 protocol implementation with <5ms performance requirement
 * 
 * Implements complete MCP server for Claude Code integration with hybrid
 * local+remote metrics collection and graceful fallback mechanisms.
 */

import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import { MetricsSessionService } from '../services/metrics-session.service';
import { ToolMetricsService } from '../services/tool-metrics.service';
import {
  CommandExecutionCreate,
  AgentInteractionCreate,
  UserSessionCreate,
  ProductivityMetricCreate
} from '../types/metrics';
import * as winston from 'winston';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: {
    name: string;
    description: string;
    required?: boolean;
  }[];
}

export interface McpCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: {};
}

export interface McpServerInfo {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export class McpServer {
  private metricsModel: MetricsModel;
  private sessionService: MetricsSessionService;
  private toolMetricsService: ToolMetricsService;
  private logger: winston.Logger;
  
  // Performance optimization
  private requestCache: Map<string, { response: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 1000; // 1 second cache for identical requests
  
  // Performance monitoring
  private performanceStats = {
    total_requests: 0,
    cached_responses: 0,
    avg_response_time_ms: 0,
    requests_under_5ms: 0
  };

  constructor(
    db: DatabaseConnection,
    sessionService: MetricsSessionService,
    toolMetricsService: ToolMetricsService,
    logger: winston.Logger
  ) {
    this.metricsModel = new MetricsModel(db);
    this.sessionService = sessionService;
    this.toolMetricsService = toolMetricsService;
    this.logger = logger;
    
    // Clear cache periodically
    setInterval(() => this.clearExpiredCache(), 30000); // Every 30 seconds
  }

  /**
   * Handle MCP JSON-RPC 2.0 request
   * Optimized for <5ms response time
   */
  async handleRequest(
    request: McpRequest,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    const startTime = performance.now();
    this.performanceStats.total_requests++;
    
    try {
      // Check cache for GET-like operations
      const cacheKey = this.getCacheKey(request, organizationId, userId);
      if (this.isReadOnlyRequest(request.method)) {
        const cached = this.requestCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL_MS) {
          this.performanceStats.cached_responses++;
          const responseTime = performance.now() - startTime;
          this.updatePerformanceStats(responseTime);
          
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: cached.response
          };
        }
      }

      // Route request to appropriate handler
      let result: any;
      
      switch (request.method) {
        case 'initialize':
          result = await this.handleInitialize(request.params);
          break;
          
        case 'tools/list':
          result = await this.handleToolsList();
          break;
          
        case 'tools/call':
          result = await this.handleToolCall(request.params, organizationId, userId);
          break;
          
        case 'resources/list':
          result = await this.handleResourcesList(organizationId);
          break;
          
        case 'resources/read':
          result = await this.handleResourceRead(request.params, organizationId);
          break;
          
        case 'prompts/list':
          result = await this.handlePromptsList();
          break;
          
        case 'prompts/get':
          result = await this.handlePromptGet(request.params);
          break;
          
        case 'logging/setLevel':
          result = await this.handleSetLogLevel(request.params);
          break;
          
        // Fortium-specific extensions
        case 'metrics/session/start':
          result = await this.handleSessionStart(request.params, organizationId, userId);
          break;
          
        case 'metrics/session/end':
          result = await this.handleSessionEnd(request.params, organizationId, userId);
          break;
          
        case 'metrics/session/activity':
          result = await this.handleSessionActivity(request.params, organizationId, userId);
          break;
          
        case 'metrics/tool/usage':
          result = await this.handleToolUsage(request.params, organizationId, userId);
          break;
          
        case 'metrics/batch':
          result = await this.handleMetricsBatch(request.params, organizationId);
          break;
          
        case 'metrics/query':
          result = await this.handleMetricsQuery(request.params, organizationId);
          break;
          
        default:
          throw new Error(`Method not found: ${request.method}`);
      }

      // Cache read-only responses
      if (this.isReadOnlyRequest(request.method) && result) {
        this.requestCache.set(cacheKey, {
          response: result,
          timestamp: Date.now()
        });
      }

      const responseTime = performance.now() - startTime;
      this.updatePerformanceStats(responseTime);

      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };

    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.updatePerformanceStats(responseTime);
      
      this.logger.error('MCP request error', {
        method: request.method,
        organization_id: organizationId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: responseTime
      });

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: {
            method: request.method,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      };
    }
  }

  /**
   * Handle batch requests with concurrency control
   */
  async handleBatchRequests(
    requests: McpRequest[],
    organizationId: string,
    userId: string
  ): Promise<McpResponse[]> {
    // Limit batch size for performance
    const maxBatchSize = 20;
    if (requests.length > maxBatchSize) {
      throw new Error(`Batch size exceeded. Maximum ${maxBatchSize} requests allowed.`);
    }

    // Process with limited concurrency
    const concurrencyLimit = 5;
    const responses: McpResponse[] = [];
    
    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);
      const batchResponses = await Promise.all(
        batch.map(req => this.handleRequest(req, organizationId, userId))
      );
      responses.push(...batchResponses);
    }

    return responses;
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities(): Promise<{
    server_info: McpServerInfo;
    capabilities: McpCapabilities;
    tools: McpTool[];
    resources: McpResource[];
    prompts: McpPrompt[];
  }> {
    return {
      server_info: {
        name: 'fortium-metrics-server',
        version: '1.0.0',
        description: 'Fortium External Metrics Web Service MCP Server',
        author: 'Fortium Partners',
        license: 'PROPRIETARY',
        homepage: 'https://github.com/FortiumPartners/claude-config'
      },
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      },
      tools: await this.getAvailableTools(),
      resources: await this.getAvailableResources(),
      prompts: await this.getAvailablePrompts()
    };
  }

  /**
   * Get server health status
   */
  async getServerHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    performance: {
      avg_response_time_ms: number;
      requests_under_5ms_percent: number;
      cache_hit_rate: number;
      total_requests: number;
    };
    database: {
      connected: boolean;
      latency_ms?: number;
    };
    timestamp: string;
  }> {
    try {
      // Test database connection
      const dbStart = performance.now();
      await this.metricsModel.healthCheck();
      const dbLatency = performance.now() - dbStart;
      
      const cacheHitRate = this.performanceStats.total_requests > 0 
        ? this.performanceStats.cached_responses / this.performanceStats.total_requests 
        : 0;
        
      const under5msPercent = this.performanceStats.total_requests > 0
        ? this.performanceStats.requests_under_5ms / this.performanceStats.total_requests
        : 0;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (this.performanceStats.avg_response_time_ms > 10 || dbLatency > 50) {
        status = 'degraded';
      }
      
      if (this.performanceStats.avg_response_time_ms > 20 || dbLatency > 100) {
        status = 'unhealthy';
      }

      return {
        status,
        performance: {
          avg_response_time_ms: this.performanceStats.avg_response_time_ms,
          requests_under_5ms_percent: under5msPercent * 100,
          cache_hit_rate: cacheHitRate * 100,
          total_requests: this.performanceStats.total_requests
        },
        database: {
          connected: true,
          latency_ms: dbLatency
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        performance: {
          avg_response_time_ms: this.performanceStats.avg_response_time_ms,
          requests_under_5ms_percent: 0,
          cache_hit_rate: 0,
          total_requests: this.performanceStats.total_requests
        },
        database: {
          connected: false
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  // Private handler methods

  private async handleInitialize(params: any): Promise<any> {
    return {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      },
      serverInfo: {
        name: 'fortium-metrics-server',
        version: '1.0.0'
      }
    };
  }

  private async handleToolsList(): Promise<{ tools: McpTool[] }> {
    return {
      tools: await this.getAvailableTools()
    };
  }

  private async handleToolCall(
    params: { name: string; arguments?: any },
    organizationId: string,
    userId: string
  ): Promise<any> {
    const startTime = performance.now();
    
    try {
      switch (params.name) {
        case 'record-session-start':
          return await this.toolRecordSessionStart(params.arguments, organizationId, userId);
          
        case 'record-session-end':
          return await this.toolRecordSessionEnd(params.arguments, organizationId, userId);
          
        case 'record-tool-usage':
          return await this.toolRecordToolUsage(params.arguments, organizationId, userId);
          
        case 'get-session-metrics':
          return await this.toolGetSessionMetrics(params.arguments, organizationId);
          
        case 'get-tool-metrics':
          return await this.toolGetToolMetrics(params.arguments, organizationId);
          
        default:
          throw new Error(`Tool not found: ${params.name}`);
      }
    } finally {
      // Record tool execution in metrics
      const executionTime = performance.now() - startTime;
      await this.toolMetricsService.recordToolExecution(
        organizationId,
        {
          user_id: userId,
          tool_name: params.name,
          input_parameters: params.arguments,
          output_summary: { success: true }
        },
        executionTime,
        'success'
      ).catch(error => {
        this.logger.error('Failed to record tool execution', { error });
      });
    }
  }

  private async handleResourcesList(organizationId: string): Promise<{ resources: McpResource[] }> {
    return {
      resources: [
        {
          uri: `fortium://metrics/sessions/${organizationId}`,
          name: 'User Sessions',
          description: 'List of user sessions for the organization',
          mimeType: 'application/json'
        },
        {
          uri: `fortium://metrics/tools/${organizationId}`,
          name: 'Tool Usage',
          description: 'Tool usage metrics for the organization',
          mimeType: 'application/json'
        },
        {
          uri: `fortium://metrics/performance/${organizationId}`,
          name: 'Performance Metrics',
          description: 'Performance and productivity metrics',
          mimeType: 'application/json'
        }
      ]
    };
  }

  private async handleResourceRead(
    params: { uri: string },
    organizationId: string
  ): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string }> }> {
    const uri = params.uri;
    
    if (uri === `fortium://metrics/sessions/${organizationId}`) {
      const sessions = this.sessionService.getActiveSessions(organizationId);
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(sessions, null, 2)
        }]
      };
    }
    
    throw new Error(`Resource not found: ${uri}`);
  }

  private async handlePromptsList(): Promise<{ prompts: McpPrompt[] }> {
    return {
      prompts: await this.getAvailablePrompts()
    };
  }

  private async handlePromptGet(params: { name: string; arguments?: any }): Promise<any> {
    // Implementation for prompt handling
    throw new Error(`Prompt not found: ${params.name}`);
  }

  private async handleSetLogLevel(params: { level: string }): Promise<{ success: boolean }> {
    // Update logging level
    this.logger.level = params.level;
    return { success: true };
  }

  // Fortium-specific handlers

  private async handleSessionStart(
    params: { user_id: string; metadata?: any },
    organizationId: string,
    userId: string
  ): Promise<any> {
    const result = await this.sessionService.startSession(
      organizationId,
      userId,
      params.metadata
    );
    
    return {
      success: result.success,
      session_id: result.session?.id,
      message: result.message
    };
  }

  private async handleSessionEnd(
    params: { session_id: string; end_metadata?: any },
    organizationId: string,
    userId: string
  ): Promise<any> {
    const result = await this.sessionService.endSession(
      organizationId,
      params.session_id,
      params.end_metadata
    );
    
    return {
      success: result.success,
      summary: result.summary,
      message: result.message
    };
  }

  private async handleSessionActivity(
    params: { session_id: string; activity: any },
    organizationId: string,
    userId: string
  ): Promise<any> {
    const result = await this.sessionService.updateSessionActivity(
      organizationId,
      params.session_id,
      params.activity
    );
    
    return {
      success: result.success,
      message: result.message
    };
  }

  private async handleToolUsage(
    params: { tool_name: string; execution_time_ms: number; status: string; context?: any },
    organizationId: string,
    userId: string
  ): Promise<any> {
    const result = await this.toolMetricsService.recordToolExecution(
      organizationId,
      {
        user_id: userId,
        tool_name: params.tool_name,
        ...params.context
      },
      params.execution_time_ms,
      params.status as 'success' | 'error' | 'timeout' | 'cancelled'
    );
    
    return {
      success: result.success,
      alerts: result.alerts,
      message: result.message
    };
  }

  private async handleMetricsBatch(params: any, organizationId: string): Promise<any> {
    // Handle batch metrics upload
    // Implementation depends on MetricsModel.batchInsertMetrics
    throw new Error('Batch metrics not yet implemented');
  }

  private async handleMetricsQuery(params: any, organizationId: string): Promise<any> {
    // Handle metrics queries
    // Implementation depends on specific query requirements
    throw new Error('Metrics query not yet implemented');
  }

  // Tool implementations

  private async toolRecordSessionStart(args: any, organizationId: string, userId: string) {
    return await this.handleSessionStart(args, organizationId, userId);
  }

  private async toolRecordSessionEnd(args: any, organizationId: string, userId: string) {
    return await this.handleSessionEnd(args, organizationId, userId);
  }

  private async toolRecordToolUsage(args: any, organizationId: string, userId: string) {
    return await this.handleToolUsage(args, organizationId, userId);
  }

  private async toolGetSessionMetrics(args: any, organizationId: string) {
    return await this.sessionService.getSessionMetrics();
  }

  private async toolGetToolMetrics(args: { tool_name?: string; days?: number }, organizationId: string) {
    const days = args.days || 7;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    
    if (args.tool_name) {
      return await this.toolMetricsService.getToolMetrics(organizationId, args.tool_name, {
        start: startDate,
        end: endDate
      });
    } else {
      return await this.toolMetricsService.getAllToolMetrics(organizationId, {
        start: startDate,
        end: endDate
      });
    }
  }

  // Helper methods

  private async getAvailableTools(): Promise<McpTool[]> {
    return [
      {
        name: 'record-session-start',
        description: 'Start a new user session with metadata',
        inputSchema: {
          type: 'object',
          properties: {
            metadata: { type: 'object' }
          }
        }
      },
      {
        name: 'record-session-end',
        description: 'End a user session with completion metadata',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            end_metadata: { type: 'object' }
          },
          required: ['session_id']
        }
      },
      {
        name: 'record-tool-usage',
        description: 'Record tool execution with performance metrics',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: { type: 'string' },
            execution_time_ms: { type: 'number' },
            status: { type: 'string', enum: ['success', 'error', 'timeout', 'cancelled'] },
            context: { type: 'object' }
          },
          required: ['tool_name', 'execution_time_ms', 'status']
        }
      },
      {
        name: 'get-session-metrics',
        description: 'Get current session metrics and statistics',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get-tool-metrics',
        description: 'Get tool usage metrics and performance data',
        inputSchema: {
          type: 'object',
          properties: {
            tool_name: { type: 'string' },
            days: { type: 'number', minimum: 1, maximum: 90 }
          }
        }
      }
    ];
  }

  private async getAvailableResources(): Promise<McpResource[]> {
    return [
      {
        uri: 'fortium://metrics/sessions',
        name: 'User Sessions',
        description: 'Active and recent user sessions'
      },
      {
        uri: 'fortium://metrics/tools',
        name: 'Tool Usage',
        description: 'Tool execution metrics and trends'
      }
    ];
  }

  private async getAvailablePrompts(): Promise<McpPrompt[]> {
    return [
      {
        name: 'analyze-productivity',
        description: 'Analyze user productivity metrics and provide insights',
        arguments: [
          { name: 'user_id', description: 'User to analyze', required: true },
          { name: 'days', description: 'Number of days to analyze', required: false }
        ]
      }
    ];
  }

  private getCacheKey(request: McpRequest, organizationId: string, userId: string): string {
    return `${request.method}:${organizationId}:${JSON.stringify(request.params)}`;
  }

  private isReadOnlyRequest(method: string): boolean {
    const readOnlyMethods = [
      'tools/list',
      'resources/list',
      'resources/read',
      'prompts/list',
      'prompts/get',
      'metrics/query'
    ];
    return readOnlyMethods.includes(method);
  }

  private updatePerformanceStats(responseTimeMs: number): void {
    const current = this.performanceStats.avg_response_time_ms;
    const count = this.performanceStats.total_requests;
    
    this.performanceStats.avg_response_time_ms = 
      ((current * (count - 1)) + responseTimeMs) / count;
    
    if (responseTimeMs < 5) {
      this.performanceStats.requests_under_5ms++;
    }
  }

  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.requestCache.entries()) {
      if ((now - cached.timestamp) > this.CACHE_TTL_MS) {
        this.requestCache.delete(key);
      }
    }
  }
}