/**
 * Security Monitoring Middleware
 * Sprint 8 Task 8.2: Runtime security monitoring and threat detection
 * 
 * Features:
 * - Real-time threat detection
 * - Attack pattern recognition
 * - Automated incident response
 * - Security event logging
 * - IP reputation checking
 * - Anomaly detection
 */

import { Request, Response, NextFunction } from 'express';
import { SecurityAuditService } from '../services/security-audit.service';
import { CloudWatchMonitoringService } from '../services/cloudwatch-monitoring.service';
import { RedisManager } from '../config/redis.config';
import * as winston from 'winston';
import * as crypto from 'crypto';

export interface SecurityThreat {
  id: string;
  type: 'sql_injection' | 'xss' | 'directory_traversal' | 'command_injection' | 
        'brute_force' | 'rate_limit_exceeded' | 'suspicious_payload' | 
        'malicious_ip' | 'anomalous_behavior';
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

export class SecurityMonitoringMiddleware {
  private threatHistory: SecurityThreat[] = [];
  private metrics: SecurityMetrics;
  private ipFailureCount: Map<string, number> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousPatterns: RegExp[];

  constructor(
    private securityAuditService: SecurityAuditService,
    private cloudwatchService: CloudWatchMonitoringService,
    private redisManager: RedisManager,
    private logger: winston.Logger,
    private config: {
      enableThreatBlocking: boolean;
      maxFailuresPerIP: number;
      blockDurationMinutes: number;
      threatScoreThreshold: number;
      enableAnomalyDetection: boolean;
      logAllRequests: boolean;
    }
  ) {
    this.metrics = {
      threats_detected: 0,
      threats_blocked: 0,
      suspicious_ips: new Set(),
      attack_patterns: new Map(),
      false_positives: 0,
      response_times: [],
    };

    this.initializeSuspiciousPatterns();
    this.startPeriodicCleanup();
  }

  /**
   * Main security monitoring middleware
   */
  monitor() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        // Extract request information
        const sourceIP = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const path = req.path;
        const method = req.method;
        const payload = this.extractPayload(req);

        // Check if IP is blocked
        if (this.blockedIPs.has(sourceIP)) {
          return this.handleBlockedRequest(req, res, sourceIP);
        }

        // Perform threat detection
        const threats = await this.detectThreats(req, sourceIP, userAgent, path, method, payload);

        // Process detected threats
        for (const threat of threats) {
          await this.processThreat(threat, req, res);
        }

        // Check for rate limiting violations
        await this.checkRateLimit(sourceIP, req, res);

        // Log security event
        if (this.config.logAllRequests || threats.length > 0) {
          await this.logSecurityEvent(req, threats);
        }

        // Update metrics
        this.updateMetrics(threats, Date.now() - startTime);

        // Continue to next middleware if no blocking threats
        const blockingThreats = threats.filter(t => t.blocked);
        if (blockingThreats.length === 0) {
          next();
        }

      } catch (error) {
        this.logger.error('Security monitoring failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          path: req.path,
          ip: this.getClientIP(req),
        });
        next(); // Don't block on monitoring failures
      }
    };
  }

  /**
   * Detect security threats in the request
   */
  private async detectThreats(
    req: Request,
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    // SQL Injection Detection
    const sqlInjectionThreat = this.detectSQLInjection(sourceIP, userAgent, path, method, payload);
    if (sqlInjectionThreat) threats.push(sqlInjectionThreat);

    // XSS Detection
    const xssThreat = this.detectXSS(sourceIP, userAgent, path, method, payload);
    if (xssThreat) threats.push(xssThreat);

    // Directory Traversal Detection
    const traversalThreat = this.detectDirectoryTraversal(sourceIP, userAgent, path, method, payload);
    if (traversalThreat) threats.push(traversalThreat);

    // Command Injection Detection
    const cmdInjectionThreat = this.detectCommandInjection(sourceIP, userAgent, path, method, payload);
    if (cmdInjectionThreat) threats.push(cmdInjectionThreat);

    // Malicious User Agent Detection
    const maliciousUAThreat = this.detectMaliciousUserAgent(sourceIP, userAgent, path, method, payload);
    if (maliciousUAThreat) threats.push(maliciousUAThreat);

    // Suspicious Payload Detection
    const suspiciousPayloadThreat = this.detectSuspiciousPayload(sourceIP, userAgent, path, method, payload);
    if (suspiciousPayloadThreat) threats.push(suspiciousPayloadThreat);

    // IP Reputation Check
    const ipReputationThreat = await this.checkIPReputation(sourceIP, userAgent, path, method, payload);
    if (ipReputationThreat) threats.push(ipReputationThreat);

    // Anomaly Detection
    if (this.config.enableAnomalyDetection) {
      const anomalyThreat = await this.detectAnomalies(req, sourceIP, userAgent, path, method, payload);
      if (anomalyThreat) threats.push(anomalyThreat);
    }

    return threats;
  }

  /**
   * Detect SQL injection attempts
   */
  private detectSQLInjection(
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): SecurityThreat | null {
    const sqlPatterns = [
      /('|(\\')|(;--|')|(\\';)|(--))/i,
      /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/i,
      /\b(or|and)\s+\d+\s*=\s*\d+/i,
      /\bor\s+\d*\s*=\s*\d*\s*(--|#)/i,
      /\b(waitfor|delay|sleep|benchmark)\s*\(/i,
      /\b(information_schema|sysobjects|sys\.tables)/i,
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(payload)) {
        const threatScore = this.calculateThreatScore('sql_injection', payload.length);
        
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'sql_injection',
          severity: threatScore > 8 ? 'critical' : threatScore > 6 ? 'high' : 'medium',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: payload.substring(0, 200), // Truncate for storage
          threat_score: threatScore,
          blocked: this.config.enableThreatBlocking && threatScore > this.config.threatScoreThreshold,
          timestamp: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect XSS attempts
   */
  private detectXSS(
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): SecurityThreat | null {
    const xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /javascript\s*:/i,
      /on\w+\s*=\s*["'][^"']*["']/i,
      /<iframe[\s\S]*?>/i,
      /<object[\s\S]*?>/i,
      /<embed[\s\S]*?>/i,
      /vbscript\s*:/i,
      /<img[\s\S]*?onerror[\s\S]*?>/i,
      /<svg[\s\S]*?onload[\s\S]*?>/i,
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(payload)) {
        const threatScore = this.calculateThreatScore('xss', payload.length);
        
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'xss',
          severity: threatScore > 7 ? 'high' : 'medium',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: payload.substring(0, 200),
          threat_score: threatScore,
          blocked: this.config.enableThreatBlocking && threatScore > this.config.threatScoreThreshold,
          timestamp: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect directory traversal attempts
   */
  private detectDirectoryTraversal(
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): SecurityThreat | null {
    const traversalPatterns = [
      /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/i,
      /\/etc\/passwd|\/etc\/shadow|\/etc\/hosts/i,
      /\\windows\\system32|\\winnt\\system32/i,
      /%2e%2e%2f|%2e%2e%5c|%2e%2e\//i,
      /\.\.;\/|\.\.;\\|\.\.;/i,
    ];

    const combinedInput = `${path} ${payload}`;
    
    for (const pattern of traversalPatterns) {
      if (pattern.test(combinedInput)) {
        const threatScore = this.calculateThreatScore('directory_traversal', combinedInput.length);
        
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'directory_traversal',
          severity: threatScore > 7 ? 'high' : 'medium',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: payload.substring(0, 200),
          threat_score: threatScore,
          blocked: this.config.enableThreatBlocking && threatScore > this.config.threatScoreThreshold,
          timestamp: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect command injection attempts
   */
  private detectCommandInjection(
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): SecurityThreat | null {
    const cmdPatterns = [
      /[;&|`$(){}[\]]/,
      /\b(cat|ls|pwd|id|whoami|uname|netstat|ps|top|wget|curl)\b/i,
      /\b(rm|mv|cp|chmod|chown|kill|killall)\b/i,
      /\|\s*(cat|ls|pwd|id|whoami)/i,
      /;\s*(cat|ls|pwd|id|whoami)/i,
    ];

    for (const pattern of cmdPatterns) {
      if (pattern.test(payload)) {
        const threatScore = this.calculateThreatScore('command_injection', payload.length);
        
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'command_injection',
          severity: 'critical',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: payload.substring(0, 200),
          threat_score: threatScore,
          blocked: this.config.enableThreatBlocking && threatScore > this.config.threatScoreThreshold,
          timestamp: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect malicious user agents
   */
  private detectMaliciousUserAgent(
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): SecurityThreat | null {
    const maliciousUAPatterns = [
      /sqlmap|havij|pangolin|jsql|blind|injection/i,
      /nikto|nessus|openvas|w3af|burp|zap/i,
      /python-requests|curl|wget|powershell/i,
      /nmap|masscan|zmap|angry/i,
      /<script|javascript|vbscript/i,
    ];

    for (const pattern of maliciousUAPatterns) {
      if (pattern.test(userAgent)) {
        const threatScore = this.calculateThreatScore('suspicious_payload', userAgent.length);
        
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'suspicious_payload',
          severity: 'medium',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: userAgent.substring(0, 200),
          threat_score: threatScore,
          blocked: this.config.enableThreatBlocking && threatScore > this.config.threatScoreThreshold,
          timestamp: new Date(),
        };
      }
    }

    return null;
  }

  /**
   * Detect suspicious payload patterns
   */
  private detectSuspiciousPayload(
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): SecurityThreat | null {
    // Check for unusually long payloads
    if (payload.length > 10000) {
      return {
        id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        type: 'suspicious_payload',
        severity: 'medium',
        source_ip: sourceIP,
        user_agent: userAgent,
        path,
        method,
        payload: `Large payload: ${payload.length} bytes`,
        threat_score: Math.min(8, payload.length / 2000),
        blocked: this.config.enableThreatBlocking && payload.length > 50000,
        timestamp: new Date(),
      };
    }

    // Check for binary content in text fields
    const binaryPattern = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\xFF]/;
    if (binaryPattern.test(payload)) {
      return {
        id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        type: 'suspicious_payload',
        severity: 'medium',
        source_ip: sourceIP,
        user_agent: userAgent,
        path,
        method,
        payload: 'Binary content detected',
        threat_score: 6,
        blocked: this.config.enableThreatBlocking,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Check IP reputation
   */
  private async checkIPReputation(
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): Promise<SecurityThreat | null> {
    try {
      // Check if IP is in our known malicious IP cache
      const cachedReputation = await this.redisManager.getCachedMetrics(`ip:reputation:${sourceIP}`);
      
      if (cachedReputation === 'malicious') {
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'malicious_ip',
          severity: 'high',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: 'Known malicious IP',
          threat_score: 8,
          blocked: this.config.enableThreatBlocking,
          timestamp: new Date(),
        };
      }

      // Check for private/internal IP ranges making external requests
      if (this.isInternalIP(sourceIP) && !this.isInternalPath(path)) {
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'anomalous_behavior',
          severity: 'medium',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: 'Internal IP accessing external resources',
          threat_score: 5,
          blocked: false,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      this.logger.error('IP reputation check failed', { sourceIP, error });
      return null;
    }
  }

  /**
   * Detect anomalous behavior patterns
   */
  private async detectAnomalies(
    req: Request,
    sourceIP: string,
    userAgent: string,
    path: string,
    method: string,
    payload: string
  ): Promise<SecurityThreat | null> {
    try {
      // Check request frequency from same IP
      const recentRequests = await this.getRecentRequestCount(sourceIP);
      
      if (recentRequests > 100) { // More than 100 requests in last minute
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'rate_limit_exceeded',
          severity: 'medium',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: `${recentRequests} requests in last minute`,
          threat_score: Math.min(9, recentRequests / 20),
          blocked: this.config.enableThreatBlocking && recentRequests > 200,
          timestamp: new Date(),
        };
      }

      // Check for unusual request patterns
      const pathPattern = await this.analyzePathPattern(sourceIP, path);
      if (pathPattern.suspicious) {
        return {
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'anomalous_behavior',
          severity: 'low',
          source_ip: sourceIP,
          user_agent: userAgent,
          path,
          method,
          payload: pathPattern.reason,
          threat_score: 4,
          blocked: false,
          timestamp: new Date(),
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Anomaly detection failed', { sourceIP, error });
      return null;
    }
  }

  /**
   * Process detected threat
   */
  private async processThreat(threat: SecurityThreat, req: Request, res: Response): Promise<void> {
    // Add to threat history
    this.threatHistory.push(threat);
    
    // Keep only recent threats
    if (this.threatHistory.length > 1000) {
      this.threatHistory = this.threatHistory.slice(-500);
    }

    // Log threat
    this.logger.warn('Security threat detected', {
      threatId: threat.id,
      type: threat.type,
      severity: threat.severity,
      sourceIP: threat.source_ip,
      path: threat.path,
      threatScore: threat.threat_score,
      blocked: threat.blocked,
    });

    // Publish to CloudWatch
    try {
      await this.cloudwatchService.publishMetric({
        metricName: 'SecurityThreatsDetected',
        namespace: 'Security',
        value: 1,
        unit: 'Count',
        dimensions: [
          { Name: 'ThreatType', Value: threat.type },
          { Name: 'Severity', Value: threat.severity },
        ],
      });
    } catch (error) {
      this.logger.error('Failed to publish security metric', { error });
    }

    // Handle blocking
    if (threat.blocked) {
      this.handleThreatBlocking(threat, req, res);
    }

    // Update IP failure count for brute force detection
    if (threat.type === 'brute_force' || threat.severity === 'critical') {
      this.updateIPFailureCount(threat.source_ip);
    }

    // Emit threat event for external handling
    this.securityAuditService.emit('threat:detected', threat);
  }

  /**
   * Handle threat blocking
   */
  private handleThreatBlocking(threat: SecurityThreat, req: Request, res: Response): void {
    // Block the request
    res.status(403).json({
      status: 'error',
      error: 'Request blocked due to security threat',
      threat_id: threat.id,
      message: 'Your request has been identified as potentially malicious and has been blocked.',
    });

    // Add IP to blocked list if severe enough
    if (threat.severity === 'critical' || threat.threat_score > 8) {
      this.blockedIPs.add(threat.source_ip);
      
      // Set expiration for blocked IP
      setTimeout(() => {
        this.blockedIPs.delete(threat.source_ip);
        this.logger.info('IP unblocked after timeout', { ip: threat.source_ip });
      }, this.config.blockDurationMinutes * 60 * 1000);
    }
  }

  /**
   * Utility methods
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           '0.0.0.0';
  }

  private extractPayload(req: Request): string {
    const parts = [];
    
    // URL parameters
    if (req.query) {
      parts.push(JSON.stringify(req.query));
    }
    
    // Request body
    if (req.body) {
      parts.push(JSON.stringify(req.body));
    }
    
    // Headers that might contain payloads
    const suspiciousHeaders = ['referer', 'user-agent', 'x-forwarded-for'];
    for (const header of suspiciousHeaders) {
      const value = req.get(header);
      if (value) {
        parts.push(value);
      }
    }
    
    return parts.join(' ');
  }

  private calculateThreatScore(type: string, payloadLength: number): number {
    const baseScores = {
      sql_injection: 8,
      xss: 6,
      directory_traversal: 7,
      command_injection: 9,
      suspicious_payload: 4,
      malicious_ip: 8,
    };

    const baseScore = baseScores[type as keyof typeof baseScores] || 5;
    const lengthMultiplier = Math.min(2, payloadLength / 1000);
    
    return Math.min(10, baseScore + lengthMultiplier);
  }

  private initializeSuspiciousPatterns(): void {
    this.suspiciousPatterns = [
      /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/i,
      /<script[\s\S]*?>[\s\S]*?<\/script>/i,
      /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/i,
      /[;&|`$(){}[\]]/,
      /javascript\s*:/i,
      /on\w+\s*=\s*["'][^"']*["']/i,
    ];
  }

  private async checkRateLimit(sourceIP: string, req: Request, res: Response): Promise<void> {
    const key = `rate_limit:${sourceIP}`;
    
    try {
      const currentCount = await this.redisManager.getRateLimit(key);
      const limit = 60; // 60 requests per minute
      
      if (currentCount && currentCount > limit) {
        this.processThreat({
          id: `threat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          type: 'rate_limit_exceeded',
          severity: 'medium',
          source_ip: sourceIP,
          user_agent: req.get('User-Agent') || '',
          path: req.path,
          method: req.method,
          payload: `Rate limit exceeded: ${currentCount} requests`,
          threat_score: Math.min(8, currentCount / 10),
          blocked: currentCount > limit * 2,
          timestamp: new Date(),
        }, req, res);
      }
      
      // Increment counter
      await this.redisManager.setRateLimit(key, (currentCount || 0) + 1, 60);
      
    } catch (error) {
      this.logger.error('Rate limit check failed', { sourceIP, error });
    }
  }

  private handleBlockedRequest(req: Request, res: Response, sourceIP: string): void {
    res.status(403).json({
      status: 'error',
      error: 'IP address blocked due to suspicious activity',
      message: 'Your IP has been temporarily blocked. Contact support if you believe this is an error.',
    });

    this.logger.warn('Blocked IP attempted access', {
      ip: sourceIP,
      path: req.path,
      userAgent: req.get('User-Agent'),
    });
  }

  private async logSecurityEvent(req: Request, threats: SecurityThreat[]): Promise<void> {
    try {
      await this.cloudwatchService.logEvent({
        level: threats.length > 0 ? 'WARN' : 'INFO',
        message: 'Security monitoring event',
        metadata: {
          ip: this.getClientIP(req),
          path: req.path,
          method: req.method,
          userAgent: req.get('User-Agent'),
          threatsDetected: threats.length,
          threats: threats.map(t => ({
            id: t.id,
            type: t.type,
            severity: t.severity,
            blocked: t.blocked,
          })),
        },
      });
    } catch (error) {
      this.logger.error('Failed to log security event', { error });
    }
  }

  private updateMetrics(threats: SecurityThreat[], responseTime: number): void {
    this.metrics.threats_detected += threats.length;
    this.metrics.threats_blocked += threats.filter(t => t.blocked).length;
    
    for (const threat of threats) {
      this.metrics.suspicious_ips.add(threat.source_ip);
      
      const count = this.metrics.attack_patterns.get(threat.type) || 0;
      this.metrics.attack_patterns.set(threat.type, count + 1);
    }

    this.metrics.response_times.push(responseTime);
    if (this.metrics.response_times.length > 100) {
      this.metrics.response_times = this.metrics.response_times.slice(-50);
    }
  }

  private updateIPFailureCount(sourceIP: string): void {
    const current = this.ipFailureCount.get(sourceIP) || 0;
    const newCount = current + 1;
    
    this.ipFailureCount.set(sourceIP, newCount);
    
    if (newCount >= this.config.maxFailuresPerIP) {
      this.blockedIPs.add(sourceIP);
      this.ipFailureCount.delete(sourceIP);
      
      this.logger.warn('IP blocked due to excessive failures', {
        ip: sourceIP,
        failureCount: newCount,
      });
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up old data every hour
    setInterval(() => {
      // Clean threat history
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      this.threatHistory = this.threatHistory.filter(t => t.timestamp.getTime() > cutoff);
      
      // Reset metrics periodically
      if (this.metrics.response_times.length > 1000) {
        this.metrics.response_times = [];
      }
      
      this.logger.debug('Security monitoring cleanup completed');
    }, 60 * 60 * 1000); // 1 hour
  }

  // Additional helper methods would be implemented here
  private isInternalIP(ip: string): boolean {
    return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(ip);
  }

  private isInternalPath(path: string): boolean {
    return path.startsWith('/api/v1/') || path.startsWith('/health') || path === '/';
  }

  private async getRecentRequestCount(sourceIP: string): Promise<number> {
    try {
      const count = await this.redisManager.getRateLimit(`recent:${sourceIP}`);
      return count || 0;
    } catch {
      return 0;
    }
  }

  private async analyzePathPattern(sourceIP: string, path: string): Promise<{ suspicious: boolean; reason: string }> {
    // Simple pattern analysis - would be more sophisticated in production
    const suspiciousPaths = ['/admin', '/config', '/system', '/.env', '/backup'];
    
    if (suspiciousPaths.some(sp => path.includes(sp))) {
      return {
        suspicious: true,
        reason: 'Accessing sensitive path without authentication',
      };
    }
    
    return { suspicious: false, reason: '' };
  }

  /**
   * Get security metrics
   */
  getMetrics(): SecurityMetrics {
    return {
      ...this.metrics,
      suspicious_ips: new Set(this.metrics.suspicious_ips),
      attack_patterns: new Map(this.metrics.attack_patterns),
    };
  }

  /**
   * Get recent threats
   */
  getRecentThreats(hours: number = 24): SecurityThreat[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.threatHistory.filter(t => t.timestamp.getTime() > cutoff);
  }
}

/**
 * Factory function to create security monitoring middleware
 */
export function createSecurityMonitoringMiddleware(
  securityAuditService: SecurityAuditService,
  cloudwatchService: CloudWatchMonitoringService,
  redisManager: RedisManager,
  logger: winston.Logger,
  config: {
    enableThreatBlocking: boolean;
    maxFailuresPerIP: number;
    blockDurationMinutes: number;
    threatScoreThreshold: number;
    enableAnomalyDetection: boolean;
    logAllRequests: boolean;
  }
): SecurityMonitoringMiddleware {
  return new SecurityMonitoringMiddleware(
    securityAuditService,
    cloudwatchService,
    redisManager,
    logger,
    config
  );
}