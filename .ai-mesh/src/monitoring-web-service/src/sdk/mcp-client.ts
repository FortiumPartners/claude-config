/**
 * MCP Client SDK for Claude Code Instances
 * Task 4.2: Client SDK for seamless integration with Claude Code
 * 
 * Provides a TypeScript SDK for Claude Code instances to connect to the metrics server
 */

import EventEmitter from 'events';
import WebSocket from 'ws';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

export interface McpClientConfig {
  serverUrl: string;
  apiKey?: string;
  organizationId?: string;
  reconnectInterval?: number;
  timeout?: number;
  enableWebSocket?: boolean;
  retryAttempts?: number;
  debug?: boolean;
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

export interface MetricsData {
  command_name: string;
  execution_time_ms: number;
  success: boolean;
  context?: {
    claude_session?: string;
    agent_used?: string;
    delegation_pattern?: any;
    [key: string]: any;
  };
}

export interface DashboardQuery {
  timeframe?: '1h' | '24h' | '7d' | '30d';
  metrics?: string[];
  format?: 'json' | 'ascii' | 'markdown';
}

export class McpClient extends EventEmitter {
  private config: Required<McpClientConfig>;
  private httpClient: AxiosInstance;
  private wsClient?: WebSocket;
  private requestId: number = 1;
  private connected: boolean = false;
  private reconnectTimer?: NodeJS.Timeout;
  private pendingRequests: Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor(config: McpClientConfig) {
    super();

    // Set default configuration
    this.config = {
      serverUrl: config.serverUrl.replace(/\/$/, ''),
      apiKey: config.apiKey || process.env.FORTIUM_API_KEY || '',
      organizationId: config.organizationId || process.env.FORTIUM_ORG_ID || '',
      reconnectInterval: config.reconnectInterval || 5000,
      timeout: config.timeout || 30000,
      enableWebSocket: config.enableWebSocket !== false,
      retryAttempts: config.retryAttempts || 3,
      debug: config.debug || false
    };

    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: this.config.serverUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Fortium-MCP-Client/1.0.0',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      }
    });

    // Add request/response interceptors for debugging
    if (this.config.debug) {
      this.httpClient.interceptors.request.use(request => {
        console.log('[MCP Client] HTTP Request:', request);
        return request;
      });

      this.httpClient.interceptors.response.use(
        response => {
          console.log('[MCP Client] HTTP Response:', response);
          return response;
        },
        error => {
          console.error('[MCP Client] HTTP Error:', error);
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Initialize connection to MCP server
   */
  async connect(): Promise<void> {
    try {
      // First, test HTTP connectivity
      await this.testConnection();

      // Initialize MCP protocol
      const initResponse = await this.sendRequest({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            resources: {},
            tools: {},
            prompts: {}
          },
          clientInfo: {
            name: 'fortium-mcp-client',
            version: '1.0.0'
          }
        }
      });

      if (initResponse.error) {
        throw new Error(`MCP initialization failed: ${initResponse.error.message}`);
      }

      this.connected = true;
      this.emit('connected', initResponse.result);

      // Establish WebSocket connection if enabled
      if (this.config.enableWebSocket) {
        await this.connectWebSocket();
      }

      if (this.config.debug) {
        console.log('[MCP Client] Successfully connected to server');
      }

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    this.connected = false;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Close WebSocket
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = undefined;
    }

    // Reject any pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    this.emit('disconnected');

    if (this.config.debug) {
      console.log('[MCP Client] Disconnected from server');
    }
  }

  /**
   * Send metrics data to the server
   */
  async collectMetrics(metricsData: MetricsData): Promise<any> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'collect_metrics',
        arguments: metricsData
      }
    });

    if (response.error) {
      throw new Error(`Metrics collection failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Query dashboard data
   */
  async queryDashboard(query: DashboardQuery = {}): Promise<any> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'query_dashboard',
        arguments: {
          timeframe: query.timeframe || '24h',
          metrics: query.metrics,
          format: query.format || 'json'
        }
      }
    });

    if (response.error) {
      throw new Error(`Dashboard query failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Migrate local metrics
   */
  async migrateLocalMetrics(migrationOptions: {
    local_config_path?: string;
    legacy_format?: any;
    preserve_local?: boolean;
  }): Promise<any> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'migrate_local_metrics',
        arguments: migrationOptions
      }
    });

    if (response.error) {
      throw new Error(`Migration failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Get server capabilities
   */
  async getCapabilities(): Promise<any> {
    try {
      const response = await this.httpClient.get('/api/mcp/capabilities');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get server health
   */
  async getHealth(): Promise<any> {
    try {
      const response = await this.httpClient.get('/api/mcp/health');
      return response.data;
    } catch (error) {
      throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send MCP request via HTTP
   */
  private async sendRequest(request: McpRequest): Promise<McpResponse> {
    const id = request.id || this.requestId++;
    const requestWithId = { ...request, id };

    try {
      const response: AxiosResponse<McpResponse> = await this.httpClient.post('/api/mcp/rpc', requestWithId);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data as McpResponse;
      }
      throw error;
    }
  }

  /**
   * Test connection to server
   */
  private async testConnection(): Promise<void> {
    try {
      await this.httpClient.get('/api/mcp/health');
    } catch (error) {
      throw new Error(`Cannot connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect WebSocket for real-time updates
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.serverUrl.replace(/^http/, 'ws') + '/api/mcp/ws';
      
      this.wsClient = new WebSocket(wsUrl, {
        headers: {
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      this.wsClient.on('open', () => {
        this.emit('websocket:connected');
        if (this.config.debug) {
          console.log('[MCP Client] WebSocket connected');
        }
        resolve();
      });

      this.wsClient.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[MCP Client] Invalid WebSocket message:', error);
        }
      });

      this.wsClient.on('close', () => {
        this.emit('websocket:disconnected');
        if (this.config.debug) {
          console.log('[MCP Client] WebSocket disconnected');
        }

        // Attempt to reconnect
        if (this.connected && this.config.enableWebSocket) {
          this.scheduleReconnect();
        }
      });

      this.wsClient.on('error', (error) => {
        this.emit('websocket:error', error);
        reject(error);
      });

      // Set connection timeout
      setTimeout(() => {
        if (this.wsClient?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      // This is a response to a previous request
      const pending = this.pendingRequests.get(message.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    } else if (message.method) {
      // This is a notification from the server
      this.emit('notification', message);
      
      // Emit specific event for the notification type
      if (message.method === 'dashboard/updated') {
        this.emit('dashboard:updated', message.params);
      } else if (message.method === 'metrics/collected') {
        this.emit('metrics:collected', message.params);
      }
    }

    if (this.config.debug) {
      console.log('[MCP Client] WebSocket message:', message);
    }
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectWebSocket();
      } catch (error) {
        console.error('[MCP Client] WebSocket reconnection failed:', error);
        this.scheduleReconnect(); // Try again
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send batch requests
   */
  async sendBatch(requests: McpRequest[]): Promise<McpResponse[]> {
    try {
      const response: AxiosResponse<McpResponse[]> = await this.httpClient.post('/api/mcp/batch', requests);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data as McpResponse[];
      }
      throw error;
    }
  }
}

/**
 * Convenience function to create and connect MCP client
 */
export async function createMcpClient(config: McpClientConfig): Promise<McpClient> {
  const client = new McpClient(config);
  await client.connect();
  return client;
}

/**
 * Auto-configure MCP client from environment
 */
export async function createAutoConfiguredMcpClient(overrides: Partial<McpClientConfig> = {}): Promise<McpClient> {
  const config: McpClientConfig = {
    serverUrl: process.env.FORTIUM_METRICS_URL || 'http://localhost:3000',
    apiKey: process.env.FORTIUM_API_KEY,
    organizationId: process.env.FORTIUM_ORG_ID,
    debug: process.env.NODE_ENV === 'development',
    ...overrides
  };

  return createMcpClient(config);
}

export default McpClient;