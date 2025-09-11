#!/usr/bin/env tsx
interface SecurityTestResult {
    testName: string;
    category: 'authentication' | 'authorization' | 'injection' | 'xss' | 'csrf' | 'configuration';
    status: 'pass' | 'fail' | 'warning';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    details: string;
    recommendation?: string;
    cve?: string;
}
declare class SecurityTester {
    private baseUrl;
    private logger;
    private testResults;
    constructor(baseUrl: string);
    runAllTests(): Promise<SecurityTestResult[]>;
    private testAuthentication;
    private testDefaultCredentials;
    private testWeakPasswordAcceptance;
    private testJWTTokenManipulation;
    private testSessionFixation;
    private testBruteForceProtection;
    private testAuthorization;
    private testUnauthorizedAccess;
    private testPrivilegeEscalation;
    private testIDOR;
    private testInjectionVulnerabilities;
    private testSQLInjection;
    private testNoSQLInjection;
    private testCommandInjection;
    private testXSSVulnerabilities;
    private testCSRFProtection;
    private testRateLimiting;
    private testSSLConfiguration;
    private testSecurityHeaders;
    private testSessionManagement;
    generateReport(): string;
}
export { SecurityTester, SecurityTestResult };
//# sourceMappingURL=security-testing.d.ts.map