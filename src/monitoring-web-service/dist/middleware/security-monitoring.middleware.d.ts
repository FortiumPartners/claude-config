import { Request, Response, NextFunction } from 'express';
import { SecurityAuditService } from '../services/security-audit.service';
import { CloudWatchMonitoringService } from '../services/cloudwatch-monitoring.service';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
export interface SecurityThreat {
    id: string;
    type: 'sql_injection' | 'xss' | 'directory_traversal' | 'command_injection' | 'brute_force' | 'rate_limit_exceeded' | 'suspicious_payload' | 'malicious_ip' | 'anomalous_behavior';
    severity: 'critical' | 'high' | 'medium' | 'low';
    source_ip: string;
    user_agent: string;
    path: string;
    method: string;
    payload: string;
    threat_score: number;
    blocked: boolean;
    timestamp: Date;
    user_id?: string;
    organization_id?: string;
}
export interface SecurityMetrics {
    threats_detected: number;
    threats_blocked: number;
    suspicious_ips: Set<string>;
    attack_patterns: Map<string, number>;
    false_positives: number;
    response_times: number[];
}
export declare class SecurityMonitoringMiddleware {
    private securityAuditService;
    private cloudwatchService;
    private redisManager;
    private logger;
    private config;
    private threatHistory;
    private metrics;
    private ipFailureCount;
    private blockedIPs;
    private suspiciousPatterns;
    constructor(securityAuditService: SecurityAuditService, cloudwatchService: CloudWatchMonitoringService, redisManager: RedisManager, logger: winston.Logger, config: {
        enableThreatBlocking: boolean;
        maxFailuresPerIP: number;
        blockDurationMinutes: number;
        threatScoreThreshold: number;
        enableAnomalyDetection: boolean;
        logAllRequests: boolean;
    });
    monitor(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private detectThreats;
    private detectSQLInjection;
    private detectXSS;
    private detectDirectoryTraversal;
    private detectCommandInjection;
    private detectMaliciousUserAgent;
    private detectSuspiciousPayload;
    private checkIPReputation;
    private detectAnomalies;
    private processThreat;
    private handleThreatBlocking;
    private getClientIP;
    private extractPayload;
    private calculateThreatScore;
    private initializeSuspiciousPatterns;
    private checkRateLimit;
    private handleBlockedRequest;
    private logSecurityEvent;
    private updateMetrics;
    private updateIPFailureCount;
    private startPeriodicCleanup;
    private isInternalIP;
    private isInternalPath;
    private getRecentRequestCount;
    private analyzePathPattern;
    getMetrics(): SecurityMetrics;
    getRecentThreats(hours?: number): SecurityThreat[];
}
export declare function createSecurityMonitoringMiddleware(securityAuditService: SecurityAuditService, cloudwatchService: CloudWatchMonitoringService, redisManager: RedisManager, logger: winston.Logger, config: {
    enableThreatBlocking: boolean;
    maxFailuresPerIP: number;
    blockDurationMinutes: number;
    threatScoreThreshold: number;
    enableAnomalyDetection: boolean;
    logAllRequests: boolean;
}): SecurityMonitoringMiddleware;
//# sourceMappingURL=security-monitoring.middleware.d.ts.map