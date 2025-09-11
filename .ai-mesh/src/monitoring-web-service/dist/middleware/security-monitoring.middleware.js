"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityMonitoringMiddleware = void 0;
exports.createSecurityMonitoringMiddleware = createSecurityMonitoringMiddleware;
const crypto = __importStar(require("crypto"));
class SecurityMonitoringMiddleware {
    securityAuditService;
    cloudwatchService;
    redisManager;
    logger;
    config;
    threatHistory = [];
    metrics;
    ipFailureCount = new Map();
    blockedIPs = new Set();
    suspiciousPatterns;
    constructor(securityAuditService, cloudwatchService, redisManager, logger, config) {
        this.securityAuditService = securityAuditService;
        this.cloudwatchService = cloudwatchService;
        this.redisManager = redisManager;
        this.logger = logger;
        this.config = config;
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
    monitor() {
        return async (req, res, next) => {
            const startTime = Date.now();
            try {
                const sourceIP = this.getClientIP(req);
                const userAgent = req.get('User-Agent') || '';
                const path = req.path;
                const method = req.method;
                const payload = this.extractPayload(req);
                if (this.blockedIPs.has(sourceIP)) {
                    return this.handleBlockedRequest(req, res, sourceIP);
                }
                const threats = await this.detectThreats(req, sourceIP, userAgent, path, method, payload);
                for (const threat of threats) {
                    await this.processThreat(threat, req, res);
                }
                await this.checkRateLimit(sourceIP, req, res);
                if (this.config.logAllRequests || threats.length > 0) {
                    await this.logSecurityEvent(req, threats);
                }
                this.updateMetrics(threats, Date.now() - startTime);
                const blockingThreats = threats.filter(t => t.blocked);
                if (blockingThreats.length === 0) {
                    next();
                }
            }
            catch (error) {
                this.logger.error('Security monitoring failed', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    path: req.path,
                    ip: this.getClientIP(req),
                });
                next();
            }
        };
    }
    async detectThreats(req, sourceIP, userAgent, path, method, payload) {
        const threats = [];
        const sqlInjectionThreat = this.detectSQLInjection(sourceIP, userAgent, path, method, payload);
        if (sqlInjectionThreat)
            threats.push(sqlInjectionThreat);
        const xssThreat = this.detectXSS(sourceIP, userAgent, path, method, payload);
        if (xssThreat)
            threats.push(xssThreat);
        const traversalThreat = this.detectDirectoryTraversal(sourceIP, userAgent, path, method, payload);
        if (traversalThreat)
            threats.push(traversalThreat);
        const cmdInjectionThreat = this.detectCommandInjection(sourceIP, userAgent, path, method, payload);
        if (cmdInjectionThreat)
            threats.push(cmdInjectionThreat);
        const maliciousUAThreat = this.detectMaliciousUserAgent(sourceIP, userAgent, path, method, payload);
        if (maliciousUAThreat)
            threats.push(maliciousUAThreat);
        const suspiciousPayloadThreat = this.detectSuspiciousPayload(sourceIP, userAgent, path, method, payload);
        if (suspiciousPayloadThreat)
            threats.push(suspiciousPayloadThreat);
        const ipReputationThreat = await this.checkIPReputation(sourceIP, userAgent, path, method, payload);
        if (ipReputationThreat)
            threats.push(ipReputationThreat);
        if (this.config.enableAnomalyDetection) {
            const anomalyThreat = await this.detectAnomalies(req, sourceIP, userAgent, path, method, payload);
            if (anomalyThreat)
                threats.push(anomalyThreat);
        }
        return threats;
    }
    detectSQLInjection(sourceIP, userAgent, path, method, payload) {
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
                    payload: payload.substring(0, 200),
                    threat_score: threatScore,
                    blocked: this.config.enableThreatBlocking && threatScore > this.config.threatScoreThreshold,
                    timestamp: new Date(),
                };
            }
        }
        return null;
    }
    detectXSS(sourceIP, userAgent, path, method, payload) {
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
    detectDirectoryTraversal(sourceIP, userAgent, path, method, payload) {
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
    detectCommandInjection(sourceIP, userAgent, path, method, payload) {
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
    detectMaliciousUserAgent(sourceIP, userAgent, path, method, payload) {
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
    detectSuspiciousPayload(sourceIP, userAgent, path, method, payload) {
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
    async checkIPReputation(sourceIP, userAgent, path, method, payload) {
        try {
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
        }
        catch (error) {
            this.logger.error('IP reputation check failed', { sourceIP, error });
            return null;
        }
    }
    async detectAnomalies(req, sourceIP, userAgent, path, method, payload) {
        try {
            const recentRequests = await this.getRecentRequestCount(sourceIP);
            if (recentRequests > 100) {
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
        }
        catch (error) {
            this.logger.error('Anomaly detection failed', { sourceIP, error });
            return null;
        }
    }
    async processThreat(threat, req, res) {
        this.threatHistory.push(threat);
        if (this.threatHistory.length > 1000) {
            this.threatHistory = this.threatHistory.slice(-500);
        }
        this.logger.warn('Security threat detected', {
            threatId: threat.id,
            type: threat.type,
            severity: threat.severity,
            sourceIP: threat.source_ip,
            path: threat.path,
            threatScore: threat.threat_score,
            blocked: threat.blocked,
        });
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
        }
        catch (error) {
            this.logger.error('Failed to publish security metric', { error });
        }
        if (threat.blocked) {
            this.handleThreatBlocking(threat, req, res);
        }
        if (threat.type === 'brute_force' || threat.severity === 'critical') {
            this.updateIPFailureCount(threat.source_ip);
        }
        this.securityAuditService.emit('threat:detected', threat);
    }
    handleThreatBlocking(threat, req, res) {
        res.status(403).json({
            status: 'error',
            error: 'Request blocked due to security threat',
            threat_id: threat.id,
            message: 'Your request has been identified as potentially malicious and has been blocked.',
        });
        if (threat.severity === 'critical' || threat.threat_score > 8) {
            this.blockedIPs.add(threat.source_ip);
            setTimeout(() => {
                this.blockedIPs.delete(threat.source_ip);
                this.logger.info('IP unblocked after timeout', { ip: threat.source_ip });
            }, this.config.blockDurationMinutes * 60 * 1000);
        }
    }
    getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            '0.0.0.0';
    }
    extractPayload(req) {
        const parts = [];
        if (req.query) {
            parts.push(JSON.stringify(req.query));
        }
        if (req.body) {
            parts.push(JSON.stringify(req.body));
        }
        const suspiciousHeaders = ['referer', 'user-agent', 'x-forwarded-for'];
        for (const header of suspiciousHeaders) {
            const value = req.get(header);
            if (value) {
                parts.push(value);
            }
        }
        return parts.join(' ');
    }
    calculateThreatScore(type, payloadLength) {
        const baseScores = {
            sql_injection: 8,
            xss: 6,
            directory_traversal: 7,
            command_injection: 9,
            suspicious_payload: 4,
            malicious_ip: 8,
        };
        const baseScore = baseScores[type] || 5;
        const lengthMultiplier = Math.min(2, payloadLength / 1000);
        return Math.min(10, baseScore + lengthMultiplier);
    }
    initializeSuspiciousPatterns() {
        this.suspiciousPatterns = [
            /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/i,
            /<script[\s\S]*?>[\s\S]*?<\/script>/i,
            /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/i,
            /[;&|`$(){}[\]]/,
            /javascript\s*:/i,
            /on\w+\s*=\s*["'][^"']*["']/i,
        ];
    }
    async checkRateLimit(sourceIP, req, res) {
        const key = `rate_limit:${sourceIP}`;
        try {
            const currentCount = await this.redisManager.getRateLimit(key);
            const limit = 60;
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
            await this.redisManager.setRateLimit(key, (currentCount || 0) + 1, 60);
        }
        catch (error) {
            this.logger.error('Rate limit check failed', { sourceIP, error });
        }
    }
    handleBlockedRequest(req, res, sourceIP) {
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
    async logSecurityEvent(req, threats) {
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
        }
        catch (error) {
            this.logger.error('Failed to log security event', { error });
        }
    }
    updateMetrics(threats, responseTime) {
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
    updateIPFailureCount(sourceIP) {
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
    startPeriodicCleanup() {
        setInterval(() => {
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            this.threatHistory = this.threatHistory.filter(t => t.timestamp.getTime() > cutoff);
            if (this.metrics.response_times.length > 1000) {
                this.metrics.response_times = [];
            }
            this.logger.debug('Security monitoring cleanup completed');
        }, 60 * 60 * 1000);
    }
    isInternalIP(ip) {
        return /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(ip);
    }
    isInternalPath(path) {
        return path.startsWith('/api/v1/') || path.startsWith('/health') || path === '/';
    }
    async getRecentRequestCount(sourceIP) {
        try {
            const count = await this.redisManager.getRateLimit(`recent:${sourceIP}`);
            return count || 0;
        }
        catch {
            return 0;
        }
    }
    async analyzePathPattern(sourceIP, path) {
        const suspiciousPaths = ['/admin', '/config', '/system', '/.env', '/backup'];
        if (suspiciousPaths.some(sp => path.includes(sp))) {
            return {
                suspicious: true,
                reason: 'Accessing sensitive path without authentication',
            };
        }
        return { suspicious: false, reason: '' };
    }
    getMetrics() {
        return {
            ...this.metrics,
            suspicious_ips: new Set(this.metrics.suspicious_ips),
            attack_patterns: new Map(this.metrics.attack_patterns),
        };
    }
    getRecentThreats(hours = 24) {
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        return this.threatHistory.filter(t => t.timestamp.getTime() > cutoff);
    }
}
exports.SecurityMonitoringMiddleware = SecurityMonitoringMiddleware;
function createSecurityMonitoringMiddleware(securityAuditService, cloudwatchService, redisManager, logger, config) {
    return new SecurityMonitoringMiddleware(securityAuditService, cloudwatchService, redisManager, logger, config);
}
//# sourceMappingURL=security-monitoring.middleware.js.map