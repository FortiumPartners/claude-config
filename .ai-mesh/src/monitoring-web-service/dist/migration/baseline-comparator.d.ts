import { ParseResult } from './data-parser';
import { ImportResult } from './bulk-importer';
export interface BaselineComparisonResult {
    comparisonValid: boolean;
    confidence: number;
    differences: {
        sessionCountDiff: number;
        toolMetricCountDiff: number;
        productivityScoreDiff: number;
        timeRangeDiff: {
            startDays: number;
            endDays: number;
        };
        userCountDiff: number;
        toolUsagePatternDiff: number;
    };
    statistics: {
        originalDataPoints: number;
        importedDataPoints: number;
        comparisonTimeMs: number;
        baselineSource: string;
    };
    insights: BaselineInsight[];
    recommendations: string[];
}
export interface BaselineInsight {
    category: 'volume' | 'temporal' | 'quality' | 'usage' | 'performance';
    severity: 'info' | 'warning' | 'error';
    message: string;
    metric: string;
    expected: number;
    actual: number;
    deviation: number;
}
export interface BaselineMetrics {
    averageSessionsPerDay: number;
    averageToolMetricsPerSession: number;
    totalUsers: number;
    averageSessionDurationMinutes: number;
    peakUsageHours: number[];
    dataTimespan: {
        start: Date;
        end: Date;
    };
    averageProductivityScore: number;
    averageSuccessRate: number;
    averageErrorRate: number;
    topTools: {
        name: string;
        count: number;
    }[];
    toolCategoryDistribution: Record<string, number>;
    sessionTypeDistribution: Record<string, number>;
}
export declare class BaselineComparator {
    private readonly toleranceThresholds;
    compareResults(parseResult: ParseResult, importResult: ImportResult): Promise<BaselineComparisonResult>;
    private calculateBaselineFromParsedData;
    private simulateImportedMetrics;
    private compareVolumeMetrics;
    private compareTemporalMetrics;
    private compareQualityMetrics;
    private compareUsagePatterns;
    private calculateConfidenceScore;
    private generateInsights;
    private generateRecommendations;
}
//# sourceMappingURL=baseline-comparator.d.ts.map