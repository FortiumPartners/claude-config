"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormatConverter = void 0;
class FormatConverter {
    convertLegacySessionToModern(legacy) {
        const sessionStart = new Date(legacy.start_time);
        const sessionEnd = legacy.end_time ? new Date(legacy.end_time) : undefined;
        const totalDurationMs = sessionEnd ? sessionEnd.getTime() - sessionStart.getTime() : undefined;
        const toolsUsed = legacy.productivity_metrics?.agents_used || [];
        const focusTimeMs = (legacy.productivity_metrics?.focus_blocks || 0) * 25 * 60 * 1000;
        const productivityScore = this.calculateProductivityScore(legacy);
        const tags = [];
        if (legacy.git_branch && legacy.git_branch !== 'unknown') {
            tags.push(legacy.git_branch);
        }
        return {
            id: legacy.session_id,
            userId: this.mapUserToUserId(legacy.user),
            sessionStart,
            sessionEnd,
            totalDurationMs,
            toolsUsed,
            productivityScore,
            sessionType: 'development',
            projectId: this.extractProjectId(legacy.working_directory),
            tags,
            interruptionsCount: legacy.productivity_metrics?.interruptions || 0,
            focusTimeMs,
            description: this.generateSessionDescription(legacy),
            metadata: {
                originalUser: legacy.user,
                workingDirectory: legacy.working_directory,
                gitBranch: legacy.git_branch,
                productivityMetrics: legacy.productivity_metrics,
                qualityMetrics: legacy.quality_metrics,
                workflowMetrics: legacy.workflow_metrics
            }
        };
    }
    convertModernSessionToLegacy(modern) {
        return {
            session_id: modern.id,
            start_time: modern.sessionStart.toISOString(),
            end_time: modern.sessionEnd?.toISOString(),
            user: modern.metadata?.originalUser || this.mapUserIdToUser(modern.userId),
            working_directory: modern.metadata?.workingDirectory || '',
            git_branch: modern.metadata?.gitBranch || modern.tags[0] || 'main',
            productivity_metrics: this.reconstructProductivityMetrics(modern),
            quality_metrics: modern.metadata?.qualityMetrics || {
                tests_run: 0,
                tests_passed: 0,
                builds_attempted: 0,
                builds_successful: 0,
                reviews_requested: 0
            },
            workflow_metrics: modern.metadata?.workflowMetrics || {
                git_commits: 0,
                prs_created: 0,
                context_switches: 0
            }
        };
    }
    convertLegacyToolMetricToModern(legacy) {
        return {
            id: this.generateId(),
            sessionId: legacy.session_id || '',
            toolName: legacy.tool_name || legacy.event || 'unknown',
            toolCategory: this.categorizeToolName(legacy.tool_name || legacy.event),
            executionCount: 1,
            totalDurationMs: legacy.execution_time || 0,
            averageDurationMs: legacy.execution_time || 0,
            successRate: legacy.success !== false ? 1.0 : 0.0,
            errorCount: legacy.success === false ? 1 : 0,
            memoryUsageMb: legacy.memory_usage ? legacy.memory_usage / (1024 * 1024) : undefined,
            parameters: legacy.parameters,
            outputSizeBytes: legacy.output_size,
            commandLine: legacy.command_line,
            workingDirectory: legacy.working_directory,
            createdAt: new Date(legacy.timestamp)
        };
    }
    convertModernToolMetricToLegacy(modern) {
        return {
            event: 'tool_usage',
            timestamp: modern.createdAt?.toISOString() || new Date().toISOString(),
            session_id: modern.sessionId,
            tool_name: modern.toolName,
            execution_time: modern.averageDurationMs,
            memory_usage: modern.memoryUsageMb ? modern.memoryUsageMb * 1024 * 1024 : undefined,
            success: modern.successRate > 0.5,
            error_message: modern.successRate <= 0.5 ? 'Tool execution failed' : undefined,
            parameters: modern.parameters,
            output_size: modern.outputSizeBytes,
            command_line: modern.commandLine,
            working_directory: modern.workingDirectory
        };
    }
    aggregateLegacyToolMetrics(legacyMetrics) {
        const aggregated = new Map();
        for (const legacy of legacyMetrics) {
            const key = `${legacy.session_id}-${legacy.tool_name}`;
            if (!aggregated.has(key)) {
                const modern = this.convertLegacyToolMetricToModern(legacy);
                aggregated.set(key, modern);
            }
            else {
                const existing = aggregated.get(key);
                existing.executionCount++;
                existing.totalDurationMs += legacy.execution_time || 0;
                existing.averageDurationMs = existing.totalDurationMs / existing.executionCount;
                if (legacy.success === false) {
                    existing.errorCount++;
                }
                existing.successRate = (existing.executionCount - existing.errorCount) / existing.executionCount;
                if (legacy.memory_usage && existing.memoryUsageMb) {
                    existing.memoryUsageMb = (existing.memoryUsageMb + (legacy.memory_usage / (1024 * 1024))) / 2;
                }
                else if (legacy.memory_usage) {
                    existing.memoryUsageMb = legacy.memory_usage / (1024 * 1024);
                }
                if (legacy.output_size) {
                    existing.outputSizeBytes = (existing.outputSizeBytes || 0) + legacy.output_size;
                }
            }
        }
        return Array.from(aggregated.values());
    }
    convertAnalyticsToLegacyFormat(analytics) {
        return {
            productivity_score: analytics.averageProductivityScore || 0,
            velocity: analytics.averageVelocity || 0,
            focus_time: analytics.totalFocusTime || 0,
            session_efficiency: analytics.sessionEfficiency || 0,
            tool_usage_patterns: analytics.toolUsagePatterns || {},
            productivity_trends: (analytics.trends || []).map((trend) => ({
                date: trend.date,
                score: trend.productivityScore,
                sessions: trend.sessionCount,
                tools_used: trend.toolsUsed
            }))
        };
    }
    convertDashboardToLegacyFormat(dashboard) {
        return {
            current_session: dashboard.currentSession ? {
                session_id: dashboard.currentSession.id,
                start_time: dashboard.currentSession.sessionStart,
                user: dashboard.currentSession.metadata?.originalUser,
                productivity_score: dashboard.currentSession.productivityScore
            } : null,
            today_stats: {
                sessions: dashboard.todayStats?.sessions || 0,
                productivity_score: dashboard.todayStats?.productivityScore || 0,
                tools_used: dashboard.todayStats?.toolsUsed || [],
                focus_time_minutes: dashboard.todayStats?.focusTimeMinutes || 0
            },
            weekly_trends: dashboard.weeklyTrends || [],
            top_tools: dashboard.topTools || [],
            productivity_trend: dashboard.productivityTrend || 'stable'
        };
    }
    convertLegacySessionsBatch(legacySessions) {
        return legacySessions.map(session => this.convertLegacySessionToModern(session));
    }
    convertModernSessionsBatch(modernSessions) {
        return modernSessions.map(session => this.convertModernSessionToLegacy(session));
    }
    calculateProductivityScore(legacy) {
        if (!legacy.productivity_metrics && !legacy.quality_metrics && !legacy.workflow_metrics) {
            return undefined;
        }
        let score = 50;
        const pm = legacy.productivity_metrics;
        const qm = legacy.quality_metrics;
        const wm = legacy.workflow_metrics;
        if (pm) {
            score += Math.min(20, pm.commands_executed);
            score += Math.min(15, pm.tools_invoked * 2);
            score += Math.min(10, pm.files_modified * 3);
            score += Math.min(10, pm.focus_blocks * 5);
            score -= Math.min(15, pm.interruptions * 2);
        }
        if (qm) {
            const testSuccessRate = qm.tests_run > 0 ? qm.tests_passed / qm.tests_run : 1;
            const buildSuccessRate = qm.builds_attempted > 0 ? qm.builds_successful / qm.builds_attempted : 1;
            score += Math.round(testSuccessRate * 10);
            score += Math.round(buildSuccessRate * 10);
        }
        if (wm) {
            score += Math.min(5, wm.git_commits * 2);
            score += Math.min(5, wm.prs_created * 10);
            score -= Math.min(10, wm.context_switches);
        }
        return Math.max(0, Math.min(100, score));
    }
    reconstructProductivityMetrics(modern) {
        if (modern.metadata?.productivityMetrics) {
            return modern.metadata.productivityMetrics;
        }
        return {
            commands_executed: modern.toolsUsed?.length || 0,
            tools_invoked: modern.toolsUsed?.length || 0,
            files_read: 0,
            files_modified: 0,
            lines_changed: 0,
            agents_used: modern.toolsUsed || [],
            focus_blocks: Math.round(modern.focusTimeMs / (25 * 60 * 1000)),
            interruptions: modern.interruptionsCount
        };
    }
    mapUserToUserId(user) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(user).digest('hex');
        return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-4${hash.substr(12, 3)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
    }
    mapUserIdToUser(userId) {
        return `user_${userId.substr(0, 8)}`;
    }
    extractProjectId(workingDirectory) {
        if (!workingDirectory)
            return undefined;
        const pathParts = workingDirectory.split('/');
        return pathParts[pathParts.length - 1] || undefined;
    }
    generateSessionDescription(legacy) {
        const parts = [];
        if (legacy.git_branch && legacy.git_branch !== 'unknown') {
            parts.push(`Branch: ${legacy.git_branch}`);
        }
        if (legacy.productivity_metrics?.tools_invoked) {
            parts.push(`Tools: ${legacy.productivity_metrics.tools_invoked}`);
        }
        if (legacy.productivity_metrics?.focus_blocks) {
            parts.push(`Focus blocks: ${legacy.productivity_metrics.focus_blocks}`);
        }
        return parts.length > 0 ? parts.join(', ') : undefined;
    }
    categorizeToolName(toolName) {
        if (!toolName)
            return undefined;
        const categories = {
            'file': ['Read', 'Write', 'Edit'],
            'search': ['Grep', 'Glob', 'Task'],
            'execution': ['Bash'],
            'agent': ['general-purpose', 'code-reviewer', 'tech-lead-orchestrator']
        };
        for (const [category, tools] of Object.entries(categories)) {
            if (tools.some(tool => toolName.includes(tool))) {
                return category;
            }
        }
        return 'other';
    }
    generateId() {
        const crypto = require('crypto');
        return crypto.randomUUID();
    }
    validateLegacySession(session) {
        const errors = [];
        if (!session.session_id)
            errors.push('Missing session_id');
        if (!session.start_time)
            errors.push('Missing start_time');
        if (!session.user)
            errors.push('Missing user');
        if (session.start_time && isNaN(Date.parse(session.start_time))) {
            errors.push('Invalid start_time format');
        }
        if (session.end_time && isNaN(Date.parse(session.end_time))) {
            errors.push('Invalid end_time format');
        }
        if (session.start_time && session.end_time) {
            const start = new Date(session.start_time);
            const end = new Date(session.end_time);
            if (end <= start) {
                errors.push('end_time must be after start_time');
            }
        }
        return { isValid: errors.length === 0, errors };
    }
    validateLegacyToolMetric(metric) {
        const errors = [];
        if (!metric.event)
            errors.push('Missing event');
        if (!metric.timestamp)
            errors.push('Missing timestamp');
        if (metric.timestamp && isNaN(Date.parse(metric.timestamp))) {
            errors.push('Invalid timestamp format');
        }
        if (metric.execution_time !== undefined && (typeof metric.execution_time !== 'number' || metric.execution_time < 0)) {
            errors.push('execution_time must be a non-negative number');
        }
        if (metric.memory_usage !== undefined && (typeof metric.memory_usage !== 'number' || metric.memory_usage < 0)) {
            errors.push('memory_usage must be a non-negative number');
        }
        if (metric.output_size !== undefined && (typeof metric.output_size !== 'number' || metric.output_size < 0)) {
            errors.push('output_size must be a non-negative number');
        }
        return { isValid: errors.length === 0, errors };
    }
    wrapResponseInLegacyFormat(data, success = true, error) {
        return {
            success,
            data: success ? data : undefined,
            error: success ? undefined : error,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    }
}
exports.FormatConverter = FormatConverter;
//# sourceMappingURL=format-converter.js.map