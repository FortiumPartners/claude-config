import EventEmitter from 'events';
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
export declare class McpClient extends EventEmitter {
    private config;
    private httpClient;
    private wsClient?;
    private requestId;
    private connected;
    private reconnectTimer?;
    private pendingRequests;
    constructor(config: McpClientConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    collectMetrics(metricsData: MetricsData): Promise<any>;
    queryDashboard(query?: DashboardQuery): Promise<any>;
    migrateLocalMetrics(migrationOptions: {
        local_config_path?: string;
        legacy_format?: any;
        preserve_local?: boolean;
    }): Promise<any>;
    getCapabilities(): Promise<any>;
    getHealth(): Promise<any>;
    private sendRequest;
    private testConnection;
    private connectWebSocket;
    private handleWebSocketMessage;
    private scheduleReconnect;
    isConnected(): boolean;
    sendBatch(requests: McpRequest[]): Promise<McpResponse[]>;
}
export declare function createMcpClient(config: McpClientConfig): Promise<McpClient>;
export declare function createAutoConfiguredMcpClient(overrides?: Partial<McpClientConfig>): Promise<McpClient>;
export default McpClient;
//# sourceMappingURL=mcp-client.d.ts.map