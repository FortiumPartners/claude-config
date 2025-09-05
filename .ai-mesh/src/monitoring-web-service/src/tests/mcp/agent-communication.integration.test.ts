/**
 * Agent Communication Integration Tests  
 * Task 4.1: Tests for Claude Code agent mesh communication patterns
 * 
 * Validates proper communication between MCP server and Claude Code agents
 */

import request from 'supertest';
import { app } from '../../app';
import { DatabaseConnection } from '../../database/connection';
import { createTestDatabase, cleanupTestDatabase } from '../helpers/database.helper';
import { createTestUser, createTestOrganization } from '../helpers/auth.helper';
import * as winston from 'winston';

describe('Agent Communication Integration Tests', () => {
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
      name: 'Agent Communication Test Org',
      subscription_tier: 'enterprise',
      settings: {
        agent_tracking_enabled: true,
        delegation_metrics_enabled: true
      }
    });

    testUser = await createTestUser(db, {
      email: 'agent-test@fortium.com',
      name: 'Agent Test User', 
      organization_id: testOrg.id,
      role: 'admin'
    });

    authToken = testUser.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  describe('AI Mesh Orchestrator Communication', () => {
    test('should track orchestrator task delegation', async () => {
      const orchestratorMetric = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: '/execute-tasks',
            execution_time_ms: 5000,
            success: true,
            context: {
              claude_session: 'orchestrator-session-1',
              agent_used: 'ai-mesh-orchestrator',
              delegation_pattern: {
                initial_agent: 'ai-mesh-orchestrator',
                task_analysis: {
                  complexity: 'high',
                  estimated_duration: 5000,
                  required_specialists: ['frontend-developer', 'code-reviewer']
                },
                delegation_sequence: [
                  {
                    agent: 'frontend-developer',
                    task: 'implement-react-component',
                    duration_ms: 3000,
                    success: true,
                    handoff_reason: 'specialized-ui-development'
                  },
                  {
                    agent: 'code-reviewer',
                    task: 'security-review',
                    duration_ms: 1500,
                    success: true,
                    handoff_reason: 'quality-gate-enforcement'
                  }
                ],
                total_handoffs: 2,
                orchestration_overhead_ms: 500
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orchestratorMetric)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('orchestration tracked');

      // Verify delegation metrics were stored
      const metricsQuery = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'query_dashboard',
          arguments: {
            timeframe: '1h',
            metrics: ['delegations'],
            session_id: 'orchestrator-session-1'
          }
        }
      };

      const queryResponse = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(metricsQuery)
        .expect(200);

      expect(queryResponse.body.result.content[0].text).toContain('delegation_pattern');
    });

    test('should handle agent conflict resolution', async () => {
      const conflictResolution = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: '/resolve-conflict',
            execution_time_ms: 2000,
            success: true,
            context: {
              claude_session: 'conflict-session',
              agent_used: 'ai-mesh-orchestrator',
              conflict_resolution: {
                conflict_type: 'agent_capability_overlap',
                agents_involved: ['frontend-developer', 'react-component-architect'],
                task_description: 'create-dashboard-component',
                resolution_strategy: 'capability_specialization',
                chosen_agent: 'react-component-architect',
                resolution_rationale: 'Higher specialization for React patterns',
                resolution_time_ms: 300
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(conflictResolution)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('conflict resolved');
    });

    test('should track cross-agent handoffs', async () => {
      const handoffMetric = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: '/build-feature',
            execution_time_ms: 8000,
            success: true,
            context: {
              claude_session: 'handoff-session',
              agent_used: 'ai-mesh-orchestrator',
              handoff_chain: [
                {
                  from_agent: 'ai-mesh-orchestrator',
                  to_agent: 'tech-lead-orchestrator',
                  reason: 'technical_planning_required',
                  handoff_time_ms: 100,
                  context_data: {
                    feature_complexity: 'high',
                    dependencies: ['database', 'authentication']
                  }
                },
                {
                  from_agent: 'tech-lead-orchestrator',
                  to_agent: 'backend-developer',
                  reason: 'api_implementation_required',
                  handoff_time_ms: 150,
                  context_data: {
                    api_endpoints: 3,
                    database_changes: true
                  }
                },
                {
                  from_agent: 'backend-developer',
                  to_agent: 'code-reviewer',
                  reason: 'quality_gate',
                  handoff_time_ms: 80,
                  context_data: {
                    security_review: true,
                    performance_review: true
                  }
                }
              ],
              total_handoffs: 3,
              handoff_efficiency: 0.96
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(handoffMetric)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('handoff chain tracked');
    });
  });

  describe('Specialized Agent Communication', () => {
    test('should track frontend-developer agent metrics', async () => {
      const frontendMetric = {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'implement-component',
            execution_time_ms: 3500,
            success: true,
            context: {
              claude_session: 'frontend-session',
              agent_used: 'frontend-developer',
              specialization_metrics: {
                framework_used: 'react',
                components_created: 2,
                accessibility_checks: true,
                responsive_design: true,
                performance_optimizations: [
                  'lazy-loading',
                  'memoization', 
                  'bundle-splitting'
                ],
                test_coverage: 0.85,
                wcag_compliance: 'AA'
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(frontendMetric)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('frontend specialization');
    });

    test('should track code-reviewer agent security metrics', async () => {
      const securityReviewMetric = {
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'security-review',
            execution_time_ms: 2200,
            success: true,
            context: {
              claude_session: 'security-session',
              agent_used: 'code-reviewer',
              security_metrics: {
                vulnerabilities_detected: 3,
                severity_breakdown: {
                  critical: 0,
                  high: 1,
                  medium: 2,
                  low: 0
                },
                security_rules_applied: [
                  'input-validation',
                  'authentication-check',
                  'authorization-verification',
                  'sql-injection-prevention'
                ],
                compliance_checks: {
                  owasp_top_10: true,
                  gdpr_compliance: true,
                  data_encryption: true
                },
                fixes_suggested: 3,
                auto_fixes_applied: 1
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(securityReviewMetric)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('security review completed');
    });

    test('should track git-workflow agent operations', async () => {
      const gitWorkflowMetric = {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'collect_metrics',
          arguments: {
            command_name: 'create-pr',
            execution_time_ms: 1800,
            success: true,
            context: {
              claude_session: 'git-session',
              agent_used: 'git-workflow',
              git_metrics: {
                branch_created: 'feature/user-dashboard',
                commits_made: 4,
                commit_message_format: 'conventional_commits',
                pr_created: true,
                pr_description_quality: 'high',
                automated_checks: {
                  branch_protection: true,
                  commit_signing: true,
                  pr_template_used: true,
                  changelog_updated: true
                },
                merge_conflicts: 0,
                files_modified: 8
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(gitWorkflowMetric)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('git workflow tracked');
    });
  });

  describe('Agent Performance Analytics', () => {
    test('should provide agent usage analytics', async () => {
      // First, collect some metrics for different agents
      const agents = ['frontend-developer', 'code-reviewer', 'git-workflow', 'ai-mesh-orchestrator'];
      
      for (const agent of agents) {
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/api/mcp/rpc')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              jsonrpc: '2.0',
              id: 100 + i,
              method: 'tools/call',
              params: {
                name: 'collect_metrics',
                arguments: {
                  command_name: `test-${agent}-${i}`,
                  execution_time_ms: 1000 + (i * 200),
                  success: i < 4, // One failure per agent
                  context: {
                    claude_session: `analytics-session-${agent}`,
                    agent_used: agent
                  }
                }
              }
            });
        }
      }

      // Query analytics
      const analyticsQuery = {
        jsonrpc: '2.0',
        id: 8,
        method: 'tools/call',
        params: {
          name: 'query_agent_analytics',
          arguments: {
            timeframe: '1h',
            metrics: ['usage', 'performance', 'success_rate', 'delegation_patterns']
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(analyticsQuery)
        .expect(200);

      const analyticsData = JSON.parse(response.body.result.content[0].text);
      
      expect(analyticsData.agent_metrics).toBeDefined();
      expect(analyticsData.agent_metrics).toHaveLength(4);
      
      analyticsData.agent_metrics.forEach(agentMetric => {
        expect(agentMetric).toMatchObject({
          agent_name: expect.any(String),
          total_calls: 5,
          success_rate: 0.8,
          avg_execution_time: expect.any(Number)
        });
      });
    });

    test('should track agent specialization effectiveness', async () => {
      const effectivenessQuery = {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: {
          name: 'analyze_agent_effectiveness',
          arguments: {
            timeframe: '24h',
            analysis_type: 'specialization_match'
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(effectivenessQuery)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('effectiveness analysis');
    });

    test('should provide delegation efficiency metrics', async () => {
      const delegationQuery = {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'analyze_delegation_efficiency',
          arguments: {
            timeframe: '7d',
            include_recommendations: true
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(delegationQuery)
        .expect(200);

      const efficiency = JSON.parse(response.body.result.content[0].text);
      
      expect(efficiency).toMatchObject({
        delegation_efficiency: expect.any(Number),
        avg_handoff_time: expect.any(Number),
        successful_delegations: expect.any(Number),
        optimization_suggestions: expect.any(Array)
      });
    });
  });

  describe('Real-time Agent Communication', () => {
    test('should handle real-time agent status updates', async () => {
      const statusUpdate = {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'update_agent_status',
          arguments: {
            agent_name: 'frontend-developer',
            status: 'busy',
            current_task: 'implementing-dashboard',
            estimated_completion: 1800000, // 30 minutes
            progress: 0.6
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body.result.content[0].text).toContain('status updated');
    });

    test('should provide real-time agent availability', async () => {
      const availabilityQuery = {
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'get_agent_availability',
          arguments: {
            required_capabilities: ['react', 'typescript'],
            urgency: 'normal'
          }
        }
      };

      const response = await request(app)
        .post('/api/mcp/rpc')
        .set('Authorization', `Bearer ${authToken}`)
        .send(availabilityQuery)
        .expect(200);

      const availability = JSON.parse(response.body.result.content[0].text);
      
      expect(availability.available_agents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agent_name: expect.any(String),
            capabilities: expect.any(Array),
            current_load: expect.any(Number),
            estimated_availability: expect.any(Number)
          })
        ])
      );
    });
  });
});