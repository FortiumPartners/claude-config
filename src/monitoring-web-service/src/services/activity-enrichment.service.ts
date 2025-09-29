/**
 * Activity Enrichment Service
 * Adds business context, impact assessment, and correlation IDs to activities
 * Provides intelligent categorization and relationship tracking
 */

import { logger } from '../config/logger';
import { ExtendedPrismaClient } from '../database/prisma-client';
import {
  EnhancedActivityContext,
  EnhancedActivityItem,
  WorkflowCorrelation,
  ActivityInsights
} from '../types/enhanced-activity.types';
import { randomUUID } from 'crypto';

export interface EnrichmentContext {
  organizationId?: string;
  teamId?: string;
  projectContext?: {
    id: string;
    name: string;
    type: string;
    technologies: string[];
  };
  userContext?: {
    role: string;
    experience: string;
    teamMemberships: string[];
  };
  sessionContext?: {
    sessionId: string;
    startTime: Date;
    previousActivities: string[];
  };
}

export interface BusinessImpactAssessment {
  category: 'development' | 'testing' | 'deployment' | 'analysis';
  scope: 'local' | 'team' | 'project' | 'organization';
  confidence: number;
  automationLevel: 'manual' | 'semi-automated' | 'automated';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  businessValue: number; // 0-100 scale
  timeToImpact: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
  stakeholders: string[];
}

export interface ActivityPattern {
  id: string;
  name: string;
  description: string;
  activities: string[];
  frequency: number;
  successRate: number;
  averageDuration: number;
  commonIssues: string[];
}

export class ActivityEnrichmentService {
  private prisma: ExtendedPrismaClient;
  private patternCache: Map<string, ActivityPattern[]> = new Map();
  private contextCache: Map<string, EnrichmentContext> = new Map();

  constructor(prisma?: ExtendedPrismaClient) {
    this.prisma = prisma || new ExtendedPrismaClient();
  }

  /**
   * Enrich activity with business context and impact assessment
   */
  async enrichActivity(
    activity: EnhancedActivityItem,
    enrichmentContext: EnrichmentContext
  ): Promise<EnhancedActivityItem> {
    try {
      logger.debug('Starting activity enrichment', {
        activityId: activity.id,
        action: activity.action.name
      });

      // Create enhanced business impact assessment
      const businessImpact = await this.assessBusinessImpact(activity, enrichmentContext);

      // Generate or update correlation ID
      const correlationData = await this.enrichCorrelationData(activity, enrichmentContext);

      // Add automation level assessment
      const enhancedAutomationLevel = this.assessAutomationLevel(activity, enrichmentContext);

      // Update activity with enriched data
      const enrichedActivity: EnhancedActivityItem = {
        ...activity,
        businessImpact: {
          category: businessImpact.category,
          scope: businessImpact.scope,
          confidence: businessImpact.confidence,
          automationLevel: enhancedAutomationLevel
        },
        correlationData: {
          ...activity.correlationData,
          ...correlationData
        },
        metadata: {
          ...activity.metadata,
          enrichment: {
            riskLevel: businessImpact.riskLevel,
            businessValue: businessImpact.businessValue,
            timeToImpact: businessImpact.timeToImpact,
            stakeholders: businessImpact.stakeholders,
            enrichedAt: new Date().toISOString()
          }
        }
      };

      // Store enrichment data
      await this.storeEnrichmentData(enrichedActivity);

      logger.info('Activity enrichment completed', {
        activityId: activity.id,
        category: businessImpact.category,
        scope: businessImpact.scope,
        confidence: businessImpact.confidence
      });

      return enrichedActivity;

    } catch (error) {
      logger.error('Failed to enrich activity', {
        activityId: activity.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Return original activity if enrichment fails
      return activity;
    }
  }

  /**
   * Assess business impact of an activity
   */
  private async assessBusinessImpact(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): Promise<BusinessImpactAssessment> {
    // Determine category based on action type and context
    const category = this.determineBusinessCategory(activity, context);

    // Assess scope based on target and project context
    const scope = this.assessBusinessScope(activity, context);

    // Calculate confidence based on available data
    const confidence = this.calculateConfidence(activity, context);

    // Assess risk level
    const riskLevel = this.assessRiskLevel(activity, context);

    // Calculate business value
    const businessValue = this.calculateBusinessValue(activity, context);

    // Determine time to impact
    const timeToImpact = this.determineTimeToImpact(activity, context);

    // Identify stakeholders
    const stakeholders = this.identifyStakeholders(activity, context);

    return {
      category,
      scope,
      confidence,
      automationLevel: activity.action.automationLevel,
      riskLevel,
      businessValue,
      timeToImpact,
      stakeholders
    };
  }

  /**
   * Enrich correlation data with workflow and relationship information
   */
  private async enrichCorrelationData(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): Promise<Partial<EnhancedActivityContext['correlation']>> {
    const correlationData: Partial<EnhancedActivityContext['correlation']> = {
      ...activity.correlationData
    };

    // Generate workflow ID if part of a session
    if (context.sessionContext && !correlationData.workflowId) {
      correlationData.workflowId = `workflow_${context.sessionContext.sessionId}`;
      correlationData.isWorkflowRoot = context.sessionContext.previousActivities.length === 0;
    }

    // Find parent activity if part of a sequence
    if (context.sessionContext?.previousActivities.length > 0) {
      const previousActivityId = context.sessionContext.previousActivities[
        context.sessionContext.previousActivities.length - 1
      ];

      const isRelated = await this.checkActivityRelationship(activity, previousActivityId);
      if (isRelated) {
        correlationData.parentActivityId = previousActivityId;
        correlationData.sequenceNumber = context.sessionContext.previousActivities.length;
      }
    }

    // Add workflow context
    correlationData.workflowContext = {
      sessionId: context.sessionContext?.sessionId,
      projectId: context.projectContext?.id,
      teamId: context.teamId,
      organizationId: context.organizationId,
      userRole: context.userContext?.role
    };

    return correlationData;
  }

  /**
   * Assess automation level based on patterns and context
   */
  private assessAutomationLevel(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): 'manual' | 'semi-automated' | 'automated' {
    // Start with declared automation level
    let level = activity.action.automationLevel;

    // Upgrade based on patterns
    if (activity.action.type === 'agent_interaction') {
      level = level === 'manual' ? 'semi-automated' : level;
    }

    if (activity.action.type === 'command_execution' && activity.isAutomated) {
      level = 'automated';
    }

    // Consider session context
    if (context.sessionContext?.previousActivities.length > 3) {
      // Multiple activities in sequence suggest automation
      level = level === 'manual' ? 'semi-automated' : level;
    }

    return level;
  }

  /**
   * Store enrichment data in database
   */
  private async storeEnrichmentData(activity: EnhancedActivityItem): Promise<void> {
    try {
      await this.prisma.withTenantContext(
        {
          tenantId: 'fortium-org',
          schemaName: 'fortium_schema',
          domain: 'fortium.com'
        },
        async (client) => {
          await client.activityData.update({
            where: { id: activity.id },
            data: {
              businessImpact: activity.businessImpact,
              correlationData: activity.correlationData,
              metadata: activity.metadata
            }
          });
        }
      );

      // Create or update workflow record if applicable
      if (activity.correlationData?.workflowId) {
        await this.createOrUpdateWorkflow(activity);
      }

    } catch (error) {
      logger.warn('Failed to store enrichment data', {
        activityId: activity.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create or update workflow record
   */
  private async createOrUpdateWorkflow(activity: EnhancedActivityItem): Promise<void> {
    if (!activity.correlationData?.workflowId) return;

    try {
      await this.prisma.withTenantContext(
        {
          tenantId: 'fortium-org',
          schemaName: 'fortium_schema',
          domain: 'fortium.com'
        },
        async (client) => {
          const existingWorkflow = await client.activityWorkflow.findFirst({
            where: { workflowId: activity.correlationData.workflowId }
          });

          if (existingWorkflow) {
            // Update existing workflow
            await client.activityWorkflow.update({
              where: { id: existingWorkflow.id },
              data: {
                updatedAt: new Date(),
                metadata: {
                  ...existingWorkflow.metadata,
                  lastActivityId: activity.id,
                  activityCount: (existingWorkflow.metadata as any)?.activityCount + 1 || 1
                }
              }
            });
          } else {
            // Create new workflow
            await client.activityWorkflow.create({
              data: {
                workflowId: activity.correlationData.workflowId,
                name: this.generateWorkflowName(activity),
                description: this.generateWorkflowDescription(activity),
                rootActivityId: activity.correlationData.isWorkflowRoot ? activity.id : null,
                status: 'active',
                metadata: {
                  sessionId: activity.correlationData.workflowContext?.sessionId,
                  projectId: activity.correlationData.workflowContext?.projectId,
                  firstActivityId: activity.id,
                  activityCount: 1
                }
              }
            });
          }
        }
      );
    } catch (error) {
      logger.warn('Failed to create/update workflow', {
        workflowId: activity.correlationData.workflowId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Find related activities based on patterns and context
   */
  async findRelatedActivities(
    activityId: string,
    context: EnrichmentContext
  ): Promise<EnhancedActivityItem[]> {
    try {
      const activities = await this.prisma.withTenantContext(
        {
          tenantId: 'fortium-org',
          schemaName: 'fortium_schema',
          domain: 'fortium.com'
        },
        async (client) => {
          // Find activities in the same session or workflow
          return await client.activityData.findMany({
            where: {
              OR: [
                {
                  correlationData: {
                    path: ['workflowContext', 'sessionId'],
                    equals: context.sessionContext?.sessionId
                  }
                },
                {
                  correlationData: {
                    path: ['workflowId'],
                    not: null
                  }
                }
              ],
              id: { not: activityId },
              timestamp: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
              }
            },
            orderBy: { timestamp: 'desc' },
            take: 10
          });
        }
      );

      return activities.map(activity => this.transformToEnhancedActivity(activity));

    } catch (error) {
      logger.error('Failed to find related activities', {
        activityId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Generate activity insights and patterns
   */
  async generateActivityInsights(
    organizationId: string,
    period: { start: Date; end: Date }
  ): Promise<ActivityInsights> {
    try {
      const activities = await this.prisma.withTenantContext(
        {
          tenantId: 'fortium-org',
          schemaName: 'fortium_schema',
          domain: 'fortium.com'
        },
        async (client) => {
          return await client.activityData.findMany({
            where: {
              timestamp: {
                gte: period.start,
                lte: period.end
              }
            },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          });
        }
      );

      // Calculate insights
      const insights: ActivityInsights = {
        organizationId,
        period,
        totalActivities: activities.length,
        activitiesByType: this.calculateActivitiesByType(activities),
        activitiesByHour: this.calculateActivitiesByHour(activities),
        performanceTrends: this.calculatePerformanceTrends(activities),
        topUsers: this.calculateTopUsers(activities),
        workflowStats: await this.calculateWorkflowStats(activities)
      };

      return insights;

    } catch (error) {
      logger.error('Failed to generate activity insights', {
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Return empty insights on error
      return {
        organizationId,
        period,
        totalActivities: 0,
        activitiesByType: {},
        activitiesByHour: {},
        performanceTrends: {
          averageExecutionTime: 0,
          averageMemoryUsage: 0,
          errorRate: 0,
          automationRate: 0
        },
        topUsers: [],
        workflowStats: {
          totalWorkflows: 0,
          averageWorkflowDuration: 0,
          completionRate: 0,
          mostCommonPatterns: []
        }
      };
    }
  }

  /**
   * Helper methods for business impact assessment
   */
  private determineBusinessCategory(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): BusinessImpactAssessment['category'] {
    if (activity.action.type === 'test_execution') return 'testing';
    if (activity.action.type === 'git_operation') return 'development';
    if (activity.target.type === 'repository') return 'development';
    if (activity.action.name.toLowerCase().includes('deploy')) return 'deployment';
    if (activity.action.name.toLowerCase().includes('analyze')) return 'analysis';

    return 'development';
  }

  private assessBusinessScope(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): BusinessImpactAssessment['scope'] {
    if (context.organizationId && activity.action.name.toLowerCase().includes('production')) {
      return 'organization';
    }
    if (context.projectContext || activity.correlationData?.workflowId) {
      return 'project';
    }
    if (context.teamId || context.userContext?.teamMemberships?.length > 0) {
      return 'team';
    }

    return 'local';
  }

  private calculateConfidence(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on available data
    if (activity.enhancedContext) confidence += 0.2;
    if (activity.performanceMetrics) confidence += 0.1;
    if (context.projectContext) confidence += 0.1;
    if (context.userContext) confidence += 0.1;

    // Decrease confidence for errors or incomplete data
    if (activity.errorDetails) confidence -= 0.1;
    if (!activity.duration) confidence -= 0.05;

    return Math.max(0, Math.min(1, confidence));
  }

  private assessRiskLevel(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): BusinessImpactAssessment['riskLevel'] {
    if (activity.errorDetails?.severity === 'critical') return 'critical';
    if (activity.errorDetails?.severity === 'high') return 'high';
    if (activity.action.name.toLowerCase().includes('delete')) return 'high';
    if (activity.action.name.toLowerCase().includes('production')) return 'medium';

    return 'low';
  }

  private calculateBusinessValue(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): number {
    let value = 50; // Base value

    // Increase value for automation and efficiency
    if (activity.action.automationLevel === 'automated') value += 20;
    if (activity.action.automationLevel === 'semi-automated') value += 10;

    // Increase value for successful outcomes
    if (activity.status === 'success' && activity.duration < 1000) value += 15;

    // Increase value for project-level impact
    if (context.projectContext) value += 15;

    // Decrease value for errors
    if (activity.errorDetails) value -= 20;

    return Math.max(0, Math.min(100, value));
  }

  private determineTimeToImpact(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): BusinessImpactAssessment['timeToImpact'] {
    if (activity.action.type === 'git_operation' && activity.target.type === 'repository') {
      return 'immediate';
    }
    if (activity.action.type === 'test_execution') {
      return 'short-term';
    }
    if (activity.action.name.toLowerCase().includes('deploy')) {
      return 'immediate';
    }

    return 'medium-term';
  }

  private identifyStakeholders(
    activity: EnhancedActivityItem,
    context: EnrichmentContext
  ): string[] {
    const stakeholders: string[] = [];

    if (context.userContext?.teamMemberships) {
      stakeholders.push(...context.userContext.teamMemberships);
    }
    if (context.projectContext?.id) {
      stakeholders.push(`project:${context.projectContext.id}`);
    }

    return [...new Set(stakeholders)];
  }

  private async checkActivityRelationship(
    activity: EnhancedActivityItem,
    previousActivityId: string
  ): Promise<boolean> {
    // Simple heuristic: activities are related if they're within 5 minutes
    // and involve similar targets or actions
    try {
      const previousActivity = await this.prisma.withTenantContext(
        {
          tenantId: 'fortium-org',
          schemaName: 'fortium_schema',
          domain: 'fortium.com'
        },
        async (client) => {
          return await client.activityData.findUnique({
            where: { id: previousActivityId }
          });
        }
      );

      if (!previousActivity) return false;

      const timeDiff = activity.timestamp.getTime() - previousActivity.timestamp.getTime();
      const timeWindow = 5 * 60 * 1000; // 5 minutes

      if (timeDiff > timeWindow) return false;

      // Check for related targets or actions
      const targetSimilarity = activity.target.name === previousActivity.targetName ||
                              activity.target.type === previousActivity.targetType;
      const actionSimilarity = activity.action.category === previousActivity.actionName;

      return targetSimilarity || actionSimilarity;

    } catch (error) {
      return false;
    }
  }

  private generateWorkflowName(activity: EnhancedActivityItem): string {
    const sessionId = activity.correlationData?.workflowContext?.sessionId;
    const projectId = activity.correlationData?.workflowContext?.projectId;

    if (projectId) {
      return `${projectId} - ${activity.action.category}`;
    }
    if (sessionId) {
      return `Session ${sessionId.substring(0, 8)}`;
    }

    return `Workflow - ${activity.action.name}`;
  }

  private generateWorkflowDescription(activity: EnhancedActivityItem): string {
    return `Automated workflow starting with ${activity.action.name} on ${activity.target.name}`;
  }

  /**
   * Statistical calculation methods
   */
  private calculateActivitiesByType(activities: any[]): Record<string, number> {
    const counts: Record<string, number> = {};

    activities.forEach(activity => {
      const type = activity.actionName || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });

    return counts;
  }

  private calculateActivitiesByHour(activities: any[]): Record<string, number> {
    const hourCounts: Record<string, number> = {};

    activities.forEach(activity => {
      const hour = new Date(activity.timestamp).getHours().toString().padStart(2, '0');
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return hourCounts;
  }

  private calculatePerformanceTrends(activities: any[]): ActivityInsights['performanceTrends'] {
    const validActivities = activities.filter(a => a.duration > 0);
    const errorActivities = activities.filter(a => a.status === 'error');
    const automatedActivities = activities.filter(a => a.isAutomated);

    return {
      averageExecutionTime: validActivities.length > 0
        ? validActivities.reduce((sum, a) => sum + a.duration, 0) / validActivities.length
        : 0,
      averageMemoryUsage: activities.length > 0
        ? activities.reduce((sum, a) => sum + (a.performanceMetrics?.memoryUsageMB || 0), 0) / activities.length
        : 0,
      errorRate: activities.length > 0
        ? errorActivities.length / activities.length * 100
        : 0,
      automationRate: activities.length > 0
        ? automatedActivities.length / activities.length * 100
        : 0
    };
  }

  private calculateTopUsers(activities: any[]): ActivityInsights['topUsers'] {
    const userStats = new Map<string, { count: number; lastActivity: Date; name: string }>();

    activities.forEach(activity => {
      const userId = activity.userId;
      const userName = activity.user ?
        `${activity.user.firstName} ${activity.user.lastName}`.trim() :
        'Unknown User';

      const existing = userStats.get(userId) || {
        count: 0,
        lastActivity: new Date(0),
        name: userName
      };

      userStats.set(userId, {
        count: existing.count + 1,
        lastActivity: activity.timestamp > existing.lastActivity
          ? activity.timestamp
          : existing.lastActivity,
        name: userName
      });
    });

    return Array.from(userStats.entries())
      .map(([userId, stats]) => ({
        userId,
        userName: stats.name,
        activityCount: stats.count,
        lastActivity: stats.lastActivity,
        averagePerformance: 75 // Placeholder - would calculate from performance metrics
      }))
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, 10);
  }

  private async calculateWorkflowStats(activities: any[]): Promise<ActivityInsights['workflowStats']> {
    try {
      const workflows = await this.prisma.withTenantContext(
        {
          tenantId: 'fortium-org',
          schemaName: 'fortium_schema',
          domain: 'fortium.com'
        },
        async (client) => {
          return await client.activityWorkflow.findMany({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          });
        }
      );

      return {
        totalWorkflows: workflows.length,
        averageWorkflowDuration: 0, // Would calculate from workflow timestamps
        completionRate: workflows.filter(w => w.status === 'completed').length / workflows.length * 100,
        mostCommonPatterns: [] // Would identify from activity sequences
      };

    } catch (error) {
      return {
        totalWorkflows: 0,
        averageWorkflowDuration: 0,
        completionRate: 0,
        mostCommonPatterns: []
      };
    }
  }

  private transformToEnhancedActivity(activity: any): EnhancedActivityItem {
    return {
      id: activity.id,
      userId: activity.userId,
      action: {
        type: 'command_execution',
        name: activity.actionName,
        description: activity.actionDescription,
        category: 'general',
        automationLevel: activity.isAutomated ? 'automated' : 'manual'
      },
      target: {
        name: activity.targetName,
        type: activity.targetType,
      },
      status: activity.status,
      timestamp: activity.timestamp,
      duration: activity.duration,
      enhancedContext: activity.enhancedContext,
      performanceMetrics: activity.performanceMetrics,
      inputData: activity.inputData,
      outputData: activity.outputData,
      errorDetails: activity.errorDetails,
      correlationData: activity.correlationData,
      businessImpact: activity.businessImpact,
      actionName: activity.actionName,
      actionDescription: activity.actionDescription,
      targetName: activity.targetName,
      targetType: activity.targetType,
      priority: activity.priority,
      isAutomated: activity.isAutomated,
      metadata: activity.metadata,
      tags: activity.tags,
      projectId: activity.projectId,
      errorMessage: activity.errorMessage,
      errorCode: activity.errorCode
    };
  }
}