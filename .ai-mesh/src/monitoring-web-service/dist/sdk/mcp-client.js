"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpClient = void 0;
exports.createMcpClient = createMcpClient;
exports.createAutoConfiguredMcpClient = createAutoConfiguredMcpClient;
const events_1 = __importDefault(require("events"));
const ws_1 = __importDefault(require("ws"));
const axios_1 = __importDefault(require("axios"));
class McpClient extends events_1.default {
    config;
    httpClient;
    wsClient;
    requestId = 1;
    connected = false;
    reconnectTimer;
    pendingRequests = new Map();
    constructor(config) {
        super();
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
        this.httpClient = axios_1.default.create({
            baseURL: this.config.serverUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Fortium-MCP-Client/1.0.0',
                ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
            }
        });
        if (this.config.debug) {
            this.httpClient.interceptors.request.use(request => {
                console.log('[MCP Client] HTTP Request:', request);
                return request;
            });
            this.httpClient.interceptors.response.use(response => {
                console.log('[MCP Client] HTTP Response:', response);
                return response;
            }, error => {
                console.error('[MCP Client] HTTP Error:', error);
                return Promise.reject(error);
            });
        }
    }
    async connect() {
        try {
            await this.testConnection();
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
            if (this.config.enableWebSocket) {
                await this.connectWebSocket();
            }
            if (this.config.debug) {
                console.log('[MCP Client] Successfully connected to server');
            }
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async disconnect() {
        this.connected = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        if (this.wsClient) {
            this.wsClient.close();
            this.wsClient = undefined;
        }
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
    async collectMetrics(metricsData) {
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
    async queryDashboard(query = {}) {
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
    async migrateLocalMetrics(migrationOptions) {
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
    async getCapabilities() {
        try {
            const response = await this.httpClient.get('/api/mcp/capabilities');
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to get capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getHealth() {
        try {
            const response = await this.httpClient.get('/api/mcp/health');
            return response.data;
        }
        catch (error) {
            throw new Error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async sendRequest(request) {
        const id = request.id || this.requestId++;
        const requestWithId = { ...request, id };
        try {
            const response = await this.httpClient.post('/api/mcp/rpc', requestWithId);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.data) {
                return error.response.data;
            }
            throw error;
        }
    }
    async testConnection() {
        try {
            await this.httpClient.get('/api/mcp/health');
        }
        catch (error) {
            throw new Error(`Cannot connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            const wsUrl = this.config.serverUrl.replace(/^http/, 'ws') + '/api/mcp/ws';
            this.wsClient = new ws_1.default(wsUrl, {
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
                }
                catch (error) {
                    console.error('[MCP Client] Invalid WebSocket message:', error);
                }
            });
            this.wsClient.on('close', () => {
                this.emit('websocket:disconnected');
                if (this.config.debug) {
                    console.log('[MCP Client] WebSocket disconnected');
                }
                if (this.connected && this.config.enableWebSocket) {
                    this.scheduleReconnect();
                }
            });
            this.wsClient.on('error', (error) => {
                this.emit('websocket:error', error);
                reject(error);
            });
            setTimeout(() => {
                if (this.wsClient?.readyState !== ws_1.default.OPEN) {
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);
        });
    }
    handleWebSocketMessage(message) {
        if (message.id && this.pendingRequests.has(message.id)) {
            const pending = this.pendingRequests.get(message.id);
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(message.id);
            if (message.error) {
                pending.reject(new Error(message.error.message));
            }
            else {
                pending.resolve(message.result);
            }
        }
        else if (message.method) {
            this.emit('notification', message);
            if (message.method === 'dashboard/updated') {
                this.emit('dashboard:updated', message.params);
            }
            else if (message.method === 'metrics/collected') {
                this.emit('metrics:collected', message.params);
            }
        }
        if (this.config.debug) {
            console.log('[MCP Client] WebSocket message:', message);
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connectWebSocket();
            }
            catch (error) {
                console.error('[MCP Client] WebSocket reconnection failed:', error);
                this.scheduleReconnect();
            }
        }, this.config.reconnectInterval);
    }
    isConnected() {
        return this.connected;
    }
    async sendBatch(requests) {
        try {
            const response = await this.httpClient.post('/api/mcp/batch', requests);
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.data) {
                return error.response.data;
            }
            throw error;
        }
    }
}
exports.McpClient = McpClient;
async function createMcpClient(config) {
    const client = new McpClient(config);
    await client.connect();
    return client;
}
async function createAutoConfiguredMcpClient(overrides = {}) {
    const config = {
        serverUrl: process.env.FORTIUM_METRICS_URL || 'http://localhost:3000',
        apiKey: process.env.FORTIUM_API_KEY,
        organizationId: process.env.FORTIUM_ORG_ID,
        debug: process.env.NODE_ENV === 'development',
        ...overrides
    };
    return createMcpClient(config);
}
exports.default = McpClient;
//# sourceMappingURL=mcp-client.js.map