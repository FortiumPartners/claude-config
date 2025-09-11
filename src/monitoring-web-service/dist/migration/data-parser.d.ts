export interface LocalSessionData {
    session_id: string;
    start_time: string;
    end_time?: string;
    user: string;
    working_directory: string;
    git_branch: string;
    productivity_metrics: {
        commands_executed: number;
        tools_invoked: number;
        files_read: number;
        files_modified: number;
        lines_changed: number;
        agents_used: string[];
        focus_blocks: number;
        interruptions: number;
    };
    quality_metrics: {
        tests_run: number;
        tests_passed: number;
        builds_attempted: number;
        builds_successful: number;
        reviews_requested: number;
    };
    workflow_metrics: {
        git_commits: number;
        prs_created: number;
        context_switches: number;
    };
}
export interface LocalToolEvent {
    event: string;
    timestamp: string;
    session_id?: string;
    tool_name?: string;
    execution_time?: number;
    memory_usage?: number;
    success?: boolean;
    error_message?: string;
    parameters?: any;
    output_size?: number;
}
export interface LocalAnalyticsData {
    productivity_score: number;
    velocity: number;
    focus_time: number;
    session_efficiency: number;
    tool_usage_patterns: Record<string, any>;
    productivity_trends: any[];
}
export interface ParsedSessionData {
    sessionId: string;
    userId?: string;
    sessionStart: Date;
    sessionEnd?: Date;
    totalDurationMs?: number;
    toolsUsed: string[];
    productivityScore?: number;
    sessionType: string;
    projectId?: string;
    tags: string[];
    interruptionsCount: number;
    focusTimeMs: number;
    description?: string;
    metadata: any;
}
export interface ParsedToolMetric {
    sessionId: string;
    toolName: string;
    toolCategory?: string;
    executionCount: number;
    totalDurationMs: number;
    averageDurationMs: number;
    successRate: number;
    errorCount: number;
    memoryUsageMb?: number;
    cpuTimeMs?: number;
    parameters?: any;
    outputSizeBytes?: number;
    commandLine?: string;
    workingDirectory?: string;
    timestamps: Date[];
}
export interface ParseResult {
    sessions: ParsedSessionData[];
    toolMetrics: ParsedToolMetric[];
    errors: ParseError[];
    statistics: {
        totalFiles: number;
        processedRecords: number;
        sessionCount: number;
        toolMetricCount: number;
        timeRange: {
            earliest: Date;
            latest: Date;
        };
        memoryUsageKB: number;
    };
}
export interface ParseError {
    file: string;
    line?: number;
    error: string;
    data?: any;
}
export declare class LocalDataParser {
    private readonly metricsDir;
    private readonly options;
    constructor(metricsDir: string, options?: Partial<ParseOptions>);
    parseAllFiles(): Promise<ParseResult>;
    private findSessionFiles;
    private findToolMetricFiles;
    private findAnalyticsFiles;
    private parseSessionFile;
    private parseToolMetricFile;
    private parseAnalyticsFile;
    private parseLogFile;
    private transformSessionData;
    private categorizeToolName;
}
export interface ParseOptions {
    batchSize: number;
    maxMemoryMB: number;
    validateData: boolean;
    includeErrorLogs: boolean;
    timeRange?: {
        start: Date;
        end: Date;
    };
}
export declare function parseDefaultMetricsLocation(options?: Partial<ParseOptions>): Promise<ParseResult>;
export declare function validateParsedData(result: ParseResult): {
    isValid: boolean;
    issues: string[];
};
//# sourceMappingURL=data-parser.d.ts.map