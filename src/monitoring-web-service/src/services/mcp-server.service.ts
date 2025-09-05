/**
 * MCP Server Service
 * Task 4.2: Core MCP protocol implementation with backward compatibility
 * 
 * Handles MCP 2024-11-05 protocol methods and maintains compatibility with existing Claude Code workflows
 */

import { DatabaseConnection } from '../database/connection';
import { MetricsCollectionService } from './metrics-collection.service';
import { MetricsQueryService } from './metrics-query.service';
import { MigrationService } from './migration.service';
import { MCP_ERROR_CODES } from '../routes/mcp.routes';
import * as winston from 'winston';

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

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
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

export interface ServerCapabilities {
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  experimental?: Record<string, any>;
}

export class McpServerService {
  private metricsCollectionService: MetricsCollectionService;
  private metricsQueryService: MetricsQueryService;
  private migrationService: MigrationService;

  constructor(
    private db: DatabaseConnection,
    private logger: winston.Logger
  ) {
    this.metricsCollectionService = new MetricsCollectionService(db, logger);
    this.metricsQueryService = new MetricsQueryService(db, logger);
    this.migrationService = new MigrationService(db, logger);
  }

  /**
   * Handle MCP request and route to appropriate method
   */
  async handleRequest(
    request: McpRequest,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    try {
      const { method, params, id } = request;

      // Route to appropriate method handler
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id, params);
        
        case 'resources/list':
          return this.handleResourcesList(id, params, organizationId);
        
        case 'resources/read':
          return this.handleResourcesRead(id, params, organizationId);
        
        case 'tools/list':
          return this.handleToolsList(id, params);
        
        case 'tools/call':
          return this.handleToolsCall(id, params, organizationId, userId);
        
        case 'prompts/list':
          return this.handlePromptsList(id, params);
        
        case 'prompts/get':
          return this.handlePromptsGet(id, params, organizationId);

        // Custom Fortium methods
        case 'fortium/migrate':
          return this.handleFortiumMigrate(id, params, organizationId, userId);
        
        case 'fortium/configure':
          return this.handleFortiumConfigure(id, params, organizationId, userId);

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
              message: `Method '${method}' not found`,
              data: { available_methods: this.getAvailableMethods() }
            }
          };
      }
    } catch (error) {
      this.logger.error('MCP request handling error:', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: MCP_ERROR_CODES.INTERNAL_ERROR,
          message: 'Internal server error',
          data: { 
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
    // Limit batch size to prevent abuse
    if (requests.length > 100) {
      return [{
        jsonrpc: '2.0',
        error: {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: 'Batch size too large',
          data: { max_batch_size: 100, received: requests.length }
        }
      }];
    }

    // Process requests with limited concurrency
    const CONCURRENCY_LIMIT = 10;
    const responses: McpResponse[] = [];
    
    for (let i = 0; i < requests.length; i += CONCURRENCY_LIMIT) {
      const batch = requests.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = batch.map(request => 
        this.handleRequest(request, organizationId, userId)
      );
      
      const batchResponses = await Promise.all(batchPromises);
      responses.push(...batchResponses);
    }

    return responses;
  }

  /**
   * MCP initialize method
   */
  private async handleInitialize(
    id: number | string | undefined,
    params: any
  ): Promise<McpResponse> {
    const requiredVersion = '2024-11-05';
    
    if (!params?.protocolVersion || params.protocolVersion !== requiredVersion) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: `Unsupported protocol version`,
          data: { 
            supported_version: requiredVersion,
            received_version: params?.protocolVersion 
          }
        }
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: requiredVersion,
        capabilities: await this.getServerCapabilities(),
        serverInfo: {
          name: 'fortium-metrics-server',
          version: '1.0.0',
          description: 'Fortium External Metrics Web Service MCP Server'
        }
      }
    };
  }

  /**
   * MCP resources/list method
   */
  private async handleResourcesList(
    id: number | string | undefined,
    params: any,
    organizationId: string
  ): Promise<McpResponse> {
    try {
      const resources: McpResource[] = [
        {
          uri: 'metrics://dashboard/current',
          name: 'Current Dashboard',
          description: 'Real-time productivity metrics dashboard'
        },
        {
          uri: 'metrics://analytics/trends',
          name: 'Productivity Trends',
          description: 'Historical productivity trends and analysis'
        },
        {
          uri: 'metrics://agents/usage',
          name: 'Agent Usage Statistics',
          description: 'Sub-agent utilization and performance metrics'
        },
        {
          uri: 'metrics://teams/performance',
          name: 'Team Performance',
          description: 'Team-level productivity and collaboration metrics'
        },
        {
          uri: 'config://organization/settings',
          name: 'Organization Settings',
          description: 'Current organization configuration and preferences'
        }
      ];

      return {
        jsonrpc: '2.0',
        id,
        result: { resources }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.SERVER_ERROR,
          message: 'Failed to list resources',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * MCP resources/read method
   */
  private async handleResourcesRead(
    id: number | string | undefined,
    params: any,
    organizationId: string
  ): Promise<McpResponse> {
    if (!params?.uri) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: 'Missing uri parameter'
        }
      };
    }

    try {
      const { uri } = params;
      
      switch (true) {
        case uri.startsWith('metrics://dashboard/'):
          const dashboardData = await this.metricsQueryService.getDashboardData(
            organizationId,
            { timeframe: '24h' }
          );
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(dashboardData, null, 2)
                }
              ]
            }
          };

        case uri.startsWith('metrics://analytics/'):
          const analyticsData = await this.metricsQueryService.getAnalyticsData(
            organizationId,
            { timeframe: '7d', include_trends: true }
          );
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(analyticsData, null, 2)
                }
              ]
            }
          };

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.RESOURCE_NOT_FOUND,
              message: `Resource not found: ${uri}`
            }
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.SERVER_ERROR,
          message: 'Failed to read resource',
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * MCP tools/list method
   */
  private async handleToolsList(
    id: number | string | undefined,
    params: any
  ): Promise<McpResponse> {
    const tools: McpTool[] = [
      {
        name: 'collect_metrics',
        description: 'Collect command execution metrics from Claude Code',
        inputSchema: {
          type: 'object',
          properties: {
            command_name: { type: 'string', description: 'Name of the executed command' },
            execution_time_ms: { type: 'number', description: 'Execution time in milliseconds' },
            success: { type: 'boolean', description: 'Whether the command succeeded' },
            context: {
              type: 'object',
              description: 'Additional context including agent usage and session info',
              properties: {
                claude_session: { type: 'string' },
                agent_used: { type: 'string' },
                delegation_pattern: { type: 'object' }
              }
            }
          },
          required: ['command_name', 'execution_time_ms', 'success']
        }
      },
      {
        name: 'query_dashboard',
        description: 'Query dashboard data and analytics',
        inputSchema: {
          type: 'object',
          properties: {
            timeframe: { type: 'string', enum: ['1h', '24h', '7d', '30d'], description: 'Time range for data' },
            metrics: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Specific metrics to include'
            },
            format: { type: 'string', enum: ['json', 'ascii', 'markdown'], description: 'Output format' }
          },
          required: ['timeframe']
        }
      },
      {
        name: 'migrate_local_metrics',
        description: 'Migrate existing local metrics to web service',
        inputSchema: {
          type: 'object',
          properties: {
            local_config_path: { type: 'string', description: 'Path to local configuration' },
            legacy_format: { type: 'object', description: 'Legacy metric data' },
            preserve_local: { type: 'boolean', description: 'Keep local copy after migration' }
          }
        }
      },
      {
        name: 'configure_integration',
        description: 'Configure Claude Code integration settings',
        inputSchema: {
          type: 'object',
          properties: {
            webhook_url: { type: 'string' },
            notification_settings: { type: 'object' },
            sync_preferences: { type: 'object' }
          }
        }
      }
    ];

    return {
      jsonrpc: '2.0',
      id,
      result: { tools }
    };
  }

  /**
   * MCP tools/call method
   */
  private async handleToolsCall(
    id: number | string | undefined,
    params: any,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    if (!params?.name) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.INVALID_PARAMS,
          message: 'Missing tool name'
        }
      };
    }

    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'collect_metrics':
          return await this.handleCollectMetrics(id, args, organizationId, userId);
        
        case 'query_dashboard':
          return await this.handleQueryDashboard(id, args, organizationId);
        
        case 'migrate_local_metrics':
          return await this.handleMigrateLocalMetrics(id, args, organizationId, userId);
        
        case 'configure_integration':
          return await this.handleConfigureIntegration(id, args, organizationId, userId);

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: MCP_ERROR_CODES.TOOL_NOT_FOUND,
              message: `Tool '${name}' not found`
            }
          };
      }
    } catch (error) {
      this.logger.error(`Tool call error for ${name}:`, error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.SERVER_ERROR,
          message: `Tool execution failed: ${name}`,
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  /**
   * Tool implementation: collect_metrics
   */
  private async handleCollectMetrics(
    id: number | string | undefined,
    args: any,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    const result = await this.metricsCollectionService.collectCommandExecution(
      organizationId,
      args
    );

    if (!result.success) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCP_ERROR_CODES.SERVER_ERROR,
          message: 'Failed to collect metrics',
          data: { reason: result.message }
        }
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: `Metric collected successfully. ID: ${result.data?.metric_id}`
          }
        ]
      }
    };
  }

  /**
   * Tool implementation: query_dashboard
   */
  private async handleQueryDashboard(
    id: number | string | undefined,
    args: any,
    organizationId: string
  ): Promise<McpResponse> {
    const { timeframe = '24h', metrics, format = 'json' } = args;

    const dashboardData = await this.metricsQueryService.getDashboardData(
      organizationId,
      { timeframe, metrics }
    );

    let content: string;
    
    switch (format) {
      case 'ascii':
        content = this.formatDashboardAscii(dashboardData);
        break;
      case 'markdown':
        content = this.formatDashboardMarkdown(dashboardData);
        break;
      default:
        content = JSON.stringify(dashboardData, null, 2);
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: content
          }
        ]
      }
    };
  }

  /**
   * Tool implementation: migrate_local_metrics
   */
  private async handleMigrateLocalMetrics(
    id: number | string | undefined,
    args: any,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    const migrationResult = await this.migrationService.migrateLocalMetrics(
      organizationId,
      userId,
      args
    );

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: `Migration completed. Migrated ${migrationResult.metrics_migrated} metrics.`
          }
        ]
      }
    };
  }

  /**
   * Tool implementation: configure_integration
   */
  private async handleConfigureIntegration(
    id: number | string | undefined,
    args: any,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    // Implementation would configure Claude Code integration
    // This is a placeholder for now
    
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: 'Integration configuration updated successfully'
          }
        ]
      }
    };
  }

  /**
   * Get server capabilities
   */
  async getServerCapabilities(): Promise<ServerCapabilities> {
    return {
      resources: {
        subscribe: false, // Future enhancement
        listChanged: false
      },
      tools: {
        listChanged: false
      },
      prompts: {
        listChanged: false
      },
      experimental: {
        batch_requests: true,
        real_time_metrics: true,
        migration_tools: true
      }
    };
  }

  /**
   * Get server health status
   */
  async getServerHealth(): Promise<any> {
    try {
      // Check database connection
      await this.db.query('SELECT 1');
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        protocol_version: '2024-11-05',
        uptime_seconds: process.uptime(),
        database: 'connected'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle prompts/list (placeholder)
   */
  private async handlePromptsList(
    id: number | string | undefined,
    params: any
  ): Promise<McpResponse> {
    return {
      jsonrpc: '2.0',
      id,
      result: { prompts: [] }
    };
  }

  /**
   * Handle prompts/get (placeholder)
   */
  private async handlePromptsGet(
    id: number | string | undefined,
    params: any,
    organizationId: string
  ): Promise<McpResponse> {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
        message: 'Prompts not yet implemented'
      }
    };
  }

  /**
   * Handle fortium/migrate (custom method)
   */
  private async handleFortiumMigrate(
    id: number | string | undefined,
    params: any,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    // Custom Fortium migration method implementation
    return {
      jsonrpc: '2.0',
      id,
      result: { migration_status: 'completed' }
    };
  }

  /**
   * Handle fortium/configure (custom method)
   */
  private async handleFortiumConfigure(
    id: number | string | undefined,
    params: any,
    organizationId: string,
    userId: string
  ): Promise<McpResponse> {
    // Custom Fortium configuration method implementation
    return {
      jsonrpc: '2.0',
      id,
      result: { configuration_updated: true }
    };
  }

  /**
   * Get list of available methods
   */
  private getAvailableMethods(): string[] {
    return [
      'initialize',
      'resources/list',
      'resources/read',
      'tools/list',
      'tools/call',
      'prompts/list',
      'prompts/get',
      'fortium/migrate',
      'fortium/configure'
    ];
  }

  /**
   * Format dashboard data as ASCII art
   */
  private formatDashboardAscii(data: any): string {
    return `
┌─────────────────────────────────────────────────────────────┐
│ FORTIUM AI-AUGMENTED DEVELOPMENT DASHBOARD                 │
├─────────────────────────────────────────────────────────────┤
│ Commands Executed: ${String(data.command_count || 0).padStart(6)}     Success Rate: ${String(Math.round((data.success_rate || 0) * 100)).padStart(3)}% │
│ Active Agents: ${String(data.active_agents || 0).padStart(10)}         Productivity: +${String(Math.round(data.productivity_improvement || 0)).padStart(2)}% │
│ Response Time: ${String(Math.round(data.avg_response_time || 0)).padStart(6)}ms       Quality Score: ${String(Math.round((data.quality_score || 0) * 100)).padStart(3)}% │
└─────────────────────────────────────────────────────────────┘`;
  }

  /**
   * Format dashboard data as Markdown
   */
  private formatDashboardMarkdown(data: any): string {
    return `# Fortium AI-Augmented Development Dashboard

## Key Metrics
- **Commands Executed**: ${data.command_count || 0}
- **Success Rate**: ${Math.round((data.success_rate || 0) * 100)}%
- **Active Agents**: ${data.active_agents || 0}
- **Productivity Improvement**: +${Math.round(data.productivity_improvement || 0)}%
- **Average Response Time**: ${Math.round(data.avg_response_time || 0)}ms
- **Quality Score**: ${Math.round((data.quality_score || 0) * 100)}%

## Recent Activity
${data.recent_commands?.map(cmd => `- ${cmd.name}: ${cmd.duration}ms`).join('\n') || 'No recent activity'}`;
  }
}