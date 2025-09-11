"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostImportValidator = exports.DataValidator = void 0;
class DataValidator {
    prisma;
    tenantSchemaName;
    sessionRules;
    toolMetricRules;
    businessRules;
    constructor(prisma, tenantSchemaName) {
        this.prisma = prisma;
        this.tenantSchemaName = tenantSchemaName;
        this.sessionRules = this.createSessionValidationRules();
        this.toolMetricRules = this.createToolMetricValidationRules();
        this.businessRules = this.createBusinessValidationRules();
    }
    async validateTransformationResult(transformationResult) {
        const startTime = Date.now();
        console.log('🔍 Starting comprehensive data validation...');
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            integrityChecks: {
                sessionDataIntegrity: true,
                toolMetricConsistency: true,
                foreignKeyIntegrity: true,
                duplicateCheck: true,
                constraintValidation: true,
                businessRuleValidation: true
            },
            statistics: {
                totalRecordsValidated: transformationResult.sessions.length + transformationResult.toolMetrics.length,
                sessionRecordsValidated: transformationResult.sessions.length,
                toolMetricRecordsValidated: transformationResult.toolMetrics.length,
                validRecords: 0,
                invalidRecords: 0,
                validationTimeMs: 0
            }
        };
        try {
            console.log(`📋 Validating ${transformationResult.sessions.length} sessions...`);
            const sessionValidation = await this.validateSessions(transformationResult.sessions);
            result.errors.push(...sessionValidation.errors);
            result.warnings.push(...sessionValidation.warnings);
            result.integrityChecks.sessionDataIntegrity = sessionValidation.isValid;
            console.log(`🔧 Validating ${transformationResult.toolMetrics.length} tool metrics...`);
            const toolMetricValidation = await this.validateToolMetrics(transformationResult.toolMetrics);
            result.errors.push(...toolMetricValidation.errors);
            result.warnings.push(...toolMetricValidation.warnings);
            result.integrityChecks.toolMetricConsistency = toolMetricValidation.isValid;
            console.log('🔗 Validating foreign key relationships...');
            const foreignKeyValidation = await this.validateForeignKeys(transformationResult);
            result.errors.push(...foreignKeyValidation.errors);
            result.warnings.push(...foreignKeyValidation.warnings);
            result.integrityChecks.foreignKeyIntegrity = foreignKeyValidation.isValid;
            console.log('🔍 Checking for duplicates...');
            const duplicateValidation = await this.validateDuplicates(transformationResult);
            result.errors.push(...duplicateValidation.errors);
            result.warnings.push(...duplicateValidation.warnings);
            result.integrityChecks.duplicateCheck = duplicateValidation.isValid;
            console.log('📐 Validating database constraints...');
            const constraintValidation = await this.validateDatabaseConstraints(transformationResult);
            result.errors.push(...constraintValidation.errors);
            result.warnings.push(...constraintValidation.warnings);
            result.integrityChecks.constraintValidation = constraintValidation.isValid;
            console.log('📋 Validating business rules...');
            const businessValidation = await this.validateBusinessRules(transformationResult);
            result.errors.push(...businessValidation.errors);
            result.warnings.push(...businessValidation.warnings);
            result.integrityChecks.businessRuleValidation = businessValidation.isValid;
            result.statistics.validationTimeMs = Date.now() - startTime;
            result.statistics.invalidRecords = result.errors.length;
            result.statistics.validRecords = result.statistics.totalRecordsValidated - result.statistics.invalidRecords;
            result.isValid = result.errors.length === 0;
            console.log(`✅ Validation completed in ${result.statistics.validationTimeMs}ms`);
            console.log(`📊 Results: ${result.statistics.validRecords} valid, ${result.statistics.invalidRecords} invalid records`);
            if (result.warnings.length > 0) {
                console.warn(`⚠️  ${result.warnings.length} validation warnings`);
            }
            return result;
        }
        catch (error) {
            result.errors.push(`Validation process failed: ${error.message}`);
            result.isValid = false;
            result.statistics.validationTimeMs = Date.now() - startTime;
            return result;
        }
    }
    async validateSessions(sessions) {
        const errors = [];
        const warnings = [];
        for (const session of sessions) {
            for (const rule of this.sessionRules) {
                const issue = rule.validator(session);
                if (issue) {
                    const message = `Session ${session.id}: ${issue.message}`;
                    if (issue.severity === 'error') {
                        errors.push(message);
                    }
                    else {
                        warnings.push(message);
                    }
                }
            }
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateToolMetrics(toolMetrics) {
        const errors = [];
        const warnings = [];
        for (const metric of toolMetrics) {
            for (const rule of this.toolMetricRules) {
                const issue = rule.validator(metric);
                if (issue) {
                    const message = `Tool metric ${metric.id}: ${issue.message}`;
                    if (issue.severity === 'error') {
                        errors.push(message);
                    }
                    else {
                        warnings.push(message);
                    }
                }
            }
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateForeignKeys(data) {
        const errors = [];
        const warnings = [];
        const sessionIds = new Set(data.sessions.map(s => s.id));
        for (const metric of data.toolMetrics) {
            if (!sessionIds.has(metric.sessionId)) {
                errors.push(`Tool metric ${metric.id} references non-existent session ${metric.sessionId}`);
            }
        }
        const metricsSessionIds = new Set(data.toolMetrics.map(m => m.sessionId));
        const orphanedSessions = data.sessions.filter(s => !metricsSessionIds.has(s.id));
        if (orphanedSessions.length > 0) {
            warnings.push(`${orphanedSessions.length} sessions have no associated tool metrics`);
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateDuplicates(data) {
        const errors = [];
        const warnings = [];
        const sessionIds = data.sessions.map(s => s.id);
        const duplicateSessionIds = this.findDuplicates(sessionIds);
        for (const duplicateId of duplicateSessionIds) {
            errors.push(`Duplicate session ID found: ${duplicateId}`);
        }
        const toolMetricKeys = data.toolMetrics.map(m => `${m.sessionId}-${m.toolName}`);
        const duplicateToolKeys = this.findDuplicates(toolMetricKeys);
        for (const duplicateKey of duplicateToolKeys) {
            warnings.push(`Duplicate tool metric found: ${duplicateKey}`);
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateDatabaseConstraints(data) {
        const errors = [];
        const warnings = [];
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const session of data.sessions) {
            if (!uuidPattern.test(session.id)) {
                errors.push(`Session ID ${session.id} is not a valid UUID`);
            }
            if (!uuidPattern.test(session.userId)) {
                errors.push(`User ID ${session.userId} in session ${session.id} is not a valid UUID`);
            }
        }
        for (const metric of data.toolMetrics) {
            if (!uuidPattern.test(metric.id)) {
                errors.push(`Tool metric ID ${metric.id} is not a valid UUID`);
            }
            if (!uuidPattern.test(metric.sessionId)) {
                errors.push(`Session ID ${metric.sessionId} in tool metric ${metric.id} is not a valid UUID`);
            }
        }
        for (const session of data.sessions) {
            if (session.sessionType.length > 50) {
                errors.push(`Session type too long in session ${session.id}: ${session.sessionType.length} > 50`);
            }
            if (session.projectId && session.projectId.length > 100) {
                errors.push(`Project ID too long in session ${session.id}: ${session.projectId.length} > 100`);
            }
            if (session.description && session.description.length > 1000) {
                warnings.push(`Description may be truncated in session ${session.id}: ${session.description.length} > 1000`);
            }
        }
        for (const metric of data.toolMetrics) {
            if (metric.toolName.length > 100) {
                errors.push(`Tool name too long in metric ${metric.id}: ${metric.toolName.length} > 100`);
            }
            if (metric.toolCategory && metric.toolCategory.length > 50) {
                errors.push(`Tool category too long in metric ${metric.id}: ${metric.toolCategory.length} > 50`);
            }
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateBusinessRules(data) {
        const errors = [];
        const warnings = [];
        for (const rule of this.businessRules) {
            try {
                const issue = rule.validator(data);
                if (issue) {
                    if (issue.severity === 'error') {
                        errors.push(`Business rule violation: ${issue.message}`);
                    }
                    else {
                        warnings.push(`Business rule warning: ${issue.message}`);
                    }
                }
            }
            catch (error) {
                errors.push(`Business rule validation failed: ${rule.name} - ${error.message}`);
            }
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    createSessionValidationRules() {
        return [
            {
                name: 'required_fields',
                description: 'Session must have required fields',
                severity: 'error',
                validator: (session) => {
                    if (!session.id)
                        return { rule: 'required_fields', severity: 'error', message: 'Missing session ID' };
                    if (!session.userId)
                        return { rule: 'required_fields', severity: 'error', message: 'Missing user ID' };
                    if (!session.sessionStart)
                        return { rule: 'required_fields', severity: 'error', message: 'Missing session start time' };
                    return null;
                }
            },
            {
                name: 'valid_dates',
                description: 'Session dates must be valid',
                severity: 'error',
                validator: (session) => {
                    if (session.sessionEnd && session.sessionEnd <= session.sessionStart) {
                        return { rule: 'valid_dates', severity: 'error', message: 'Session end time must be after start time' };
                    }
                    const now = new Date();
                    if (session.sessionStart > now) {
                        return { rule: 'valid_dates', severity: 'error', message: 'Session start time cannot be in the future' };
                    }
                    return null;
                }
            },
            {
                name: 'productivity_score_range',
                description: 'Productivity score must be within valid range',
                severity: 'error',
                validator: (session) => {
                    if (session.productivityScore !== undefined &&
                        (session.productivityScore < 0 || session.productivityScore > 100)) {
                        return {
                            rule: 'productivity_score_range',
                            severity: 'error',
                            message: `Productivity score ${session.productivityScore} is outside valid range 0-100`
                        };
                    }
                    return null;
                }
            },
            {
                name: 'reasonable_duration',
                description: 'Session duration should be reasonable',
                severity: 'warning',
                validator: (session) => {
                    if (session.totalDurationMs) {
                        const hours = Number(session.totalDurationMs) / (1000 * 60 * 60);
                        if (hours > 24) {
                            return {
                                rule: 'reasonable_duration',
                                severity: 'warning',
                                message: `Session duration ${hours.toFixed(1)}h seems unusually long`
                            };
                        }
                    }
                    return null;
                }
            },
            {
                name: 'interruptions_reasonable',
                description: 'Interruption count should be reasonable',
                severity: 'warning',
                validator: (session) => {
                    if (session.interruptionsCount > 100) {
                        return {
                            rule: 'interruptions_reasonable',
                            severity: 'warning',
                            message: `Interruption count ${session.interruptionsCount} seems unusually high`
                        };
                    }
                    return null;
                }
            }
        ];
    }
    createToolMetricValidationRules() {
        return [
            {
                name: 'required_fields',
                description: 'Tool metric must have required fields',
                severity: 'error',
                validator: (metric) => {
                    if (!metric.id)
                        return { rule: 'required_fields', severity: 'error', message: 'Missing tool metric ID' };
                    if (!metric.sessionId)
                        return { rule: 'required_fields', severity: 'error', message: 'Missing session ID' };
                    if (!metric.toolName)
                        return { rule: 'required_fields', severity: 'error', message: 'Missing tool name' };
                    return null;
                }
            },
            {
                name: 'positive_counts',
                description: 'Counts must be positive',
                severity: 'error',
                validator: (metric) => {
                    if (metric.executionCount < 0) {
                        return { rule: 'positive_counts', severity: 'error', message: 'Execution count cannot be negative' };
                    }
                    if (metric.errorCount < 0) {
                        return { rule: 'positive_counts', severity: 'error', message: 'Error count cannot be negative' };
                    }
                    return null;
                }
            },
            {
                name: 'valid_success_rate',
                description: 'Success rate must be between 0 and 1',
                severity: 'error',
                validator: (metric) => {
                    if (metric.successRate < 0 || metric.successRate > 1) {
                        return {
                            rule: 'valid_success_rate',
                            severity: 'error',
                            message: `Success rate ${metric.successRate} must be between 0 and 1`
                        };
                    }
                    return null;
                }
            },
            {
                name: 'consistent_durations',
                description: 'Duration metrics should be consistent',
                severity: 'warning',
                validator: (metric) => {
                    const expectedAverage = metric.executionCount > 0 ?
                        Number(metric.totalDurationMs) / metric.executionCount : 0;
                    const actualAverage = Number(metric.averageDurationMs);
                    if (Math.abs(expectedAverage - actualAverage) > expectedAverage * 0.1) {
                        return {
                            rule: 'consistent_durations',
                            severity: 'warning',
                            message: `Average duration ${actualAverage}ms inconsistent with total ${metric.totalDurationMs}ms / count ${metric.executionCount}`
                        };
                    }
                    return null;
                }
            }
        ];
    }
    createBusinessValidationRules() {
        return [
            {
                name: 'session_tool_relationship',
                description: 'Sessions should have reasonable tool usage patterns',
                severity: 'warning',
                validator: (data) => {
                    const sessionsWithoutTools = data.sessions.filter(session => !data.toolMetrics.some(metric => metric.sessionId === session.id));
                    if (sessionsWithoutTools.length > data.sessions.length * 0.5) {
                        return {
                            rule: 'session_tool_relationship',
                            severity: 'warning',
                            message: `${sessionsWithoutTools.length} sessions have no tool usage data (${Math.round(sessionsWithoutTools.length / data.sessions.length * 100)}%)`
                        };
                    }
                    return null;
                }
            },
            {
                name: 'productivity_score_distribution',
                description: 'Productivity scores should have reasonable distribution',
                severity: 'warning',
                validator: (data) => {
                    const sessionsWithScores = data.sessions.filter(s => s.productivityScore !== undefined);
                    if (sessionsWithScores.length === 0)
                        return null;
                    const averageScore = sessionsWithScores.reduce((sum, s) => sum + s.productivityScore, 0) / sessionsWithScores.length;
                    if (averageScore < 10 || averageScore > 90) {
                        return {
                            rule: 'productivity_score_distribution',
                            severity: 'warning',
                            message: `Average productivity score ${averageScore.toFixed(1)} seems unusual`
                        };
                    }
                    return null;
                }
            },
            {
                name: 'data_volume_sanity',
                description: 'Data volumes should be reasonable',
                severity: 'warning',
                validator: (data) => {
                    const toolMetricsPerSession = data.toolMetrics.length / Math.max(1, data.sessions.length);
                    if (toolMetricsPerSession > 50) {
                        return {
                            rule: 'data_volume_sanity',
                            severity: 'warning',
                            message: `Average ${toolMetricsPerSession.toFixed(1)} tool metrics per session seems high`
                        };
                    }
                    return null;
                }
            }
        ];
    }
    findDuplicates(array) {
        const seen = new Set();
        const duplicates = new Set();
        for (const item of array) {
            if (seen.has(item)) {
                duplicates.add(item);
            }
            else {
                seen.add(item);
            }
        }
        return Array.from(duplicates);
    }
}
exports.DataValidator = DataValidator;
class PostImportValidator {
    prisma;
    tenantSchemaName;
    constructor(prisma, tenantSchemaName) {
        this.prisma = prisma;
        this.tenantSchemaName = tenantSchemaName;
    }
    async validateImportedData(originalData) {
        const startTime = Date.now();
        console.log('🔍 Validating imported data integrity...');
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            integrityChecks: {
                sessionDataIntegrity: true,
                toolMetricConsistency: true,
                foreignKeyIntegrity: true,
                duplicateCheck: true,
                constraintValidation: true,
                businessRuleValidation: true
            },
            statistics: {
                totalRecordsValidated: 0,
                sessionRecordsValidated: 0,
                toolMetricRecordsValidated: 0,
                validRecords: 0,
                invalidRecords: 0,
                validationTimeMs: 0
            }
        };
        try {
            const [sessionsCount, toolMetricsCount] = await Promise.all([
                this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${this.tenantSchemaName}".metrics_sessions`),
                this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${this.tenantSchemaName}".tool_metrics`)
            ]);
            const importedSessions = Number(sessionsCount[0].count);
            const importedToolMetrics = Number(toolMetricsCount[0].count);
            result.statistics.sessionRecordsValidated = importedSessions;
            result.statistics.toolMetricRecordsValidated = importedToolMetrics;
            result.statistics.totalRecordsValidated = importedSessions + importedToolMetrics;
            if (importedSessions !== originalData.sessions.length) {
                result.errors.push(`Session count mismatch: expected ${originalData.sessions.length}, found ${importedSessions}`);
                result.integrityChecks.sessionDataIntegrity = false;
            }
            if (importedToolMetrics !== originalData.toolMetrics.length) {
                result.errors.push(`Tool metric count mismatch: expected ${originalData.toolMetrics.length}, found ${importedToolMetrics}`);
                result.integrityChecks.toolMetricConsistency = false;
            }
            const orphanedMetrics = await this.prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count
        FROM "${this.tenantSchemaName}".tool_metrics tm
        LEFT JOIN "${this.tenantSchemaName}".metrics_sessions ms ON tm.session_id = ms.id
        WHERE ms.id IS NULL
      `);
            if (Number(orphanedMetrics[0].count) > 0) {
                result.errors.push(`Found ${orphanedMetrics[0].count} orphaned tool metrics`);
                result.integrityChecks.foreignKeyIntegrity = false;
            }
            const sampleValidation = await this.validateSampleRecords(originalData);
            result.errors.push(...sampleValidation.errors);
            result.warnings.push(...sampleValidation.warnings);
            result.statistics.validationTimeMs = Date.now() - startTime;
            result.statistics.invalidRecords = result.errors.length;
            result.statistics.validRecords = result.statistics.totalRecordsValidated - result.statistics.invalidRecords;
            result.isValid = result.errors.length === 0;
            console.log(`✅ Post-import validation completed in ${result.statistics.validationTimeMs}ms`);
            if (result.isValid) {
                console.log('✅ All integrity checks passed');
            }
            else {
                console.error(`❌ ${result.errors.length} integrity issues found`);
            }
            return result;
        }
        catch (error) {
            result.errors.push(`Post-import validation failed: ${error.message}`);
            result.isValid = false;
            result.statistics.validationTimeMs = Date.now() - startTime;
            return result;
        }
    }
    async validateSampleRecords(originalData) {
        const errors = [];
        const warnings = [];
        try {
            const sampleSessions = originalData.sessions.slice(0, 10);
            for (const originalSession of sampleSessions) {
                const importedSession = await this.prisma.$queryRawUnsafe(`
          SELECT * FROM "${this.tenantSchemaName}".metrics_sessions WHERE id = $1
        `, originalSession.id);
                if (!importedSession.length) {
                    errors.push(`Session ${originalSession.id} not found in imported data`);
                }
                else {
                    const imported = importedSession[0];
                    if (imported.user_id !== originalSession.userId) {
                        errors.push(`Session ${originalSession.id} user_id mismatch: ${imported.user_id} !== ${originalSession.userId}`);
                    }
                    if (new Date(imported.session_start).getTime() !== originalSession.sessionStart.getTime()) {
                        warnings.push(`Session ${originalSession.id} session_start time difference detected`);
                    }
                }
            }
        }
        catch (error) {
            errors.push(`Sample validation failed: ${error.message}`);
        }
        return { errors, warnings };
    }
}
exports.PostImportValidator = PostImportValidator;
//# sourceMappingURL=data-validator.js.map