"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.basicUsage = basicUsage;
exports.autoConfiguredUsage = autoConfiguredUsage;
exports.eventDrivenUsage = eventDrivenUsage;
exports.migrationWorkflow = migrationWorkflow;
exports.errorHandlingExample = errorHandlingExample;
exports.claudeCodeIntegration = claudeCodeIntegration;
exports.runExamples = runExamples;
const mcp_client_1 = require("../mcp-client");
async function basicUsage() {
    console.log('=== Basic MCP Client Usage ===\n');
    const client = new mcp_client_1.McpClient({
        serverUrl: 'http://localhost:3000',
        apiKey: 'your-api-key',
        organizationId: 'your-org-id',
        debug: true
    });
    try {
        console.log('Connecting to MCP server...');
        await client.connect();
        console.log('✓ Connected successfully\n');
        console.log('Sending metrics data...');
        const metricsResult = await client.collectMetrics({
            command_name: 'example-command',
            execution_time_ms: 1500,
            success: true,
            context: {
                claude_session: 'session-123',
                agent_used: 'frontend-developer'
            }
        });
        console.log('✓ Metrics collected:', metricsResult, '\n');
        console.log('Querying dashboard...');
        const dashboardData = await client.queryDashboard({
            timeframe: '24h',
            format: 'json'
        });
        console.log('✓ Dashboard data retrieved:', dashboardData, '\n');
        const health = await client.getHealth();
        console.log('✓ Server health:', health, '\n');
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await client.disconnect();
        console.log('Disconnected from server');
    }
}
async function autoConfiguredUsage() {
    console.log('=== Auto-Configured MCP Client ===\n');
    try {
        const client = await (0, mcp_client_1.createAutoConfiguredMcpClient)({
            debug: true
        });
        console.log('✓ Auto-configured client connected\n');
        const batchRequests = [
            {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: 'collect_metrics',
                    arguments: {
                        command_name: 'batch-command-1',
                        execution_time_ms: 800,
                        success: true
                    }
                }
            },
            {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                    name: 'collect_metrics',
                    arguments: {
                        command_name: 'batch-command-2',
                        execution_time_ms: 1200,
                        success: false
                    }
                }
            }
        ];
        const batchResults = await client.sendBatch(batchRequests);
        console.log('✓ Batch metrics collected:', batchResults, '\n');
        await client.disconnect();
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
}
async function eventDrivenUsage() {
    console.log('=== Event-Driven MCP Client ===\n');
    const client = new mcp_client_1.McpClient({
        serverUrl: 'ws://localhost:3000',
        apiKey: 'your-api-key',
        organizationId: 'your-org-id',
        enableWebSocket: true,
        debug: true
    });
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
    try {
        await client.connect();
        console.log('Waiting for server events (30 seconds)...\n');
        const interval = setInterval(async () => {
            try {
                await client.collectMetrics({
                    command_name: 'periodic-task',
                    execution_time_ms: Math.floor(Math.random() * 2000) + 500,
                    success: Math.random() > 0.2,
                    context: {
                        claude_session: `session-${Date.now()}`,
                        agent_used: 'background-processor'
                    }
                });
                console.log('📤 Sent periodic metrics');
            }
            catch (error) {
                console.error('❌ Failed to send periodic metrics:', error);
            }
        }, 5000);
        setTimeout(async () => {
            clearInterval(interval);
            await client.disconnect();
            console.log('Example completed');
        }, 30000);
    }
    catch (error) {
        console.error('❌ Connection error:', error);
    }
}
async function migrationWorkflow() {
    console.log('=== Migration Workflow ===\n');
    const client = await (0, mcp_client_1.createAutoConfiguredMcpClient)();
    try {
        console.log('Starting migration workflow...\n');
        console.log('1. Migrating legacy format data...');
        const legacyData = {
            timestamp: Date.now() - 86400000,
            command: 'legacy-command',
            duration: 2500,
            success: true,
            agent: 'legacy-agent'
        };
        const migrationResult = await client.migrateLocalMetrics({
            legacy_format: legacyData
        });
        console.log('✓ Migration result:', migrationResult, '\n');
        console.log('2. Querying migrated data...');
        const migratedMetrics = await client.queryDashboard({
            timeframe: '7d',
            format: 'markdown'
        });
        console.log('✓ Migrated metrics:', migratedMetrics, '\n');
    }
    catch (error) {
        console.error('❌ Migration error:', error);
    }
    finally {
        await client.disconnect();
    }
}
async function errorHandlingExample() {
    console.log('=== Error Handling Example ===\n');
    const client = new mcp_client_1.McpClient({
        serverUrl: 'http://localhost:3000',
        apiKey: 'invalid-key',
        organizationId: 'test-org',
        retryAttempts: 3,
        timeout: 5000
    });
    try {
        await client.connect();
        await client.collectMetrics({
            command_name: 'test-command',
            execution_time_ms: 1000,
            success: true
        });
    }
    catch (error) {
        console.log('❌ Expected error caught:', error instanceof Error ? error.message : error);
        console.log('\nRetrying with correct configuration...');
        const retryClient = new mcp_client_1.McpClient({
            serverUrl: 'http://localhost:3000',
            apiKey: 'your-api-key',
            organizationId: 'your-org-id'
        });
        try {
            await retryClient.connect();
            console.log('✓ Retry successful');
            await retryClient.disconnect();
        }
        catch (retryError) {
            console.error('❌ Retry also failed:', retryError);
        }
    }
    finally {
        await client.disconnect();
    }
}
async function claudeCodeIntegration() {
    console.log('=== Claude Code Integration ===\n');
    const client = await (0, mcp_client_1.createAutoConfiguredMcpClient)();
    const simulateClaudeCommand = async (commandName, agent) => {
        const startTime = Date.now();
        try {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
            const endTime = Date.now();
            const success = Math.random() > 0.1;
            await client.collectMetrics({
                command_name: commandName,
                execution_time_ms: endTime - startTime,
                success,
                context: {
                    claude_session: 'claude-session-' + Date.now(),
                    agent_used: agent,
                    command_type: 'simulated',
                    timestamp: new Date().toISOString()
                }
            });
            console.log(`✓ Command "${commandName}" executed by ${agent} (${endTime - startTime}ms, ${success ? 'success' : 'failed'})`);
        }
        catch (error) {
            console.error(`❌ Failed to execute command "${commandName}":`, error);
        }
    };
    const commands = [
        { name: '/plan-product', agent: 'tech-lead-orchestrator' },
        { name: '/execute-tasks', agent: 'ai-mesh-orchestrator' },
        { name: 'frontend-implementation', agent: 'frontend-developer' },
        { name: 'code-review', agent: 'code-reviewer' },
        { name: 'test-execution', agent: 'test-runner' }
    ];
    console.log('Simulating Claude Code command executions...\n');
    for (const command of commands) {
        await simulateClaudeCommand(command.name, command.agent);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('\nQuerying collected metrics...');
    const results = await client.queryDashboard({
        timeframe: '1h',
        format: 'ascii'
    });
    console.log(results);
    await client.disconnect();
    console.log('\nClaude Code integration example completed');
}
async function runExamples() {
    console.log('Fortium MCP Client SDK Examples\n');
    console.log('================================\n');
    try {
        await basicUsage();
        console.log('\n' + '='.repeat(50) + '\n');
        await autoConfiguredUsage();
        console.log('\n' + '='.repeat(50) + '\n');
        await migrationWorkflow();
        console.log('\n' + '='.repeat(50) + '\n');
        await errorHandlingExample();
        console.log('\n' + '='.repeat(50) + '\n');
        await claudeCodeIntegration();
    }
    catch (error) {
        console.error('Example execution failed:', error);
    }
}
if (require.main === module) {
    runExamples().catch(console.error);
}
//# sourceMappingURL=basic-usage.js.map