# External Metrics Web Service - MCP Server Integration Documentation

> **Version**: 1.0.0  
> **Status**: Production Ready  
> **Last Updated**: September 2025  
> **Protocol Version**: MCP 2024-11-05  

## Overview

The MCP (Model Context Protocol) Server Integration provides seamless connectivity between Claude Code and the External Metrics Web Service. This integration implements the full MCP 2024-11-05 specification with performance optimizations to achieve <5ms response times and hybrid local+remote data collection with graceful fallback mechanisms.

## MCP Protocol Implementation

### MCP 2024-11-05 Specification Compliance

The implementation fully supports the MCP 2024-11-05 protocol specification with the following capabilities:

**Core Protocol Features**:
- **JSON-RPC 2.0**: Complete request/response/notification support
- **Transport Agnostic**: HTTP, WebSocket, and SSE transport support
- **Batch Requests**: Up to 20 concurrent requests with concurrency control
- **Error Handling**: Comprehensive error codes and recovery mechanisms
- **Security**: JWT authentication and request signing

**MCP Capabilities**:
```typescript
interface McpCapabilities {
  tools: {
    listChanged: boolean;        // Dynamic tool list updates
  };
  resources: {
    subscribe: boolean;          // Resource subscription support
    listChanged: boolean;        // Dynamic resource updates
  };
  prompts: {
    listChanged: boolean;        // Dynamic prompt updates
  };
  logging: {};                   // Structured logging support
}
```

## MCP Server Architecture

### Core MCP Server Implementation

**Location**: `/src/mcp/mcp-server.ts`  
**Class**: `McpServer`

```typescript
export class McpServer {
  // Performance optimization with caching
  private requestCache: Map<string, CachedResponse> = new Map();
  private readonly CACHE_TTL_MS = 1000; // 1 second cache
  
  // Performance monitoring
  private performanceStats = {
    total_requests: 0,
    cached_responses: 0,
    avg_response_time_ms: 0,
    requests_under_5ms: 0
  };
  
  // Handle MCP JSON-RPC 2.0 requests with <5ms target
  async handleRequest(
    request: McpRequest,
    organizationId: string,
    userId: string
  ): Promise<McpResponse>
  
  // Batch processing with concurrency control
  async handleBatchRequests(
    requests: McpRequest[],
    organizationId: string,
    userId: string
  ): Promise<McpResponse[]>
}
```

**Performance Optimizations**:
- **Request Caching**: 1-second TTL cache for read-only operations
- **Concurrent Processing**: Batch requests with 5-request concurrency limit
- **Query Optimization**: Prepared statements and connection pooling
- **Memory Management**: Automatic cache cleanup every 30 seconds

### Protocol Message Types

#### Initialize Request/Response
```json
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "clientInfo": {
      "name": "claude-code",
      "version": "1.2.0"
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "prompts": { "listChanged": true },
      "logging": {}
    },
    "serverInfo": {
      "name": "fortium-metrics-server",
      "version": "1.0.0",
      "description": "Fortium External Metrics Web Service MCP Server"
    }
  }
}
```

#### Tools List and Execution
```json
// Tools List Request
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}

// Tools List Response
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "record-session-start",
        "description": "Start a new user session with metadata",
        "inputSchema": {
          "type": "object",
          "properties": {
            "metadata": { "type": "object" }
          }
        }
      },
      {
        "name": "record-tool-usage",
        "description": "Record tool execution with performance metrics",
        "inputSchema": {
          "type": "object",
          "properties": {
            "tool_name": { "type": "string" },
            "execution_time_ms": { "type": "number" },
            "status": { "type": "string", "enum": ["success", "error", "timeout", "cancelled"] }
          },
          "required": ["tool_name", "execution_time_ms", "status"]
        }
      }
    ]
  }
}
```

#### Tool Call Request/Response
```json
// Tool Call Request
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "record-tool-usage",
    "arguments": {
      "tool_name": "generate_component",
      "execution_time_ms": 1250,
      "status": "success",
      "context": {
        "framework": "react",
        "complexity": "medium"
      }
    }
  }
}

// Tool Call Response
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "success": true,
    "alerts": [],
    "message": "Tool usage recorded successfully"
  }
}
```

## Integration with Claude Code

### MCP Client Configuration

**Claude Code MCP Configuration**:
```json
{
  "mcpServers": {
    "fortium-metrics": {
      "command": "npx",
      "args": ["-y", "@fortium/metrics-mcp-server"],
      "env": {
        "FORTIUM_API_URL": "https://api.fortium-metrics.com",
        "FORTIUM_API_KEY": "${FORTIUM_API_KEY}",
        "FORTIUM_ORG_ID": "${FORTIUM_ORG_ID}",
        "FORTIUM_MODE": "hybrid"
      }
    }
  }
}
```

**Environment Variables**:
```bash
# Required for production
FORTIUM_API_URL=https://api.fortium-metrics.com
FORTIUM_API_KEY=your_api_key_here
FORTIUM_ORG_ID=your_org_id_here

# Optional configuration
FORTIUM_MODE=hybrid                    # hybrid, remote, or local
FORTIUM_BATCH_SIZE=20                 # metrics per batch
FORTIUM_SYNC_INTERVAL=5000            # sync interval in ms
FORTIUM_LOCAL_FALLBACK=true           # enable local fallback
FORTIUM_PERFORMANCE_MONITORING=true   # enable performance tracking
```

### Hybrid Collector Implementation

**Location**: `/src/mcp/hybrid-collector.ts`  
**Purpose**: Seamless local+remote data collection with fallback

```typescript
class HybridCollector {
  constructor(config: HybridConfig) {
    this.mode = config.remote_enabled ? 'hybrid' : 'local';
    this.localPath = '.claude/hooks/';
    this.remoteEndpoint = config.remote_endpoint;
  }

  async collectMetrics(data: MetricsData): Promise<CollectionResult> {
    // Always collect locally for reliability
    const localResult = await this.saveLocal(data);
    
    // Sync to remote when available and enabled
    if (this.mode === 'hybrid' || this.mode === 'remote') {
      try {
        const remoteResult = await this.syncRemote(data);
        return this.mergeResults(localResult, remoteResult);
      } catch (error) {
        // Graceful degradation - continue with local
        this.logger.warn('Remote sync failed, continuing locally', { error });
        return localResult;
      }
    }
    
    return localResult;
  }
  
  // Performance requirement: <5ms overhead
  async measurePerformance(): Promise<PerformanceMetrics> {
    const start = performance.now();
    await this.collectMetrics({ test: 'performance' });
    const end = performance.now();
    
    return {
      collection_latency_ms: end - start,
      meets_performance_target: (end - start) < 5
    };
  }
}
```

**Fallback Strategy**:
1. **Hybrid Mode**: Collect locally + sync to remote
2. **Remote Failure**: Continue with local collection
3. **Network Issues**: Queue for later sync
4. **Data Consistency**: Conflict resolution with remote-wins strategy

### Local Compatibility Layer

**Location**: `/src/mcp/local-compatibility.ts`  
**Purpose**: Maintain compatibility with existing local hooks

```typescript
class LocalCompatibilityLayer {
  // Support existing local file formats
  async readLocalMetrics(directory: string): Promise<LocalMetrics[]> {
    const files = await fs.readdir(directory);
    const metrics: LocalMetrics[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(directory, file), 'utf-8');
        const parsed = JSON.parse(content);
        
        // Convert legacy format to modern schema
        const converted = this.convertLegacyFormat(parsed);
        metrics.push(converted);
      }
    }
    
    return metrics;
  }
  
  // Convert legacy metrics to current schema
  private convertLegacyFormat(legacy: any): LocalMetrics {
    return {
      id: legacy.session_id || this.generateId(),
      organization_id: 'local',
      user_id: 'local_user',
      timestamp: new Date(legacy.timestamp),
      command_executions: this.convertCommands(legacy.commands || []),
      agent_interactions: this.convertAgentData(legacy.agents || []),
      session_data: this.convertSessionData(legacy.session || {})
    };
  }
}
```

## Available MCP Tools

### 1. Session Management Tools

#### record-session-start
**Purpose**: Initialize new user session with metadata tracking

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "project_name": { "type": "string" },
        "project_type": { "type": "string" },
        "claude_version": { "type": "string" },
        "user_timezone": { "type": "string" }
      }
    }
  }
}
```

**Usage Example**:
```javascript
// Start session with project context
const result = await mcpClient.callTool('record-session-start', {
  metadata: {
    project_name: 'web-dashboard',
    project_type: 'react_typescript',
    claude_version: '3.5-sonnet',
    user_timezone: 'America/New_York'
  }
});

// Response
{
  "success": true,
  "session_id": "sess_abc123",
  "message": "Session started successfully"
}
```

#### record-session-end
**Purpose**: Complete session with summary statistics

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "session_id": { "type": "string" },
    "end_metadata": {
      "type": "object",
      "properties": {
        "completion_reason": { "type": "string" },
        "tasks_completed": { "type": "number" },
        "satisfaction_score": { "type": "number", "minimum": 1, "maximum": 10 }
      }
    }
  },
  "required": ["session_id"]
}
```

### 2. Tool Usage Tracking

#### record-tool-usage
**Purpose**: Track individual tool executions with performance data

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "tool_name": { "type": "string" },
    "execution_time_ms": { "type": "number", "minimum": 0 },
    "status": { 
      "type": "string", 
      "enum": ["success", "error", "timeout", "cancelled"] 
    },
    "context": {
      "type": "object",
      "properties": {
        "input_size": { "type": "number" },
        "output_size": { "type": "number" },
        "complexity_score": { "type": "number" },
        "framework": { "type": "string" },
        "language": { "type": "string" }
      }
    }
  },
  "required": ["tool_name", "execution_time_ms", "status"]
}
```

**Usage Example**:
```javascript
// Record tool execution
const result = await mcpClient.callTool('record-tool-usage', {
  tool_name: 'code_generator',
  execution_time_ms: 2340,
  status: 'success',
  context: {
    input_size: 450,
    output_size: 1250,
    complexity_score: 7.5,
    framework: 'express',
    language: 'typescript'
  }
});

// Response includes performance alerts
{
  "success": true,
  "alerts": [
    {
      "type": "performance_warning",
      "message": "Execution time above average for this tool",
      "threshold_ms": 2000,
      "actual_ms": 2340
    }
  ],
  "message": "Tool usage recorded successfully"
}
```

### 3. Analytics and Queries

#### get-session-metrics
**Purpose**: Retrieve current session statistics and performance data

**Usage Example**:
```javascript
const metrics = await mcpClient.callTool('get-session-metrics');

// Response
{
  "current_session": {
    "id": "sess_abc123",
    "duration_ms": 1234567,
    "commands_executed": 15,
    "tools_used": ["code_generator", "file_creator", "test_runner"],
    "productivity_score": 8.5
  },
  "performance": {
    "avg_command_time_ms": 1850,
    "success_rate": 0.93,
    "error_count": 1
  }
}
```

#### get-tool-metrics
**Purpose**: Get tool usage analytics and performance trends

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "tool_name": { "type": "string" },
    "days": { 
      "type": "number", 
      "minimum": 1, 
      "maximum": 90,
      "default": 7 
    }
  }
}
```

**Usage Example**:
```javascript
// Get metrics for specific tool
const metrics = await mcpClient.callTool('get-tool-metrics', {
  tool_name: 'code_generator',
  days: 30
});

// Response
{
  "tool_name": "code_generator",
  "period": {
    "start": "2025-08-08T00:00:00Z",
    "end": "2025-09-08T00:00:00Z",
    "days": 30
  },
  "usage_stats": {
    "total_executions": 156,
    "avg_execution_time_ms": 1850,
    "success_rate": 0.94,
    "trend": "improving"
  },
  "performance_percentiles": {
    "p50": 1200,
    "p90": 3400,
    "p95": 4200,
    "p99": 8100
  }
}
```

## MCP Resources

### Available Resources

MCP resources provide read-only access to metrics data and system information.

#### User Sessions Resource
**URI**: `fortium://metrics/sessions/{organization_id}`  
**Description**: List of user sessions for the organization  
**MIME Type**: `application/json`

```javascript
// Read sessions resource
const sessions = await mcpClient.readResource('fortium://metrics/sessions/org_123');

// Response
{
  "contents": [
    {
      "uri": "fortium://metrics/sessions/org_123",
      "mimeType": "application/json",
      "text": JSON.stringify({
        "active_sessions": [
          {
            "id": "sess_abc123",
            "user_id": "user_456",
            "start_time": "2025-09-08T10:00:00Z",
            "duration_ms": 1234567,
            "status": "active"
          }
        ],
        "recent_sessions": [...]
      }, null, 2)
    }
  ]
}
```

#### Tool Usage Resource
**URI**: `fortium://metrics/tools/{organization_id}`  
**Description**: Tool usage metrics for the organization  
**MIME Type**: `application/json`

#### Performance Metrics Resource
**URI**: `fortium://metrics/performance/{organization_id}`  
**Description**: System performance and productivity metrics  
**MIME Type**: `application/json`

## API Endpoints and Protocols

### HTTP Endpoints

**Base URL**: `https://api.fortium-metrics.com/mcp/v1`

#### MCP Request Endpoint
```http
POST /mcp/v1/request
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Organization-ID: <org_id>

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "record-session-start",
    "arguments": { ... }
  }
}
```

#### Batch Request Endpoint
```http
POST /mcp/v1/batch
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Organization-ID: <org_id>

[
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { ... }
  },
  {
    "jsonrpc": "2.0", 
    "id": 2,
    "method": "tools/call",
    "params": { ... }
  }
]
```

### WebSocket Protocol

**WebSocket URL**: `wss://api.fortium-metrics.com/mcp/ws`  
**Authentication**: JWT token in connection params

```javascript
// WebSocket connection
const ws = new WebSocket('wss://api.fortium-metrics.com/mcp/ws', {
  headers: {
    'Authorization': 'Bearer ' + jwtToken,
    'X-Organization-ID': organizationId
  }
});

// Send MCP request
ws.send(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'record-tool-usage',
    arguments: { ... }
  }
}));

// Receive response
ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  console.log('MCP Response:', response);
};
```

## Configuration and Setup

### Server Configuration

**Environment Variables**:
```bash
# MCP Server Configuration
MCP_PORT=3001
MCP_HOST=0.0.0.0
MCP_PROTOCOL_VERSION=2024-11-05

# Performance Settings
MCP_CACHE_TTL_MS=1000
MCP_BATCH_SIZE_LIMIT=20
MCP_CONCURRENT_REQUESTS=5
MCP_REQUEST_TIMEOUT_MS=5000

# Security Settings
MCP_JWT_SECRET=your_jwt_secret
MCP_RATE_LIMIT_REQUESTS=1000
MCP_RATE_LIMIT_WINDOW_MS=60000

# Integration Settings
MCP_LOCAL_HOOKS_PATH=~/.claude/hooks
MCP_HYBRID_MODE=true
MCP_SYNC_INTERVAL_MS=5000
```

### Client SDK Configuration

**MCP Client Configuration**:
```typescript
import { McpClient } from '@fortium/metrics-mcp-client';

const client = new McpClient({
  serverUrl: 'https://api.fortium-metrics.com/mcp/v1',
  apiKey: process.env.FORTIUM_API_KEY,
  organizationId: process.env.FORTIUM_ORG_ID,
  
  // Performance settings
  timeout: 5000,
  retryAttempts: 3,
  batchSize: 20,
  
  // Hybrid mode settings
  hybridMode: true,
  localFallback: true,
  syncInterval: 5000,
  
  // Monitoring
  performanceTracking: true,
  errorReporting: true
});

// Initialize client
await client.initialize();
```

## Troubleshooting and Best Practices

### Common Issues and Solutions

#### 1. High Latency (>5ms)
**Symptoms**: MCP requests taking longer than performance target
**Solutions**:
- Check network connectivity to API endpoint
- Verify database connection pool health
- Review request caching configuration
- Monitor CPU and memory usage

**Diagnostic Commands**:
```bash
# Check MCP server health
curl -H "Authorization: Bearer $TOKEN" \
     https://api.fortium-metrics.com/health/mcp

# Performance test
curl -X POST -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
     https://api.fortium-metrics.com/mcp/v1/request
```

#### 2. Authentication Failures
**Symptoms**: 401/403 responses from MCP endpoints
**Solutions**:
- Verify JWT token validity and expiration
- Check organization ID in headers
- Validate API key configuration
- Review user permissions and roles

#### 3. Local Fallback Issues
**Symptoms**: Hybrid mode not falling back to local collection
**Solutions**:
- Check local hooks directory permissions
- Verify Node.js hooks are properly installed
- Review error logs for specific failure reasons
- Test local collection independently

#### 4. Rate Limiting
**Symptoms**: 429 Too Many Requests responses
**Solutions**:
- Implement exponential backoff retry logic
- Reduce batch sizes or request frequency  
- Review rate limit configuration for organization
- Use batch requests for bulk operations

### Performance Optimization

**Best Practices**:
- **Batch Requests**: Use batch endpoints for multiple operations
- **Caching**: Leverage 1-second cache for repeated read operations
- **Connection Pooling**: Reuse HTTP connections where possible
- **Error Handling**: Implement proper retry logic with backoff
- **Monitoring**: Track performance metrics and set up alerting

**Performance Monitoring**:
```typescript
// Track MCP request performance
const startTime = performance.now();
const result = await mcpClient.callTool('record-tool-usage', params);
const endTime = performance.now();

const responseTime = endTime - startTime;
if (responseTime > 5) {
  logger.warn('MCP request exceeded 5ms target', {
    method: 'record-tool-usage',
    response_time_ms: responseTime,
    target_ms: 5
  });
}
```

### Security Best Practices

- **Token Management**: Rotate JWT tokens regularly
- **API Key Security**: Store API keys securely, never in code
- **Request Validation**: Validate all input parameters
- **Rate Limiting**: Respect rate limits and implement backoff
- **Error Handling**: Don't expose sensitive information in errors
- **Audit Logging**: Log all MCP interactions for compliance

This comprehensive MCP Server Integration documentation provides developers with everything needed to successfully integrate Claude Code with the External Metrics Web Service using the MCP protocol.