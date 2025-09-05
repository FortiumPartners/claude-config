/**
 * Backward Compatibility Service
 * Task 4.4: Maintains compatibility with legacy MCP requests and data formats
 * 
 * Handles translation between legacy MCP formats and current protocol versions
 */

import { DatabaseConnection } from '../database/connection';
import { McpServerService, McpRequest, McpResponse } from './mcp-server.service';
import * as winston from 'winston';

export interface LegacyMcpRequest {
  id?: number | string;
  method: string;
  params?: any;
  version?: string;
}

export interface LegacyMcpResponse {
  id?: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface CompatibilityRule {
  legacyMethod: string;
  modernMethod: string;
  paramTransformer?: (params: any) => any;
  responseTransformer?: (response: any) => any;
  deprecationWarning?: string;
}

export class CompatibilityService {
  private mcpServerService: McpServerService;
  private compatibilityRules: Map<string, CompatibilityRule> = new Map();

  constructor(
    private db: DatabaseConnection,
    private logger: winston.Logger
  ) {
    this.mcpServerService = new McpServerService(db, logger);
    this.initializeCompatibilityRules();
  }

  /**
   * Handle legacy MCP request with backward compatibility
   */
  async handleLegacyRequest(
    request: LegacyMcpRequest,
    organizationId: string,
    userId: string
  ): Promise<LegacyMcpResponse> {
    try {
      // Detect protocol version
      const protocolVersion = this.detectProtocolVersion(request);
      
      // Transform legacy request to modern format
      const modernRequest = await this.transformLegacyRequest(request, protocolVersion);
      
      // Process with modern MCP server
      const modernResponse = await this.mcpServerService.handleRequest(
        modernRequest,
        organizationId,
        userId
      );

      // Transform response back to legacy format if needed
      const legacyResponse = await this.transformModernResponse(
        modernResponse,
        request,
        protocolVersion
      );

      // Log compatibility usage for analytics
      await this.logCompatibilityUsage(
        organizationId,
        protocolVersion,
        request.method,
        modernRequest.method
      );

      return legacyResponse;

    } catch (error) {
      this.logger.error('Legacy request handling error:', error);
      
      return {
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
            compatibility_layer: true
          }
        }
      };
    }
  }

  /**
   * Detect MCP protocol version from request
   */
  private detectProtocolVersion(request: LegacyMcpRequest): string {
    // Check for explicit version
    if (request.version) {
      return request.version;
    }

    // Check for legacy method patterns
    if (request.method?.startsWith('dashboard/')) {
      return 'legacy-dashboard';
    }

    if (request.method?.startsWith('metrics/')) {
      return 'legacy-metrics';
    }

    if (request.method === 'get_capabilities') {
      return 'mcp-2023';
    }

    if (!request.method?.includes('/')) {
      return 'pre-mcp';
    }

    // Default to current
    return '2024-11-05';
  }

  /**
   * Transform legacy request to modern MCP format
   */
  private async transformLegacyRequest(
    legacyRequest: LegacyMcpRequest,
    version: string
  ): Promise<McpRequest> {
    const rule = this.compatibilityRules.get(legacyRequest.method);
    
    if (rule) {
      // Apply deprecation warning
      if (rule.deprecationWarning) {
        this.logger.warn(`Deprecated method used: ${legacyRequest.method} - ${rule.deprecationWarning}`);
      }

      // Transform to modern request
      const modernRequest: McpRequest = {
        jsonrpc: '2.0',
        id: legacyRequest.id,
        method: rule.modernMethod,
        params: rule.paramTransformer 
          ? rule.paramTransformer(legacyRequest.params)
          : legacyRequest.params
      };

      return modernRequest;
    }

    // Handle version-specific transformations
    switch (version) {
      case 'legacy-dashboard':
        return this.transformLegacyDashboardRequest(legacyRequest);
      
      case 'legacy-metrics':
        return this.transformLegacyMetricsRequest(legacyRequest);
      
      case 'mcp-2023':
        return this.transformMcp2023Request(legacyRequest);
      
      case 'pre-mcp':
        return this.transformPreMcpRequest(legacyRequest);
      
      default:
        // Assume modern format, just add jsonrpc field
        return {
          jsonrpc: '2.0',
          id: legacyRequest.id,
          method: legacyRequest.method,
          params: legacyRequest.params
        };
    }
  }

  /**
   * Transform legacy dashboard requests
   */
  private transformLegacyDashboardRequest(request: LegacyMcpRequest): McpRequest {
    switch (request.method) {
      case 'dashboard/get':
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: 'tools/call',
          params: {
            name: 'query_dashboard',
            arguments: {
              timeframe: request.params?.timeframe || '24h',
              format: request.params?.format || 'json',
              ...request.params
            }
          }
        };

      case 'dashboard/metrics':
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: 'resources/read',
          params: {
            uri: 'metrics://dashboard/current'
          }
        };

      default:
        throw new Error(`Unknown legacy dashboard method: ${request.method}`);
    }
  }

  /**
   * Transform legacy metrics requests
   */
  private transformLegacyMetricsRequest(request: LegacyMcpRequest): McpRequest {
    switch (request.method) {
      case 'metrics/send':
      case 'metrics/collect':
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: 'tools/call',
          params: {
            name: 'collect_metrics',
            arguments: this.transformLegacyMetricsParams(request.params)
          }
        };

      case 'metrics/query':
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: 'tools/call',
          params: {
            name: 'query_dashboard',
            arguments: {
              timeframe: request.params?.timeframe || '24h',
              metrics: request.params?.metrics,
              format: 'json'
            }
          }
        };

      default:
        throw new Error(`Unknown legacy metrics method: ${request.method}`);
    }
  }

  /**
   * Transform MCP 2023 requests
   */
  private transformMcp2023Request(request: LegacyMcpRequest): McpRequest {
    switch (request.method) {
      case 'get_capabilities':
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'legacy-client',
              version: '2023'
            }
          }
        };

      case 'list_tools':
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: 'tools/list',
          params: request.params
        };

      case 'call_tool':
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: 'tools/call',
          params: {
            name: request.params?.tool_name || request.params?.name,
            arguments: request.params?.arguments || request.params?.args
          }
        };

      default:
        // Direct mapping with jsonrpc field
        return {
          jsonrpc: '2.0',
          id: request.id,
          method: request.method,
          params: request.params
        };
    }
  }

  /**
   * Transform pre-MCP requests
   */
  private transformPreMcpRequest(request: LegacyMcpRequest): McpRequest {
    // Map old command-style requests to MCP tools
    const commandMappings: Record<string, string> = {
      'send_metrics': 'collect_metrics',
      'get_dashboard': 'query_dashboard',
      'migrate_data': 'migrate_local_metrics',
      'health_check': 'server_health'
    };

    const toolName = commandMappings[request.method] || request.method;

    return {
      jsonrpc: '2.0',
      id: request.id,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: request.params || {}
      }
    };
  }

  /**
   * Transform modern response to legacy format
   */
  private async transformModernResponse(
    modernResponse: McpResponse,
    originalRequest: LegacyMcpRequest,
    version: string
  ): Promise<LegacyMcpResponse> {
    const rule = this.compatibilityRules.get(originalRequest.method);
    
    if (rule?.responseTransformer) {
      return {
        id: modernResponse.id,
        result: rule.responseTransformer(modernResponse.result),
        error: modernResponse.error
      };
    }

    // Version-specific response transformations
    switch (version) {
      case 'legacy-dashboard':
        return this.transformLegacyDashboardResponse(modernResponse, originalRequest);
      
      case 'legacy-metrics':
        return this.transformLegacyMetricsResponse(modernResponse, originalRequest);
      
      case 'mcp-2023':
        return this.transformMcp2023Response(modernResponse, originalRequest);
      
      case 'pre-mcp':
        return this.transformPreMcpResponse(modernResponse, originalRequest);
      
      default:
        // Remove jsonrpc field for legacy clients
        const { jsonrpc, ...legacyResponse } = modernResponse;
        return legacyResponse;
    }
  }

  /**
   * Transform dashboard responses for legacy clients
   */
  private transformLegacyDashboardResponse(
    response: McpResponse,
    originalRequest: LegacyMcpRequest
  ): LegacyMcpResponse {
    if (response.error) {
      return { id: response.id, error: response.error };
    }

    switch (originalRequest.method) {
      case 'dashboard/get':
        // Extract content from tool call response
        if (response.result?.content?.[0]?.text) {
          try {
            const dashboardData = JSON.parse(response.result.content[0].text);
            return {
              id: response.id,
              result: {
                dashboard: dashboardData,
                timestamp: new Date().toISOString()
              }
            };
          } catch {
            return {
              id: response.id,
              result: { raw_content: response.result.content[0].text }
            };
          }
        }
        break;

      case 'dashboard/metrics':
        // Transform resource response
        if (response.result?.contents?.[0]?.text) {
          try {
            const metricsData = JSON.parse(response.result.contents[0].text);
            return {
              id: response.id,
              result: { metrics: metricsData }
            };
          } catch {
            return {
              id: response.id,
              result: { raw_data: response.result.contents[0].text }
            };
          }
        }
        break;
    }

    return { id: response.id, result: response.result };
  }

  /**
   * Transform metrics responses for legacy clients
   */
  private transformLegacyMetricsResponse(
    response: McpResponse,
    originalRequest: LegacyMcpRequest
  ): LegacyMcpResponse {
    if (response.error) {
      return { id: response.id, error: response.error };
    }

    switch (originalRequest.method) {
      case 'metrics/send':
      case 'metrics/collect':
        return {
          id: response.id,
          result: {
            success: true,
            message: 'Metrics collected successfully',
            ...response.result
          }
        };

      case 'metrics/query':
        // Extract and simplify query results
        if (response.result?.content?.[0]?.text) {
          try {
            const data = JSON.parse(response.result.content[0].text);
            return {
              id: response.id,
              result: {
                metrics: data,
                count: Array.isArray(data) ? data.length : 1,
                timestamp: new Date().toISOString()
              }
            };
          } catch {
            return {
              id: response.id,
              result: { raw_data: response.result.content[0].text }
            };
          }
        }
        break;
    }

    return { id: response.id, result: response.result };
  }

  /**
   * Transform MCP 2023 responses
   */
  private transformMcp2023Response(
    response: McpResponse,
    originalRequest: LegacyMcpRequest
  ): LegacyMcpResponse {
    if (response.error) {
      return { id: response.id, error: response.error };
    }

    switch (originalRequest.method) {
      case 'get_capabilities':
        return {
          id: response.id,
          result: {
            capabilities: response.result?.capabilities || {},
            server_info: response.result?.serverInfo || {},
            protocol_version: '2023' // Hide the modern version
          }
        };

      case 'list_tools':
        return {
          id: response.id,
          result: {
            tools: response.result?.tools || []
          }
        };

      case 'call_tool':
        return {
          id: response.id,
          result: {
            tool_result: response.result,
            success: !response.error
          }
        };

      default:
        const { jsonrpc, ...legacyResponse } = response;
        return legacyResponse;
    }
  }

  /**
   * Transform pre-MCP responses
   */
  private transformPreMcpResponse(
    response: McpResponse,
    originalRequest: LegacyMcpRequest
  ): LegacyMcpResponse {
    if (response.error) {
      return {
        id: response.id,
        error: {
          code: response.error.code,
          message: response.error.message
        }
      };
    }

    // Simplify tool call responses
    if (response.result?.content?.[0]?.text) {
      return {
        id: response.id,
        result: {
          success: true,
          data: response.result.content[0].text,
          message: 'Operation completed successfully'
        }
      };
    }

    return {
      id: response.id,
      result: response.result || { success: true }
    };
  }

  /**
   * Transform legacy metrics parameters
   */
  private transformLegacyMetricsParams(params: any): any {
    if (!params) return {};

    // Handle various legacy parameter formats
    const transformed: any = {};

    // Map common legacy field names
    const fieldMappings: Record<string, string> = {
      'command': 'command_name',
      'duration': 'execution_time_ms',
      'time': 'execution_time_ms',
      'duration_ms': 'execution_time_ms',
      'succeeded': 'success',
      'status': 'success',
      'agent': 'context.agent_used',
      'session': 'context.claude_session',
      'metadata': 'context'
    };

    Object.entries(params).forEach(([key, value]) => {
      const mappedKey = fieldMappings[key];
      if (mappedKey) {
        if (mappedKey.includes('.')) {
          // Nested field
          const [parent, child] = mappedKey.split('.');
          if (!transformed[parent]) transformed[parent] = {};
          transformed[parent][child] = value;
        } else {
          transformed[mappedKey] = value;
        }
      } else {
        transformed[key] = value;
      }
    });

    // Ensure required fields
    if (!transformed.command_name) {
      transformed.command_name = params.name || params.action || 'unknown_command';
    }

    if (transformed.execution_time_ms === undefined) {
      transformed.execution_time_ms = 0;
    }

    if (transformed.success === undefined) {
      transformed.success = params.status !== 'failed' && params.status !== false;
    }

    return transformed;
  }

  /**
   * Initialize compatibility rules
   */
  private initializeCompatibilityRules(): void {
    const rules: CompatibilityRule[] = [
      // Legacy dashboard methods
      {
        legacyMethod: 'dashboard_get',
        modernMethod: 'tools/call',
        paramTransformer: (params) => ({
          name: 'query_dashboard',
          arguments: params
        }),
        deprecationWarning: 'dashboard_get is deprecated, use tools/call with query_dashboard'
      },

      // Legacy metrics methods
      {
        legacyMethod: 'send_metric',
        modernMethod: 'tools/call',
        paramTransformer: (params) => ({
          name: 'collect_metrics',
          arguments: this.transformLegacyMetricsParams(params)
        }),
        deprecationWarning: 'send_metric is deprecated, use tools/call with collect_metrics'
      },

      // Legacy tool methods
      {
        legacyMethod: 'get_tools',
        modernMethod: 'tools/list',
        deprecationWarning: 'get_tools is deprecated, use tools/list'
      },

      {
        legacyMethod: 'execute_tool',
        modernMethod: 'tools/call',
        paramTransformer: (params) => ({
          name: params.tool_name || params.name,
          arguments: params.args || params.arguments
        }),
        deprecationWarning: 'execute_tool is deprecated, use tools/call'
      }
    ];

    rules.forEach(rule => {
      this.compatibilityRules.set(rule.legacyMethod, rule);
    });
  }

  /**
   * Log compatibility usage for analytics
   */
  private async logCompatibilityUsage(
    organizationId: string,
    protocolVersion: string,
    legacyMethod: string,
    modernMethod: string
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO compatibility_usage_log (
          organization_id, protocol_version, legacy_method, modern_method, 
          usage_count, last_used, created_at
        ) 
        VALUES ($1, $2, $3, $4, 1, NOW(), NOW())
        ON CONFLICT (organization_id, protocol_version, legacy_method, modern_method)
        DO UPDATE SET 
          usage_count = compatibility_usage_log.usage_count + 1,
          last_used = NOW()
      `;

      await this.db.query(query, [
        organizationId,
        protocolVersion,
        legacyMethod,
        modernMethod
      ]);

    } catch (error) {
      // Don't fail the request if logging fails
      this.logger.warn('Failed to log compatibility usage:', error);
    }
  }

  /**
   * Get compatibility usage statistics
   */
  async getCompatibilityStats(organizationId: string): Promise<any> {
    const query = `
      SELECT 
        protocol_version, 
        legacy_method, 
        modern_method,
        usage_count, 
        last_used
      FROM compatibility_usage_log 
      WHERE organization_id = $1 
      ORDER BY usage_count DESC, last_used DESC
    `;

    const result = await this.db.query(query, [organizationId]);
    return result.rows;
  }
}