/**
 * Data Transformer for Local to Cloud Format Conversion
 * Transforms parsed local metrics data to cloud database schema format
 * 
 * Sprint 6 - Task 6.1: Historical Data Migration Scripts
 * Handles schema mapping, data validation, and format conversion
 */

import { 
  ParsedSessionData, 
  ParsedToolMetric, 
  ParseResult 
} from './data-parser';

// Prisma types for database insertion
export interface TransformedSession {
  id: string;
  userId: string;
  sessionStart: Date;
  sessionEnd?: Date;
  totalDurationMs?: bigint;
  toolsUsed?: any; // JSON
  productivityScore?: number;
  sessionType: string;
  projectId?: string;
  tags: any; // JSON array
  interruptionsCount: number;
  focusTimeMs: bigint;
  description?: string;
}

export interface TransformedToolMetric {
  id: string;
  sessionId: string;
  toolName: string;
  toolCategory?: string;
  executionCount: number;
  totalDurationMs: bigint;
  averageDurationMs: bigint;
  successRate: number; // Decimal
  errorCount: number;
  memoryUsageMb?: number;
  cpuTimeMs?: bigint;
  parameters?: any; // JSON
  outputSizeBytes?: bigint;
  commandLine?: string;
  workingDirectory?: string;
}

export interface UserMapping {
  localUser: string;
  cloudUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface TransformationResult {
  sessions: TransformedSession[];
  toolMetrics: TransformedToolMetric[];
  userMappings: UserMapping[];
  errors: TransformationError[];
  statistics: {
    originalSessions: number;
    transformedSessions: number;
    originalToolMetrics: number;
    transformedToolMetrics: number;
    duplicatesRemoved: number;
    invalidRecordsSkipped: number;
    usersIdentified: number;
  };
}

export interface TransformationError {
  type: 'session' | 'toolMetric' | 'user';
  recordId: string;
  error: string;
  originalData?: any;
}

export interface TransformationOptions {
  tenantId: string;
  defaultUserId?: string;
  userMappingStrategy: 'create' | 'map' | 'default';
  deduplicationStrategy: 'strict' | 'loose' | 'none';
  timeZone: string;
  validateConstraints: boolean;
  maxSessionDurationHours: number;
  minSessionDurationMs: number;
}

/**
 * Main data transformation class
 */
export class DataTransformer {
  private readonly options: TransformationOptions;
  private readonly userCache = new Map<string, string>(); // localUser -> cloudUserId
  private readonly sessionCache = new Set<string>(); // Track processed sessions

  constructor(options: TransformationOptions) {
    this.options = options;
  }

  /**
   * Transform parsed local data to cloud database format
   */
  async transform(parseResult: ParseResult): Promise<TransformationResult> {
    const startTime = Date.now();
    console.log(`🔄 Starting data transformation for tenant: ${this.options.tenantId}`);

    const result: TransformationResult = {
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
      // Step 1: Identify and process users
      console.log('👥 Processing user mappings...');
      await this.processUsers(parseResult, result);

      // Step 2: Transform sessions
      console.log('📋 Transforming sessions...');
      await this.transformSessions(parseResult.sessions, result);

      // Step 3: Transform tool metrics
      console.log('🔧 Transforming tool metrics...');
      await this.transformToolMetrics(parseResult.toolMetrics, result);

      // Step 4: Apply deduplication
      console.log('🔍 Applying deduplication strategies...');
      await this.deduplicateData(result);

      // Step 5: Validate final data
      console.log('✅ Validating transformed data...');
      await this.validateTransformedData(result);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Transformation completed in ${processingTime}ms`);
      console.log(`📊 Sessions: ${result.statistics.originalSessions} → ${result.statistics.transformedSessions}`);
      console.log(`🔧 Tool Metrics: ${result.statistics.originalToolMetrics} → ${result.statistics.transformedToolMetrics}`);
      console.log(`👥 Users: ${result.statistics.usersIdentified} identified`);
      console.log(`❌ Errors: ${result.errors.length}`);

      return result;

    } catch (error) {
      result.errors.push({
        type: 'session',
        recordId: 'global',
        error: `Global transformation error: ${error.message}`,
        originalData: error
      });

      return result;
    }
  }

  /**
   * Process and map local users to cloud user IDs
   */
  private async processUsers(parseResult: ParseResult, result: TransformationResult): Promise<void> {
    const localUsers = new Set<string>();

    // Extract unique users from session metadata
    for (const session of parseResult.sessions) {
      if (session.metadata?.user) {
        localUsers.add(session.metadata.user);
      }
    }

    for (const localUser of localUsers) {
      try {
        let cloudUserId: string;

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

      } catch (error) {
        result.errors.push({
          type: 'user',
          recordId: localUser,
          error: `User mapping error: ${error.message}`,
          originalData: { localUser }
        });
      }
    }
  }

  /**
   * Transform parsed sessions to database format
   */
  private async transformSessions(
    parsedSessions: ParsedSessionData[], 
    result: TransformationResult
  ): Promise<void> {
    for (const parsed of parsedSessions) {
      try {
        // Skip duplicates
        if (this.sessionCache.has(parsed.sessionId)) {
          result.statistics.duplicatesRemoved++;
          continue;
        }

        // Validate session data
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

        // Get user ID
        const localUser = parsed.metadata?.user || 'unknown';
        const userId = this.userCache.get(localUser) || this.options.defaultUserId || 'default-user-id';

        // Transform to database format
        const transformed: TransformedSession = {
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

      } catch (error) {
        result.errors.push({
          type: 'session',
          recordId: parsed.sessionId,
          error: `Session transformation error: ${error.message}`,
          originalData: parsed
        });
      }
    }
  }

  /**
   * Transform parsed tool metrics to database format
   */
  private async transformToolMetrics(
    parsedMetrics: ParsedToolMetric[], 
    result: TransformationResult
  ): Promise<void> {
    const processedKeys = new Set<string>();

    for (const parsed of parsedMetrics) {
      try {
        // Check if session exists
        if (!this.sessionCache.has(parsed.sessionId)) {
          result.errors.push({
            type: 'toolMetric',
            recordId: `${parsed.sessionId}-${parsed.toolName}`,
            error: 'Tool metric references non-existent session',
            originalData: parsed
          });
          continue;
        }

        // Create deduplication key
        const deduplicationKey = `${parsed.sessionId}-${parsed.toolName}`;
        if (processedKeys.has(deduplicationKey)) {
          result.statistics.duplicatesRemoved++;
          continue;
        }

        // Validate tool metric data
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

        // Transform to database format
        const transformed: TransformedToolMetric = {
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

      } catch (error) {
        result.errors.push({
          type: 'toolMetric',
          recordId: `${parsed.sessionId}-${parsed.toolName}`,
          error: `Tool metric transformation error: ${error.message}`,
          originalData: parsed
        });
      }
    }
  }

  /**
   * Apply deduplication strategies
   */
  private async deduplicateData(result: TransformationResult): Promise<void> {
    if (this.options.deduplicationStrategy === 'none') return;

    const originalSessionCount = result.sessions.length;
    const originalToolMetricCount = result.toolMetrics.length;

    if (this.options.deduplicationStrategy === 'strict') {
      // Remove exact duplicates
      const sessionMap = new Map<string, TransformedSession>();
      for (const session of result.sessions) {
        sessionMap.set(session.id, session);
      }
      result.sessions = Array.from(sessionMap.values());

      const toolMetricMap = new Map<string, TransformedToolMetric>();
      for (const metric of result.toolMetrics) {
        const key = `${metric.sessionId}-${metric.toolName}`;
        if (!toolMetricMap.has(key)) {
          toolMetricMap.set(key, metric);
        }
      }
      result.toolMetrics = Array.from(toolMetricMap.values());

    } else if (this.options.deduplicationStrategy === 'loose') {
      // Remove similar sessions within time windows
      result.sessions = this.deduplicateSessionsByTimeWindow(result.sessions, 5 * 60 * 1000); // 5 minutes
    }

    const sessionsRemoved = originalSessionCount - result.sessions.length;
    const metricsRemoved = originalToolMetricCount - result.toolMetrics.length;
    
    result.statistics.duplicatesRemoved += sessionsRemoved + metricsRemoved;
  }

  /**
   * Validate transformed data integrity
   */
  private async validateTransformedData(result: TransformationResult): Promise<void> {
    if (!this.options.validateConstraints) return;

    // Validate sessions
    for (const session of result.sessions) {
      if (!session.id || !session.userId) {
        result.errors.push({
          type: 'session',
          recordId: session.id || 'unknown',
          error: 'Missing required fields after transformation'
        });
      }

      // Check session duration limits
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

    // Validate tool metrics
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

  /**
   * Validate individual session data
   */
  private validateSession(session: ParsedSessionData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!session.sessionId) errors.push('Missing session ID');
    if (!session.sessionStart) errors.push('Missing session start time');
    
    // Check session duration
    if (session.sessionEnd && session.sessionStart) {
      const duration = session.sessionEnd.getTime() - session.sessionStart.getTime();
      if (duration < this.options.minSessionDurationMs) {
        errors.push(`Session duration ${duration}ms is below minimum ${this.options.minSessionDurationMs}ms`);
      }
      if (duration > this.options.maxSessionDurationHours * 60 * 60 * 1000) {
        errors.push(`Session duration exceeds maximum ${this.options.maxSessionDurationHours} hours`);
      }
    }

    // Validate productivity score range
    if (session.productivityScore !== undefined) {
      if (session.productivityScore < 0 || session.productivityScore > 100) {
        errors.push(`Productivity score ${session.productivityScore} is outside valid range 0-100`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate individual tool metric data
   */
  private validateToolMetric(metric: ParsedToolMetric): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!metric.sessionId) errors.push('Missing session ID');
    if (!metric.toolName) errors.push('Missing tool name');
    if (metric.executionCount < 0) errors.push('Execution count cannot be negative');
    if (metric.successRate < 0 || metric.successRate > 1) errors.push('Success rate must be between 0 and 1');
    if (metric.errorCount < 0) errors.push('Error count cannot be negative');

    return { isValid: errors.length === 0, errors };
  }

  // Utility methods for data transformation

  private async createCloudUser(localUser: string): Promise<string> {
    // In real implementation, this would create a user in the database
    // For now, generate a deterministic UUID based on local user
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(localUser).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-4${hash.substr(12, 3)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
  }

  private async mapExistingUser(localUser: string): Promise<string> {
    // In real implementation, this would query the database for existing users
    // For now, use the create method
    return this.createCloudUser(localUser);
  }

  private inferEmailFromUser(localUser: string): string {
    // Try to infer email from local user
    if (localUser.includes('@')) return localUser;
    return `${localUser}@example.com`;
  }

  private inferFirstName(localUser: string): string {
    const parts = localUser.split(/[._-]/);
    return parts[0] || localUser;
  }

  private inferLastName(localUser: string): string {
    const parts = localUser.split(/[._-]/);
    return parts[1] || 'User';
  }

  private normalizeProductivityScore(score?: number): number | undefined {
    if (score === undefined) return undefined;
    
    // If score is between 0-1, convert to 0-100
    if (score >= 0 && score <= 1) {
      return Math.round(score * 100);
    }
    
    // If already in 0-100 range, use as-is
    if (score >= 0 && score <= 100) {
      return Math.round(score);
    }
    
    // Clamp to valid range
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private sanitizeProjectId(projectId?: string): string | undefined {
    if (!projectId) return undefined;
    return projectId.replace(/[^a-zA-Z0-9_-]/g, '_').substr(0, 100);
  }

  private sanitizeDescription(description?: string): string | undefined {
    if (!description) return undefined;
    return description.substr(0, 500); // Limit description length
  }

  private sanitizeToolName(toolName: string): string {
    return toolName.replace(/[^\w-]/g, '_').substr(0, 100);
  }

  private sanitizeCommandLine(commandLine?: string): string | undefined {
    if (!commandLine) return undefined;
    return commandLine.substr(0, 1000); // Limit command line length
  }

  private sanitizeWorkingDirectory(workingDirectory?: string): string | undefined {
    if (!workingDirectory) return undefined;
    return workingDirectory.substr(0, 500);
  }

  private generateId(): string {
    const crypto = require('crypto');
    return crypto.randomUUID();
  }

  private deduplicateSessionsByTimeWindow(sessions: TransformedSession[], windowMs: number): TransformedSession[] {
    // Sort sessions by start time
    const sorted = sessions.sort((a, b) => a.sessionStart.getTime() - b.sessionStart.getTime());
    const deduplicated: TransformedSession[] = [];
    
    let lastSession: TransformedSession | null = null;
    
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

/**
 * Utility function to create a transformer with sensible defaults
 */
export function createDefaultTransformer(tenantId: string, options: Partial<TransformationOptions> = {}): DataTransformer {
  const defaultOptions: TransformationOptions = {
    tenantId,
    userMappingStrategy: 'create',
    deduplicationStrategy: 'strict',
    timeZone: 'UTC',
    validateConstraints: true,
    maxSessionDurationHours: 24,
    minSessionDurationMs: 1000, // 1 second minimum
    ...options
  };

  return new DataTransformer(defaultOptions);
}