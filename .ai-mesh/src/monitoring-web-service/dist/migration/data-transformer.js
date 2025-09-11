"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataTransformer = void 0;
exports.createDefaultTransformer = createDefaultTransformer;
class DataTransformer {
    options;
    userCache = new Map();
    sessionCache = new Set();
    constructor(options) {
        this.options = options;
    }
    async transform(parseResult) {
        const startTime = Date.now();
        console.log(`🔄 Starting data transformation for tenant: ${this.options.tenantId}`);
        const result = {
            sessions: [],
            toolMetrics: [],
            userMappings: [],
            errors: [],
            statistics: {
                originalSessions: parseResult.sessions.length,
                transformedSessions: 0,
                originalToolMetrics: parseResult.toolMetrics.length,
                transformedToolMetrics: 0,
                duplicatesRemoved: 0,
                invalidRecordsSkipped: 0,
                usersIdentified: 0
            }
        };
        try {
            console.log('👥 Processing user mappings...');
            await this.processUsers(parseResult, result);
            console.log('📋 Transforming sessions...');
            await this.transformSessions(parseResult.sessions, result);
            console.log('🔧 Transforming tool metrics...');
            await this.transformToolMetrics(parseResult.toolMetrics, result);
            console.log('🔍 Applying deduplication strategies...');
            await this.deduplicateData(result);
            console.log('✅ Validating transformed data...');
            await this.validateTransformedData(result);
            const processingTime = Date.now() - startTime;
            console.log(`✅ Transformation completed in ${processingTime}ms`);
            console.log(`📊 Sessions: ${result.statistics.originalSessions} → ${result.statistics.transformedSessions}`);
            console.log(`🔧 Tool Metrics: ${result.statistics.originalToolMetrics} → ${result.statistics.transformedToolMetrics}`);
            console.log(`👥 Users: ${result.statistics.usersIdentified} identified`);
            console.log(`❌ Errors: ${result.errors.length}`);
            return result;
        }
        catch (error) {
            result.errors.push({
                type: 'session',
                recordId: 'global',
                error: `Global transformation error: ${error.message}`,
                originalData: error
            });
            return result;
        }
    }
    async processUsers(parseResult, result) {
        const localUsers = new Set();
        for (const session of parseResult.sessions) {
            if (session.metadata?.user) {
                localUsers.add(session.metadata.user);
            }
        }
        for (const localUser of localUsers) {
            try {
                let cloudUserId;
                switch (this.options.userMappingStrategy) {
                    case 'create':
                        cloudUserId = await this.createCloudUser(localUser);
                        break;
                    case 'map':
                        cloudUserId = await this.mapExistingUser(localUser);
                        break;
                    case 'default':
                        cloudUserId = this.options.defaultUserId || 'default-user-id';
                        break;
                    default:
                        throw new Error(`Unknown user mapping strategy: ${this.options.userMappingStrategy}`);
                }
                this.userCache.set(localUser, cloudUserId);
                result.userMappings.push({
                    localUser,
                    cloudUserId,
                    email: this.inferEmailFromUser(localUser),
                    firstName: this.inferFirstName(localUser),
                    lastName: this.inferLastName(localUser),
                    role: 'developer'
                });
                result.statistics.usersIdentified++;
            }
            catch (error) {
                result.errors.push({
                    type: 'user',
                    recordId: localUser,
                    error: `User mapping error: ${error.message}`,
                    originalData: { localUser }
                });
            }
        }
    }
    async transformSessions(parsedSessions, result) {
        for (const parsed of parsedSessions) {
            try {
                if (this.sessionCache.has(parsed.sessionId)) {
                    result.statistics.duplicatesRemoved++;
                    continue;
                }
                const validationResult = this.validateSession(parsed);
                if (!validationResult.isValid) {
                    result.errors.push({
                        type: 'session',
                        recordId: parsed.sessionId,
                        error: `Session validation failed: ${validationResult.errors.join(', ')}`,
                        originalData: parsed
                    });
                    result.statistics.invalidRecordsSkipped++;
                    continue;
                }
                const localUser = parsed.metadata?.user || 'unknown';
                const userId = this.userCache.get(localUser) || this.options.defaultUserId || 'default-user-id';
                const transformed = {
                    id: parsed.sessionId,
                    userId,
                    sessionStart: parsed.sessionStart,
                    sessionEnd: parsed.sessionEnd,
                    totalDurationMs: parsed.totalDurationMs ? BigInt(parsed.totalDurationMs) : undefined,
                    toolsUsed: parsed.toolsUsed.length > 0 ? parsed.toolsUsed : null,
                    productivityScore: this.normalizeProductivityScore(parsed.productivityScore),
                    sessionType: parsed.sessionType || 'development',
                    projectId: this.sanitizeProjectId(parsed.projectId),
                    tags: parsed.tags.length > 0 ? parsed.tags : [],
                    interruptionsCount: Math.max(0, parsed.interruptionsCount),
                    focusTimeMs: BigInt(Math.max(0, parsed.focusTimeMs)),
                    description: this.sanitizeDescription(parsed.description)
                };
                result.sessions.push(transformed);
                this.sessionCache.add(parsed.sessionId);
                result.statistics.transformedSessions++;
            }
            catch (error) {
                result.errors.push({
                    type: 'session',
                    recordId: parsed.sessionId,
                    error: `Session transformation error: ${error.message}`,
                    originalData: parsed
                });
            }
        }
    }
    async transformToolMetrics(parsedMetrics, result) {
        const processedKeys = new Set();
        for (const parsed of parsedMetrics) {
            try {
                if (!this.sessionCache.has(parsed.sessionId)) {
                    result.errors.push({
                        type: 'toolMetric',
                        recordId: `${parsed.sessionId}-${parsed.toolName}`,
                        error: 'Tool metric references non-existent session',
                        originalData: parsed
                    });
                    continue;
                }
                const deduplicationKey = `${parsed.sessionId}-${parsed.toolName}`;
                if (processedKeys.has(deduplicationKey)) {
                    result.statistics.duplicatesRemoved++;
                    continue;
                }
                const validationResult = this.validateToolMetric(parsed);
                if (!validationResult.isValid) {
                    result.errors.push({
                        type: 'toolMetric',
                        recordId: deduplicationKey,
                        error: `Tool metric validation failed: ${validationResult.errors.join(', ')}`,
                        originalData: parsed
                    });
                    result.statistics.invalidRecordsSkipped++;
                    continue;
                }
                const transformed = {
                    id: this.generateId(),
                    sessionId: parsed.sessionId,
                    toolName: this.sanitizeToolName(parsed.toolName),
                    toolCategory: parsed.toolCategory,
                    executionCount: Math.max(1, parsed.executionCount),
                    totalDurationMs: BigInt(Math.max(0, parsed.totalDurationMs)),
                    averageDurationMs: BigInt(Math.max(0, parsed.averageDurationMs)),
                    successRate: Math.min(1.0, Math.max(0.0, parsed.successRate)),
                    errorCount: Math.max(0, parsed.errorCount),
                    memoryUsageMb: parsed.memoryUsageMb ? Math.max(0, parsed.memoryUsageMb) : undefined,
                    cpuTimeMs: parsed.cpuTimeMs ? BigInt(Math.max(0, parsed.cpuTimeMs)) : undefined,
                    parameters: parsed.parameters,
                    outputSizeBytes: parsed.outputSizeBytes ? BigInt(Math.max(0, parsed.outputSizeBytes)) : undefined,
                    commandLine: this.sanitizeCommandLine(parsed.commandLine),
                    workingDirectory: this.sanitizeWorkingDirectory(parsed.workingDirectory)
                };
                result.toolMetrics.push(transformed);
                processedKeys.add(deduplicationKey);
                result.statistics.transformedToolMetrics++;
            }
            catch (error) {
                result.errors.push({
                    type: 'toolMetric',
                    recordId: `${parsed.sessionId}-${parsed.toolName}`,
                    error: `Tool metric transformation error: ${error.message}`,
                    originalData: parsed
                });
            }
        }
    }
    async deduplicateData(result) {
        if (this.options.deduplicationStrategy === 'none')
            return;
        const originalSessionCount = result.sessions.length;
        const originalToolMetricCount = result.toolMetrics.length;
        if (this.options.deduplicationStrategy === 'strict') {
            const sessionMap = new Map();
            for (const session of result.sessions) {
                sessionMap.set(session.id, session);
            }
            result.sessions = Array.from(sessionMap.values());
            const toolMetricMap = new Map();
            for (const metric of result.toolMetrics) {
                const key = `${metric.sessionId}-${metric.toolName}`;
                if (!toolMetricMap.has(key)) {
                    toolMetricMap.set(key, metric);
                }
            }
            result.toolMetrics = Array.from(toolMetricMap.values());
        }
        else if (this.options.deduplicationStrategy === 'loose') {
            result.sessions = this.deduplicateSessionsByTimeWindow(result.sessions, 5 * 60 * 1000);
        }
        const sessionsRemoved = originalSessionCount - result.sessions.length;
        const metricsRemoved = originalToolMetricCount - result.toolMetrics.length;
        result.statistics.duplicatesRemoved += sessionsRemoved + metricsRemoved;
    }
    async validateTransformedData(result) {
        if (!this.options.validateConstraints)
            return;
        for (const session of result.sessions) {
            if (!session.id || !session.userId) {
                result.errors.push({
                    type: 'session',
                    recordId: session.id || 'unknown',
                    error: 'Missing required fields after transformation'
                });
            }
            if (session.totalDurationMs) {
                const durationHours = Number(session.totalDurationMs) / (1000 * 60 * 60);
                if (durationHours > this.options.maxSessionDurationHours) {
                    result.errors.push({
                        type: 'session',
                        recordId: session.id,
                        error: `Session duration ${durationHours}h exceeds maximum ${this.options.maxSessionDurationHours}h`
                    });
                }
            }
        }
        const sessionIds = new Set(result.sessions.map(s => s.id));
        for (const metric of result.toolMetrics) {
            if (!sessionIds.has(metric.sessionId)) {
                result.errors.push({
                    type: 'toolMetric',
                    recordId: metric.id,
                    error: 'Tool metric references non-existent session after transformation'
                });
            }
        }
    }
    validateSession(session) {
        const errors = [];
        if (!session.sessionId)
            errors.push('Missing session ID');
        if (!session.sessionStart)
            errors.push('Missing session start time');
        if (session.sessionEnd && session.sessionStart) {
            const duration = session.sessionEnd.getTime() - session.sessionStart.getTime();
            if (duration < this.options.minSessionDurationMs) {
                errors.push(`Session duration ${duration}ms is below minimum ${this.options.minSessionDurationMs}ms`);
            }
            if (duration > this.options.maxSessionDurationHours * 60 * 60 * 1000) {
                errors.push(`Session duration exceeds maximum ${this.options.maxSessionDurationHours} hours`);
            }
        }
        if (session.productivityScore !== undefined) {
            if (session.productivityScore < 0 || session.productivityScore > 100) {
                errors.push(`Productivity score ${session.productivityScore} is outside valid range 0-100`);
            }
        }
        return { isValid: errors.length === 0, errors };
    }
    validateToolMetric(metric) {
        const errors = [];
        if (!metric.sessionId)
            errors.push('Missing session ID');
        if (!metric.toolName)
            errors.push('Missing tool name');
        if (metric.executionCount < 0)
            errors.push('Execution count cannot be negative');
        if (metric.successRate < 0 || metric.successRate > 1)
            errors.push('Success rate must be between 0 and 1');
        if (metric.errorCount < 0)
            errors.push('Error count cannot be negative');
        return { isValid: errors.length === 0, errors };
    }
    async createCloudUser(localUser) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(localUser).digest('hex');
        return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-4${hash.substr(12, 3)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
    }
    async mapExistingUser(localUser) {
        return this.createCloudUser(localUser);
    }
    inferEmailFromUser(localUser) {
        if (localUser.includes('@'))
            return localUser;
        return `${localUser}@example.com`;
    }
    inferFirstName(localUser) {
        const parts = localUser.split(/[._-]/);
        return parts[0] || localUser;
    }
    inferLastName(localUser) {
        const parts = localUser.split(/[._-]/);
        return parts[1] || 'User';
    }
    normalizeProductivityScore(score) {
        if (score === undefined)
            return undefined;
        if (score >= 0 && score <= 1) {
            return Math.round(score * 100);
        }
        if (score >= 0 && score <= 100) {
            return Math.round(score);
        }
        return Math.max(0, Math.min(100, Math.round(score)));
    }
    sanitizeProjectId(projectId) {
        if (!projectId)
            return undefined;
        return projectId.replace(/[^a-zA-Z0-9_-]/g, '_').substr(0, 100);
    }
    sanitizeDescription(description) {
        if (!description)
            return undefined;
        return description.substr(0, 500);
    }
    sanitizeToolName(toolName) {
        return toolName.replace(/[^\w-]/g, '_').substr(0, 100);
    }
    sanitizeCommandLine(commandLine) {
        if (!commandLine)
            return undefined;
        return commandLine.substr(0, 1000);
    }
    sanitizeWorkingDirectory(workingDirectory) {
        if (!workingDirectory)
            return undefined;
        return workingDirectory.substr(0, 500);
    }
    generateId() {
        const crypto = require('crypto');
        return crypto.randomUUID();
    }
    deduplicateSessionsByTimeWindow(sessions, windowMs) {
        const sorted = sessions.sort((a, b) => a.sessionStart.getTime() - b.sessionStart.getTime());
        const deduplicated = [];
        let lastSession = null;
        for (const session of sorted) {
            if (!lastSession ||
                session.sessionStart.getTime() - lastSession.sessionStart.getTime() > windowMs ||
                session.userId !== lastSession.userId) {
                deduplicated.push(session);
                lastSession = session;
            }
        }
        return deduplicated;
    }
}
exports.DataTransformer = DataTransformer;
function createDefaultTransformer(tenantId, options = {}) {
    const defaultOptions = {
        tenantId,
        userMappingStrategy: 'create',
        deduplicationStrategy: 'strict',
        timeZone: 'UTC',
        validateConstraints: true,
        maxSessionDurationHours: 24,
        minSessionDurationMs: 1000,
        ...options
    };
    return new DataTransformer(defaultOptions);
}
//# sourceMappingURL=data-transformer.js.map