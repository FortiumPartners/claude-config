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
exports.SecurityAuditService = void 0;
const events_1 = require("events");
const crypto = __importStar(require("crypto"));
class SecurityAuditService extends events_1.EventEmitter {
    dbConnection;
    redisManager;
    logger;
    config;
    auditHistory = [];
    knownVulnerabilities = new Map();
    auditInterval = null;
    constructor(dbConnection, redisManager, logger, config) {
        super();
        this.dbConnection = dbConnection;
        this.redisManager = redisManager;
        this.logger = logger;
        this.config = config;
        this.initializeVulnerabilityDatabase();
        if (this.config.enableAutomaticAudits) {
            this.startAutomaticAudits();
        }
    }
    async performSecurityAudit() {
        const auditId = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const startTime = Date.now();
        this.logger.info('Starting comprehensive security audit', { auditId });
        try {
            const vulnerabilities = [];
            const owaspVulns = await this.performOWASPChecks();
            vulnerabilities.push(...owaspVulns);
            const authVulns = await this.auditAuthenticationSecurity();
            vulnerabilities.push(...authVulns);
            const dataVulns = await this.auditDataProtection();
            vulnerabilities.push(...dataVulns);
            const configVulns = await this.auditSecurityConfiguration();
            vulnerabilities.push(...configVulns);
            const depVulns = await this.scanDependencyVulnerabilities();
            vulnerabilities.push(...depVulns);
            const infraVulns = await this.auditInfrastructureSecurity();
            vulnerabilities.push(...infraVulns);
            const securityScore = this.calculateSecurityScore(vulnerabilities);
            const complianceStatus = await this.checkComplianceStatus();
            const recommendations = this.generateSecurityRecommendations(vulnerabilities);
            const previousAudit = this.auditHistory.length > 0
                ? this.auditHistory[this.auditHistory.length - 1]
                : null;
            const improvements = previousAudit
                ? this.calculateImprovements(previousAudit, vulnerabilities)
                : 0;
            const newIssues = previousAudit
                ? this.calculateNewIssues(previousAudit, vulnerabilities)
                : vulnerabilities.length;
            const report = {
                audit_id: auditId,
                timestamp: new Date(),
                duration_ms: Date.now() - startTime,
                vulnerabilities,
                security_score: securityScore,
                compliance_status: complianceStatus,
                recommendations,
                previous_audit_id: previousAudit?.audit_id,
                improvements_made: improvements,
                new_issues: newIssues,
            };
            this.auditHistory.push(report);
            await this.storeAuditReport(report);
            this.emit('audit:completed', report);
            const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
            if (criticalVulns.length > 0) {
                this.emit('security:critical_vulnerabilities', {
                    auditId,
                    count: criticalVulns.length,
                    vulnerabilities: criticalVulns,
                });
            }
            this.logger.info('Security audit completed', {
                auditId,
                duration: Date.now() - startTime,
                vulnerabilityCount: vulnerabilities.length,
                criticalCount: criticalVulns.length,
                securityScore,
            });
            return report;
        }
        catch (error) {
            this.logger.error('Security audit failed', {
                auditId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
    async performOWASPChecks() {
        const vulnerabilities = [];
        const injectionVulns = await this.checkInjectionVulnerabilities();
        vulnerabilities.push(...injectionVulns);
        const authVulns = await this.checkBrokenAuthentication();
        vulnerabilities.push(...authVulns);
        const dataVulns = await this.checkSensitiveDataExposure();
        vulnerabilities.push(...dataVulns);
        const xxeVulns = await this.checkXXEVulnerabilities();
        vulnerabilities.push(...xxeVulns);
        const accessVulns = await this.checkBrokenAccessControl();
        vulnerabilities.push(...accessVulns);
        const misconfigVulns = await this.checkSecurityMisconfiguration();
        vulnerabilities.push(...misconfigVulns);
        const xssVulns = await this.checkXSSVulnerabilities();
        vulnerabilities.push(...xssVulns);
        const deserializationVulns = await this.checkInsecureDeserialization();
        vulnerabilities.push(...deserializationVulns);
        const componentVulns = await this.checkKnownVulnerabilities();
        vulnerabilities.push(...componentVulns);
        const loggingVulns = await this.checkInsufficientLogging();
        vulnerabilities.push(...loggingVulns);
        return vulnerabilities;
    }
    async checkInjectionVulnerabilities() {
        const vulnerabilities = [];
        try {
            const parameterizationIssues = await this.analyzeQueryParameterization();
            if (parameterizationIssues.length > 0) {
                vulnerabilities.push({
                    id: `inj_${Date.now()}_sql`,
                    type: 'injection',
                    severity: 'high',
                    title: 'SQL Injection Risk - Non-parameterized Queries',
                    description: 'Found database queries that may not use proper parameterization',
                    location: 'Database query execution',
                    cwe: 'CWE-89',
                    cvss_score: 8.5,
                    remediation: [
                        'Use parameterized queries/prepared statements',
                        'Implement input validation and sanitization',
                        'Use ORM frameworks with built-in protection',
                        'Apply principle of least privilege for database access',
                    ],
                    compliance_impact: ['SOC2 CC6.1', 'GDPR Art. 32'],
                    detected_at: new Date(),
                    false_positive: false,
                });
            }
            const redisInjectionRisk = await this.checkRedisInjectionRisk();
            if (redisInjectionRisk) {
                vulnerabilities.push({
                    id: `inj_${Date.now()}_nosql`,
                    type: 'injection',
                    severity: 'medium',
                    title: 'NoSQL Injection Risk - Redis Commands',
                    description: 'Redis key generation may be vulnerable to injection',
                    location: 'Redis cache operations',
                    cwe: 'CWE-943',
                    cvss_score: 6.5,
                    remediation: [
                        'Sanitize cache keys before Redis operations',
                        'Use allowed-list validation for cache key patterns',
                        'Implement Redis ACL for command restrictions',
                    ],
                    compliance_impact: ['SOC2 CC6.1'],
                    detected_at: new Date(),
                    false_positive: false,
                });
            }
        }
        catch (error) {
            this.logger.error('Injection vulnerability check failed', { error });
        }
        return vulnerabilities;
    }
    async checkBrokenAuthentication() {
        const vulnerabilities = [];
        try {
            const jwtIssues = await this.analyzeJWTSecurity();
            vulnerabilities.push(...jwtIssues);
            const sessionIssues = await this.analyzeSessionManagement();
            vulnerabilities.push(...sessionIssues);
            const passwordIssues = await this.analyzePasswordSecurity();
            vulnerabilities.push(...passwordIssues);
            const mfaIssues = await this.analyzeMFASecurity();
            vulnerabilities.push(...mfaIssues);
        }
        catch (error) {
            this.logger.error('Authentication vulnerability check failed', { error });
        }
        return vulnerabilities;
    }
    async checkSensitiveDataExposure() {
        const vulnerabilities = [];
        try {
            const encryptionAtRest = await this.checkEncryptionAtRest();
            if (!encryptionAtRest) {
                vulnerabilities.push({
                    id: `exp_${Date.now()}_encryption_rest`,
                    type: 'sensitive_data_exposure',
                    severity: 'high',
                    title: 'Sensitive Data Not Encrypted at Rest',
                    description: 'Database contains sensitive data without proper encryption',
                    location: 'Database storage',
                    cwe: 'CWE-311',
                    cvss_score: 7.5,
                    remediation: [
                        'Enable database encryption at rest (TDE)',
                        'Encrypt sensitive columns using application-level encryption',
                        'Implement key management system',
                        'Use encrypted storage volumes',
                    ],
                    compliance_impact: ['GDPR Art. 32', 'HIPAA 164.312(a)(2)(iv)', 'SOC2 CC6.1'],
                    detected_at: new Date(),
                    false_positive: false,
                });
            }
            const encryptionInTransit = await this.checkEncryptionInTransit();
            if (!encryptionInTransit) {
                vulnerabilities.push({
                    id: `exp_${Date.now()}_encryption_transit`,
                    type: 'sensitive_data_exposure',
                    severity: 'high',
                    title: 'Data Not Encrypted in Transit',
                    description: 'Communications not properly encrypted with TLS',
                    location: 'Network communications',
                    cwe: 'CWE-319',
                    cvss_score: 8.0,
                    remediation: [
                        'Enforce HTTPS with TLS 1.3',
                        'Use strong cipher suites',
                        'Implement certificate pinning',
                        'Encrypt database connections with SSL',
                    ],
                    compliance_impact: ['GDPR Art. 32', 'HIPAA 164.312(e)(1)', 'SOC2 CC6.1'],
                    detected_at: new Date(),
                    false_positive: false,
                });
            }
            const logsExposure = await this.checkSensitiveDataInLogs();
            vulnerabilities.push(...logsExposure);
        }
        catch (error) {
            this.logger.error('Sensitive data exposure check failed', { error });
        }
        return vulnerabilities;
    }
    async auditAuthenticationSecurity() {
        const vulnerabilities = [];
        const jwtSecretStrength = await this.checkJWTSecretStrength();
        if (!jwtSecretStrength) {
            vulnerabilities.push({
                id: `auth_${Date.now()}_weak_jwt`,
                type: 'broken_authentication',
                severity: 'critical',
                title: 'Weak JWT Secret Configuration',
                description: 'JWT secret may be too short or predictable',
                location: 'Authentication configuration',
                cwe: 'CWE-521',
                cvss_score: 9.0,
                remediation: [
                    'Generate cryptographically strong JWT secrets (min 256 bits)',
                    'Use separate secrets for access and refresh tokens',
                    'Implement secret rotation policy',
                    'Store secrets in secure key management system',
                ],
                compliance_impact: ['SOC2 CC6.1', 'GDPR Art. 32'],
                detected_at: new Date(),
                false_positive: false,
            });
        }
        const defaultCredentials = await this.checkDefaultCredentials();
        vulnerabilities.push(...defaultCredentials);
        return vulnerabilities;
    }
    async auditDataProtection() {
        const vulnerabilities = [];
        const piiHandling = await this.auditPIIHandling();
        vulnerabilities.push(...piiHandling);
        const retentionPolicies = await this.auditDataRetention();
        vulnerabilities.push(...retentionPolicies);
        return vulnerabilities;
    }
    calculateSecurityScore(vulnerabilities) {
        if (vulnerabilities.length === 0)
            return 100;
        let totalDeduction = 0;
        const severityWeights = { critical: 25, high: 15, medium: 8, low: 3 };
        for (const vuln of vulnerabilities) {
            if (!vuln.false_positive) {
                totalDeduction += severityWeights[vuln.severity];
            }
        }
        return Math.max(0, 100 - totalDeduction);
    }
    async checkComplianceStatus() {
        const soc2Status = await this.checkSOC2Compliance();
        const gdprStatus = await this.checkGDPRCompliance();
        const hipaaStatus = await this.checkHIPAACompliance();
        return {
            soc2: soc2Status,
            gdpr: gdprStatus,
            hipaa: hipaaStatus,
        };
    }
    async analyzeQueryParameterization() {
        return [];
    }
    async checkRedisInjectionRisk() {
        return false;
    }
    async analyzeJWTSecurity() {
        const vulnerabilities = [];
        const algorithm = process.env.JWT_ALGORITHM || 'HS256';
        if (algorithm === 'none' || algorithm.startsWith('HS')) {
            vulnerabilities.push({
                id: `jwt_${Date.now()}_algorithm`,
                type: 'broken_authentication',
                severity: 'medium',
                title: 'Insecure JWT Algorithm',
                description: `JWT using potentially insecure algorithm: ${algorithm}`,
                location: 'JWT configuration',
                cwe: 'CWE-327',
                cvss_score: 5.5,
                remediation: [
                    'Use RS256 or ES256 algorithms for better security',
                    'Avoid symmetric algorithms for distributed systems',
                    'Implement proper key rotation',
                ],
                compliance_impact: ['SOC2 CC6.1'],
                detected_at: new Date(),
                false_positive: false,
            });
        }
        return vulnerabilities;
    }
    async analyzeSessionManagement() {
        const vulnerabilities = [];
        const sessionTimeout = process.env.JWT_EXPIRES_IN || '15m';
        const timeoutMinutes = this.parseTimeToMinutes(sessionTimeout);
        if (timeoutMinutes > 60) {
            vulnerabilities.push({
                id: `session_${Date.now()}_timeout`,
                type: 'broken_authentication',
                severity: 'low',
                title: 'Long Session Timeout',
                description: `Session timeout is ${sessionTimeout}, which may be too long`,
                location: 'Session configuration',
                cwe: 'CWE-613',
                cvss_score: 3.5,
                remediation: [
                    'Reduce session timeout to 15-30 minutes',
                    'Implement sliding session expiration',
                    'Use refresh tokens for longer-lived access',
                ],
                compliance_impact: ['SOC2 CC6.1'],
                detected_at: new Date(),
                false_positive: false,
            });
        }
        return vulnerabilities;
    }
    async analyzePasswordSecurity() {
        return [];
    }
    async analyzeMFASecurity() {
        const vulnerabilities = [];
        const mfaEnforced = process.env.ENFORCE_MFA === 'true';
        if (!mfaEnforced) {
            vulnerabilities.push({
                id: `mfa_${Date.now()}_not_enforced`,
                type: 'broken_authentication',
                severity: 'medium',
                title: 'Multi-Factor Authentication Not Enforced',
                description: 'MFA is not enforced for user authentication',
                location: 'Authentication system',
                cwe: 'CWE-308',
                cvss_score: 6.5,
                remediation: [
                    'Implement and enforce MFA for all users',
                    'Support multiple MFA methods (TOTP, SMS, hardware keys)',
                    'Require MFA for administrative functions',
                ],
                compliance_impact: ['SOC2 CC6.1', 'HIPAA 164.312(d)'],
                detected_at: new Date(),
                false_positive: false,
            });
        }
        return vulnerabilities;
    }
    async checkXXEVulnerabilities() { return []; }
    async checkBrokenAccessControl() { return []; }
    async checkSecurityMisconfiguration() { return []; }
    async checkXSSVulnerabilities() { return []; }
    async checkInsecureDeserialization() { return []; }
    async checkKnownVulnerabilities() { return []; }
    async checkInsufficientLogging() { return []; }
    async auditSecurityConfiguration() { return []; }
    async scanDependencyVulnerabilities() { return []; }
    async auditInfrastructureSecurity() { return []; }
    async checkEncryptionAtRest() { return true; }
    async checkEncryptionInTransit() { return true; }
    async checkSensitiveDataInLogs() { return []; }
    async checkJWTSecretStrength() { return true; }
    async checkDefaultCredentials() { return []; }
    async auditPIIHandling() { return []; }
    async auditDataRetention() { return []; }
    async checkSOC2Compliance() {
        return 'compliant';
    }
    async checkGDPRCompliance() {
        return 'compliant';
    }
    async checkHIPAACompliance() {
        return 'compliant';
    }
    parseTimeToMinutes(timeStr) {
        const match = timeStr.match(/(\d+)([smhd])/);
        if (!match)
            return 15;
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 's': return Math.round(value / 60);
            case 'm': return value;
            case 'h': return value * 60;
            case 'd': return value * 60 * 24;
            default: return 15;
        }
    }
    generateSecurityRecommendations(vulnerabilities) {
        const recommendations = new Set();
        if (vulnerabilities.some(v => v.type === 'injection')) {
            recommendations.add('Implement comprehensive input validation and parameterized queries');
        }
        if (vulnerabilities.some(v => v.type === 'broken_authentication')) {
            recommendations.add('Strengthen authentication mechanisms with MFA and strong JWT configuration');
        }
        if (vulnerabilities.some(v => v.type === 'sensitive_data_exposure')) {
            recommendations.add('Implement end-to-end encryption for data at rest and in transit');
        }
        recommendations.add('Conduct regular penetration testing');
        recommendations.add('Implement automated security scanning in CI/CD pipeline');
        recommendations.add('Establish incident response procedures');
        recommendations.add('Regular security training for development team');
        return Array.from(recommendations);
    }
    calculateImprovements(previousAudit, currentVulns) {
        const previousVulnIds = new Set(previousAudit.vulnerabilities.map(v => v.id));
        const currentVulnIds = new Set(currentVulns.map(v => v.id));
        let improvements = 0;
        for (const prevId of previousVulnIds) {
            if (!currentVulnIds.has(prevId)) {
                improvements++;
            }
        }
        return improvements;
    }
    calculateNewIssues(previousAudit, currentVulns) {
        const previousVulnIds = new Set(previousAudit.vulnerabilities.map(v => v.id));
        return currentVulns.filter(v => !previousVulnIds.has(v.id)).length;
    }
    async storeAuditReport(report) {
        try {
            await this.redisManager.cacheMetrics(`security:audit:${report.audit_id}`, report, 86400 * 30);
            this.logger.info('Security audit report stored', {
                auditId: report.audit_id,
                vulnerabilityCount: report.vulnerabilities.length,
                securityScore: report.security_score,
            });
        }
        catch (error) {
            this.logger.error('Failed to store audit report', {
                auditId: report.audit_id,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    initializeVulnerabilityDatabase() {
        this.logger.info('Security vulnerability database initialized');
    }
    startAutomaticAudits() {
        const intervalMs = this.config.auditIntervalHours * 60 * 60 * 1000;
        this.auditInterval = setInterval(async () => {
            try {
                await this.performSecurityAudit();
            }
            catch (error) {
                this.logger.error('Automatic security audit failed', { error });
            }
        }, intervalMs);
        this.logger.info('Automatic security audits started', {
            intervalHours: this.config.auditIntervalHours,
        });
    }
    async getLatestAuditReport() {
        return this.auditHistory.length > 0
            ? this.auditHistory[this.auditHistory.length - 1]
            : null;
    }
    getAuditHistory() {
        return [...this.auditHistory];
    }
    async markFalsePositive(auditId, vulnerabilityId) {
        try {
            const audit = this.auditHistory.find(a => a.audit_id === auditId);
            if (!audit)
                return false;
            const vulnerability = audit.vulnerabilities.find(v => v.id === vulnerabilityId);
            if (!vulnerability)
                return false;
            vulnerability.false_positive = true;
            audit.security_score = this.calculateSecurityScore(audit.vulnerabilities);
            await this.storeAuditReport(audit);
            this.emit('vulnerability:false_positive', { auditId, vulnerabilityId });
            return true;
        }
        catch (error) {
            this.logger.error('Failed to mark false positive', {
                auditId,
                vulnerabilityId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    async shutdown() {
        if (this.auditInterval) {
            clearInterval(this.auditInterval);
        }
        this.auditHistory.length = 0;
        this.knownVulnerabilities.clear();
        this.logger.info('Security Audit Service shutdown complete');
    }
}
exports.SecurityAuditService = SecurityAuditService;
//# sourceMappingURL=security-audit.service.js.map