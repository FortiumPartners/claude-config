/**
 * Error Handler Utility
 * 
 * Comprehensive error handling for Helm deployment operations:
 * - Error classification and categorization
 * - Context-aware error messages
 * - Recovery suggestions and automated retries
 * - Error logging and reporting
 * 
 * Part of: Task 3.1 - Helm Deployment Engine Implementation
 */

const { EventEmitter } = require('events');

/**
 * Error categories for classification and handling
 */
const ERROR_CATEGORIES = {
  CONFIGURATION: 'configuration',
  NETWORK: 'network',
  AUTHENTICATION: 'authentication',
  RESOURCE: 'resource',
  VALIDATION: 'validation',
  TIMEOUT: 'timeout',
  DEPENDENCY: 'dependency',
  PERMISSION: 'permission',
  CHART: 'chart',
  UNKNOWN: 'unknown'
};

/**
 * Error severity levels
 */
const ERROR_SEVERITY = {
  CRITICAL: 'critical',    // System failure, requires immediate attention
  HIGH: 'high',           // Operation failure, blocks deployment
  MEDIUM: 'medium',       // Warning, may cause issues
  LOW: 'low',            // Informational, minor issues
  INFO: 'info'           // Information only
};

/**
 * Error recovery strategies
 */
const RECOVERY_STRATEGIES = {
  RETRY: 'retry',
  ROLLBACK: 'rollback',
  MANUAL_INTERVENTION: 'manual',
  IGNORE: 'ignore',
  ESCALATE: 'escalate'
};

/**
 * Comprehensive Error Handler Class
 * 
 * Provides intelligent error handling with:
 * - Error classification and severity assessment
 * - Context-aware error messages and solutions
 * - Automatic recovery suggestions
 * - Error metrics and reporting
 */
class ErrorHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      enableAutoRetry: config.enableAutoRetry !== false,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000,
      enableLogging: config.enableLogging !== false,
      logLevel: config.logLevel || 'error',
      enableMetrics: config.enableMetrics !== false,
      escalationThreshold: config.escalationThreshold || 5,
      ...config
    };

    this.errorPatterns = this._initializeErrorPatterns();
    this.errorMetrics = {
      total: 0,
      byCategory: {},
      bySeverity: {},
      recent: []
    };
    
    this.recoveryStrategies = this._initializeRecoveryStrategies();
  }

  /**
   * Handle an error with comprehensive classification and recovery
   * 
   * @param {Error|string} error - The error to handle
   * @param {object} context - Error context information
   * @returns {object} Handled error with classification and recovery info
   */
  handle(error, context = {}) {
    const errorInfo = this._classifyError(error, context);
    const handledError = this._createHandledError(errorInfo, context);
    
    // Record error metrics
    this._recordError(handledError);
    
    // Log error based on configuration
    if (this.config.enableLogging) {
      this._logError(handledError);
    }
    
    // Emit error event for monitoring
    this.emit('error', handledError);
    
    // Check for escalation conditions
    if (this._shouldEscalate(handledError)) {
      this.emit('escalation', handledError);
    }
    
    return handledError;
  }

  /**
   * Determine if an error is retryable
   * 
   * @param {object} error - Handled error object
   * @returns {boolean} Whether the error is retryable
   */
  isRetryable(error) {
    const retryableCategories = [
      ERROR_CATEGORIES.NETWORK,
      ERROR_CATEGORIES.TIMEOUT,
      ERROR_CATEGORIES.RESOURCE
    ];
    
    return retryableCategories.includes(error.category) &&
           error.severity !== ERROR_SEVERITY.CRITICAL &&
           !error.context.isRetry;
  }

  /**
   * Get recovery strategy for an error
   * 
   * @param {object} error - Handled error object
   * @returns {object} Recovery strategy with actions
   */
  getRecoveryStrategy(error) {
    const strategy = this.recoveryStrategies[error.category];
    
    if (!strategy) {
      return {
        strategy: RECOVERY_STRATEGIES.MANUAL_INTERVENTION,
        actions: ['Contact system administrator'],
        priority: ERROR_SEVERITY.HIGH
      };
    }
    
    return {
      strategy: strategy.strategy,
      actions: strategy.getActions(error),
      priority: strategy.priority,
      automated: strategy.automated
    };
  }

  /**
   * Get error metrics and statistics
   * 
   * @returns {object} Error metrics
   */
  getMetrics() {
    return {
      ...this.errorMetrics,
      trends: this._calculateTrends(),
      topErrors: this._getTopErrors(),
      escalationRate: this._calculateEscalationRate()
    };
  }

  /**
   * Reset error metrics
   */
  resetMetrics() {
    this.errorMetrics = {
      total: 0,
      byCategory: {},
      bySeverity: {},
      recent: []
    };
  }

  // Private Methods

  _classifyError(error, context) {
    const message = error.message || error.toString();
    const category = this._categorizeError(message, context);
    const severity = this._assessSeverity(message, category, context);
    const isTransient = this._isTransientError(message, category);
    const patterns = this._findMatchingPatterns(message);
    
    return {
      originalError: error,
      message,
      category,
      severity,
      isTransient,
      patterns,
      timestamp: new Date().toISOString()
    };
  }

  _categorizeError(message, context) {
    const lowerMessage = message.toLowerCase();
    
    // Configuration errors
    if (lowerMessage.includes('invalid') && 
        (lowerMessage.includes('config') || lowerMessage.includes('value'))) {
      return ERROR_CATEGORIES.CONFIGURATION;
    }
    
    // Network errors
    if (lowerMessage.includes('connection') || 
        lowerMessage.includes('network') || 
        lowerMessage.includes('timeout') ||
        lowerMessage.includes('dial tcp')) {
      return ERROR_CATEGORIES.NETWORK;
    }
    
    // Authentication errors
    if (lowerMessage.includes('unauthorized') || 
        lowerMessage.includes('forbidden') || 
        lowerMessage.includes('authentication') ||
        lowerMessage.includes('token')) {
      return ERROR_CATEGORIES.AUTHENTICATION;
    }
    
    // Resource errors
    if (lowerMessage.includes('insufficient') || 
        lowerMessage.includes('quota') || 
        lowerMessage.includes('capacity') ||
        lowerMessage.includes('resources')) {
      return ERROR_CATEGORIES.RESOURCE;
    }
    
    // Permission errors
    if (lowerMessage.includes('permission') || 
        lowerMessage.includes('denied') || 
        lowerMessage.includes('rbac')) {
      return ERROR_CATEGORIES.PERMISSION;
    }
    
    // Chart errors
    if (lowerMessage.includes('chart') || 
        lowerMessage.includes('template') || 
        lowerMessage.includes('helm')) {
      return ERROR_CATEGORIES.CHART;
    }
    
    // Validation errors
    if (lowerMessage.includes('validation') || 
        lowerMessage.includes('invalid') || 
        lowerMessage.includes('malformed')) {
      return ERROR_CATEGORIES.VALIDATION;
    }
    
    // Timeout errors
    if (lowerMessage.includes('timeout') || 
        lowerMessage.includes('deadline')) {
      return ERROR_CATEGORIES.TIMEOUT;
    }
    
    // Dependency errors
    if (lowerMessage.includes('dependency') || 
        lowerMessage.includes('missing') || 
        lowerMessage.includes('not found')) {
      return ERROR_CATEGORIES.DEPENDENCY;
    }
    
    return ERROR_CATEGORIES.UNKNOWN;
  }

  _assessSeverity(message, category, context) {
    const lowerMessage = message.toLowerCase();
    
    // Critical errors - system failure
    if (lowerMessage.includes('panic') || 
        lowerMessage.includes('fatal') || 
        lowerMessage.includes('critical') ||
        category === ERROR_CATEGORIES.AUTHENTICATION && context.operation === 'production') {
      return ERROR_SEVERITY.CRITICAL;
    }
    
    // High severity - operation failure
    if (category === ERROR_CATEGORIES.CONFIGURATION || 
        category === ERROR_CATEGORIES.PERMISSION || 
        category === ERROR_CATEGORIES.CHART ||
        lowerMessage.includes('failed')) {
      return ERROR_SEVERITY.HIGH;
    }
    
    // Medium severity - potential issues
    if (category === ERROR_CATEGORIES.RESOURCE || 
        category === ERROR_CATEGORIES.DEPENDENCY || 
        category === ERROR_CATEGORIES.VALIDATION) {
      return ERROR_SEVERITY.MEDIUM;
    }
    
    // Low severity - transient issues
    if (category === ERROR_CATEGORIES.NETWORK || 
        category === ERROR_CATEGORIES.TIMEOUT) {
      return ERROR_SEVERITY.LOW;
    }
    
    return ERROR_SEVERITY.INFO;
  }

  _isTransientError(message, category) {
    const transientCategories = [
      ERROR_CATEGORIES.NETWORK,
      ERROR_CATEGORIES.TIMEOUT,
      ERROR_CATEGORIES.RESOURCE
    ];
    
    const transientKeywords = [
      'temporary',
      'retry',
      'connection reset',
      'deadline exceeded',
      'throttled'
    ];
    
    return transientCategories.includes(category) ||
           transientKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  _findMatchingPatterns(message) {
    const matches = [];
    
    for (const pattern of this.errorPatterns) {
      if (pattern.regex.test(message)) {
        matches.push({
          name: pattern.name,
          description: pattern.description,
          solution: pattern.solution
        });
      }
    }
    
    return matches;
  }

  _createHandledError(errorInfo, context) {
    const recoveryStrategy = this.getRecoveryStrategy(errorInfo);
    
    return {
      id: this._generateErrorId(),
      timestamp: errorInfo.timestamp,
      category: errorInfo.category,
      severity: errorInfo.severity,
      isTransient: errorInfo.isTransient,
      message: errorInfo.message,
      originalError: errorInfo.originalError,
      context,
      patterns: errorInfo.patterns,
      recovery: recoveryStrategy,
      suggestions: this._generateSuggestions(errorInfo, context),
      documentation: this._getDocumentationLinks(errorInfo.category)
    };
  }

  _generateSuggestions(errorInfo, context) {
    const suggestions = [];
    
    // Add pattern-based suggestions
    errorInfo.patterns.forEach(pattern => {
      suggestions.push(pattern.solution);
    });
    
    // Add category-based suggestions
    switch (errorInfo.category) {
      case ERROR_CATEGORIES.NETWORK:
        suggestions.push('Check network connectivity and firewall rules');
        suggestions.push('Verify Kubernetes cluster endpoint accessibility');
        break;
        
      case ERROR_CATEGORIES.AUTHENTICATION:
        suggestions.push('Verify kubeconfig credentials and permissions');
        suggestions.push('Check service account tokens and RBAC settings');
        break;
        
      case ERROR_CATEGORIES.RESOURCE:
        suggestions.push('Check cluster resource availability');
        suggestions.push('Review resource requests and limits');
        break;
        
      case ERROR_CATEGORIES.CONFIGURATION:
        suggestions.push('Validate Helm chart values and configuration');
        suggestions.push('Check chart dependencies and requirements');
        break;
        
      case ERROR_CATEGORIES.CHART:
        suggestions.push('Verify chart syntax and template validity');
        suggestions.push('Check chart version compatibility');
        break;
    }
    
    // Add context-specific suggestions
    if (context.operation === 'upgrade' && errorInfo.isTransient) {
      suggestions.push('Consider rolling back to previous version');
    }
    
    if (context.releaseName) {
      suggestions.push(`Check release status: helm status ${context.releaseName}`);
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  _getDocumentationLinks(category) {
    const baseUrl = 'https://helm.sh/docs';
    const links = [];
    
    switch (category) {
      case ERROR_CATEGORIES.CHART:
        links.push(`${baseUrl}/chart_template_guide/`);
        links.push(`${baseUrl}/chart_best_practices/`);
        break;
        
      case ERROR_CATEGORIES.CONFIGURATION:
        links.push(`${baseUrl}/chart_template_guide/values_files/`);
        links.push(`${baseUrl}/helm/helm_install/`);
        break;
        
      case ERROR_CATEGORIES.AUTHENTICATION:
        links.push(`${baseUrl}/faq/#helm-client-permissions`);
        break;
        
      default:
        links.push(`${baseUrl}/faq/`);
        links.push(`${baseUrl}/troubleshooting/`);
    }
    
    return links;
  }

  _recordError(handledError) {
    this.errorMetrics.total++;
    
    // Record by category
    if (!this.errorMetrics.byCategory[handledError.category]) {
      this.errorMetrics.byCategory[handledError.category] = 0;
    }
    this.errorMetrics.byCategory[handledError.category]++;
    
    // Record by severity
    if (!this.errorMetrics.bySeverity[handledError.severity]) {
      this.errorMetrics.bySeverity[handledError.severity] = 0;
    }
    this.errorMetrics.bySeverity[handledError.severity]++;
    
    // Keep recent errors (last 100)
    this.errorMetrics.recent.push({
      id: handledError.id,
      timestamp: handledError.timestamp,
      category: handledError.category,
      severity: handledError.severity,
      message: handledError.message.substring(0, 200)
    });
    
    if (this.errorMetrics.recent.length > 100) {
      this.errorMetrics.recent.shift();
    }
  }

  _logError(handledError) {
    const logLevel = this._getLogLevel(handledError.severity);
    const message = `[${handledError.severity.toUpperCase()}] ${handledError.category}: ${handledError.message}`;
    
    if (console[logLevel]) {
      console[logLevel](message, {
        errorId: handledError.id,
        category: handledError.category,
        severity: handledError.severity,
        context: handledError.context,
        suggestions: handledError.suggestions
      });
    }
  }

  _getLogLevel(severity) {
    switch (severity) {
      case ERROR_SEVERITY.CRITICAL:
        return 'error';
      case ERROR_SEVERITY.HIGH:
        return 'error';
      case ERROR_SEVERITY.MEDIUM:
        return 'warn';
      case ERROR_SEVERITY.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  _shouldEscalate(handledError) {
    // Escalate critical errors immediately
    if (handledError.severity === ERROR_SEVERITY.CRITICAL) {
      return true;
    }
    
    // Escalate if error rate exceeds threshold
    const recentErrors = this.errorMetrics.recent.filter(error => 
      Date.now() - new Date(error.timestamp).getTime() < 300000 // Last 5 minutes
    );
    
    return recentErrors.length >= this.config.escalationThreshold;
  }

  _calculateTrends() {
    const now = Date.now();
    const hourAgo = now - 3600000;
    const dayAgo = now - 86400000;
    
    const recentHour = this.errorMetrics.recent.filter(error => 
      new Date(error.timestamp).getTime() > hourAgo
    );
    
    const recentDay = this.errorMetrics.recent.filter(error => 
      new Date(error.timestamp).getTime() > dayAgo
    );
    
    return {
      lastHour: recentHour.length,
      lastDay: recentDay.length,
      errorRate: recentHour.length / 60 // Errors per minute
    };
  }

  _getTopErrors() {
    const errorCounts = {};
    
    this.errorMetrics.recent.forEach(error => {
      const key = error.message.substring(0, 100);
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));
  }

  _calculateEscalationRate() {
    const escalatedErrors = this.errorMetrics.recent.filter(error => 
      error.severity === ERROR_SEVERITY.CRITICAL
    );
    
    return this.errorMetrics.total > 0 ? 
      (escalatedErrors.length / this.errorMetrics.total) * 100 : 0;
  }

  _generateErrorId() {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  _initializeErrorPatterns() {
    return [
      {
        name: 'connection-refused',
        regex: /connection refused/i,
        description: 'Network connection was refused',
        solution: 'Check if the Kubernetes API server is accessible and running'
      },
      {
        name: 'timeout',
        regex: /timeout|deadline exceeded/i,
        description: 'Operation timed out',
        solution: 'Increase timeout value or check network latency'
      },
      {
        name: 'not-found',
        regex: /not found|404/i,
        description: 'Resource not found',
        solution: 'Verify resource name and namespace'
      },
      {
        name: 'unauthorized',
        regex: /unauthorized|401/i,
        description: 'Authentication failed',
        solution: 'Check credentials and authentication configuration'
      },
      {
        name: 'forbidden',
        regex: /forbidden|403/i,
        description: 'Permission denied',
        solution: 'Check RBAC permissions and service account roles'
      },
      {
        name: 'chart-not-found',
        regex: /chart.*not found/i,
        description: 'Helm chart not found',
        solution: 'Verify chart path and repository configuration'
      },
      {
        name: 'release-exists',
        regex: /release.*already exists/i,
        description: 'Release already exists',
        solution: 'Use upgrade instead of install, or choose a different release name'
      },
      {
        name: 'invalid-yaml',
        regex: /yaml|invalid.*syntax/i,
        description: 'Invalid YAML syntax',
        solution: 'Check YAML formatting and syntax in values files'
      }
    ];
  }

  _initializeRecoveryStrategies() {
    return {
      [ERROR_CATEGORIES.NETWORK]: {
        strategy: RECOVERY_STRATEGIES.RETRY,
        priority: ERROR_SEVERITY.MEDIUM,
        automated: true,
        getActions: (error) => [
          'Retry operation with exponential backoff',
          'Check network connectivity',
          'Verify cluster endpoint accessibility'
        ]
      },
      
      [ERROR_CATEGORIES.TIMEOUT]: {
        strategy: RECOVERY_STRATEGIES.RETRY,
        priority: ERROR_SEVERITY.MEDIUM,
        automated: true,
        getActions: (error) => [
          'Retry with increased timeout',
          'Check system performance',
          'Verify resource availability'
        ]
      },
      
      [ERROR_CATEGORIES.RESOURCE]: {
        strategy: RECOVERY_STRATEGIES.MANUAL_INTERVENTION,
        priority: ERROR_SEVERITY.HIGH,
        automated: false,
        getActions: (error) => [
          'Check cluster resource availability',
          'Scale cluster or adjust resource requests',
          'Review resource quotas and limits'
        ]
      },
      
      [ERROR_CATEGORIES.AUTHENTICATION]: {
        strategy: RECOVERY_STRATEGIES.MANUAL_INTERVENTION,
        priority: ERROR_SEVERITY.CRITICAL,
        automated: false,
        getActions: (error) => [
          'Verify kubeconfig credentials',
          'Check service account permissions',
          'Renew authentication tokens'
        ]
      },
      
      [ERROR_CATEGORIES.CONFIGURATION]: {
        strategy: RECOVERY_STRATEGIES.MANUAL_INTERVENTION,
        priority: ERROR_SEVERITY.HIGH,
        automated: false,
        getActions: (error) => [
          'Validate chart values and configuration',
          'Check chart dependencies',
          'Review template syntax'
        ]
      }
    };
  }
}

module.exports = { 
  ErrorHandler, 
  ERROR_CATEGORIES, 
  ERROR_SEVERITY, 
  RECOVERY_STRATEGIES 
};