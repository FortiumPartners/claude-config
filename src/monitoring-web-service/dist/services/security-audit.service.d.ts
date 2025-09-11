import * as winston from 'winston';
import { EventEmitter } from 'events';
import { DatabaseConnection } from '../database/connection';
import { RedisManager } from '../config/redis.config';
export interface SecurityVulnerability {
    id: string;
    type: 'injection' | 'broken_authentication' | 'sensitive_data_exposure' | 'xml_external_entities' | 'broken_access_control' | 'security_misconfiguration' | 'xss' | 'insecure_deserialization' | 'known_vulnerabilities' | 'insufficient_logging';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    location: string;
    cwe: string;
    cvss_score: number;
    remediation: string[];
    compliance_impact: string[];
    detected_at: Date;
    false_positive: boolean;
}
export interface SecurityAuditReport {
    audit_id: string;
    timestamp: Date;
    duration_ms: number;
    vulnerabilities: SecurityVulnerability[];
    security_score: number;
    compliance_status: {
        soc2: 'compliant' | 'non_compliant' | 'partial';
        gdpr: 'compliant' | 'non_compliant' | 'partial';
        hipaa: 'compliant' | 'non_compliant' | 'partial';
    };
    recommendations: string[];
    previous_audit_id?: string;
    improvements_made: number;
    new_issues: number;
}
export interface ComplianceCheck {
    framework: 'SOC2' | 'GDPR' | 'HIPAA';
    control_id: string;
    control_description: string;
    status: 'pass' | 'fail' | 'not_applicable';
    evidence: string[];
    recommendations: string[];
}
export declare class SecurityAuditService extends EventEmitter {
    private dbConnection;
    private redisManager;
    private logger;
    private config;
    private auditHistory;
    private knownVulnerabilities;
    private auditInterval;
    constructor(dbConnection: DatabaseConnection, redisManager: RedisManager, logger: winston.Logger, config: {
        enableAutomaticAudits: boolean;
        auditIntervalHours: number;
        includePenetrationTesting: boolean;
        complianceFrameworks: Array<'SOC2' | 'GDPR' | 'HIPAA'>;
        falsePositiveThreshold: number;
        reportRetentionDays: number;
    });
    performSecurityAudit(): Promise<SecurityAuditReport>;
    private performOWASPChecks;
    private checkInjectionVulnerabilities;
    private checkBrokenAuthentication;
    private checkSensitiveDataExposure;
    private auditAuthenticationSecurity;
    private auditDataProtection;
    private calculateSecurityScore;
    private checkComplianceStatus;
    private analyzeQueryParameterization;
    private checkRedisInjectionRisk;
    private analyzeJWTSecurity;
    private analyzeSessionManagement;
    private analyzePasswordSecurity;
    private analyzeMFASecurity;
    private checkXXEVulnerabilities;
    private checkBrokenAccessControl;
    private checkSecurityMisconfiguration;
    private checkXSSVulnerabilities;
    private checkInsecureDeserialization;
    private checkKnownVulnerabilities;
    private checkInsufficientLogging;
    private auditSecurityConfiguration;
    private scanDependencyVulnerabilities;
    private auditInfrastructureSecurity;
    private checkEncryptionAtRest;
    private checkEncryptionInTransit;
    private checkSensitiveDataInLogs;
    private checkJWTSecretStrength;
    private checkDefaultCredentials;
    private auditPIIHandling;
    private auditDataRetention;
    private checkSOC2Compliance;
    private checkGDPRCompliance;
    private checkHIPAACompliance;
    private parseTimeToMinutes;
    private generateSecurityRecommendations;
    private calculateImprovements;
    private calculateNewIssues;
    private storeAuditReport;
    private initializeVulnerabilityDatabase;
    private startAutomaticAudits;
    getLatestAuditReport(): Promise<SecurityAuditReport | null>;
    getAuditHistory(): SecurityAuditReport[];
    markFalsePositive(auditId: string, vulnerabilityId: string): Promise<boolean>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=security-audit.service.d.ts.map