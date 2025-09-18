/**
 * Metrics Session Service
 * Task 3.1: Session lifecycle management (start, active, end states)
 * 
 * Provides session tracking with duration calculation, timezone support,
 * and session metadata collection for analytics.
 */

import { MetricsModel } from '../models/metrics.model';
import { DatabaseConnection } from '../database/connection';
import {
  UserSession,
  UserSessionCreate,
  UserSessionUpdate,
  CommandExecution,
  AgentInteraction,
  PerformanceMetrics
} from '../types/metrics';
import * as winston from 'winston';

export interface SessionMetadata {
  user_agent?: string;
  timezone?: string;
  project_context?: string;
  claude_version?: string;
  system_info?: {
    os: string;
    node_version: string;
    memory_usage: number;
  };
  workspace_info?: {
    working_directory: string;
    git_branch?: string;
    git_commit?: string;
    project_type?: string;
  };
}

export interface SessionAnalytics {
  commands_executed: number;
  agents_used: string[];
  total_execution_time_ms: number;
  average_command_time_ms: number;
  error_count: number;
  error_rate: number;
  productivity_score?: number;
  focus_time_minutes?: number;
  interruption_count?: number;
}

export interface SessionSummary {
  session: UserSession;
  analytics: SessionAnalytics;
  commands: CommandExecution[];
  interactions: AgentInteraction[];
}

export interface ActiveSessionInfo {
  session_id: string;
  user_id: string;
  organization_id: string;
  start_time: Date;
  duration_minutes: number;
  commands_executed: number;
  agents_used: string[];
  last_activity: Date;
  is_active: boolean;
}

export class MetricsSessionService {
  private metricsModel: MetricsModel;
  private logger: winston.Logger;
  
  // Active session tracking
  private activeSessions: Map<string, ActiveSessionInfo> = new Map();
  
  // Session timeout (inactive for 30 minutes = ended)
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  
  // Cleanup interval for inactive sessions
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.metricsModel = new MetricsModel(db);
    this.logger = logger;
    
    // Start cleanup timer for inactive sessions
    setInterval(() => this.cleanupInactiveSessions(), this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Start a new user session
   * Creates session record and initializes tracking
   */
  async startSession(
    organizationId: string,
    userId: string,
    metadata?: SessionMetadata
  ): Promise<{ success: boolean; session?: UserSession; message?: string }> {
    try {
      // Check for existing active session
      const existingSession = await this.getActiveSession(organizationId, userId);
      if (existingSession) {
        this.logger.info('User already has active session', {
          organization_id: organizationId,
          user_id: userId,
          existing_session_id: existingSession.id
        });
        
        return {
          success: true,
          session: existingSession,
          message: 'Active session already exists'
        };
      }

      // Create session data
      const sessionData: UserSessionCreate = {
        user_id: userId,
        context: {
          ...metadata,
          session_start_timestamp: new Date().toISOString(),
          timezone: metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      // Store in database
      const session = await this.metricsModel.createUserSession(organizationId, sessionData);
      
      // Track in active sessions map
      const activeSessionInfo: ActiveSessionInfo = {
        session_id: session.id,
        user_id: userId,
        organization_id: organizationId,
        start_time: session.session_start,
        duration_minutes: 0,
        commands_executed: 0,
        agents_used: [],
        last_activity: new Date(),
        is_active: true
      };
      
      this.activeSessions.set(session.id, activeSessionInfo);

      this.logger.info('Session started', {
        organization_id: organizationId,
        user_id: userId,
        session_id: session.id,
        timezone: metadata?.timezone
      });

      return {
        success: true,
        session
      };

    } catch (error) {
      this.logger.error('Failed to start session', {
        organization_id: organizationId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to start session'
      };
    }
  }

  /**
   * Update session activity and metrics
   * Called when commands are executed or agents are used
   */
  async updateSessionActivity(
    organizationId: string,
    sessionId: string,
    activity: {
      command_name?: string;
      agent_name?: string;
      execution_time_ms?: number;
      status?: 'success' | 'error';
    }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const activeSession = this.activeSessions.get(sessionId);
      if (!activeSession) {
        // Try to load from database
        const dbSession = await this.metricsModel.getUserSession(organizationId, sessionId);
        if (!dbSession || dbSession.session_end) {
          return {
            success: false,
            message: 'Session not found or already ended'
          };
        }
        
        // Restore to active tracking
        const restoredSession: ActiveSessionInfo = {
          session_id: sessionId,
          user_id: dbSession.user_id,
          organization_id: organizationId,
          start_time: dbSession.session_start,
          duration_minutes: dbSession.duration_minutes || 0,
          commands_executed: dbSession.commands_executed,
          agents_used: dbSession.agents_used,
          last_activity: new Date(),
          is_active: true
        };
        
        this.activeSessions.set(sessionId, restoredSession);
      }

      const session = this.activeSessions.get(sessionId)!;
      
      // Update activity tracking
      if (activity.command_name) {
        session.commands_executed++;
      }
      
      if (activity.agent_name && !session.agents_used.includes(activity.agent_name)) {
        session.agents_used.push(activity.agent_name);
      }
      
      session.last_activity = new Date();
      session.duration_minutes = Math.round(
        (session.last_activity.getTime() - session.start_time.getTime()) / (1000 * 60)
      );

      // Update database periodically (every 5 commands or every 10 minutes)
      const shouldSync = session.commands_executed % 5 === 0 || 
                        (Date.now() - session.last_activity.getTime()) > 10 * 60 * 1000;
      
      if (shouldSync) {
        await this.syncSessionToDatabase(organizationId, session);
      }

      return { success: true };

    } catch (error) {
      this.logger.error('Failed to update session activity', {
        organization_id: organizationId,
        session_id: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update activity'
      };
    }
  }

  /**
   * End a user session
   * Calculates final metrics and closes session
   */
  async endSession(
    organizationId: string,
    sessionId: string,
    endMetadata?: {
      productivity_score?: number;
      focus_time_minutes?: number;
      interruption_count?: number;
      completion_reason?: 'user_ended' | 'timeout' | 'error';
    }
  ): Promise<{ success: boolean; summary?: SessionSummary; message?: string }> {
    try {
      const activeSession = this.activeSessions.get(sessionId);
      let session: UserSession | null;

      if (activeSession) {
        // Sync final state to database
        await this.syncSessionToDatabase(organizationId, activeSession);
        session = await this.metricsModel.getUserSession(organizationId, sessionId);
      } else {
        // Load from database
        session = await this.metricsModel.getUserSession(organizationId, sessionId);
      }

      if (!session) {
        return {
          success: false,
          message: 'Session not found'
        };
      }

      if (session.session_end) {
        return {
          success: true,
          message: 'Session already ended',
          summary: await this.getSessionSummary(organizationId, sessionId)
        };
      }

      // Calculate final session metrics
      const endTime = new Date();
      const durationMinutes = Math.round(
        (endTime.getTime() - session.session_start.getTime()) / (1000 * 60)
      );

      // Get session analytics
      const analytics = await this.calculateSessionAnalytics(organizationId, sessionId);

      // Update session with final data
      const updateData: UserSessionUpdate = {
        session_end: endTime,
        duration_minutes: durationMinutes,
        commands_executed: analytics.commands_executed,
        agents_used: analytics.agents_used,
        productivity_score: endMetadata?.productivity_score || analytics.productivity_score,
        context: {
          ...(session.context || {}),
          end_metadata: endMetadata,
          final_analytics: analytics
        }
      };

      const updatedSession = await this.metricsModel.updateUserSession(
        organizationId,
        sessionId,
        updateData
      );

      // Remove from active tracking
      this.activeSessions.delete(sessionId);

      // Generate session summary
      const summary = await this.getSessionSummary(organizationId, sessionId);

      this.logger.info('Session ended', {
        organization_id: organizationId,
        session_id: sessionId,
        duration_minutes: durationMinutes,
        commands_executed: analytics.commands_executed,
        agents_used: analytics.agents_used.length,
        productivity_score: updateData.productivity_score
      });

      return {
        success: true,
        summary
      };

    } catch (error) {
      this.logger.error('Failed to end session', {
        organization_id: organizationId,
        session_id: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to end session'
      };
    }
  }

  /**
   * Get active session for user
   */
  async getActiveSession(organizationId: string, userId: string): Promise<UserSession | null> {
    try {
      return await this.metricsModel.getActiveUserSession(organizationId, userId);
    } catch (error) {
      this.logger.error('Failed to get active session', {
        organization_id: organizationId,
        user_id: userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get session summary with analytics
   */
  async getSessionSummary(organizationId: string, sessionId: string): Promise<SessionSummary | null> {
    try {
      const session = await this.metricsModel.getUserSession(organizationId, sessionId);
      if (!session) return null;

      const [analytics, commands, interactions] = await Promise.all([
        this.calculateSessionAnalytics(organizationId, sessionId),
        this.metricsModel.getSessionCommands(organizationId, sessionId),
        this.metricsModel.getSessionInteractions(organizationId, sessionId)
      ]);

      return {
        session,
        analytics,
        commands,
        interactions
      };

    } catch (error) {
      this.logger.error('Failed to get session summary', {
        organization_id: organizationId,
        session_id: sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Get all active sessions for organization
   */
  getActiveSessions(organizationId: string): ActiveSessionInfo[] {
    return Array.from(this.activeSessions.values())
      .filter(session => session.organization_id === organizationId);
  }

  /**
   * Calculate session analytics
   */
  private async calculateSessionAnalytics(
    organizationId: string,
    sessionId: string
  ): Promise<SessionAnalytics> {
    const [commands, interactions] = await Promise.all([
      this.metricsModel.getSessionCommands(organizationId, sessionId),
      this.metricsModel.getSessionInteractions(organizationId, sessionId)
    ]);

    const totalExecutionTime = commands.reduce((sum, cmd) => sum + cmd.execution_time_ms, 0);
    const errorCount = commands.filter(cmd => cmd.status === 'error').length;
    const agentNames = [...new Set(interactions.map(int => int.agent_name))];

    const analytics: SessionAnalytics = {
      commands_executed: commands.length,
      agents_used: agentNames,
      total_execution_time_ms: totalExecutionTime,
      average_command_time_ms: commands.length > 0 ? totalExecutionTime / commands.length : 0,
      error_count: errorCount,
      error_rate: commands.length > 0 ? errorCount / commands.length : 0,
    };

    // Calculate productivity score (0-100)
    if (commands.length > 0) {
      const successRate = 1 - analytics.error_rate;
      const avgResponseTime = analytics.average_command_time_ms;
      const agentUtilization = agentNames.length / 10; // Normalize to max 10 agents
      
      // Weighted productivity score
      analytics.productivity_score = Math.round(
        (successRate * 40) +                    // 40% weight for success rate
        (Math.min(1, 5000 / avgResponseTime) * 30) +  // 30% weight for speed (5s baseline)
        (Math.min(1, agentUtilization) * 20) +  // 20% weight for agent diversity
        (Math.min(1, commands.length / 50) * 10)      // 10% weight for activity volume
      );
    }

    return analytics;
  }

  /**
   * Sync active session data to database
   */
  private async syncSessionToDatabase(
    organizationId: string,
    activeSession: ActiveSessionInfo
  ): Promise<void> {
    try {
      const updateData: UserSessionUpdate = {
        duration_minutes: activeSession.duration_minutes,
        commands_executed: activeSession.commands_executed,
        agents_used: activeSession.agents_used,
        context: {
          last_sync: new Date().toISOString(),
          is_active: activeSession.is_active
        }
      };

      await this.metricsModel.updateUserSession(
        organizationId,
        activeSession.session_id,
        updateData
      );

    } catch (error) {
      this.logger.error('Failed to sync session to database', {
        organization_id: organizationId,
        session_id: activeSession.session_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Cleanup inactive sessions
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const sessionsToEnd: ActiveSessionInfo[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      const inactiveTime = now - session.last_activity.getTime();
      
      if (inactiveTime > this.SESSION_TIMEOUT_MS) {
        sessionsToEnd.push(session);
      }
    }

    // End inactive sessions
    for (const session of sessionsToEnd) {
      await this.endSession(
        session.organization_id,
        session.session_id,
        {
          completion_reason: 'timeout',
          productivity_score: undefined // Will be calculated
        }
      );
    }

    if (sessionsToEnd.length > 0) {
      this.logger.info('Cleaned up inactive sessions', {
        count: sessionsToEnd.length,
        timeout_minutes: this.SESSION_TIMEOUT_MS / (60 * 1000)
      });
    }
  }

  /**
   * Get session performance metrics
   */
  async getSessionMetrics(): Promise<{
    active_sessions: number;
    total_sessions_today: number;
    average_session_duration_minutes: number;
    average_commands_per_session: number;
    average_productivity_score: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const metrics = await this.metricsModel.getSessionMetrics(today);
      
      return {
        active_sessions: this.activeSessions.size,
        ...metrics
      };

    } catch (error) {
      this.logger.error('Failed to get session metrics', error);
      return {
        active_sessions: this.activeSessions.size,
        total_sessions_today: 0,
        average_session_duration_minutes: 0,
        average_commands_per_session: 0,
        average_productivity_score: 0
      };
    }
  }
}