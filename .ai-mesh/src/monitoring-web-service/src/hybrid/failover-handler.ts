/**
 * Failover Handler for Hybrid Mode Resilience
 * Manages graceful failover between local and remote data sources
 * 
 * Sprint 6 - Task 6.4: Hybrid Mode Implementation
 * Ensures continuous operation during network or service failures
 */

import { PrismaClient } from '../generated/prisma-client';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface FailoverConfiguration {
  maxRetryAttempts: number;
  retryInterval: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  connectionTimeout: number; // milliseconds
  degradedModeThreshold: number; // error rate percentage
  autoRecoveryEnabled: boolean;
  fallbackToLocalOnly: boolean;
  persistFailoverState: boolean;
}

export interface FailoverStatus {
  currentMode: 'hybrid' | 'local_only' | 'remote_only' | 'degraded';
  lastFailover: Date | null;
  failoverReason: string | null;
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  errorRate: number;
  isRecovering: boolean;
  uptime: number;
}

export interface FailoverEvent {
  type: 'failover' | 'recovery' | 'degraded' | 'health_check';
  timestamp: Date;
  fromMode: string;
  toMode: string;
  reason: string;
  duration?: number;
  affectedOperations?: string[];
}

/**
 * Handles failover scenarios for hybrid local + remote data synchronization
 */
export class FailoverHandler extends EventEmitter {
  private readonly prisma: PrismaClient;
  private readonly tenantSchemaName: string;
  private readonly config: FailoverConfiguration;
  private readonly localMetricsDir: string;
  
  private currentMode: 'hybrid' | 'local_only' | 'remote_only' | 'degraded' = 'hybrid';
  private lastFailover: Date | null = null;
  private failoverReason: string | null = null;
  private connectionAttempts = 0;
  private successfulConnections = 0;
  private failedConnections = 0;
  private isRecovering = false;
  private startTime = Date.now();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private failoverHistory: FailoverEvent[] = [];

  constructor(
    prisma: PrismaClient, 
    tenantSchemaName: string,
    config: Partial<FailoverConfiguration> = {}
  ) {
    super();
    this.prisma = prisma;
    this.tenantSchemaName = tenantSchemaName;
    this.localMetricsDir = path.join(os.homedir(), '.agent-os', 'metrics');
    
    this.config = {
      maxRetryAttempts: 3,
      retryInterval: 5000,
      healthCheckInterval: 30000,
      connectionTimeout: 10000,
      degradedModeThreshold: 50, // 50% error rate triggers degraded mode
      autoRecoveryEnabled: true,
      fallbackToLocalOnly: true,
      persistFailoverState: true,
      ...config
    };

    this.initialize();
  }

  /**
   * Initialize failover handler and start health checks
   */
  private async initialize(): Promise<void> {
    console.log('🛡️  Initializing Failover Handler...');
    
    // Load persisted failover state
    if (this.config.persistFailoverState) {
      await this.loadFailoverState();
    }
    
    // Start periodic health checks
    this.startHealthChecks();
    
    // Setup process handlers for graceful shutdown
    this.setupProcessHandlers();
    
    console.log(`✅ Failover Handler initialized (mode: ${this.currentMode})`);
    this.emit('initialized', { mode: this.currentMode });
  }

  /**
   * Handle connection failure and initiate failover
   */
  async handleConnectionFailure(error?: Error): Promise<void> {
    this.failedConnections++;
    const errorRate = this.calculateErrorRate();
    
    console.warn(`🔥 Connection failure detected (error rate: ${errorRate}%):`, error?.message);
    
    if (errorRate >= this.config.degradedModeThreshold && this.currentMode === 'hybrid') {
      await this.initiateFailover('degraded', `High error rate: ${errorRate}%`);
    } else if (this.currentMode === 'hybrid' || this.currentMode === 'degraded') {
      await this.initiateFailover('local_only', error?.message || 'Connection failure');
    }
  }

  /**
   * Handle service degradation
   */
  async handleServiceDegradation(reason: string): Promise<void> {
    if (this.currentMode === 'hybrid') {
      await this.initiateFailover('degraded', reason);
    }
  }

  /**
   * Attempt to recover from failover
   */
  async attemptRecovery(): Promise<boolean> {
    if (this.isRecovering || this.currentMode === 'hybrid') {
      return false;
    }
    
    this.isRecovering = true;
    console.log('🔄 Attempting failover recovery...');
    
    try {
      // Test connection health
      const isHealthy = await this.performHealthCheck();
      
      if (isHealthy) {
        const previousMode = this.currentMode;
        await this.initiateRecovery(previousMode);
        
        console.log('✅ Failover recovery successful');
        this.emit('recovery', { 
          fromMode: previousMode, 
          toMode: this.currentMode,
          duration: Date.now() - (this.lastFailover?.getTime() || Date.now())
        });
        
        return true;
      } else {
        console.log('⚠️  Recovery attempt failed - connection still unhealthy');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Recovery attempt failed:', error);
      return false;
      
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * Get current failover status
   */
  getFailoverStatus(): FailoverStatus {
    return {
      currentMode: this.currentMode,
      lastFailover: this.lastFailover,
      failoverReason: this.failoverReason,
      connectionAttempts: this.connectionAttempts,
      successfulConnections: this.successfulConnections,
      failedConnections: this.failedConnections,
      errorRate: this.calculateErrorRate(),
      isRecovering: this.isRecovering,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get failover history
   */
  getFailoverHistory(): FailoverEvent[] {
    return [...this.failoverHistory];
  }

  /**
   * Force failover to specific mode
   */
  async forceFailover(
    mode: 'hybrid' | 'local_only' | 'remote_only' | 'degraded', 
    reason: string = 'Manual failover'
  ): Promise<void> {
    await this.initiateFailover(mode, reason);
  }

  /**
   * Check if currently in failover mode
   */
  isInFailoverMode(): boolean {
    return this.currentMode !== 'hybrid';
  }

  /**
   * Stop failover handler
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    console.log('🛑 Failover Handler stopped');
    this.emit('stopped');
  }

  // Private methods

  /**
   * Initiate failover to specified mode
   */
  private async initiateFailover(
    targetMode: 'hybrid' | 'local_only' | 'remote_only' | 'degraded',
    reason: string
  ): Promise<void> {
    const previousMode = this.currentMode;
    
    if (previousMode === targetMode) {
      return; // Already in target mode
    }
    
    console.log(`🔄 Initiating failover: ${previousMode} → ${targetMode} (${reason})`);
    
    const failoverStart = Date.now();
    
    try {
      // Perform mode-specific failover actions
      await this.executeFailoverActions(previousMode, targetMode);
      
      // Update state
      this.currentMode = targetMode;
      this.lastFailover = new Date();
      this.failoverReason = reason;
      
      // Record failover event
      const failoverEvent: FailoverEvent = {
        type: 'failover',
        timestamp: new Date(),
        fromMode: previousMode,
        toMode: targetMode,
        reason,
        duration: Date.now() - failoverStart
      };
      
      this.failoverHistory.push(failoverEvent);
      
      // Persist failover state
      if (this.config.persistFailoverState) {
        await this.saveFailoverState();
      }
      
      console.log(`✅ Failover completed: ${previousMode} → ${targetMode} in ${failoverEvent.duration}ms`);
      this.emit('failover', failoverEvent);
      
      // Start auto-recovery if enabled
      if (this.config.autoRecoveryEnabled && targetMode !== 'hybrid') {
        this.scheduleRecoveryAttempt();
      }
      
    } catch (error) {
      console.error(`❌ Failover failed: ${previousMode} → ${targetMode}:`, error);
      this.emit('failoverError', { previousMode, targetMode, reason, error });
    }
  }

  /**
   * Execute mode-specific failover actions
   */
  private async executeFailoverActions(fromMode: string, toMode: string): Promise<void> {
    switch (toMode) {
      case 'local_only':
        await this.switchToLocalOnly();
        break;
      case 'remote_only':
        await this.switchToRemoteOnly();
        break;
      case 'degraded':
        await this.switchToDegradedMode();
        break;
      case 'hybrid':
        await this.switchToHybridMode();
        break;
    }
  }

  /**
   * Switch to local-only mode
   */
  private async switchToLocalOnly(): Promise<void> {
    console.log('📱 Switching to local-only mode...');
    
    // Ensure local storage is available
    await this.ensureLocalStorageAvailable();
    
    // Queue any pending remote operations for later
    await this.queuePendingRemoteOperations();
    
    console.log('✅ Local-only mode activated');
  }

  /**
   * Switch to remote-only mode
   */
  private async switchToRemoteOnly(): Promise<void> {
    console.log('☁️  Switching to remote-only mode...');
    
    // Verify remote connectivity
    const isRemoteHealthy = await this.performHealthCheck();
    if (!isRemoteHealthy) {
      throw new Error('Cannot switch to remote-only mode: remote service unhealthy');
    }
    
    // Sync any local changes before switching
    await this.syncLocalChangesToRemote();
    
    console.log('✅ Remote-only mode activated');
  }

  /**
   * Switch to degraded mode
   */
  private async switchToDegradedMode(): Promise<void> {
    console.log('⚡ Switching to degraded mode...');
    
    // Ensure both local and limited remote capabilities
    await this.ensureLocalStorageAvailable();
    
    // Reduce remote operation frequency
    await this.configureDegradedRemoteOperations();
    
    console.log('✅ Degraded mode activated');
  }

  /**
   * Switch to hybrid mode
   */
  private async switchToHybridMode(): Promise<void> {
    console.log('🔄 Switching to hybrid mode...');
    
    // Verify both local and remote are healthy
    await this.ensureLocalStorageAvailable();
    const isRemoteHealthy = await this.performHealthCheck();
    
    if (!isRemoteHealthy) {
      throw new Error('Cannot switch to hybrid mode: remote service unhealthy');
    }
    
    // Sync local changes to remote
    await this.syncLocalChangesToRemote();
    
    console.log('✅ Hybrid mode activated');
  }

  /**
   * Initiate recovery from failover mode
   */
  private async initiateRecovery(fromMode: string): Promise<void> {
    console.log(`🔄 Initiating recovery from ${fromMode} to hybrid mode...`);
    
    await this.executeFailoverActions(fromMode, 'hybrid');
    
    this.currentMode = 'hybrid';
    this.lastFailover = null;
    this.failoverReason = null;
    
    // Reset error counters after successful recovery
    this.failedConnections = 0;
    this.successfulConnections++;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.performHealthCheck();
        
        if (isHealthy) {
          this.successfulConnections++;
          
          // Attempt auto-recovery if in failover mode
          if (this.config.autoRecoveryEnabled && this.currentMode !== 'hybrid') {
            await this.attemptRecovery();
          }
        } else {
          this.failedConnections++;
          
          // Handle degradation if error rate is high
          const errorRate = this.calculateErrorRate();
          if (errorRate >= this.config.degradedModeThreshold && this.currentMode === 'hybrid') {
            await this.handleServiceDegradation(`Health check failed, error rate: ${errorRate}%`);
          }
        }
        
        this.emit('healthCheck', { 
          healthy: isHealthy, 
          mode: this.currentMode,
          errorRate: this.calculateErrorRate()
        });
        
      } catch (error) {
        console.warn('Health check failed:', error.message);
        this.failedConnections++;
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check on remote service
   */
  private async performHealthCheck(): Promise<boolean> {
    try {
      this.connectionAttempts++;
      
      // Test database connectivity with timeout
      const healthCheckPromise = this.prisma.$queryRaw`SELECT 1 as health_check`;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.connectionTimeout);
      });
      
      await Promise.race([healthCheckPromise, timeoutPromise]);
      
      // Test specific tenant schema
      await this.prisma.$queryRawUnsafe(`SELECT 1 FROM "${this.tenantSchemaName}".metrics_sessions LIMIT 1`);
      
      return true;
      
    } catch (error) {
      console.warn('Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Calculate current error rate
   */
  private calculateErrorRate(): number {
    const totalConnections = this.successfulConnections + this.failedConnections;
    return totalConnections > 0 ? Math.round((this.failedConnections / totalConnections) * 100) : 0;
  }

  /**
   * Schedule recovery attempt
   */
  private scheduleRecoveryAttempt(): void {
    setTimeout(async () => {
      if (this.currentMode !== 'hybrid' && !this.isRecovering) {
        await this.attemptRecovery();
      }
    }, this.config.retryInterval);
  }

  /**
   * Ensure local storage is available and functional
   */
  private async ensureLocalStorageAvailable(): Promise<void> {
    try {
      await fs.mkdir(this.localMetricsDir, { recursive: true });
      
      // Test write capability
      const testFile = path.join(this.localMetricsDir, '.failover-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
    } catch (error) {
      throw new Error(`Local storage unavailable: ${error.message}`);
    }
  }

  /**
   * Queue pending remote operations for later execution
   */
  private async queuePendingRemoteOperations(): Promise<void> {
    // Implementation would queue operations for later sync
    console.log('📋 Queuing pending remote operations...');
  }

  /**
   * Sync local changes to remote before mode switch
   */
  private async syncLocalChangesToRemote(): Promise<void> {
    // Implementation would sync pending local changes
    console.log('🔄 Syncing local changes to remote...');
  }

  /**
   * Configure degraded remote operations (reduced frequency)
   */
  private async configureDegradedRemoteOperations(): Promise<void> {
    // Implementation would reduce remote operation frequency
    console.log('⚡ Configuring degraded remote operations...');
  }

  /**
   * Save failover state to disk
   */
  private async saveFailoverState(): Promise<void> {
    try {
      const stateFile = path.join(this.localMetricsDir, '.failover-state.json');
      const state = {
        currentMode: this.currentMode,
        lastFailover: this.lastFailover,
        failoverReason: this.failoverReason,
        connectionStats: {
          attempts: this.connectionAttempts,
          successful: this.successfulConnections,
          failed: this.failedConnections
        },
        failoverHistory: this.failoverHistory.slice(-10) // Keep last 10 events
      };
      
      await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
      
    } catch (error) {
      console.warn('Failed to save failover state:', error.message);
    }
  }

  /**
   * Load failover state from disk
   */
  private async loadFailoverState(): Promise<void> {
    try {
      const stateFile = path.join(this.localMetricsDir, '.failover-state.json');
      const data = await fs.readFile(stateFile, 'utf8');
      const state = JSON.parse(data);
      
      this.currentMode = state.currentMode || 'hybrid';
      this.lastFailover = state.lastFailover ? new Date(state.lastFailover) : null;
      this.failoverReason = state.failoverReason;
      
      if (state.connectionStats) {
        this.connectionAttempts = state.connectionStats.attempts || 0;
        this.successfulConnections = state.connectionStats.successful || 0;
        this.failedConnections = state.connectionStats.failed || 0;
      }
      
      if (state.failoverHistory) {
        this.failoverHistory = state.failoverHistory.map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }));
      }
      
      console.log(`📂 Loaded failover state: ${this.currentMode}`);
      
    } catch (error) {
      // State file doesn't exist or is invalid - start with defaults
      console.log('📂 No existing failover state found, starting fresh');
    }
  }

  /**
   * Setup process handlers for graceful shutdown
   */
  private setupProcessHandlers(): void {
    process.on('SIGINT', () => {
      console.log('🛑 Graceful shutdown initiated...');
      this.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('🛑 Graceful shutdown initiated...');
      this.stop();
      process.exit(0);
    });
  }
}