/**
 * Claude Code Integration Tests
 * Task 4.5: Verify all MCP integration tests pass with existing Claude configurations
 * 
 * End-to-end tests validating MCP integration with actual Claude Code workflows
 */

import request from 'supertest';
import { app } from '../../app';
import { DatabaseConnection } from '../../database/connection';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database.helper';
import { createTestUser, createTestOrganization } from '../helpers/auth.helper';
import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

describe('Claude Code Integration Tests', () => {
  let db: DatabaseConnection;
  let logger: winston.Logger;
  let testUser: any;
  let testOrg: any;
  let authToken: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    logger = winston.createLogger({
      level: 'silent',
      transports: []
    });

    testOrg = await createTestOrganization(db, {
      name: 'Claude Code Integration Test Org',
      subscription_tier: 'enterprise',
      settings: {
        mcp_integration_enabled: true,
        claude_code_integration: true,
        webhook_endpoints: []
      }
    });

    testUser = await createTestUser(db, {
      email: 'claude-integration@fortium.com',
      name: 'Claude Integration User',
      organization_id: testOrg.id,
      role: 'admin'
    });

    authToken = testUser.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  describe('MCP Server Discovery and Connection', () => {
    test('should be discoverable by Claude Code MCP client', async () => {
      // Test server capabilities endpoint
      const response = await request(app)
        .get('/api/mcp/capabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        server_info: {
          name: 'fortium-metrics-server',
          version: '1.0.0',
          description: expect.any(String)
        },
        protocol_version: '2024-11-05',
        capabilities: expect.objectContaining({
          resources: expect.any(Object),
          tools: expect.any(Object),
          experimental: expect.any(Object)
        }),
        endpoints: {
          rpc: '/api/mcp/rpc',
          websocket: '/api/mcp/ws'
        }
      });
    });

    test('should handle MCP client initialization', async () => {
      const initRequest = {
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
        .send(initRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: expect.any(Object),
          serverInfo: {
            name: 'fortium-metrics-server'
          }
        }
      });
    });
  });

  describe('Existing Claude Code Command Integration', () => {
    test('should integrate with /manager-dashboard command', async () => {
      // Simulate existing dashboard command calling MCP
      const dashboardRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'query_dashboard',
          arguments: {
            timeframe: '24h',
            metrics: ['commands', 'agents', 'productivity'],
            format: 'ascii'
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dashboardRequest)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('Dashboard');
      
      // Verify it contains ASCII dashboard format
      expect(response.body.result.content[0].text).toMatch(/┌─+┐/);
    });

    test('should handle agent delegation workflows', async () => {
      // Simulate AI mesh orchestrator delegating to specific agents
      const delegationWorkflow = [
        {
          agent: 'ai-mesh-orchestrator',
          command: '/execute-tasks',
          delegated_to: 'frontend-developer'
        },
        {
          agent: 'frontend-developer', 
          command: 'implement-component',
          result: 'success'
        },
        {
          agent: 'code-reviewer',
          command: 'review-code',
          result: 'approved'
        }
      ];

      for (const step of delegationWorkflow) {
        const metricRequest = {
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 1000),
          method: 'tools/call',
          params: {
            name: 'collect_metrics',
            arguments: {
              command_name: step.command,
              execution_time_ms: 1500,
              success: step.result !== 'failed',
              context: {
                agent_used: step.agent,
                claude_session: 'delegation-test-session',
                delegated_to: step.delegated_to
              }
            }
          }
        };

        const response = await request(app)
          .post('/api/mcp/rpc')
          .set('Authorization', `Bearer ${authToken}`)
          .send(metricRequest)
          .expect(200);

        expect(response.body.result.content[0].text).toContain('successfully');
      }
    });

    test('should support /fold-prompt command integration', async () => {
      // Test project optimization command
      const optimizationRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: '/fold-prompt',
            execution_time_ms: 3000,
            success: true,
            context: {
              agent_used: 'general-purpose',
              claude_session: 'optimization-session',
              optimization_type: 'project_analysis'
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(optimizationRequest)
        .expect(200);

      expect(response.body.result).toBeDefined();
    });
  });

  describe('Backward Compatibility with Local Metrics', () => {
    test('should migrate local dashboard settings', async () => {
      // Create mock local dashboard settings
      const mockDashboardSettings = {
        teams: {
          engineering: {
            name: 'Engineering Team',
            members: [
              { name: 'Alice Developer', ai_usage_level: 'high' },
              { name: 'Bob Reviewer', ai_usage_level: 'medium' }
            ]
          }
        },
        goals: {
          productivity_improvement: 30,
          current_improvement: 25
        },
        current_sprint: {
          name: 'Sprint 24'
        }
      };

      const migrationRequest = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'migrate_local_metrics',
          arguments: {
            legacy_format: {
              dashboard_settings: mockDashboardSettings,
              metrics: [
                {
                  timestamp: Date.now(),
                  command: 'test-command',
                  duration: 1000,
                  success: true,
                  agent: 'test-agent'
                }
              ]
            },
            preserve_local: true
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(migrationRequest)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('migrated successfully');
    });

    test('should handle missing local configuration gracefully', async () => {
      const migrationRequest = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'migrate_local_metrics',
          arguments: {
            local_config_path: '/nonexistent/path'
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(migrationRequest)
        .expect(200);

      // Should not fail, but report no migration
      expect(response.body.result).toBeDefined();
    });
  });

  describe('Agent Communication Patterns', () => {
    test('should track complete agent workflow', async () => {
      const sessionId = 'agent-workflow-session';
      const workflowSteps = [
        {
          agent: 'ai-mesh-orchestrator',
          task: 'analyze-request',
          duration: 500
        },
        {
          agent: 'tech-lead-orchestrator', 
          task: 'create-technical-plan',
          duration: 1200
        },
        {
          agent: 'backend-developer',
          task: 'implement-api',
          duration: 3000
        },
        {
          agent: 'frontend-developer',
          task: 'create-ui',
          duration: 2500
        },
        {
          agent: 'code-reviewer',
          task: 'review-and-approve',
          duration: 800
        }
      ];

      // Track each step
      for (const [index, step] of workflowSteps.entries()) {
        const stepRequest = {
          jsonrpc: '2.0',
          id: 100 + index,
          method: 'tools/call',
          params: {
            name: 'collect_metrics',
            arguments: {
              command_name: step.task,
              execution_time_ms: step.duration,
              success: true,
              context: {
                agent_used: step.agent,
                claude_session: sessionId,
                workflow_step: index + 1,
                total_steps: workflowSteps.length
              }
            }
          }
        };

        await request(app)
          .post('/api/mcp/rpc')
          .set('Authorization', `Bearer ${authToken}`)
          .send(stepRequest)
          .expect(200);
      }

      // Query workflow analytics
      const analyticsRequest = {
        jsonrpc: '2.0',
        id: 200,
        method: 'tools/call',
        params: {
          name: 'query_dashboard',
          arguments: {
            timeframe: '1h',
            metrics: ['workflow_efficiency'],
            session_id: sessionId
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(analyticsRequest)
        .expect(200);

      expect(response.body.result.content[0].text).toContain(sessionId);
    });

    test('should handle agent conflicts and resolutions', async () => {
      const conflictRequest = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'resolve-agent-conflict',
            execution_time_ms: 300,
            success: true,
            context: {
              agent_used: 'ai-mesh-orchestrator',
              conflict_type: 'capability_overlap',
              agents_involved: ['frontend-developer', 'react-component-architect'],
              resolution: 'chose_react_specialist',
              resolution_rationale: 'Higher React specialization'
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictRequest)
        .expect(200);

      expect(response.body.result).toBeDefined();
    });
  });

  describe('Real-world Command Scenarios', () => {
    test('should handle /build command workflow', async () => {
      const buildWorkflow = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: '/build',
            execution_time_ms: 8000,
            success: true,
            context: {
              agent_used: 'ai-mesh-orchestrator',
              claude_session: 'build-session',
              build_steps: [
                { step: 'analysis', duration: 1000, agent: 'general-purpose' },
                { step: 'implementation', duration: 5000, agent: 'backend-developer' },
                { step: 'testing', duration: 1500, agent: 'test-runner' },
                { step: 'review', duration: 500, agent: 'code-reviewer' }
              ],
              total_files_modified: 8,
              tests_passed: 15,
              quality_score: 0.92
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(buildWorkflow)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('successfully');
    });

    test('should handle /test e2e command integration', async () => {
      const e2eTestRequest = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: '/test e2e',
            execution_time_ms: 12000,
            success: true,
            context: {
              agent_used: 'playwright-tester',
              claude_session: 'e2e-test-session',
              test_results: {
                total_tests: 24,
                passed: 22,
                failed: 2,
                skipped: 0,
                coverage: 0.87
              },
              browser_coverage: ['chrome', 'firefox', 'safari'],
              performance_metrics: {
                avg_response_time: 280,
                largest_contentful_paint: 1200
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(e2eTestRequest)
        .expect(200);

      expect(response.body.result).toBeDefined();
    });

    test('should handle git workflow operations', async () => {
      const gitWorkflowRequest = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'git-workflow',
            execution_time_ms: 2000,
            success: true,
            context: {
              agent_used: 'git-workflow',
              claude_session: 'git-session',
              git_operations: [
                { operation: 'branch_create', duration: 100 },
                { operation: 'commit_changes', duration: 800 },
                { operation: 'create_pr', duration: 1100 }
              ],
              branch_name: 'feature/mcp-integration',
              commits_count: 5,
              files_changed: 12,
              pr_created: true
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gitWorkflowRequest)
        .expect(200);

      expect(response.body.result).toBeDefined();
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent MCP requests from multiple Claude sessions', async () => {
      const concurrentSessions = 10;
      const requestsPerSession = 5;

      const allRequests = [];

      for (let session = 0; session < concurrentSessions; session++) {
        for (let req = 0; req < requestsPerSession; req++) {
          const request = {
            jsonrpc: '2.0',
            id: session * 100 + req,
            method: 'tools/call',
            params: {
              name: 'collect_metrics',
              arguments: {
                command_name: `concurrent-test-${session}-${req}`,
                execution_time_ms: Math.floor(Math.random() * 1000) + 500,
                success: true,
                context: {
                  claude_session: `session-${session}`,
                  agent_used: 'general-purpose'
                }
              }
            }
          };

          allRequests.push(
            request(app)
              .post('/api/mcp/rpc')
              .set('Authorization', `Bearer ${authToken}`)
              .send(request)
          );
        }
      }

      // Execute all requests concurrently
      const responses = await Promise.all(allRequests);

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.result).toBeDefined();
      });

      // Verify total metrics collected
      const summaryRequest = {
        jsonrpc: '2.0',
        id: 999,
        method: 'tools/call',
        params: {
          name: 'query_dashboard',
          arguments: {
            timeframe: '1h',
            metrics: ['command_count']
          }
        }
      };

      const summaryResponse = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(summaryRequest)
        .expect(200);

      // Should include the concurrent requests we just made
      expect(summaryResponse.body.result).toBeDefined();
    });

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      const loadTestRequests = 50;

      const promises = Array.from({ length: loadTestRequests }, (_, i) => {
        return request(app)
          .post('/api/mcp/rpc')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            jsonrpc: '2.0',
            id: i,
            method: 'tools/call',
            params: {
              name: 'query_dashboard',
              arguments: {
                timeframe: '24h',
                metrics: ['all']
              }
            }
          });
      });

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      const avgResponseTime = (endTime - startTime) / loadTestRequests;

      // Should maintain reasonable performance under load
      expect(avgResponseTime).toBeLessThan(100); // Less than 100ms average
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.result).toBeDefined();
      });
    });

    test('should handle MCP protocol errors gracefully', async () => {
      // Invalid JSON-RPC format
      const invalidRequest = {
        jsonrpc: '1.0', // Wrong version
        id: 1,
        method: 'invalid_method'
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest)
        .expect(200);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe(-32600); // Invalid Request
    });
  });

  describe('Feature Integration Validation', () => {
    test('should integrate with existing MCP servers (Context7, Playwright, Linear)', async () => {
      // Verify our MCP server doesn't conflict with existing ones
      const capabilitiesResponse = await request(app)
        .get('/api/mcp/capabilities')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should have unique server name and capabilities
      expect(capabilitiesResponse.body.server_info.name).toBe('fortium-metrics-server');
      
      // Should have experimental features that don't conflict
      expect(capabilitiesResponse.body.capabilities.experimental).toMatchObject({
        batch_requests: true,
        real_time_metrics: true,
        migration_tools: true
      });
    });

    test('should support Claude Code configuration migration', async () => {
      // Test configuration migration tool
      const configMigrationRequest = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'configure_integration',
          arguments: {
            webhook_url: 'https://claude-code.example.com/webhooks/metrics',
            notification_settings: {
              productivity_alerts: true,
              agent_performance: true,
              threshold_breaches: true
            },
            sync_preferences: {
              realtime_updates: true,
              batch_size: 100,
              sync_interval_minutes: 5
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(configMigrationRequest)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('configuration updated');
    });

    test('should validate end-to-end user journey', async () => {
      // Simulate complete user journey: setup → migration → usage → analytics
      
      // 1. Setup integration
      const setupRequest = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'configure_integration',
          arguments: {
            webhook_url: 'https://test.example.com/webhook'
          }
        }
      };

      await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(setupRequest)
        .expect(200);

      // 2. Migrate existing data
      const migrationRequest = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'migrate_local_metrics',
          arguments: {
            legacy_format: {
              commands: [
                { name: 'legacy-command-1', duration: 1000, success: true },
                { name: 'legacy-command-2', duration: 1500, success: false }
              ]
            }
          }
        }
      };

      await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(migrationRequest)
        .expect(200);

      // 3. Use normal operations
      const usageRequest = {
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'new-command',
            execution_time_ms: 800,
            success: true,
            context: {
              agent_used: 'test-agent'
            }
          }
        }
      };

      await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(usageRequest)
        .expect(200);

      // 4. Query analytics
      const analyticsRequest = {
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'query_dashboard',
          arguments: {
            timeframe: '1h',
            metrics: ['all']
          }
        }
      };

      const analyticsResponse = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(analyticsRequest)
        .expect(200);

      // Should show combined legacy and new data
      expect(analyticsResponse.body.result.content[0].text).toBeDefined();
    });
  });
});