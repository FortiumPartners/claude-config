"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsSessionService = void 0;
const metrics_model_1 = require("../models/metrics.model");
class MetricsSessionService {
    metricsModel;
    logger;
    activeSessions = new Map();
    SESSION_TIMEOUT_MS = 30 * 60 * 1000;
    CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
    constructor(db, logger) {
        this.metricsModel = new metrics_model_1.MetricsModel(db);
        this.logger = logger;
        setInterval(() => this.cleanupInactiveSessions(), this.CLEANUP_INTERVAL_MS);
    }
    async startSession(organizationId, userId, metadata) {
        try {
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
            const sessionData = {
                user_id: userId,
                context: {
                    ...metadata,
                    session_start_timestamp: new Date().toISOString(),
                    timezone: metadata?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            };
            const session = await this.metricsModel.createUserSession(organizationId, sessionData);
            const activeSessionInfo = {
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
        }
        catch (error) {
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
    async updateSessionActivity(organizationId, sessionId, activity) {
        try {
            const activeSession = this.activeSessions.get(sessionId);
            if (!activeSession) {
                const dbSession = await this.metricsModel.getUserSession(organizationId, sessionId);
                if (!dbSession || dbSession.session_end) {
                    return {
                        success: false,
                        message: 'Session not found or already ended'
                    };
                }
                const restoredSession = {
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
            const session = this.activeSessions.get(sessionId);
            if (activity.command_name) {
                session.commands_executed++;
            }
            if (activity.agent_name && !session.agents_used.includes(activity.agent_name)) {
                session.agents_used.push(activity.agent_name);
            }
            session.last_activity = new Date();
            session.duration_minutes = Math.round((session.last_activity.getTime() - session.start_time.getTime()) / (1000 * 60));
            const shouldSync = session.commands_executed % 5 === 0 ||
                (Date.now() - session.last_activity.getTime()) > 10 * 60 * 1000;
            if (shouldSync) {
                await this.syncSessionToDatabase(organizationId, session);
            }
            return { success: true };
        }
        catch (error) {
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
    async endSession(organizationId, sessionId, endMetadata) {
        try {
            const activeSession = this.activeSessions.get(sessionId);
            let session;
            if (activeSession) {
                await this.syncSessionToDatabase(organizationId, activeSession);
                session = await this.metricsModel.getUserSession(organizationId, sessionId);
            }
            else {
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
            const endTime = new Date();
            const durationMinutes = Math.round((endTime.getTime() - session.session_start.getTime()) / (1000 * 60));
            const analytics = await this.calculateSessionAnalytics(organizationId, sessionId);
            const updateData = {
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
            const updatedSession = await this.metricsModel.updateUserSession(organizationId, sessionId, updateData);
            this.activeSessions.delete(sessionId);
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
        }
        catch (error) {
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
    async getActiveSession(organizationId, userId) {
        try {
            return await this.metricsModel.getActiveUserSession(organizationId, userId);
        }
        catch (error) {
            this.logger.error('Failed to get active session', {
                organization_id: organizationId,
                user_id: userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    async getSessionSummary(organizationId, sessionId) {
        try {
            const session = await this.metricsModel.getUserSession(organizationId, sessionId);
            if (!session)
                return null;
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
        }
        catch (error) {
            this.logger.error('Failed to get session summary', {
                organization_id: organizationId,
                session_id: sessionId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    getActiveSessions(organizationId) {
        return Array.from(this.activeSessions.values())
            .filter(session => session.organization_id === organizationId);
    }
    async calculateSessionAnalytics(organizationId, sessionId) {
        const [commands, interactions] = await Promise.all([
            this.metricsModel.getSessionCommands(organizationId, sessionId),
            this.metricsModel.getSessionInteractions(organizationId, sessionId)
        ]);
        const totalExecutionTime = commands.reduce((sum, cmd) => sum + cmd.execution_time_ms, 0);
        const errorCount = commands.filter(cmd => cmd.status === 'error').length;
        const agentNames = [...new Set(interactions.map(int => int.agent_name))];
        const analytics = {
            commands_executed: commands.length,
            agents_used: agentNames,
            total_execution_time_ms: totalExecutionTime,
            average_command_time_ms: commands.length > 0 ? totalExecutionTime / commands.length : 0,
            error_count: errorCount,
            error_rate: commands.length > 0 ? errorCount / commands.length : 0,
        };
        if (commands.length > 0) {
            const successRate = 1 - analytics.error_rate;
            const avgResponseTime = analytics.average_command_time_ms;
            const agentUtilization = agentNames.length / 10;
            analytics.productivity_score = Math.round((successRate * 40) +
                (Math.min(1, 5000 / avgResponseTime) * 30) +
                (Math.min(1, agentUtilization) * 20) +
                (Math.min(1, commands.length / 50) * 10));
        }
        return analytics;
    }
    async syncSessionToDatabase(organizationId, activeSession) {
        try {
            const updateData = {
                duration_minutes: activeSession.duration_minutes,
                commands_executed: activeSession.commands_executed,
                agents_used: activeSession.agents_used,
                context: {
                    last_sync: new Date().toISOString(),
                    is_active: activeSession.is_active
                }
            };
            await this.metricsModel.updateUserSession(organizationId, activeSession.session_id, updateData);
        }
        catch (error) {
            this.logger.error('Failed to sync session to database', {
                organization_id: organizationId,
                session_id: activeSession.session_id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async cleanupInactiveSessions() {
        const now = Date.now();
        const sessionsToEnd = [];
        for (const [sessionId, session] of this.activeSessions.entries()) {
            const inactiveTime = now - session.last_activity.getTime();
            if (inactiveTime > this.SESSION_TIMEOUT_MS) {
                sessionsToEnd.push(session);
            }
        }
        for (const session of sessionsToEnd) {
            await this.endSession(session.organization_id, session.session_id, {
                completion_reason: 'timeout',
                productivity_score: undefined
            });
        }
        if (sessionsToEnd.length > 0) {
            this.logger.info('Cleaned up inactive sessions', {
                count: sessionsToEnd.length,
                timeout_minutes: this.SESSION_TIMEOUT_MS / (60 * 1000)
            });
        }
    }
    async getSessionMetrics() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const metrics = await this.metricsModel.getSessionMetrics(today);
            return {
                active_sessions: this.activeSessions.size,
                ...metrics
            };
        }
        catch (error) {
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
exports.MetricsSessionService = MetricsSessionService;
//# sourceMappingURL=metrics-session.service.js.map