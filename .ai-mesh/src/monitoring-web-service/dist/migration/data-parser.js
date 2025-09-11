"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDataParser = void 0;
exports.parseDefaultMetricsLocation = parseDefaultMetricsLocation;
exports.validateParsedData = validateParsedData;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const glob_1 = require("glob");
class LocalDataParser {
    metricsDir;
    options;
    constructor(metricsDir, options = {}) {
        this.metricsDir = metricsDir;
        this.options = {
            batchSize: 1000,
            maxMemoryMB: 500,
            validateData: true,
            includeErrorLogs: true,
            timeRange: undefined,
            ...options
        };
    }
    async parseAllFiles() {
        const startTime = Date.now();
        const result = {
            sessions: [],
            toolMetrics: [],
            errors: [],
            statistics: {
                totalFiles: 0,
                processedRecords: 0,
                sessionCount: 0,
                toolMetricCount: 0,
                timeRange: {
                    earliest: new Date(),
                    latest: new Date(0)
                },
                memoryUsageKB: 0
            }
        };
        try {
            const sessionFiles = await this.findSessionFiles();
            const toolFiles = await this.findToolMetricFiles();
            const analyticsFiles = await this.findAnalyticsFiles();
            result.statistics.totalFiles = sessionFiles.length + toolFiles.length + analyticsFiles.length;
            console.log(`📊 Processing ${sessionFiles.length} session files...`);
            for (const file of sessionFiles) {
                try {
                    const sessions = await this.parseSessionFile(file);
                    result.sessions.push(...sessions);
                    result.statistics.sessionCount += sessions.length;
                    sessions.forEach(session => {
                        if (session.sessionStart < result.statistics.timeRange.earliest) {
                            result.statistics.timeRange.earliest = session.sessionStart;
                        }
                        if (session.sessionEnd && session.sessionEnd > result.statistics.timeRange.latest) {
                            result.statistics.timeRange.latest = session.sessionEnd;
                        }
                    });
                }
                catch (error) {
                    result.errors.push({
                        file,
                        error: `Session file parse error: ${error.message}`,
                        data: error
                    });
                }
            }
            console.log(`🔧 Processing ${toolFiles.length} tool metric files...`);
            for (const file of toolFiles) {
                try {
                    const metrics = await this.parseToolMetricFile(file);
                    result.toolMetrics.push(...metrics);
                    result.statistics.toolMetricCount += metrics.length;
                }
                catch (error) {
                    result.errors.push({
                        file,
                        error: `Tool metric file parse error: ${error.message}`,
                        data: error
                    });
                }
            }
            console.log(`📈 Processing ${analyticsFiles.length} analytics files...`);
            for (const file of analyticsFiles) {
                try {
                    await this.parseAnalyticsFile(file, result.sessions);
                }
                catch (error) {
                    result.errors.push({
                        file,
                        error: `Analytics file parse error: ${error.message}`,
                        data: error
                    });
                }
            }
            result.statistics.processedRecords = result.sessions.length + result.toolMetrics.length;
            result.statistics.memoryUsageKB = Math.round(process.memoryUsage().heapUsed / 1024);
            const processingTimeMs = Date.now() - startTime;
            console.log(`✅ Parsing completed in ${processingTimeMs}ms`);
            console.log(`📊 Parsed ${result.statistics.sessionCount} sessions, ${result.statistics.toolMetricCount} tool metrics`);
            console.log(`⚠️  ${result.errors.length} parsing errors encountered`);
            return result;
        }
        catch (error) {
            result.errors.push({
                file: 'global',
                error: `Global parsing error: ${error.message}`,
                data: error
            });
            return result;
        }
    }
    async findSessionFiles() {
        const patterns = [
            path.join(this.metricsDir, 'sessions', '*.json'),
            path.join(this.metricsDir, 'sessions', '*.jsonl'),
            path.join(this.metricsDir, '**', '*session*.json*'),
            path.join(this.metricsDir, 'productivity-indicators.json')
        ];
        const files = [];
        for (const pattern of patterns) {
            const matches = await (0, glob_1.glob)(pattern);
            files.push(...matches.filter(f => fs.existsSync(f)));
        }
        return [...new Set(files)];
    }
    async findToolMetricFiles() {
        const patterns = [
            path.join(this.metricsDir, 'realtime', 'activity.log'),
            path.join(this.metricsDir, 'realtime.log'),
            path.join(this.metricsDir, '**', '*tool*.json*'),
            path.join(this.metricsDir, '**', '*.jsonl')
        ];
        const files = [];
        for (const pattern of patterns) {
            const matches = await (0, glob_1.glob)(pattern);
            files.push(...matches.filter(f => fs.existsSync(f) && !f.includes('session')));
        }
        return [...new Set(files)];
    }
    async findAnalyticsFiles() {
        const patterns = [
            path.join(this.metricsDir, 'historical-baseline.json'),
            path.join(this.metricsDir, 'current-baseline.json'),
            path.join(this.metricsDir, '**', '*analytics*.json'),
            path.join(this.metricsDir, '**', '*productivity*.json'),
            path.join(this.metricsDir, '**', '*performance*.json')
        ];
        const files = [];
        for (const pattern of patterns) {
            const matches = await (0, glob_1.glob)(pattern);
            files.push(...matches.filter(f => fs.existsSync(f)));
        }
        return [...new Set(files)];
    }
    async parseSessionFile(filePath) {
        const sessions = [];
        const isJSONL = filePath.endsWith('.jsonl');
        if (isJSONL) {
            const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            let lineNumber = 0;
            for await (const line of rl) {
                lineNumber++;
                if (line.trim()) {
                    try {
                        const data = JSON.parse(line);
                        const session = this.transformSessionData(data, filePath);
                        if (session)
                            sessions.push(session);
                    }
                    catch (error) {
                        if (this.options.includeErrorLogs) {
                            console.warn(`Warning: Invalid JSON at ${filePath}:${lineNumber}`);
                        }
                    }
                }
            }
        }
        else {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (Array.isArray(data)) {
                for (const sessionData of data) {
                    const session = this.transformSessionData(sessionData, filePath);
                    if (session)
                        sessions.push(session);
                }
            }
            else {
                const session = this.transformSessionData(data, filePath);
                if (session)
                    sessions.push(session);
            }
        }
        return sessions;
    }
    async parseToolMetricFile(filePath) {
        const toolMetrics = [];
        const sessionMetrics = new Map();
        if (filePath.endsWith('.log')) {
            return this.parseLogFile(filePath);
        }
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        for await (const line of rl) {
            if (line.trim()) {
                try {
                    const data = JSON.parse(line);
                    if (data.tool_name && data.session_id) {
                        const key = `${data.session_id}-${data.tool_name}`;
                        if (!sessionMetrics.has(key)) {
                            sessionMetrics.set(key, {
                                sessionId: data.session_id,
                                toolName: data.tool_name,
                                executions: [],
                                totalDuration: 0,
                                errors: 0,
                                memoryUsages: [],
                                parameters: [],
                                timestamps: []
                            });
                        }
                        const metric = sessionMetrics.get(key);
                        metric.executions.push(data.execution_time || 0);
                        metric.totalDuration += data.execution_time || 0;
                        metric.timestamps.push(new Date(data.timestamp));
                        if (!data.success)
                            metric.errors++;
                        if (data.memory_usage)
                            metric.memoryUsages.push(data.memory_usage);
                        if (data.parameters)
                            metric.parameters.push(data.parameters);
                    }
                }
                catch (error) {
                    continue;
                }
            }
        }
        for (const [, data] of sessionMetrics) {
            const metric = {
                sessionId: data.sessionId,
                toolName: data.toolName,
                toolCategory: this.categorizeToolName(data.toolName),
                executionCount: data.executions.length,
                totalDurationMs: data.totalDuration,
                averageDurationMs: data.executions.length > 0 ?
                    Math.round(data.totalDuration / data.executions.length) : 0,
                successRate: data.executions.length > 0 ?
                    (data.executions.length - data.errors) / data.executions.length : 1.0,
                errorCount: data.errors,
                memoryUsageMb: data.memoryUsages.length > 0 ?
                    Math.round(data.memoryUsages.reduce((a, b) => a + b, 0) / data.memoryUsages.length / 1024 / 1024) :
                    undefined,
                timestamps: data.timestamps
            };
            toolMetrics.push(metric);
        }
        return toolMetrics;
    }
    async parseAnalyticsFile(filePath, sessions) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.productivity_score !== undefined) {
                const recentSession = sessions
                    .filter(s => s.sessionEnd)
                    .sort((a, b) => b.sessionEnd.getTime() - a.sessionEnd.getTime())[0];
                if (recentSession && typeof data.productivity_score === 'number') {
                    recentSession.productivityScore = Math.round(data.productivity_score * 10);
                }
            }
            if (data.productivity_trends && Array.isArray(data.productivity_trends)) {
                for (const trend of data.productivity_trends) {
                    if (trend.session_id) {
                        const session = sessions.find(s => s.sessionId === trend.session_id);
                        if (session && trend.score) {
                            session.productivityScore = Math.round(trend.score * 10);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.warn(`Warning: Could not parse analytics file ${filePath}: ${error.message}`);
        }
    }
    async parseLogFile(filePath) {
        const metrics = [];
        const lines = fs.readFileSync(filePath, 'utf8').split('\n');
        const toolUsagePattern = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*?)\|([^|]+)\|([^|]+)\|(.+)/;
        const sessionTools = new Map();
        for (const line of lines) {
            const match = line.match(toolUsagePattern);
            if (match) {
                const [, timestamp, sessionId, toolName] = match;
                try {
                    const date = new Date(timestamp);
                    const key = `${sessionId}-${toolName}`;
                    if (!sessionTools.has(key)) {
                        sessionTools.set(key, {
                            sessionId,
                            toolName,
                            count: 0,
                            timestamps: []
                        });
                    }
                    const tool = sessionTools.get(key);
                    tool.count++;
                    tool.timestamps.push(date);
                }
                catch (error) {
                    continue;
                }
            }
        }
        for (const [, data] of sessionTools) {
            metrics.push({
                sessionId: data.sessionId,
                toolName: data.toolName,
                toolCategory: this.categorizeToolName(data.toolName),
                executionCount: data.count,
                totalDurationMs: 0,
                averageDurationMs: 0,
                successRate: 1.0,
                errorCount: 0,
                timestamps: data.timestamps
            });
        }
        return metrics;
    }
    transformSessionData(data, filePath) {
        try {
            let sessionId;
            let startTime;
            let endTime;
            let toolsUsed = [];
            let productivityScore;
            let interruptionsCount = 0;
            let focusTimeMs = 0;
            if (data.session_id) {
                sessionId = data.session_id;
                startTime = new Date(data.start_time);
                endTime = data.end_time ? new Date(data.end_time) : undefined;
                if (data.productivity_metrics) {
                    interruptionsCount = data.productivity_metrics.interruptions || 0;
                    toolsUsed = data.productivity_metrics.agents_used || [];
                    focusTimeMs = (data.productivity_metrics.focus_blocks || 0) * 25 * 60 * 1000;
                }
                if (data.productivity_score !== undefined) {
                    productivityScore = Math.round(data.productivity_score * 10);
                }
            }
            else if (data.sessionId || data.id) {
                sessionId = data.sessionId || data.id;
                startTime = new Date(data.startTime || data.created_at || data.timestamp);
                endTime = data.endTime ? new Date(data.endTime) : undefined;
                toolsUsed = data.tools || data.toolsUsed || [];
                productivityScore = data.productivityScore || data.score;
                interruptionsCount = data.interruptions || 0;
                focusTimeMs = data.focusTime || 0;
            }
            else {
                return null;
            }
            if (this.options.timeRange) {
                if (startTime < this.options.timeRange.start || startTime > this.options.timeRange.end) {
                    return null;
                }
            }
            const totalDurationMs = endTime ? endTime.getTime() - startTime.getTime() : undefined;
            return {
                sessionId,
                sessionStart: startTime,
                sessionEnd: endTime,
                totalDurationMs,
                toolsUsed,
                productivityScore,
                sessionType: 'development',
                projectId: data.working_directory ? path.basename(data.working_directory) : undefined,
                tags: data.git_branch ? [data.git_branch] : [],
                interruptionsCount,
                focusTimeMs,
                description: data.description,
                metadata: {
                    user: data.user,
                    workingDirectory: data.working_directory,
                    gitBranch: data.git_branch,
                    originalFile: path.basename(filePath),
                    qualityMetrics: data.quality_metrics,
                    workflowMetrics: data.workflow_metrics
                }
            };
        }
        catch (error) {
            console.warn(`Warning: Could not transform session data from ${filePath}: ${error.message}`);
            return null;
        }
    }
    categorizeToolName(toolName) {
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
        return undefined;
    }
}
exports.LocalDataParser = LocalDataParser;
async function parseDefaultMetricsLocation(options = {}) {
    const metricsDir = path.join(require('os').homedir(), '.agent-os', 'metrics');
    const parser = new LocalDataParser(metricsDir, options);
    return parser.parseAllFiles();
}
function validateParsedData(result) {
    const issues = [];
    for (const session of result.sessions) {
        if (!session.sessionId)
            issues.push(`Session missing sessionId`);
        if (!session.sessionStart)
            issues.push(`Session ${session.sessionId} missing sessionStart`);
    }
    for (const metric of result.toolMetrics) {
        if (!metric.sessionId)
            issues.push(`Tool metric missing sessionId`);
        if (!metric.toolName)
            issues.push(`Tool metric missing toolName`);
    }
    const sessionIds = new Set(result.sessions.map(s => s.sessionId));
    const orphanedMetrics = result.toolMetrics.filter(m => !sessionIds.has(m.sessionId));
    if (orphanedMetrics.length > 0) {
        issues.push(`${orphanedMetrics.length} tool metrics have no corresponding session`);
    }
    return {
        isValid: issues.length === 0,
        issues
    };
}
//# sourceMappingURL=data-parser.js.map