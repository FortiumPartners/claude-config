/**
 * Error Recovery Utilities
 * Task 2.2: Error Boundary Integration Enhancement
 * 
 * Features:
 * - Error recovery strategies and utilities
 * - State restoration mechanisms
 * - Performance monitoring and recovery
 * - Network connectivity handling
 */

import { ErrorCategory, RecoveryStrategy } from '../components/LoggingErrorBoundary';

export interface RecoveryContext {
  errorId: string;
  errorCategory: ErrorCategory;
  retryCount: number;
  lastErrorTime: number;
  userAgent: string;
  networkStatus: boolean;
  performanceMetrics?: {
    memoryUsage?: number;
    renderTime?: number;
    networkLatency?: number;
  };
}

export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  message: string;
  nextRetryDelay?: number;
  shouldReload?: boolean;
}

/**
 * Main error recovery manager
 */
export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private recoveryHistory: Map<string, RecoveryContext[]> = new Map();
  private stateSnapshots: Map<string, any> = new Map();
  private maxHistorySize = 50;

  static getInstance(): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager();
    }
    return ErrorRecoveryManager.instance;
  }

  /**
   * Determine the best recovery strategy based on error context
   */
  determineRecoveryStrategy(
    error: Error,
    category: ErrorCategory,
    context: RecoveryContext
  ): RecoveryStrategy {
    // Check for recurring errors
    const history = this.getErrorHistory(context.errorId);
    const recentErrors = history.filter(h => Date.now() - h.lastErrorTime < 5 * 60 * 1000); // 5 minutes

    // If too many recent errors, escalate to more drastic measures
    if (recentErrors.length >= 3) {
      if (category === 'fatal-error') {
        return 'reload';
      }
      return 'fallback';
    }

    // Network-based decisions
    if (!context.networkStatus) {
      return 'fallback'; // Don't retry when offline
    }

    // Performance-based decisions
    if (context.performanceMetrics?.memoryUsage && context.performanceMetrics.memoryUsage > 200 * 1024 * 1024) {
      return 'reload'; // Reload if memory usage is too high (>200MB)
    }

    // Category-based default strategies
    switch (category) {
      case 'network-error':
        return context.retryCount < 2 ? 'retry' : 'fallback';
      case 'validation-error':
        return 'fallback';
      case 'performance-error':
        return context.retryCount < 1 ? 'degrade' : 'reload';
      case 'fatal-error':
        return 'reload';
      case 'component-error':
      default:
        return context.retryCount < 3 ? 'retry' : 'fallback';
    }
  }

  /**
   * Execute recovery strategy
   */
  async executeRecovery(
    strategy: RecoveryStrategy,
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    this.addToHistory(context);

    switch (strategy) {
      case 'retry':
        return this.executeRetryRecovery(context);
      
      case 'fallback':
        return this.executeFallbackRecovery(context);
      
      case 'degrade':
        return this.executeDegradeRecovery(context);
      
      case 'reload':
        return this.executeReloadRecovery(context);
      
      case 'redirect':
        return this.executeRedirectRecovery(context);
      
      default:
        return {
          success: false,
          strategy,
          message: 'Unknown recovery strategy',
        };
    }
  }

  /**
   * Retry recovery with exponential backoff
   */
  private async executeRetryRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    const baseDelay = 1000;
    const maxDelay = 10000;
    const delay = Math.min(baseDelay * Math.pow(2, context.retryCount), maxDelay);

    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 200;
    const finalDelay = delay + jitter;

    return {
      success: true,
      strategy: 'retry',
      message: `Retrying in ${Math.round(finalDelay / 1000)} seconds...`,
      nextRetryDelay: finalDelay,
    };
  }

  /**
   * Fallback recovery - show alternative UI
   */
  private async executeFallbackRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    return {
      success: true,
      strategy: 'fallback',
      message: 'Showing simplified interface due to technical difficulties.',
    };
  }

  /**
   * Degrade recovery - reduce functionality
   */
  private async executeDegradeRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    // Could disable non-essential features, reduce animations, etc.
    return {
      success: true,
      strategy: 'degrade',
      message: 'Running in reduced functionality mode to improve stability.',
    };
  }

  /**
   * Reload recovery - full page reload
   */
  private async executeReloadRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    // Save any important state before reload
    this.saveCurrentState('pre-reload', {
      timestamp: Date.now(),
      errorContext: context,
      url: window.location.href,
    });

    return {
      success: true,
      strategy: 'reload',
      message: 'Reloading application to resolve the issue...',
      shouldReload: true,
    };
  }

  /**
   * Redirect recovery - navigate to error page
   */
  private async executeRedirectRecovery(context: RecoveryContext): Promise<RecoveryResult> {
    const errorPageUrl = `/error?id=${context.errorId}&category=${context.errorCategory}`;
    
    return {
      success: true,
      strategy: 'redirect',
      message: 'Redirecting to error page for assistance...',
    };
  }

  /**
   * Save current application state for recovery
   */
  saveCurrentState(key: string, state: any): void {
    try {
      this.stateSnapshots.set(key, {
        ...state,
        timestamp: Date.now(),
      });

      // Cleanup old snapshots
      if (this.stateSnapshots.size > this.maxHistorySize) {
        const oldestKey = Array.from(this.stateSnapshots.keys())[0];
        this.stateSnapshots.delete(oldestKey);
      }
    } catch (error) {
      console.warn('Failed to save state snapshot:', error);
    }
  }

  /**
   * Restore previously saved state
   */
  restoreState(key: string): any | null {
    return this.stateSnapshots.get(key) || null;
  }

  /**
   * Add error to history for pattern analysis
   */
  private addToHistory(context: RecoveryContext): void {
    const history = this.recoveryHistory.get(context.errorId) || [];
    history.push(context);

    // Keep only recent history
    const recentHistory = history.filter(h => Date.now() - h.lastErrorTime < 24 * 60 * 60 * 1000); // 24 hours
    
    this.recoveryHistory.set(context.errorId, recentHistory.slice(-10)); // Max 10 entries
  }

  /**
   * Get error history for analysis
   */
  getErrorHistory(errorId?: string): RecoveryContext[] {
    if (errorId) {
      return this.recoveryHistory.get(errorId) || [];
    }
    
    // Return all history
    const allHistory: RecoveryContext[] = [];
    for (const history of this.recoveryHistory.values()) {
      allHistory.push(...history);
    }
    return allHistory.sort((a, b) => b.lastErrorTime - a.lastErrorTime);
  }

  /**
   * Clear error history (for cleanup)
   */
  clearHistory(errorId?: string): void {
    if (errorId) {
      this.recoveryHistory.delete(errorId);
    } else {
      this.recoveryHistory.clear();
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    averageRetryCount: number;
    successfulRecoveries: number;
  } {
    const allHistory = this.getErrorHistory();
    const stats = {
      totalErrors: allHistory.length,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      averageRetryCount: 0,
      successfulRecoveries: 0,
    };

    // Initialize category counts
    const categories: ErrorCategory[] = ['component-error', 'network-error', 'validation-error', 'performance-error', 'fatal-error'];
    categories.forEach(cat => {
      stats.errorsByCategory[cat] = 0;
    });

    if (allHistory.length === 0) {
      return stats;
    }

    // Calculate statistics
    let totalRetries = 0;
    let recoveries = 0;

    allHistory.forEach(context => {
      stats.errorsByCategory[context.errorCategory]++;
      totalRetries += context.retryCount;
      if (context.retryCount > 0) {
        recoveries++;
      }
    });

    stats.averageRetryCount = totalRetries / allHistory.length;
    stats.successfulRecoveries = recoveries;

    return stats;
  }
}

/**
 * Network connectivity manager for offline error handling
 */
export class NetworkRecoveryManager {
  private static instance: NetworkRecoveryManager;
  private onlineCallbacks: Set<() => void> = new Set();
  private offlineCallbacks: Set<() => void> = new Set();
  private connectionQuality: 'fast' | 'slow' | 'offline' = 'fast';

  static getInstance(): NetworkRecoveryManager {
    if (!NetworkRecoveryManager.instance) {
      NetworkRecoveryManager.instance = new NetworkRecoveryManager();
    }
    return NetworkRecoveryManager.instance;
  }

  constructor() {
    this.setupNetworkMonitoring();
  }

  private setupNetworkMonitoring(): void {
    // Basic online/offline detection
    window.addEventListener('online', () => {
      this.connectionQuality = this.detectConnectionQuality();
      this.notifyOnlineCallbacks();
    });

    window.addEventListener('offline', () => {
      this.connectionQuality = 'offline';
      this.notifyOfflineCallbacks();
    });

    // Initial connection quality detection
    this.connectionQuality = navigator.onLine ? this.detectConnectionQuality() : 'offline';
  }

  private detectConnectionQuality(): 'fast' | 'slow' {
    // Use Network Information API if available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const { effectiveType, downlink } = connection;
      if (effectiveType === '4g' && downlink > 10) {
        return 'fast';
      }
      if (effectiveType === '3g' || downlink < 1.5) {
        return 'slow';
      }
    }

    return 'fast'; // Default assumption
  }

  private notifyOnlineCallbacks(): void {
    this.onlineCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Error in online callback:', error);
      }
    });
  }

  private notifyOfflineCallbacks(): void {
    this.offlineCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.warn('Error in offline callback:', error);
      }
    });
  }

  /**
   * Register callback for when connection comes back online
   */
  onOnline(callback: () => void): () => void {
    this.onlineCallbacks.add(callback);
    return () => this.onlineCallbacks.delete(callback);
  }

  /**
   * Register callback for when connection goes offline
   */
  onOffline(callback: () => void): () => void {
    this.offlineCallbacks.add(callback);
    return () => this.offlineCallbacks.delete(callback);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): {
    isOnline: boolean;
    quality: 'fast' | 'slow' | 'offline';
    canRetry: boolean;
  } {
    return {
      isOnline: navigator.onLine,
      quality: this.connectionQuality,
      canRetry: this.connectionQuality !== 'offline',
    };
  }

  /**
   * Test network connectivity with a ping
   */
  async testConnectivity(timeout: number = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Performance recovery utilities
 */
export class PerformanceRecoveryManager {
  private performanceObserver: PerformanceObserver | null = null;
  private memoryCheckInterval: number | null = null;

  /**
   * Start monitoring performance for recovery decisions
   */
  startMonitoring(onIssueDetected: (issue: PerformanceIssue) => void): void {
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.duration > 50) { // Long task > 50ms
            onIssueDetected({
              type: 'long-task',
              duration: entry.duration,
              timestamp: Date.now(),
            });
          }
        });
      });

      try {
        this.performanceObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('Failed to observe long tasks:', error);
      }
    }

    // Monitor memory usage
    if ((performance as any).memory) {
      this.memoryCheckInterval = window.setInterval(() => {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize;
        
        if (memoryUsage > 150 * 1024 * 1024) { // > 150MB
          onIssueDetected({
            type: 'high-memory',
            memoryUsage,
            timestamp: Date.now(),
          });
        }
      }, 10000); // Check every 10 seconds
    }
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Force garbage collection if available (Chrome DevTools)
   */
  forceGarbageCollection(): boolean {
    if ((window as any).gc) {
      try {
        (window as any).gc();
        return true;
      } catch (error) {
        console.warn('Failed to force garbage collection:', error);
      }
    }
    return false;
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const memory = (performance as any).memory;

    return {
      loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
      domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0,
      memoryUsage: memory ? memory.usedJSHeapSize : 0,
      totalMemory: memory ? memory.totalJSHeapSize : 0,
      memoryLimit: memory ? memory.jsHeapSizeLimit : 0,
      timestamp: Date.now(),
    };
  }
}

// Types
export interface PerformanceIssue {
  type: 'long-task' | 'high-memory' | 'slow-render';
  duration?: number;
  memoryUsage?: number;
  timestamp: number;
}

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  memoryUsage: number;
  totalMemory: number;
  memoryLimit: number;
  timestamp: number;
}

// Singleton instances for easy access
export const errorRecoveryManager = ErrorRecoveryManager.getInstance();
export const networkRecoveryManager = NetworkRecoveryManager.getInstance();

// Utility functions
export function createRecoveryContext(
  errorId: string,
  category: ErrorCategory,
  retryCount: number = 0
): RecoveryContext {
  const performanceManager = new PerformanceRecoveryManager();
  const metrics = performanceManager.getCurrentMetrics();
  
  return {
    errorId,
    errorCategory: category,
    retryCount,
    lastErrorTime: Date.now(),
    userAgent: navigator.userAgent,
    networkStatus: navigator.onLine,
    performanceMetrics: {
      memoryUsage: metrics.memoryUsage,
      renderTime: metrics.loadTime,
    },
  };
}

export function shouldAttemptRecovery(
  category: ErrorCategory,
  retryCount: number,
  networkStatus: boolean
): boolean {
  // Don't retry if offline for network errors
  if (category === 'network-error' && !networkStatus) {
    return false;
  }

  // Maximum retry limits by category
  const maxRetries: Record<ErrorCategory, number> = {
    'network-error': 3,
    'component-error': 3,
    'validation-error': 2,
    'performance-error': 1,
    'fatal-error': 0,
  };

  return retryCount < maxRetries[category];
}