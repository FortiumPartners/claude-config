/**
 * Data Parser for Historical Local Metrics Migration
 * Parses JSONL files from local hooks system and transforms them for cloud import
 * 
 * Performance Requirements:
 * - Handle large datasets (1M+ records) efficiently
 * - Memory usage <500MB during processing
 * - Streaming parse for memory efficiency
 * 
 * Sprint 6 - Task 6.1: Historical Data Migration Scripts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Transform } from 'stream';
import { promisify } from 'util';
import { glob } from 'glob';

// Type definitions for local data formats
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

// Parsed data structure for migration
export interface ParsedSessionData {
  sessionId: string;
  userId?: string; // Will be mapped during migration
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

/**
 * Main data parser class for local metrics files
 */
export class LocalDataParser {
  private readonly metricsDir: string;
  private readonly options: ParseOptions;
  
  constructor(metricsDir: string, options: Partial<ParseOptions> = {}) {
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

  /**
   * Parse all local metrics files and return structured data
   */
  async parseAllFiles(): Promise<ParseResult> {
    const startTime = Date.now();
    const result: ParseResult = {
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
      // Find all metrics files
      const sessionFiles = await this.findSessionFiles();
      const toolFiles = await this.findToolMetricFiles();
      const analyticsFiles = await this.findAnalyticsFiles();

      result.statistics.totalFiles = sessionFiles.length + toolFiles.length + analyticsFiles.length;

      // Process session files
      console.log(`📊 Processing ${sessionFiles.length} session files...`);
      for (const file of sessionFiles) {
        try {
          const sessions = await this.parseSessionFile(file);
          result.sessions.push(...sessions);
          result.statistics.sessionCount += sessions.length;
          
          // Update time range
          sessions.forEach(session => {
            if (session.sessionStart < result.statistics.timeRange.earliest) {
              result.statistics.timeRange.earliest = session.sessionStart;
            }
            if (session.sessionEnd && session.sessionEnd > result.statistics.timeRange.latest) {
              result.statistics.timeRange.latest = session.sessionEnd;
            }
          });
          
        } catch (error) {
          result.errors.push({
            file,
            error: `Session file parse error: ${error.message}`,
            data: error
          });
        }
      }

      // Process tool metric files
      console.log(`🔧 Processing ${toolFiles.length} tool metric files...`);
      for (const file of toolFiles) {
        try {
          const metrics = await this.parseToolMetricFile(file);
          result.toolMetrics.push(...metrics);
          result.statistics.toolMetricCount += metrics.length;
        } catch (error) {
          result.errors.push({
            file,
            error: `Tool metric file parse error: ${error.message}`,
            data: error
          });
        }
      }

      // Process analytics files for productivity scores
      console.log(`📈 Processing ${analyticsFiles.length} analytics files...`);
      for (const file of analyticsFiles) {
        try {
          await this.parseAnalyticsFile(file, result.sessions);
        } catch (error) {
          result.errors.push({
            file,
            error: `Analytics file parse error: ${error.message}`,
            data: error
          });
        }
      }

      // Calculate statistics
      result.statistics.processedRecords = result.sessions.length + result.toolMetrics.length;
      result.statistics.memoryUsageKB = Math.round(process.memoryUsage().heapUsed / 1024);

      const processingTimeMs = Date.now() - startTime;
      console.log(`✅ Parsing completed in ${processingTimeMs}ms`);
      console.log(`📊 Parsed ${result.statistics.sessionCount} sessions, ${result.statistics.toolMetricCount} tool metrics`);
      console.log(`⚠️  ${result.errors.length} parsing errors encountered`);

      return result;

    } catch (error) {
      result.errors.push({
        file: 'global',
        error: `Global parsing error: ${error.message}`,
        data: error
      });
      
      return result;
    }
  }

  /**
   * Find all session data files (JSONL and JSON)
   */
  private async findSessionFiles(): Promise<string[]> {
    const patterns = [
      path.join(this.metricsDir, 'sessions', '*.json'),
      path.join(this.metricsDir, 'sessions', '*.jsonl'),
      path.join(this.metricsDir, '**', '*session*.json*'),
      path.join(this.metricsDir, 'productivity-indicators.json')
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern);
      files.push(...matches.filter(f => fs.existsSync(f)));
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Find all tool metric files
   */
  private async findToolMetricFiles(): Promise<string[]> {
    const patterns = [
      path.join(this.metricsDir, 'realtime', 'activity.log'),
      path.join(this.metricsDir, 'realtime.log'),
      path.join(this.metricsDir, '**', '*tool*.json*'),
      path.join(this.metricsDir, '**', '*.jsonl')
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern);
      files.push(...matches.filter(f => fs.existsSync(f) && !f.includes('session')));
    }

    return [...new Set(files)];
  }

  /**
   * Find analytics and productivity files
   */
  private async findAnalyticsFiles(): Promise<string[]> {
    const patterns = [
      path.join(this.metricsDir, 'historical-baseline.json'),
      path.join(this.metricsDir, 'current-baseline.json'),
      path.join(this.metricsDir, '**', '*analytics*.json'),
      path.join(this.metricsDir, '**', '*productivity*.json'),
      path.join(this.metricsDir, '**', '*performance*.json')
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern);
      files.push(...matches.filter(f => fs.existsSync(f)));
    }

    return [...new Set(files)];
  }

  /**
   * Parse individual session file
   */
  private async parseSessionFile(filePath: string): Promise<ParsedSessionData[]> {
    const sessions: ParsedSessionData[] = [];
    const isJSONL = filePath.endsWith('.jsonl');

    if (isJSONL) {
      // Parse JSONL file line by line for memory efficiency
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
            if (session) sessions.push(session);
          } catch (error) {
            if (this.options.includeErrorLogs) {
              console.warn(`Warning: Invalid JSON at ${filePath}:${lineNumber}`);
            }
          }
        }
      }
    } else {
      // Parse regular JSON file
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (Array.isArray(data)) {
        // Array of sessions
        for (const sessionData of data) {
          const session = this.transformSessionData(sessionData, filePath);
          if (session) sessions.push(session);
        }
      } else {
        // Single session
        const session = this.transformSessionData(data, filePath);
        if (session) sessions.push(session);
      }
    }

    return sessions;
  }

  /**
   * Parse tool metric files (JSONL format)
   */
  private async parseToolMetricFile(filePath: string): Promise<ParsedToolMetric[]> {
    const toolMetrics: ParsedToolMetric[] = [];
    const sessionMetrics = new Map<string, Map<string, any>>();

    // Handle different file types
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
          const data: LocalToolEvent = JSON.parse(line);
          
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

            const metric = sessionMetrics.get(key)!;
            metric.executions.push(data.execution_time || 0);
            metric.totalDuration += data.execution_time || 0;
            metric.timestamps.push(new Date(data.timestamp));
            
            if (!data.success) metric.errors++;
            if (data.memory_usage) metric.memoryUsages.push(data.memory_usage);
            if (data.parameters) metric.parameters.push(data.parameters);
          }
        } catch (error) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }

    // Transform collected data into ParsedToolMetric format
    for (const [, data] of sessionMetrics) {
      const metric: ParsedToolMetric = {
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

  /**
   * Parse analytics files to enrich session data with productivity scores
   */
  private async parseAnalyticsFile(filePath: string, sessions: ParsedSessionData[]): Promise<void> {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (data.productivity_score !== undefined) {
        // Find the most recent session and apply the productivity score
        const recentSession = sessions
          .filter(s => s.sessionEnd)
          .sort((a, b) => b.sessionEnd!.getTime() - a.sessionEnd!.getTime())[0];
        
        if (recentSession && typeof data.productivity_score === 'number') {
          recentSession.productivityScore = Math.round(data.productivity_score * 10); // Convert to 0-100 scale
        }
      }

      // Process historical productivity trends if available
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

    } catch (error) {
      // Analytics file parsing is optional - don't fail the entire process
      console.warn(`Warning: Could not parse analytics file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Parse log files for tool usage events
   */
  private async parseLogFile(filePath: string): Promise<ParsedToolMetric[]> {
    const metrics: ParsedToolMetric[] = [];
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');

    // Simple log parsing - looking for tool usage patterns
    const toolUsagePattern = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*?)\|([^|]+)\|([^|]+)\|(.+)/;
    
    const sessionTools = new Map<string, Map<string, any>>();

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

          const tool = sessionTools.get(key)!;
          tool.count++;
          tool.timestamps.push(date);
        } catch (error) {
          // Skip malformed timestamp
          continue;
        }
      }
    }

    // Convert to metrics format
    for (const [, data] of sessionTools) {
      metrics.push({
        sessionId: data.sessionId,
        toolName: data.toolName,
        toolCategory: this.categorizeToolName(data.toolName),
        executionCount: data.count,
        totalDurationMs: 0,
        averageDurationMs: 0,
        successRate: 1.0, // Assume success for log entries
        errorCount: 0,
        timestamps: data.timestamps
      });
    }

    return metrics;
  }

  /**
   * Transform local session data to parsed format
   */
  private transformSessionData(data: any, filePath: string): ParsedSessionData | null {
    try {
      // Handle different session data formats
      let sessionId: string;
      let startTime: Date;
      let endTime: Date | undefined;
      let toolsUsed: string[] = [];
      let productivityScore: number | undefined;
      let interruptionsCount = 0;
      let focusTimeMs = 0;

      if (data.session_id) {
        // Full session data format
        sessionId = data.session_id;
        startTime = new Date(data.start_time);
        endTime = data.end_time ? new Date(data.end_time) : undefined;
        
        if (data.productivity_metrics) {
          interruptionsCount = data.productivity_metrics.interruptions || 0;
          toolsUsed = data.productivity_metrics.agents_used || [];
          focusTimeMs = (data.productivity_metrics.focus_blocks || 0) * 25 * 60 * 1000; // 25min blocks
        }

        if (data.productivity_score !== undefined) {
          productivityScore = Math.round(data.productivity_score * 10);
        }

      } else if (data.sessionId || data.id) {
        // Alternative session format
        sessionId = data.sessionId || data.id;
        startTime = new Date(data.startTime || data.created_at || data.timestamp);
        endTime = data.endTime ? new Date(data.endTime) : undefined;
        toolsUsed = data.tools || data.toolsUsed || [];
        productivityScore = data.productivityScore || data.score;
        interruptionsCount = data.interruptions || 0;
        focusTimeMs = data.focusTime || 0;

      } else {
        // Skip data without session ID
        return null;
      }

      // Apply time range filter if specified
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

    } catch (error) {
      console.warn(`Warning: Could not transform session data from ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Categorize tool names for better organization
   */
  private categorizeToolName(toolName: string): string | undefined {
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

/**
 * Utility function to parse data from default Claude Config location
 */
export async function parseDefaultMetricsLocation(options: Partial<ParseOptions> = {}): Promise<ParseResult> {
  const metricsDir = path.join(require('os').homedir(), '.agent-os', 'metrics');
  const parser = new LocalDataParser(metricsDir, options);
  return parser.parseAllFiles();
}

/**
 * Utility function to validate parsed data integrity
 */
export function validateParsedData(result: ParseResult): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for missing required fields
  for (const session of result.sessions) {
    if (!session.sessionId) issues.push(`Session missing sessionId`);
    if (!session.sessionStart) issues.push(`Session ${session.sessionId} missing sessionStart`);
  }

  for (const metric of result.toolMetrics) {
    if (!metric.sessionId) issues.push(`Tool metric missing sessionId`);
    if (!metric.toolName) issues.push(`Tool metric missing toolName`);
  }

  // Check data consistency
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