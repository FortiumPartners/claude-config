export interface TestSuite {
    name: string;
    command: string;
    args: string[];
    requiredCoverage?: {
        statements: number;
        branches: number;
        functions: number;
        lines: number;
    };
}
export interface TestResults {
    suite: string;
    passed: boolean;
    coverage?: {
        statements: number;
        branches: number;
        functions: number;
        lines: number;
    };
    duration: number;
    errors: string[];
}
export declare class TestRunner {
    private readonly testSuites;
    runAllTests(): Promise<TestResults[]>;
    private runTestSuite;
    private extractCoverage;
    private extractErrors;
    private printTestResult;
    private printSummary;
    private getAchievedCoverage;
    runSingleSuite(suiteName: string): Promise<TestResults | null>;
}
//# sourceMappingURL=test-runner.d.ts.map