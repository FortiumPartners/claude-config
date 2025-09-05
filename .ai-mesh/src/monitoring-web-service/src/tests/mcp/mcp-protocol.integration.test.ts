/**
 * MCP Protocol Integration Tests
 * Task 4.1: Integration tests for MCP protocol compatibility and agent communication
 * 
 * Tests MCP (Model Context Protocol) server compliance and Claude Code integration
 */

import request from 'supertest';
import { WebSocketServer, WebSocket } from 'ws';
import { app } from '../../app';
import { DatabaseConnection } from '../../database/connection';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database.helper';
import { createTestUser, createTestOrganization } from '../helpers/auth.helper';
import * as winston from 'winston';

describe('MCP Protocol Integration Tests', () => {
  let db: DatabaseConnection;
  let logger: winston.Logger;
  let testUser: any;
  let testOrg: any;
  let authToken: string;
  let wsServer: WebSocketServer;
  let wsClient: WebSocket;

  beforeAll(async () => {
    // Setup test database and logger
    db = await createTestDatabase();
    logger = winston.createLogger({
      level: 'silent', // Suppress logs during testing
      transports: []
    });

    // Create test organization and user
    testOrg = await createTestOrganization(db, {
      name: 'Test MCP Organization',
      subscription_tier: 'enterprise',
      settings: {
        mcp_integration_enabled: true,
        webhook_endpoints: []
      }
    });

    testUser = await createTestUser(db, {
      email: 'mcp-test@fortium.com',
      name: 'MCP Test User',
      organization_id: testOrg.id,
      role: 'admin'
    });

    authToken = testUser.token;
  });

  afterAll(async () => {
    if (wsClient) {
      wsClient.close();
    }
    if (wsServer) {
      wsServer.close();
    }
    await cleanupTestDatabase(db);
  });

  describe('MCP Server Protocol Compliance', () => {
    test('should respond to MCP protocol initialization', async () => {
      const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            resources: {},
            tools: {},
            prompts: {}
          },
          clientInfo: {
            name: 'claude-code',
            version: '1.0.0'
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(initMessage)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: expect.objectContaining({
            resources: expect.any(Object),
            tools: expect.any(Object)
          }),
          serverInfo: {
            name: 'fortium-metrics-server',
            version: expect.any(String)
          }
        }
      });
    });

    test('should list available MCP resources', async () => {
      const listResourcesMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list',
        params: {}
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(listResourcesMessage)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          resources: expect.arrayContaining([
            expect.objectContaining({
              uri: expect.stringMatching(/^metrics:\/\//),
              name: expect.any(String),
              description: expect.any(String)
            })
          ])
        }
      });
    });

    test('should list available MCP tools', async () => {
      const listToolsMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {}
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(listToolsMessage)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 3,
        result: {
          tools: expect.arrayContaining([
            expect.objectContaining({
              name: 'collect_metrics',
              description: expect.any(String),
              inputSchema: expect.any(Object)
            }),
            expect.objectContaining({
              name: 'query_dashboard',
              description: expect.any(String),
              inputSchema: expect.any(Object)
            })
          ])
        }
      });
    });

    test('should handle MCP tool calls correctly', async () => {
      const toolCallMessage = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'test-command',
            execution_time_ms: 1500,
            success: true,
            context: {
              claude_session: 'test-session',
              agent_used: 'test-agent'
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(toolCallMessage)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 4,
        result: {
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Metric collected successfully')
            }
          ]
        }
      });
    });

    test('should handle MCP errors correctly', async () => {
      const invalidMessage = {
        jsonrpc: '2.0',
        id: 5,
        method: 'invalid/method',
        params: {}
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidMessage)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 5,
        error: {
          code: -32601,
          message: 'Method not found',
          data: expect.any(Object)
        }
      });
    });
  });

  describe('Claude Code Agent Communication', () => {
    test('should handle dashboard command from Claude Code', async () => {
      const dashboardCommand = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'query_dashboard',
          arguments: {
            timeframe: '7d',
            metrics: ['commands', 'agents', 'productivity']
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dashboardCommand)
        .expect(200);

      expect(response.body.result.content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Dashboard Data')
          })
        ])
      );
    });

    test('should maintain session context between calls', async () => {
      // First call to establish context
      const firstCall = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'session-test',
            execution_time_ms: 1000,
            success: true,
            context: {
              claude_session: 'persistent-session',
              agent_used: 'test-agent'
            }
          }
        }
      };

      await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(firstCall)
        .expect(200);

      // Second call should recognize session context
      const secondCall = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'query_dashboard',
          arguments: {
            session_id: 'persistent-session',
            timeframe: '1h'
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(secondCall)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('persistent-session');
    });

    test('should handle agent delegation patterns', async () => {
      const delegationCommand = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'delegated-task',
            execution_time_ms: 2500,
            success: true,
            context: {
              claude_session: 'delegation-test',
              agent_used: 'ai-mesh-orchestrator',
              delegated_to: ['frontend-developer', 'code-reviewer'],
              delegation_chain: [
                {
                  agent: 'ai-mesh-orchestrator',
                  task: 'analyze task',
                  duration_ms: 500
                },
                {
                  agent: 'frontend-developer',
                  task: 'implement component',
                  duration_ms: 1500
                },
                {
                  agent: 'code-reviewer',
                  task: 'review code',
                  duration_ms: 500
                }
              ]
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(delegationCommand)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('delegation');
    });
  });

  describe('Backward Compatibility', () => {
    test('should handle legacy local metrics format', async () => {
      const legacyMetric = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'migrate_local_metrics',
          arguments: {
            legacy_format: {
              timestamp: Date.now(),
              command: 'legacy-command',
              duration: 1000,
              success: true
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(legacyMetric)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('migrated successfully');
    });

    test('should support existing dashboard command format', async () => {
      const legacyDashboard = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'legacy_dashboard',
          arguments: {
            type: 'weekly',
            format: 'ascii'
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(legacyDashboard)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('┌─────────────────');
    });

    test('should handle configuration migration', async () => {
      const configMigration = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'migrate_configuration',
          arguments: {
            local_config_path: '~/.agent-os/dashboard-settings.yml',
            preserve_local: true
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configMigration)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('Configuration migrated');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent MCP requests', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        jsonrpc: '2.0',
        id: 100 + i,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: `concurrent-${i}`,
            execution_time_ms: 100,
            success: true,
            context: {
              claude_session: `concurrent-session-${i}`
            }
          }
        }
      }));

      const promises = concurrentRequests.map(req =>
        request(app)
          .post('/api/mcp/rpc')
          .set('Authorization', `Bearer ${authToken}`)
          .send(req)
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(100 + index);
        expect(response.body.result).toBeDefined();
      });
    });

    test('should respect rate limits for MCP calls', async () => {
      // Make many requests to trigger rate limiting
      const requests = Array.from({ length: 50 }, (_, i) => 
        request(app)
          .post('/api/mcp/rpc')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            jsonrpc: '2.0',
            id: 200 + i,
            method: 'tools/call',
            params: {
              name: 'collect_metrics',
              arguments: {
                command_name: `rate-limit-${i}`,
                execution_time_ms: 10,
                success: true
              }
            }
          })
      );

      const responses = await Promise.allSettled(requests);
      
      // Some requests should succeed, some should be rate limited
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      const rateLimited = responses.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      ).length;

      expect(successful).toBeGreaterThan(0);
      expect(rateLimited).toBeGreaterThan(0);
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      const loadTest = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post('/api/mcp/rpc')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            jsonrpc: '2.0',
            id: 300 + i,
            method: 'tools/call',
            params: {
              name: 'query_dashboard',
              arguments: {
                timeframe: '24h',
                metrics: ['all']
              }
            }
          })
      );

      const responses = await Promise.all(loadTest);
      const endTime = Date.now();
      
      const avgResponseTime = (endTime - startTime) / responses.length;
      
      // Should maintain sub-50ms average response time
      expect(avgResponseTime).toBeLessThan(50);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.result).toBeDefined();
      });
    });
  });
});