import { ValidationResult, CommandContext } from './types';
import { IntegrationConfigManager } from './integration-config';

/**
 * Task 3.7: Create fallback mechanisms for integration failures
 * 
 * Handles integration failures gracefully and provides fallback options
 */
export class FallbackHandler {
  constructor(private config: IntegrationConfigManager) {}

  /**
   * Handle integration failures and provide fallback responses
   */
  public async handleIntegrationFailure(
    error: Error,
    command: string,
    context: CommandContext,
    attemptCount: number = 0
  ): Promise<FallbackResult> {
    const fallbackSettings = this.config.getFallbackSettings();
    
    // Log the failure
    await this.logFailure(error, command, context, attemptCount);

    // Check if we should retry
    if (attemptCount < fallbackSettings.maxRetries && this.isRetryableError(error)) {
      return {
        action: 'retry',
        delay: this.calculateRetryDelay(attemptCount),
        message: `Integration failure, retrying in ${this.calculateRetryDelay(attemptCount)}ms...`
      };
    }

    // Determine fallback strategy based on error type and configuration
    if (fallbackSettings.enableGracefulDegradation) {
      return await this.handleGracefulDegradation(error, command, context);
    } else {
      return await this.handleFailure(error, command, context);
    }
  }

  /**
   * Handle timeout scenarios
   */
  public async handleTimeout(
    command: string,
    context: CommandContext,
    timeoutMs: number
  ): Promise<FallbackResult> {
    const fallbackSettings = this.config.getFallbackSettings();
    
    if (fallbackSettings.enableGracefulDegradation) {
      return {
        action: 'allow_with_warning',
        validationResult: {
          allowed: true,
          violations: ['INTEGRATION_TIMEOUT'],
          suggestedActions: [
            `Integration validation timed out after ${timeoutMs}ms`,
            'Command is allowed to proceed but enforcement may be incomplete',
            'Check integration configuration and system resources'
          ]
        },
        message: `Integration timeout - allowing ${command} to proceed with warning`
      };
    } else {
      return {
        action: 'block',
        validationResult: {
          allowed: false,
          violations: ['INTEGRATION_TIMEOUT', 'ENFORCEMENT_UNAVAILABLE'],
          suggestedActions: [
            'Integration system is unavailable',
            'Wait a moment and try again',
            'Contact support if problem persists'
          ]
        },
        message: `Integration timeout - blocking ${command} execution`
      };
    }
  }

  /**
   * Handle configuration errors
   */
  public async handleConfigError(error: Error, command: string): Promise<FallbackResult> {
    return {
      action: 'allow_with_warning',
      validationResult: {
        allowed: true,
        violations: ['CONFIGURATION_ERROR'],
        suggestedActions: [
          'Integration configuration is invalid or missing',
          'Check .claude/integration-config.json',
          'Run with default settings for now'
        ]
      },
      message: `Configuration error - using default settings: ${error.message}`
    };
  }

  /**
   * Handle enforcement engine failures
   */
  public async handleEnforcementError(
    error: Error,
    command: string,
    context: CommandContext
  ): Promise<FallbackResult> {
    const fallbackSettings = this.config.getFallbackSettings();

    if (fallbackSettings.fallbackToWarningsOnly) {
      return {
        action: 'allow_with_warning',
        validationResult: {
          allowed: true,
          violations: ['ENFORCEMENT_ENGINE_ERROR'],
          suggestedActions: [
            'Task enforcement is currently unavailable',
            'Command is allowed but may not follow proper task sequence',
            'Review task status manually after completion'
          ]
        },
        message: `Enforcement engine error - allowing ${command} with warnings`
      };
    } else {
      return {
        action: 'block',
        validationResult: {
          allowed: false,
          violations: ['ENFORCEMENT_ENGINE_ERROR', 'SYSTEM_UNAVAILABLE'],
          suggestedActions: [
            'Task enforcement system is unavailable',
            'Try again in a few minutes',
            'Use override if this is an emergency'
          ]
        },
        message: `Enforcement engine error - blocking ${command}`
      };
    }
  }

  /**
   * Handle session management failures
   */
  public async handleSessionError(error: Error, sessionId: string): Promise<FallbackResult> {
    return {
      action: 'create_fallback_session',
      validationResult: {
        allowed: true,
        violations: ['SESSION_MANAGEMENT_ERROR'],
        suggestedActions: [
          'Session management is temporarily unavailable',
          'Created temporary session for this command',
          'Some features may be limited'
        ]
      },
      message: `Session error - using temporary session: ${error.message}`,
      fallbackSessionId: `temp-${Date.now()}`
    };
  }

  /**
   * Handle validation failures
   */
  public async handleValidationError(
    error: Error,
    command: string,
    context: CommandContext
  ): Promise<FallbackResult> {
    // For validation errors, we typically want to be more strict
    return {
      action: 'block',
      validationResult: {
        allowed: false,
        violations: ['VALIDATION_SYSTEM_ERROR'],
        suggestedActions: [
          'Command validation failed due to system error',
          'Check system logs for details',
          'Try again or use override if necessary'
        ]
      },
      message: `Validation error - cannot verify ${command} safety: ${error.message}`
    };
  }

  /**
   * Create emergency bypass for critical situations
   */
  public createEmergencyBypass(
    command: string,
    reason: string,
    authorizedBy: string
  ): ValidationResult {
    return {
      allowed: true,
      violations: ['EMERGENCY_BYPASS_USED'],
      suggestedActions: [
        `Emergency bypass activated by ${authorizedBy}`,
        `Reason: ${reason}`,
        'This command bypassed all enforcement checks',
        'Review task status and compliance after completion'
      ]
    };
  }

  private async handleGracefulDegradation(
    error: Error,
    command: string,
    context: CommandContext
  ): Promise<FallbackResult> {
    const fallbackSettings = this.config.getFallbackSettings();

    // Determine severity of the error
    const severity = this.classifyErrorSeverity(error);

    switch (severity) {
      case 'low':
        return {
          action: 'allow_with_info',
          validationResult: {
            allowed: true,
            violations: [],
            suggestedActions: [
              'Minor integration issue detected',
              'Command allowed to proceed normally'
            ]
          },
          message: `Minor issue resolved - proceeding with ${command}`
        };

      case 'medium':
        if (fallbackSettings.fallbackToWarningsOnly) {
          return {
            action: 'allow_with_warning',
            validationResult: {
              allowed: true,
              violations: ['INTEGRATION_DEGRADED'],
              suggestedActions: [
                'Integration running in degraded mode',
                'Some enforcement features may be unavailable',
                'Monitor task completion manually'
              ]
            },
            message: `Degraded mode - allowing ${command} with warnings`
          };
        } else {
          return {
            action: 'block',
            validationResult: {
              allowed: false,
              violations: ['INTEGRATION_DEGRADED', 'SAFETY_CHECK_FAILED'],
              suggestedActions: [
                'Integration system is degraded',
                'Cannot safely validate command',
                'Wait for system recovery or use override'
              ]
            },
            message: `Degraded mode - blocking ${command} for safety`
          };
        }

      case 'high':
      default:
        return {
          action: 'block',
          validationResult: {
            allowed: false,
            violations: ['CRITICAL_INTEGRATION_FAILURE'],
            suggestedActions: [
              'Critical integration failure detected',
              'System cannot safely process commands',
              'Contact support immediately'
            ]
          },
          message: `Critical failure - blocking all operations`
        };
    }
  }

  private async handleFailure(
    error: Error,
    command: string,
    context: CommandContext
  ): Promise<FallbackResult> {
    return {
      action: 'block',
      validationResult: {
        allowed: false,
        violations: ['INTEGRATION_FAILURE'],
        suggestedActions: [
          'Integration system failure',
          'Cannot validate command safety',
          'Try again later or contact support'
        ]
      },
      message: `Integration failure - blocking ${command}: ${error.message}`
    };
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'TIMEOUT',
      'CONNECTION_RESET',
      'TEMPORARY_FAILURE',
      'RESOURCE_BUSY',
      'RATE_LIMITED'
    ];

    return retryableErrors.some(retryable => 
      error.message.toUpperCase().includes(retryable)
    );
  }

  private calculateRetryDelay(attemptCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, attemptCount), 10000);
  }

  private classifyErrorSeverity(error: Error): 'low' | 'medium' | 'high' {
    const errorMessage = error.message.toLowerCase();

    const highSeverityIndicators = [
      'critical',
      'fatal',
      'corruption',
      'security',
      'authentication',
      'authorization'
    ];

    const mediumSeverityIndicators = [
      'timeout',
      'connection',
      'network',
      'unavailable',
      'degraded'
    ];

    if (highSeverityIndicators.some(indicator => errorMessage.includes(indicator))) {
      return 'high';
    }

    if (mediumSeverityIndicators.some(indicator => errorMessage.includes(indicator))) {
      return 'medium';
    }

    return 'low';
  }

  private async logFailure(
    error: Error,
    command: string,
    context: CommandContext,
    attemptCount: number
  ): Promise<void> {
    const logSettings = this.config.getLoggingSettings();
    
    if (logSettings.enabled) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Integration failure',
        error: error.message,
        command,
        context: logSettings.includeSessionData ? context : { command: context.command },
        attemptCount,
        stack: error.stack
      };

      if (logSettings.logToFile && logSettings.logFilePath) {
        // Would write to log file in production
        console.error('INTEGRATION_FAILURE:', JSON.stringify(logEntry, null, 2));
      } else {
        console.error('Integration failure:', logEntry);
      }
    }
  }
}

export interface FallbackResult {
  action: 'retry' | 'allow_with_info' | 'allow_with_warning' | 'block' | 'create_fallback_session';
  validationResult?: ValidationResult;
  message: string;
  delay?: number; // for retry actions
  fallbackSessionId?: string; // for session fallback
}

export type ErrorSeverity = 'low' | 'medium' | 'high';