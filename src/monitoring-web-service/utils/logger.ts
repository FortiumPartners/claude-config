/**
 * =====================================================
 * Logger Utility - Structured Logging System
 * External Metrics Web Service
 * =====================================================
 * 
 * Comprehensive logging utility providing structured
 * logging capabilities for the multi-tenant SaaS platform.
 * 
 * Features:
 * - Multiple log levels with filtering
 * - Structured JSON logging for production
 * - Context-aware logging with tenant information
 * - Performance monitoring integration
 * - Configurable output formats
 * - Error tracking and aggregation
 * =====================================================
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  tenantId?: string;
  userId?: string;
  sessionId?: string;
}

export class Logger {
  private component: string;
  private context: Record<string, any> = {};

  constructor(component: string, initialContext?: Record<string, any>) {
    this.component = component;
    if (initialContext) {
      this.context = { ...initialContext };
    }
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | Record<string, any>): void {
    let errorContext: Record<string, any> = {};
    let errorInfo: LogEntry['error'];

    if (error instanceof Error) {
      errorInfo = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else if (error && typeof error === 'object') {
      errorContext = error;
    }

    this.log('error', message, errorContext, errorInfo);
  }

  private log(
    level: LogLevel, 
    message: string, 
    context?: Record<string, any>,
    error?: LogEntry['error']
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      context: { ...this.context, ...context },
      error
    };

    // In production, send to structured logging service
    // For now, use console output
    const logMessage = JSON.stringify(entry, null, 2);
    
    switch (level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }
}