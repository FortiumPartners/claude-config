/**
 * Enhanced Activity Collector Service
 * Collects comprehensive activity context including environment, performance, I/O, and business impact data
 * Integrates with existing tool execution pipeline and activity tracking system
 */

import { logger } from '../config/logger';
import { ExtendedPrismaClient } from '../database/prisma-client';
import {
  EnhancedActivityContext,
  ActivityAction,
  ActivityTarget,
  CreateEnhancedActivityRequest,
  EnhancedActivityItem
} from '../types/enhanced-activity.types';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export interface ActivityCollectionContext {
  sessionId?: string;
  workflowId?: string;
  parentActivityId?: string;
  gitBranch?: string;
  gitCommit?: string;
  workingDirectory?: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  executionTimeMs: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  diskIOBytes?: number;
  networkIOBytes?: number;
  queueTimeMs?: number;
}

export class EnhancedActivityCollectorService {
  private prisma: ExtendedPrismaClient;
  private activeCollections: Map<string, ActivityCollectionContext> = new Map();

  constructor(prisma?: ExtendedPrismaClient) {
    this.prisma = prisma || new ExtendedPrismaClient();
  }

  /**
   * Start collecting activity data for a new activity
   */
  async startActivity(
    userId: string,
    action: ActivityAction,
    target: ActivityTarget,
    context?: Partial<ActivityCollectionContext>
  ): Promise<string> {
    const activityId = randomUUID();
    const collectionContext: ActivityCollectionContext = {
      sessionId: context?.sessionId || randomUUID(),
      workflowId: context?.workflowId,
      parentActivityId: context?.parentActivityId,
      gitBranch: context?.gitBranch,
      gitCommit: context?.gitCommit,
      workingDirectory: context?.workingDirectory || process.cwd(),
      startTime: Date.now(),
      metadata: context?.metadata || {}
    };

    // Collect initial environment context
    try {
      const envContext = await this.collectEnvironmentContext(collectionContext);
      collectionContext.metadata = {
        ...collectionContext.metadata,
        environment: envContext
      };
    } catch (error) {
      logger.warn('Failed to collect environment context', { error, activityId });
    }

    this.activeCollections.set(activityId, collectionContext);

    logger.debug('Started activity collection', {
      activityId,
      action: action.name,
      target: target.name,
      userId
    });

    return activityId;
  }

  /**
   * Complete activity collection and store enhanced data
   */
  async completeActivity(
    activityId: string,
    userId: string,
    status: 'success' | 'error' | 'cancelled',
    result?: any,
    error?: Error,
    additionalContext?: Record<string, any>
  ): Promise<EnhancedActivityItem | null> {
    const collectionContext = this.activeCollections.get(activityId);
    if (!collectionContext) {
      logger.warn('No active collection found for activity', { activityId });
      return null;
    }

    try {
      const endTime = Date.now();
      const executionTimeMs = endTime - collectionContext.startTime;

      // Collect performance metrics
      const performanceMetrics = await this.collectPerformanceMetrics(
        executionTimeMs,
        collectionContext
      );

      // Collect input/output data
      const inputData = await this.collectInputData(collectionContext);
      const outputData = await this.collectOutputData(result, collectionContext);

      // Create enhanced context
      const enhancedContext: EnhancedActivityContext = {
        environment: collectionContext.metadata?.environment || await this.collectEnvironmentContext(collectionContext),
        performance: performanceMetrics,
        inputs: inputData,
        outputs: outputData,
        impact: await this.assessBusinessImpact(collectionContext, result, error),
        correlation: {
          workflowId: collectionContext.workflowId,
          parentActivityId: collectionContext.parentActivityId,
          childActivityIds: [],
          sequenceNumber: undefined,
          isWorkflowRoot: !collectionContext.parentActivityId,
          workflowContext: collectionContext.metadata
        }
      };

      // Add error details if present
      if (error) {
        enhancedContext.error = await this.collectErrorDetails(error, collectionContext);
      }

      // Store activity in database
      const activity = await this.storeEnhancedActivity({
        userId,
        action: collectionContext.metadata?.action || {
          type: 'command_execution',
          name: 'Unknown Action',
          description: 'No action details available',
          category: 'general',
          automationLevel: 'manual'
        },
        target: collectionContext.metadata?.target || {
          name: 'Unknown Target',
          type: 'unknown'
        },
        context: enhancedContext,
        correlationId: activityId,
        workflowId: collectionContext.workflowId
      }, status, additionalContext);

      // Clean up collection context
      this.activeCollections.delete(activityId);

      logger.info('Activity collection completed', {
        activityId,
        status,
        executionTimeMs,
        memoryUsageMB: performanceMetrics.memoryUsageMB
      });

      return activity;

    } catch (error) {
      logger.error('Failed to complete activity collection', {
        activityId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Clean up on error
      this.activeCollections.delete(activityId);
      return null;
    }
  }

  /**
   * Collect environment context information
   */
  private async collectEnvironmentContext(context: ActivityCollectionContext): Promise<EnhancedActivityContext['environment']> {
    const gitInfo = await this.collectGitInfo(context.workingDirectory);

    return {
      os: `${os.type()} ${os.release()}`,
      nodeVersion: process.version,
      workingDirectory: context.workingDirectory || process.cwd(),
      gitBranch: context.gitBranch || gitInfo.branch,
      gitCommit: context.gitCommit || gitInfo.commit,
      sessionId: context.sessionId
    };
  }

  /**
   * Collect Git repository information
   */
  private async collectGitInfo(workingDirectory?: string): Promise<{ branch?: string; commit?: string }> {
    try {
      const cwd = workingDirectory || process.cwd();
      const [branchResult, commitResult] = await Promise.allSettled([
        execAsync('git rev-parse --abbrev-ref HEAD', { cwd }),
        execAsync('git rev-parse HEAD', { cwd })
      ]);

      return {
        branch: branchResult.status === 'fulfilled' ? branchResult.value.stdout.trim() : undefined,
        commit: commitResult.status === 'fulfilled' ? commitResult.value.stdout.trim().substring(0, 8) : undefined
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(
    executionTimeMs: number,
    context: ActivityCollectionContext
  ): Promise<PerformanceMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      executionTimeMs,
      memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
      cpuUsagePercent: Math.round((cpuUsage.user + cpuUsage.system) / 1000 / executionTimeMs * 100 * 100) / 100,
      queueTimeMs: 0 // Will be enhanced in future versions
    };
  }

  /**
   * Collect input data
   */
  private async collectInputData(context: ActivityCollectionContext): Promise<EnhancedActivityContext['inputs']> {
    return {
      parameters: context.metadata?.parameters || {},
      files: context.metadata?.inputFiles || [],
      environment: this.sanitizeEnvironmentVariables(process.env),
      commandLine: context.metadata?.commandLine
    };
  }

  /**
   * Collect output data
   */
  private async collectOutputData(
    result: any,
    context: ActivityCollectionContext
  ): Promise<EnhancedActivityContext['outputs']> {
    return {
      result: this.sanitizeOutput(result),
      filesModified: context.metadata?.filesModified || [],
      stdout: context.metadata?.stdout,
      stderr: context.metadata?.stderr,
      artifacts: context.metadata?.artifacts || []
    };
  }

  /**
   * Assess business impact of the activity
   */
  private async assessBusinessImpact(
    context: ActivityCollectionContext,
    result: any,
    error?: Error
  ): Promise<EnhancedActivityContext['impact']> {
    // Basic impact assessment - can be enhanced with ML/AI in future
    const category = this.determineImpactCategory(context);
    const scope = this.determineImpactScope(context);
    const automationLevel = this.determineAutomationLevel(context);

    let confidence = 0.7; // Base confidence
    if (error) confidence -= 0.2;
    if (result && typeof result === 'object' && Object.keys(result).length > 0) confidence += 0.1;

    return {
      category,
      scope,
      confidence: Math.max(0, Math.min(1, confidence)),
      automationLevel
    };
  }

  /**
   * Collect detailed error information
   */
  private async collectErrorDetails(
    error: Error,
    context: ActivityCollectionContext
  ): Promise<EnhancedActivityContext['error']> {
    const errorCategory = this.categorizeError(error);
    const severity = this.determineSeverity(error, errorCategory);

    return {
      category: errorCategory,
      severity,
      code: (error as any).code || 'UNKNOWN',
      message: error.message,
      stackTrace: error.stack,
      context: {
        workingDirectory: context.workingDirectory,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString()
      },
      relatedActivities: [], // Will be populated by correlation service
      recoveryActions: this.generateRecoveryActions(error, errorCategory),
      documentationLinks: this.getDocumentationLinks(errorCategory),
      similarIssues: [] // Will be populated by intelligence service
    };
  }

  /**
   * Store enhanced activity in database
   */
  private async storeEnhancedActivity(
    request: CreateEnhancedActivityRequest,
    status: string,
    additionalContext?: Record<string, any>
  ): Promise<EnhancedActivityItem> {
    const activityData = {
      userId: request.userId,
      actionName: request.action.name,
      actionDescription: request.action.description,
      targetName: request.target.name,
      targetType: request.target.type,
      status,
      priority: this.calculatePriority(request.context),
      isAutomated: request.action.automationLevel !== 'manual',
      timestamp: new Date(),
      duration: request.context.performance.executionTimeMs,
      enhancedContext: request.context,
      performanceMetrics: request.context.performance,
      inputData: request.context.inputs,
      outputData: request.context.outputs,
      errorDetails: request.context.error,
      correlationData: request.context.correlation,
      businessImpact: request.context.impact,
      metadata: additionalContext || {},
      tags: this.generateTags(request),
      projectId: this.extractProjectId(request.context)
    };

    // Use tenant context for database operations
    const activity = await this.prisma.withTenantContext(
      {
        tenantId: 'fortium-org',
        schemaName: 'fortium_schema',
        domain: 'fortium.com'
      },
      async (client) => {
        return await client.activityData.create({
          data: activityData,
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

    // Transform to enhanced activity item
    return this.transformToEnhancedActivity(activity);
  }

  /**
   * Helper methods for data processing
   */
  private sanitizeEnvironmentVariables(env: NodeJS.ProcessEnv): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveKeys = /^(.*password.*|.*secret.*|.*key.*|.*token.*|.*api.*|.*auth.*)$/i;

    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        if (sensitiveKeys.test(key)) {
          sanitized[key] = '***REDACTED***';
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  private sanitizeOutput(result: any): any {
    if (typeof result === 'string') {
      // Redact common sensitive patterns
      return result
        .replace(/password['":\s]*['"]\w+['"]/gi, 'password="***REDACTED***"')
        .replace(/token['":\s]*['"]\w+['"]/gi, 'token="***REDACTED***"')
        .replace(/key['":\s]*['"]\w+['"]/gi, 'key="***REDACTED***"');
    }

    if (typeof result === 'object' && result !== null) {
      // Deep clone and sanitize object
      const sanitized = JSON.parse(JSON.stringify(result));
      this.sanitizeObjectRecursive(sanitized);
      return sanitized;
    }

    return result;
  }

  private sanitizeObjectRecursive(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      if (/^(.*password.*|.*secret.*|.*key.*|.*token.*|.*api.*|.*auth.*)$/i.test(key)) {
        obj[key] = '***REDACTED***';
      } else if (typeof value === 'object') {
        this.sanitizeObjectRecursive(value);
      }
    }
  }

  private determineImpactCategory(context: ActivityCollectionContext): EnhancedActivityContext['impact']['category'] {
    const metadata = context.metadata || {};

    if (metadata.category) return metadata.category;
    if (metadata.action?.type === 'test_execution') return 'testing';
    if (metadata.action?.type === 'git_operation') return 'development';
    if (metadata.target?.type === 'repository') return 'development';

    return 'development'; // default
  }

  private determineImpactScope(context: ActivityCollectionContext): EnhancedActivityContext['impact']['scope'] {
    const metadata = context.metadata || {};

    if (metadata.scope) return metadata.scope;
    if (context.workflowId) return 'project';
    if (metadata.target?.type === 'repository') return 'team';

    return 'local'; // default
  }

  private determineAutomationLevel(context: ActivityCollectionContext): EnhancedActivityContext['impact']['automationLevel'] {
    const metadata = context.metadata || {};

    if (metadata.automationLevel) return metadata.automationLevel;
    if (metadata.action?.automationLevel) return metadata.action.automationLevel;

    return 'manual'; // default
  }

  private categorizeError(error: Error): EnhancedActivityContext['error']['category'] {
    const message = error.message.toLowerCase();
    const code = (error as any).code;

    if (code === 'ENOENT' || message.includes('not found')) return 'resource';
    if (code === 'EACCES' || message.includes('permission')) return 'permission';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network') || message.includes('connection')) return 'network';
    if (message.includes('syntax')) return 'syntax';

    return 'runtime';
  }

  private determineSeverity(error: Error, category: EnhancedActivityContext['error']['category']): EnhancedActivityContext['error']['severity'] {
    if (category === 'syntax') return 'medium';
    if (category === 'permission') return 'high';
    if (category === 'resource') return 'medium';
    if (category === 'network') return 'medium';
    if (category === 'timeout') return 'low';

    return 'medium';
  }

  private generateRecoveryActions(error: Error, category: EnhancedActivityContext['error']['category']): EnhancedActivityContext['error']['recoveryActions'] {
    const actions: EnhancedActivityContext['error']['recoveryActions'] = [];

    switch (category) {
      case 'permission':
        actions.push({
          description: 'Check file/directory permissions',
          automated: false,
          command: 'ls -la',
          priority: 1
        });
        break;
      case 'resource':
        actions.push({
          description: 'Verify file/resource exists',
          automated: false,
          command: 'find . -name "*target*"',
          priority: 1
        });
        break;
      case 'network':
        actions.push({
          description: 'Check network connectivity',
          automated: false,
          command: 'ping -c 3 8.8.8.8',
          priority: 1
        });
        break;
    }

    return actions;
  }

  private getDocumentationLinks(category: EnhancedActivityContext['error']['category']): string[] {
    const links: string[] = [];

    switch (category) {
      case 'permission':
        links.push('https://docs.npmjs.com/resolving-eacces-permissions-errors');
        break;
      case 'network':
        links.push('https://docs.docker.com/network/troubleshooting/');
        break;
      case 'syntax':
        links.push('https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors');
        break;
    }

    return links;
  }

  private calculatePriority(context: EnhancedActivityContext): number {
    let priority = 0; // normal

    if (context.error) {
      switch (context.error.severity) {
        case 'critical': priority = 3; break;
        case 'high': priority = 2; break;
        case 'medium': priority = 1; break;
        case 'low': priority = 0; break;
      }
    }

    if (context.impact.scope === 'organization') priority = Math.max(priority, 2);
    if (context.impact.scope === 'team') priority = Math.max(priority, 1);

    return priority;
  }

  private generateTags(request: CreateEnhancedActivityRequest): string[] {
    const tags = [
      request.action.type,
      request.action.category,
      request.target.type,
      request.context.impact.category,
      request.context.impact.automationLevel
    ];

    if (request.context.error) {
      tags.push('error', request.context.error.category);
    }

    if (request.workflowId) {
      tags.push('workflow');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  private extractProjectId(context: EnhancedActivityContext): string | undefined {
    return context.correlation.workflowContext?.projectId || context.inputs.parameters?.projectId;
  }

  private transformToEnhancedActivity(activity: any): EnhancedActivityItem {
    return {
      id: activity.id,
      userId: activity.userId,
      action: {
        type: 'command_execution', // Default, should be from context
        name: activity.actionName,
        description: activity.actionDescription,
        category: 'general',
        automationLevel: activity.isAutomated ? 'automated' : 'manual'
      },
      target: {
        name: activity.targetName,
        type: activity.targetType,
        path: activity.enhancedContext?.inputs?.files?.[0]
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

  /**
   * Get active collection contexts (for debugging/monitoring)
   */
  getActiveCollections(): Map<string, ActivityCollectionContext> {
    return new Map(this.activeCollections);
  }

  /**
   * Clean up stale collections (older than 1 hour)
   */
  async cleanupStaleCollections(): Promise<number> {
    const staleThreshold = Date.now() - (60 * 60 * 1000); // 1 hour
    let cleaned = 0;

    for (const [activityId, context] of this.activeCollections.entries()) {
      if (context.startTime < staleThreshold) {
        this.activeCollections.delete(activityId);
        cleaned++;

        logger.warn('Cleaned up stale activity collection', {
          activityId,
          startTime: new Date(context.startTime).toISOString(),
          age: Date.now() - context.startTime
        });
      }
    }

    return cleaned;
  }
}