import { PrismaClient } from '../generated/prisma-client';
import { EventEmitter } from 'events';
export interface FailoverConfiguration {
    maxRetryAttempts: number;
    retryInterval: number;
    healthCheckInterval: number;
    connectionTimeout: number;
    degradedModeThreshold: number;
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
export declare class FailoverHandler extends EventEmitter {
    private readonly prisma;
    private readonly tenantSchemaName;
    private readonly config;
    private readonly localMetricsDir;
    private currentMode;
    private lastFailover;
    private failoverReason;
    private connectionAttempts;
    private successfulConnections;
    private failedConnections;
    private isRecovering;
    private startTime;
    private healthCheckInterval;
    private failoverHistory;
    constructor(prisma: PrismaClient, tenantSchemaName: string, config?: Partial<FailoverConfiguration>);
    private initialize;
    handleConnectionFailure(error?: Error): Promise<void>;
    handleServiceDegradation(reason: string): Promise<void>;
    attemptRecovery(): Promise<boolean>;
    getFailoverStatus(): FailoverStatus;
    getFailoverHistory(): FailoverEvent[];
    forceFailover(mode: 'hybrid' | 'local_only' | 'remote_only' | 'degraded', reason?: string): Promise<void>;
    isInFailoverMode(): boolean;
    stop(): void;
    private initiateFailover;
    private executeFailoverActions;
    private switchToLocalOnly;
    private switchToRemoteOnly;
    private switchToDegradedMode;
    private switchToHybridMode;
    private initiateRecovery;
    private startHealthChecks;
    private performHealthCheck;
    private calculateErrorRate;
    private scheduleRecoveryAttempt;
    private ensureLocalStorageAvailable;
    private queuePendingRemoteOperations;
    private syncLocalChangesToRemote;
    private configureDegradedRemoteOperations;
    private saveFailoverState;
    private loadFailoverState;
    private setupProcessHandlers;
}
//# sourceMappingURL=failover-handler.d.ts.map