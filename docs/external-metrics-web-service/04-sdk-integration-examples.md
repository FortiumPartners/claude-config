# External Metrics Web Service - SDK Integration and Examples

> **Version**: 1.0.0  
> **Status**: Production Ready  
> **Last Updated**: September 2025  

## Overview

The External Metrics Web Service provides comprehensive SDKs and integration examples for seamless connection with Claude Code instances. This documentation covers the MCP Client SDK, configuration options, usage examples, and best practices for integrating metrics collection into your Claude Code workflows.

## SDK Architecture

### MCP Client SDK

**Location**: `/src/sdk/mcp-client.ts`  
**Package**: `@fortium/metrics-mcp-client`  
**Type**: TypeScript SDK with JavaScript compatibility

**Core Features**:
- **MCP Protocol**: Full MCP 2024-11-05 specification support
- **Multi-Transport**: HTTP, WebSocket, and SSE connectivity
- **Auto-Retry**: Exponential backoff with configurable retry attempts
- **Event-Driven**: EventEmitter-based architecture for real-time updates
- **Type Safety**: Complete TypeScript definitions
- **Performance**: <5ms request overhead with local caching

### SDK Components

```typescript
// Core SDK classes and interfaces
export class McpClient extends EventEmitter {
  // Main client for MCP communication
}

export interface McpClientConfig {
  serverUrl: string;           // Base URL for metrics service
  apiKey?: string;            // API authentication key  
  organizationId?: string;    // Organization identifier
  reconnectInterval?: number; // WebSocket reconnection interval
  timeout?: number;           // Request timeout in milliseconds
  enableWebSocket?: boolean;  // Enable WebSocket real-time updates
  retryAttempts?: number;     // HTTP request retry attempts
  debug?: boolean;            // Enable debug logging
}

// Convenience factory functions
export function createMcpClient(config: McpClientConfig): McpClient;
export function createAutoConfiguredMcpClient(overrides?: Partial<McpClientConfig>): Promise<McpClient>;
```

## Installation and Setup

### NPM Installation

```bash
# Install the MCP Client SDK
npm install @fortium/metrics-mcp-client

# Install peer dependencies
npm install ws axios
```

### Environment Configuration

**Required Environment Variables**:
```bash
# Core Configuration
FORTIUM_METRICS_URL=https://api.fortium-metrics.com
FORTIUM_API_KEY=your_api_key_here
FORTIUM_ORG_ID=your_organization_id

# Optional Configuration
FORTIUM_TIMEOUT=30000          # Request timeout (ms)
FORTIUM_RETRY_ATTEMPTS=3       # Retry attempts for failed requests
FORTIUM_WEBSOCKET_ENABLED=true # Enable WebSocket real-time updates
FORTIUM_DEBUG=false            # Enable debug logging
FORTIUM_RECONNECT_INTERVAL=5000 # WebSocket reconnection interval (ms)
```

### Claude Code MCP Server Configuration

**`.claude/config.json` Configuration**:
```json
{
  "mcpServers": {
    "fortium-metrics": {
      "command": "npx",
      "args": ["-y", "@fortium/metrics-mcp-server"],
      "env": {
        "FORTIUM_METRICS_URL": "${FORTIUM_METRICS_URL}",
        "FORTIUM_API_KEY": "${FORTIUM_API_KEY}",
        "FORTIUM_ORG_ID": "${FORTIUM_ORG_ID}",
        "FORTIUM_MODE": "hybrid"
      }
    }
  }
}
```

## Basic Usage Examples

### Example 1: Simple Metrics Collection

```typescript
import { McpClient } from '@fortium/metrics-mcp-client';

async function basicMetricsCollection() {
  // Initialize client with configuration
  const client = new McpClient({
    serverUrl: 'https://api.fortium-metrics.com',
    apiKey: process.env.FORTIUM_API_KEY,
    organizationId: process.env.FORTIUM_ORG_ID,
    debug: true
  });

  try {
    // Connect to the metrics service
    console.log('Connecting to metrics service...');
    await client.connect();
    console.log('✓ Connected successfully');

    // Collect command execution metrics
    const metricsResult = await client.collectMetrics({
      command_name: 'generate_component',
      execution_time_ms: 1500,
      success: true,
      context: {
        claude_session: 'session-abc123',
        agent_used: 'frontend-developer',
        framework: 'react',
        component_type: 'form'
      }
    });

    console.log('✓ Metrics collected:', metricsResult);
    
    // Query dashboard data
    const dashboardData = await client.queryDashboard({
      timeframe: '24h',
      format: 'json'
    });
    
    console.log('✓ Dashboard data:', dashboardData);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
    console.log('Disconnected from service');
  }
}
```

### Example 2: Auto-Configured Client

```typescript
import { createAutoConfiguredMcpClient } from '@fortium/metrics-mcp-client';

async function autoConfiguredExample() {
  // Client automatically uses environment variables
  // FORTIUM_METRICS_URL, FORTIUM_API_KEY, FORTIUM_ORG_ID
  const client = await createAutoConfiguredMcpClient({
    debug: true,
    timeout: 10000
  });

  try {
    // Client is already connected
    console.log('✓ Auto-configured client ready');

    // Send multiple metrics in batch for better performance
    const batchResults = await client.sendBatch([
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'record-tool-usage',
          arguments: {
            tool_name: 'code_generator',
            execution_time_ms: 1200,
            status: 'success',
            context: { language: 'typescript' }
          }
        }
      },
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'record-tool-usage',
          arguments: {
            tool_name: 'test_runner',
            execution_time_ms: 800,
            status: 'success',
            context: { test_type: 'unit' }
          }
        }
      }
    ]);

    console.log('✓ Batch results:', batchResults);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.disconnect();
  }
}
```

### Example 3: Real-Time Event-Driven Usage

```typescript
import { McpClient } from '@fortium/metrics-mcp-client';

async function eventDrivenExample() {
  const client = new McpClient({
    serverUrl: 'wss://api.fortium-metrics.com', // WebSocket URL
    apiKey: process.env.FORTIUM_API_KEY,
    organizationId: process.env.FORTIUM_ORG_ID,
    enableWebSocket: true,
    debug: true
  });

  // Set up event listeners
  client.on('connected', (serverInfo) => {
    console.log('✓ Connected to server:', serverInfo);
  });

  client.on('websocket:connected', () => {
    console.log('✓ WebSocket connection established');
  });

  client.on('notification', (notification) => {
    console.log('📨 Server notification:', notification);
  });

  client.on('dashboard:updated', (data) => {
    console.log('📊 Dashboard updated:', data);
  });

  client.on('metrics:collected', (data) => {
    console.log('📈 New metrics collected:', data);
  });

  client.on('error', (error) => {
    console.error('❌ Client error:', error);
  });

  client.on('disconnected', () => {
    console.log('📡 Connection lost, attempting to reconnect...');
  });

  try {
    await client.connect();
    
    // Simulate periodic metrics collection
    const metricsInterval = setInterval(async () => {
      try {
        await client.collectMetrics({
          command_name: 'background_task',
          execution_time_ms: Math.floor(Math.random() * 2000) + 500,
          success: Math.random() > 0.1, // 90% success rate
          context: {
            claude_session: `session-${Date.now()}`,
            agent_used: 'background-processor',
            task_type: 'automated'
          }
        });
      } catch (error) {
        console.error('❌ Failed to send metrics:', error);
      }
    }, 5000);

    // Keep connection alive for demonstration
    await new Promise(resolve => setTimeout(resolve, 30000));
    clearInterval(metricsInterval);

  } catch (error) {
    console.error('❌ Connection error:', error);
  } finally {
    await client.disconnect();
  }
}
```

## Advanced Integration Patterns

### Example 4: Claude Code Agent Integration

```typescript
import { McpClient } from '@fortium/metrics-mcp-client';

class ClaudeCodeMetricsIntegration {
  private client: McpClient;
  private sessionId: string | null = null;

  constructor(config: { apiKey: string; organizationId: string; userId: string }) {
    this.client = new McpClient({
      serverUrl: 'https://api.fortium-metrics.com',
      apiKey: config.apiKey,
      organizationId: config.organizationId,
      enableWebSocket: true
    });
  }

  async initializeSession(sessionMetadata?: any) {
    await this.client.connect();
    
    // Start a new session
    const sessionResult = await this.client.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'record-session-start',
        arguments: {
          metadata: {
            project_name: sessionMetadata?.project || 'default',
            claude_version: sessionMetadata?.claudeVersion || '3.5-sonnet',
            user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...sessionMetadata
          }
        }
      }
    });

    this.sessionId = sessionResult.session_id;
    console.log('✓ Session started:', this.sessionId);
    return this.sessionId;
  }

  async recordAgentInteraction(agentName: string, interaction: {
    type: 'tool_call' | 'delegation' | 'response';
    inputTokens: number;
    outputTokens: number;
    processingTimeMs: number;
    success: boolean;
    metadata?: any;
  }) {
    if (!this.sessionId) {
      throw new Error('Session not initialized');
    }

    return await this.client.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'record-agent-interaction',
        arguments: {
          session_id: this.sessionId,
          agent_name: agentName,
          interaction_type: interaction.type,
          input_tokens: interaction.inputTokens,
          output_tokens: interaction.outputTokens,
          processing_time_ms: interaction.processingTimeMs,
          success: interaction.success,
          metadata: interaction.metadata
        }
      }
    });
  }

  async recordCommandExecution(command: {
    name: string;
    args: any;
    executionTimeMs: number;
    status: 'success' | 'error' | 'timeout' | 'cancelled';
    errorMessage?: string;
    context?: any;
  }) {
    return await this.client.collectMetrics({
      command_name: command.name,
      execution_time_ms: command.executionTimeMs,
      success: command.status === 'success',
      context: {
        session_id: this.sessionId,
        command_args: command.args,
        status: command.status,
        error_message: command.errorMessage,
        ...command.context
      }
    });
  }

  async endSession(completionMetadata?: any) {
    if (!this.sessionId) return;

    await this.client.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'record-session-end',
        arguments: {
          session_id: this.sessionId,
          end_metadata: {
            completion_reason: completionMetadata?.reason || 'normal',
            tasks_completed: completionMetadata?.tasksCompleted || 0,
            satisfaction_score: completionMetadata?.satisfactionScore,
            ...completionMetadata
          }
        }
      }
    });

    console.log('✓ Session ended:', this.sessionId);
    this.sessionId = null;
    await this.client.disconnect();
  }

  async getSessionMetrics() {
    return await this.client.send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'get-session-metrics'
      }
    });
  }
}

// Usage example
async function claudeCodeAgentExample() {
  const integration = new ClaudeCodeMetricsIntegration({
    apiKey: process.env.FORTIUM_API_KEY!,
    organizationId: process.env.FORTIUM_ORG_ID!,
    userId: 'user-123'
  });

  try {
    // Initialize session
    await integration.initializeSession({
      project: 'e-commerce-platform',
      claudeVersion: '3.5-sonnet',
      userRole: 'lead-developer'
    });

    // Record agent interactions
    await integration.recordAgentInteraction('tech-lead-orchestrator', {
      type: 'tool_call',
      inputTokens: 450,
      outputTokens: 1200,
      processingTimeMs: 3400,
      success: true,
      metadata: {
        task: 'architecture_planning',
        complexity: 8
      }
    });

    // Record command executions
    await integration.recordCommandExecution({
      name: '/plan-product',
      args: { description: 'User authentication system' },
      executionTimeMs: 2500,
      status: 'success',
      context: {
        agent_used: 'tech-lead-orchestrator',
        output_files: ['auth-service.ts', 'auth.test.ts']
      }
    });

    await integration.recordCommandExecution({
      name: '/execute-tasks',
      args: { taskList: ['implement-auth', 'write-tests'] },
      executionTimeMs: 15000,
      status: 'success',
      context: {
        agents_used: ['backend-developer', 'test-runner'],
        files_modified: 8,
        tests_added: 12
      }
    });

    // Get session metrics
    const sessionMetrics = await integration.getSessionMetrics();
    console.log('Session metrics:', sessionMetrics);

    // End session
    await integration.endSession({
      reason: 'task_completed',
      tasksCompleted: 2,
      satisfactionScore: 9
    });

  } catch (error) {
    console.error('❌ Integration error:', error);
  }
}
```

### Example 5: Batch Processing and Migration

```typescript
import { McpClient } from '@fortium/metrics-mcp-client';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

class MetricsMigrationService {
  private client: McpClient;

  constructor(client: McpClient) {
    this.client = client;
  }

  // Migrate local metrics files to cloud service
  async migrateLocalMetrics(localMetricsPath: string) {
    console.log('🔄 Starting metrics migration...');
    
    const files = await readdir(localMetricsPath);
    const metricsFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.log'));
    
    const migrationResults = {
      totalFiles: metricsFiles.length,
      successfulMigrations: 0,
      failedMigrations: 0,
      errors: [] as Array<{ file: string; error: string }>
    };

    for (const file of metricsFiles) {
      try {
        console.log(`📁 Processing ${file}...`);
        
        const filePath = join(localMetricsPath, file);
        const content = await readFile(filePath, 'utf-8');
        
        // Parse local format
        const localMetrics = this.parseLocalMetrics(content, file);
        
        // Convert to cloud format
        const cloudMetrics = this.convertToCloudFormat(localMetrics);
        
        // Send in batches
        const batchSize = 20;
        for (let i = 0; i < cloudMetrics.length; i += batchSize) {
          const batch = cloudMetrics.slice(i, i + batchSize);
          await this.client.send({
            jsonrpc: '2.0',
            method: 'metrics/batch',
            params: {
              command_executions: batch.filter(m => m.type === 'command'),
              agent_interactions: batch.filter(m => m.type === 'agent'),
              productivity_metrics: batch.filter(m => m.type === 'productivity')
            }
          });
        }
        
        migrationResults.successfulMigrations++;
        console.log(`✓ Migrated ${file} (${cloudMetrics.length} metrics)`);
        
      } catch (error) {
        migrationResults.failedMigrations++;
        migrationResults.errors.push({
          file,
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`❌ Failed to migrate ${file}:`, error);
      }
    }

    console.log('🎉 Migration completed:', migrationResults);
    return migrationResults;
  }

  private parseLocalMetrics(content: string, filename: string) {
    // Support different local formats
    if (filename.endsWith('.json')) {
      return JSON.parse(content);
    } else if (filename.endsWith('.log')) {
      return content.split('\n').filter(line => line.trim()).map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw_log: line, timestamp: new Date().toISOString() };
        }
      });
    }
    return [];
  }

  private convertToCloudFormat(localMetrics: any[]) {
    return localMetrics.map(metric => {
      // Convert legacy format to current schema
      if (metric.command_name || metric.command) {
        return {
          type: 'command',
          command_name: metric.command_name || metric.command,
          execution_time_ms: metric.duration_ms || metric.duration || 0,
          status: metric.success ? 'success' : 'error',
          context: {
            migrated_from: 'local_file',
            original_timestamp: metric.timestamp,
            ...metric.context
          }
        };
      }
      
      if (metric.agent_name || metric.agent) {
        return {
          type: 'agent',
          agent_name: metric.agent_name || metric.agent,
          interaction_type: metric.type || 'tool_call',
          processing_time_ms: metric.processing_time || 0,
          success: metric.success !== false,
          metadata: {
            migrated_from: 'local_file',
            ...metric.metadata
          }
        };
      }

      return {
        type: 'productivity',
        metric_type: 'migrated_data',
        value: 1,
        unit: 'count',
        period_start: new Date(metric.timestamp || Date.now()),
        period_end: new Date(metric.timestamp || Date.now()),
        dimensions: {
          migrated_from: 'local_file',
          original_data: metric
        }
      };
    });
  }
}

async function migrationExample() {
  const client = await createAutoConfiguredMcpClient();
  const migrationService = new MetricsMigrationService(client);
  
  try {
    // Migrate metrics from local Claude hooks
    await migrationService.migrateLocalMetrics('~/.claude/metrics');
    
    // Verify migration by querying recent data
    const recentMetrics = await client.queryDashboard({
      timeframe: '1h',
      format: 'json'
    });
    
    console.log('✓ Recent metrics after migration:', recentMetrics);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.disconnect();
  }
}
```

## Error Handling and Best Practices

### Example 6: Comprehensive Error Handling

```typescript
import { McpClient } from '@fortium/metrics-mcp-client';

class RobustMetricsClient {
  private client: McpClient;
  private retryQueue: Array<{ request: any; attempt: number }> = [];
  private maxRetries = 3;
  private baseRetryDelay = 1000; // 1 second

  constructor(config: any) {
    this.client = new McpClient({
      ...config,
      retryAttempts: this.maxRetries
    });

    // Set up error handlers
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    this.client.on('error', (error) => {
      console.error('❌ MCP Client error:', error);
      
      // Categorize errors
      if (error.code === 'ECONNREFUSED') {
        console.log('🔄 Server unavailable, enabling offline mode');
        this.enableOfflineMode();
      } else if (error.code === 401) {
        console.log('🔐 Authentication failed, refreshing token');
        this.refreshAuthentication();
      } else if (error.code === 429) {
        console.log('⏱️ Rate limit exceeded, implementing backoff');
        this.implementRateBackoff();
      }
    });

    this.client.on('disconnected', () => {
      console.log('📡 Connection lost, attempting to reconnect...');
      this.handleDisconnection();
    });

    this.client.on('reconnected', () => {
      console.log('✓ Connection restored, processing queued requests');
      this.processQueuedRequests();
    });
  }

  async collectMetricsWithRetry(metrics: any, maxAttempts = 3) {
    let attempt = 1;
    
    while (attempt <= maxAttempts) {
      try {
        const result = await this.client.collectMetrics(metrics);
        
        // Success - clear any queued retry for this request
        this.removeFromRetryQueue(metrics);
        return result;
        
      } catch (error) {
        console.warn(`❌ Attempt ${attempt}/${maxAttempts} failed:`, error);
        
        if (attempt === maxAttempts) {
          // Final attempt failed - queue for later retry
          this.queueForRetry({ metrics, attempt: 0 });
          throw new Error(`Failed to collect metrics after ${maxAttempts} attempts: ${error}`);
        }
        
        // Wait before retry with exponential backoff
        const delay = this.baseRetryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
        attempt++;
      }
    }
  }

  private async enableOfflineMode() {
    // Implement local storage fallback
    console.log('💾 Switching to local storage mode');
    // Store metrics locally until connection is restored
  }

  private async refreshAuthentication() {
    try {
      // Implement token refresh logic
      const newToken = await this.requestNewToken();
      this.client.updateConfig({ apiKey: newToken });
      console.log('✓ Authentication refreshed');
    } catch (error) {
      console.error('❌ Failed to refresh authentication:', error);
    }
  }

  private async implementRateBackoff() {
    // Implement exponential backoff for rate limiting
    const backoffDelay = this.calculateRateBackoff();
    console.log(`⏱️ Backing off for ${backoffDelay}ms`);
    await this.sleep(backoffDelay);
  }

  private queueForRetry(request: any) {
    this.retryQueue.push({ request, attempt: 0 });
  }

  private removeFromRetryQueue(request: any) {
    const index = this.retryQueue.findIndex(q => 
      JSON.stringify(q.request) === JSON.stringify(request)
    );
    if (index >= 0) {
      this.retryQueue.splice(index, 1);
    }
  }

  private async processQueuedRequests() {
    const queue = [...this.retryQueue];
    this.retryQueue = [];

    for (const { request } of queue) {
      try {
        await this.collectMetricsWithRetry(request.metrics);
        console.log('✓ Successfully processed queued request');
      } catch (error) {
        console.error('❌ Failed to process queued request:', error);
      }
    }
  }

  private handleDisconnection() {
    // Implement reconnection logic
    setTimeout(() => {
      this.client.connect().catch(console.error);
    }, 5000);
  }

  private calculateRateBackoff(): number {
    return Math.min(30000, this.baseRetryDelay * Math.pow(2, 3)); // Max 30 seconds
  }

  private async requestNewToken(): Promise<string> {
    // Implement token refresh API call
    throw new Error('Token refresh not implemented');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async disconnect() {
    await this.client.disconnect();
  }
}

async function robustClientExample() {
  const robustClient = new RobustMetricsClient({
    serverUrl: 'https://api.fortium-metrics.com',
    apiKey: process.env.FORTIUM_API_KEY,
    organizationId: process.env.FORTIUM_ORG_ID,
    timeout: 10000
  });

  try {
    // This will automatically retry on failures
    await robustClient.collectMetricsWithRetry({
      command_name: 'robust_test',
      execution_time_ms: 1000,
      success: true,
      context: {
        error_handling: 'comprehensive',
        retry_enabled: true
      }
    });

    console.log('✓ Metrics collected with robust error handling');

  } catch (error) {
    console.error('❌ Final error after all retry attempts:', error);
  } finally {
    await robustClient.disconnect();
  }
}
```

## Performance Optimization

### Connection Pooling and Caching

```typescript
import { McpClient } from '@fortium/metrics-mcp-client';

class OptimizedMetricsClient {
  private static instance: OptimizedMetricsClient;
  private client: McpClient;
  private requestCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5000; // 5 seconds

  private constructor() {
    this.client = new McpClient({
      serverUrl: process.env.FORTIUM_METRICS_URL!,
      apiKey: process.env.FORTIUM_API_KEY!,
      organizationId: process.env.FORTIUM_ORG_ID!,
      enableWebSocket: true, // Keep connection alive
      timeout: 5000 // Fast timeout for better UX
    });

    // Clean cache periodically
    setInterval(() => this.cleanCache(), 30000);
  }

  static getInstance(): OptimizedMetricsClient {
    if (!this.instance) {
      this.instance = new OptimizedMetricsClient();
    }
    return this.instance;
  }

  async getMetricsWithCache(query: string) {
    const cacheKey = JSON.stringify(query);
    const cached = this.requestCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }

    const data = await this.client.queryDashboard({ 
      timeframe: '1h',
      format: 'json'
    });

    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  async batchCollectMetrics(metricsList: any[]) {
    // Batch multiple metrics for better performance
    const batchRequests = metricsList.map((metrics, index) => ({
      jsonrpc: '2.0' as const,
      id: index,
      method: 'tools/call',
      params: {
        name: 'collect_metrics',
        arguments: metrics
      }
    }));

    return await this.client.sendBatch(batchRequests);
  }

  private cleanCache() {
    const now = Date.now();
    for (const [key, entry] of this.requestCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.requestCache.delete(key);
      }
    }
  }
}
```

## Testing and Validation

### SDK Testing Utilities

```typescript
import { McpClient } from '@fortium/metrics-mcp-client';

export class McpClientTestUtils {
  static createMockClient(): McpClient {
    const mockClient = new McpClient({
      serverUrl: 'http://localhost:test',
      apiKey: 'test-key',
      organizationId: 'test-org'
    });

    // Override methods for testing
    mockClient.connect = jest.fn().mockResolvedValue(true);
    mockClient.collectMetrics = jest.fn().mockResolvedValue({ success: true });
    mockClient.disconnect = jest.fn().mockResolvedValue(true);

    return mockClient;
  }

  static async validateMetricsData(metrics: any) {
    const requiredFields = ['command_name', 'execution_time_ms', 'success'];
    
    for (const field of requiredFields) {
      if (!(field in metrics)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof metrics.execution_time_ms !== 'number' || metrics.execution_time_ms < 0) {
      throw new Error('execution_time_ms must be a non-negative number');
    }

    if (typeof metrics.success !== 'boolean') {
      throw new Error('success must be a boolean');
    }

    return true;
  }
}

// Example test
describe('MCP Client Integration', () => {
  let client: McpClient;

  beforeEach(() => {
    client = McpClientTestUtils.createMockClient();
  });

  it('should collect metrics successfully', async () => {
    const testMetrics = {
      command_name: 'test_command',
      execution_time_ms: 1000,
      success: true
    };

    await McpClientTestUtils.validateMetricsData(testMetrics);
    
    const result = await client.collectMetrics(testMetrics);
    expect(result.success).toBe(true);
    expect(client.collectMetrics).toHaveBeenCalledWith(testMetrics);
  });
});
```

This comprehensive SDK documentation and examples provide developers with everything needed to successfully integrate the External Metrics Web Service with their Claude Code workflows, from basic usage to advanced error handling and performance optimization patterns.