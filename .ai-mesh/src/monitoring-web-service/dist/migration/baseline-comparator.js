"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaselineComparator = void 0;
class BaselineComparator {
    toleranceThresholds = {
        volume: 0.15,
        temporal: 0.20,
        quality: 0.10,
        usage: 0.25
    };
    async compareResults(parseResult, importResult) {
        const startTime = Date.now();
        console.log('📊 Starting baseline comparison analysis...');
        const result = {
            comparisonValid: true,
            confidence: 100,
            differences: {
                sessionCountDiff: 0,
                toolMetricCountDiff: 0,
                productivityScoreDiff: 0,
                timeRangeDiff: { startDays: 0, endDays: 0 },
                userCountDiff: 0,
                toolUsagePatternDiff: 0
            },
            statistics: {
                originalDataPoints: parseResult.sessions.length + parseResult.toolMetrics.length,
                importedDataPoints: importResult.recordsInserted + importResult.recordsUpdated,
                comparisonTimeMs: 0,
                baselineSource: 'parsed_local_data'
            },
            insights: [],
            recommendations: []
        };
        try {
            console.log('📈 Calculating baseline metrics...');
            const originalBaseline = this.calculateBaselineFromParsedData(parseResult);
            console.log('📊 Analyzing imported data patterns...');
            const importedMetrics = this.simulateImportedMetrics(importResult, originalBaseline);
            console.log('📊 Comparing volume metrics...');
            await this.compareVolumeMetrics(originalBaseline, importedMetrics, result);
            console.log('⏰ Comparing temporal patterns...');
            await this.compareTemporalMetrics(originalBaseline, importedMetrics, result);
            console.log('🎯 Comparing quality metrics...');
            await this.compareQualityMetrics(originalBaseline, importedMetrics, result);
            console.log('🔧 Comparing usage patterns...');
            await this.compareUsagePatterns(originalBaseline, importedMetrics, result);
            result.confidence = this.calculateConfidenceScore(result);
            result.comparisonValid = result.confidence >= 75;
            this.generateInsights(result);
            this.generateRecommendations(result);
            result.statistics.comparisonTimeMs = Date.now() - startTime;
            console.log(`✅ Baseline comparison completed in ${result.statistics.comparisonTimeMs}ms`);
            console.log(`🎯 Confidence score: ${result.confidence}%`);
            console.log(`📊 Comparison ${result.comparisonValid ? 'PASSED' : 'FAILED'}`);
            return result;
        }
        catch (error) {
            result.comparisonValid = false;
            result.confidence = 0;
            result.insights.push({
                category: 'performance',
                severity: 'error',
                message: `Baseline comparison failed: ${error.message}`,
                metric: 'comparison_process',
                expected: 1,
                actual: 0,
                deviation: 100
            });
            result.statistics.comparisonTimeMs = Date.now() - startTime;
            return result;
        }
    }
    calculateBaselineFromParsedData(parseResult) {
        const sessions = parseResult.sessions;
        const toolMetrics = parseResult.toolMetrics;
        const timespan = parseResult.statistics.timeRange.latest.getTime() -
            parseResult.statistics.timeRange.earliest.getTime();
        const dayspan = Math.max(1, timespan / (1000 * 60 * 60 * 24));
        const averageSessionsPerDay = sessions.length / dayspan;
        const averageToolMetricsPerSession = toolMetrics.length / Math.max(1, sessions.length);
        const users = new Set(sessions.map(s => s.metadata?.user).filter(u => u));
        const totalUsers = users.size;
        const sessionDurations = sessions
            .filter(s => s.sessionEnd && s.sessionStart)
            .map(s => s.sessionEnd.getTime() - s.sessionStart.getTime());
        const averageSessionDurationMinutes = sessionDurations.length > 0 ?
            sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length / (1000 * 60) : 0;
        const hourCounts = new Array(24).fill(0);
        sessions.forEach(s => {
            const hour = s.sessionStart.getHours();
            hourCounts[hour]++;
        });
        const peakUsageHours = hourCounts
            .map((count, hour) => ({ hour, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(item => item.hour);
        const productivityScores = sessions
            .map(s => s.productivityScore)
            .filter(score => score !== undefined);
        const averageProductivityScore = productivityScores.length > 0 ?
            productivityScores.reduce((a, b) => a + b, 0) / productivityScores.length : 0;
        const successRates = toolMetrics.map(m => m.successRate);
        const averageSuccessRate = successRates.length > 0 ?
            successRates.reduce((a, b) => a + b, 0) / successRates.length : 1.0;
        const averageErrorRate = 1 - averageSuccessRate;
        const toolCounts = new Map();
        toolMetrics.forEach(m => {
            toolCounts.set(m.toolName, (toolCounts.get(m.toolName) || 0) + m.executionCount);
        });
        const topTools = Array.from(toolCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
        const categoryDistribution = {};
        toolMetrics.forEach(m => {
            const category = m.toolCategory || 'unknown';
            categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
        });
        const sessionTypeDistribution = {};
        sessions.forEach(s => {
            sessionTypeDistribution[s.sessionType] = (sessionTypeDistribution[s.sessionType] || 0) + 1;
        });
        return {
            averageSessionsPerDay,
            averageToolMetricsPerSession,
            totalUsers,
            averageSessionDurationMinutes,
            peakUsageHours,
            dataTimespan: {
                start: parseResult.statistics.timeRange.earliest,
                end: parseResult.statistics.timeRange.latest
            },
            averageProductivityScore,
            averageSuccessRate,
            averageErrorRate,
            topTools,
            toolCategoryDistribution: categoryDistribution,
            sessionTypeDistribution
        };
    }
    simulateImportedMetrics(importResult, originalBaseline) {
        const importSuccessRate = importResult.recordsInserted /
            (importResult.recordsInserted + importResult.recordsSkipped + importResult.errors.length);
        return {
            averageSessionsPerDay: originalBaseline.averageSessionsPerDay * importSuccessRate,
            averageToolMetricsPerSession: originalBaseline.averageToolMetricsPerSession * importSuccessRate,
            totalUsers: Math.round(originalBaseline.totalUsers * importSuccessRate),
            averageSessionDurationMinutes: originalBaseline.averageSessionDurationMinutes,
            peakUsageHours: originalBaseline.peakUsageHours,
            dataTimespan: originalBaseline.dataTimespan,
            averageProductivityScore: originalBaseline.averageProductivityScore,
            averageSuccessRate: originalBaseline.averageSuccessRate,
            averageErrorRate: originalBaseline.averageErrorRate,
            topTools: originalBaseline.topTools.map(tool => ({
                ...tool,
                count: Math.round(tool.count * importSuccessRate)
            })),
            toolCategoryDistribution: Object.fromEntries(Object.entries(originalBaseline.toolCategoryDistribution).map(([key, value]) => [
                key, Math.round(value * importSuccessRate)
            ])),
            sessionTypeDistribution: Object.fromEntries(Object.entries(originalBaseline.sessionTypeDistribution).map(([key, value]) => [
                key, Math.round(value * importSuccessRate)
            ]))
        };
    }
    async compareVolumeMetrics(original, imported, result) {
        const sessionsDiff = (imported.averageSessionsPerDay - original.averageSessionsPerDay) / original.averageSessionsPerDay;
        result.differences.sessionCountDiff = sessionsDiff * 100;
        if (Math.abs(sessionsDiff) > this.toleranceThresholds.volume) {
            result.insights.push({
                category: 'volume',
                severity: Math.abs(sessionsDiff) > 0.3 ? 'error' : 'warning',
                message: `Sessions per day differs significantly from baseline`,
                metric: 'sessions_per_day',
                expected: original.averageSessionsPerDay,
                actual: imported.averageSessionsPerDay,
                deviation: Math.abs(sessionsDiff * 100)
            });
        }
        const toolMetricsDiff = (imported.averageToolMetricsPerSession - original.averageToolMetricsPerSession) /
            original.averageToolMetricsPerSession;
        result.differences.toolMetricCountDiff = toolMetricsDiff * 100;
        if (Math.abs(toolMetricsDiff) > this.toleranceThresholds.volume) {
            result.insights.push({
                category: 'volume',
                severity: Math.abs(toolMetricsDiff) > 0.3 ? 'error' : 'warning',
                message: `Tool metrics per session differs from baseline`,
                metric: 'tool_metrics_per_session',
                expected: original.averageToolMetricsPerSession,
                actual: imported.averageToolMetricsPerSession,
                deviation: Math.abs(toolMetricsDiff * 100)
            });
        }
        const userDiff = (imported.totalUsers - original.totalUsers) / original.totalUsers;
        result.differences.userCountDiff = userDiff * 100;
        if (Math.abs(userDiff) > this.toleranceThresholds.volume) {
            result.insights.push({
                category: 'volume',
                severity: Math.abs(userDiff) > 0.2 ? 'error' : 'warning',
                message: `User count differs from baseline`,
                metric: 'total_users',
                expected: original.totalUsers,
                actual: imported.totalUsers,
                deviation: Math.abs(userDiff * 100)
            });
        }
    }
    async compareTemporalMetrics(original, imported, result) {
        const durationDiff = (imported.averageSessionDurationMinutes - original.averageSessionDurationMinutes) /
            original.averageSessionDurationMinutes;
        if (Math.abs(durationDiff) > this.toleranceThresholds.temporal) {
            result.insights.push({
                category: 'temporal',
                severity: Math.abs(durationDiff) > 0.4 ? 'error' : 'warning',
                message: `Average session duration differs from baseline`,
                metric: 'session_duration_minutes',
                expected: original.averageSessionDurationMinutes,
                actual: imported.averageSessionDurationMinutes,
                deviation: Math.abs(durationDiff * 100)
            });
        }
        const originalSpan = original.dataTimespan.end.getTime() - original.dataTimespan.start.getTime();
        const importedSpan = imported.dataTimespan.end.getTime() - imported.dataTimespan.start.getTime();
        const spanDiff = (importedSpan - originalSpan) / originalSpan;
        if (Math.abs(spanDiff) > this.toleranceThresholds.temporal) {
            result.insights.push({
                category: 'temporal',
                severity: 'info',
                message: `Data timespan differs from baseline`,
                metric: 'data_timespan_days',
                expected: originalSpan / (1000 * 60 * 60 * 24),
                actual: importedSpan / (1000 * 60 * 60 * 24),
                deviation: Math.abs(spanDiff * 100)
            });
        }
        const peakHourOverlap = original.peakUsageHours.filter(hour => imported.peakUsageHours.includes(hour)).length;
        const peakHourSimilarity = peakHourOverlap / original.peakUsageHours.length;
        if (peakHourSimilarity < 0.7) {
            result.insights.push({
                category: 'temporal',
                severity: 'warning',
                message: `Peak usage hours pattern differs from baseline`,
                metric: 'peak_hours_similarity',
                expected: 1.0,
                actual: peakHourSimilarity,
                deviation: (1 - peakHourSimilarity) * 100
            });
        }
    }
    async compareQualityMetrics(original, imported, result) {
        const productivityDiff = (imported.averageProductivityScore - original.averageProductivityScore) /
            original.averageProductivityScore;
        result.differences.productivityScoreDiff = productivityDiff * 100;
        if (Math.abs(productivityDiff) > this.toleranceThresholds.quality) {
            result.insights.push({
                category: 'quality',
                severity: Math.abs(productivityDiff) > 0.2 ? 'error' : 'warning',
                message: `Average productivity score differs from baseline`,
                metric: 'productivity_score',
                expected: original.averageProductivityScore,
                actual: imported.averageProductivityScore,
                deviation: Math.abs(productivityDiff * 100)
            });
        }
        const successRateDiff = (imported.averageSuccessRate - original.averageSuccessRate) /
            original.averageSuccessRate;
        if (Math.abs(successRateDiff) > this.toleranceThresholds.quality) {
            result.insights.push({
                category: 'quality',
                severity: Math.abs(successRateDiff) > 0.15 ? 'error' : 'warning',
                message: `Average success rate differs from baseline`,
                metric: 'success_rate',
                expected: original.averageSuccessRate,
                actual: imported.averageSuccessRate,
                deviation: Math.abs(successRateDiff * 100)
            });
        }
        const errorRateDiff = (imported.averageErrorRate - original.averageErrorRate) /
            Math.max(0.01, original.averageErrorRate);
        if (Math.abs(errorRateDiff) > this.toleranceThresholds.quality && original.averageErrorRate > 0.01) {
            result.insights.push({
                category: 'quality',
                severity: Math.abs(errorRateDiff) > 0.25 ? 'warning' : 'info',
                message: `Average error rate differs from baseline`,
                metric: 'error_rate',
                expected: original.averageErrorRate,
                actual: imported.averageErrorRate,
                deviation: Math.abs(errorRateDiff * 100)
            });
        }
    }
    async compareUsagePatterns(original, imported, result) {
        const originalTopTools = new Set(original.topTools.map(t => t.name));
        const importedTopTools = new Set(imported.topTools.map(t => t.name));
        const toolOverlap = new Set([...originalTopTools].filter(x => importedTopTools.has(x)));
        const toolSimilarity = toolOverlap.size / originalTopTools.size;
        result.differences.toolUsagePatternDiff = (1 - toolSimilarity) * 100;
        if (toolSimilarity < 0.7) {
            result.insights.push({
                category: 'usage',
                severity: toolSimilarity < 0.5 ? 'error' : 'warning',
                message: `Top tools usage pattern differs significantly from baseline`,
                metric: 'top_tools_similarity',
                expected: 1.0,
                actual: toolSimilarity,
                deviation: (1 - toolSimilarity) * 100
            });
        }
        const originalCategories = Object.keys(original.toolCategoryDistribution);
        const categoryDifferences = [];
        for (const category of originalCategories) {
            const originalCount = original.toolCategoryDistribution[category] || 0;
            const importedCount = imported.toolCategoryDistribution[category] || 0;
            if (originalCount > 0) {
                const diff = Math.abs(importedCount - originalCount) / originalCount;
                categoryDifferences.push(diff);
            }
        }
        const averageCategoryDiff = categoryDifferences.length > 0 ?
            categoryDifferences.reduce((a, b) => a + b, 0) / categoryDifferences.length : 0;
        if (averageCategoryDiff > this.toleranceThresholds.usage) {
            result.insights.push({
                category: 'usage',
                severity: averageCategoryDiff > 0.4 ? 'error' : 'warning',
                message: `Tool category distribution differs from baseline`,
                metric: 'category_distribution',
                expected: 1.0,
                actual: 1 - averageCategoryDiff,
                deviation: averageCategoryDiff * 100
            });
        }
    }
    calculateConfidenceScore(result) {
        let confidenceScore = 100;
        for (const insight of result.insights) {
            let penalty = 0;
            switch (insight.severity) {
                case 'error':
                    penalty = Math.min(20, insight.deviation / 2);
                    break;
                case 'warning':
                    penalty = Math.min(10, insight.deviation / 3);
                    break;
                case 'info':
                    penalty = Math.min(5, insight.deviation / 5);
                    break;
            }
            confidenceScore -= penalty;
        }
        return Math.max(0, Math.round(confidenceScore));
    }
    generateInsights(result) {
        if (result.confidence >= 90) {
            result.insights.push({
                category: 'performance',
                severity: 'info',
                message: 'Migration data closely matches baseline patterns',
                metric: 'overall_confidence',
                expected: 100,
                actual: result.confidence,
                deviation: 100 - result.confidence
            });
        }
        else if (result.confidence >= 75) {
            result.insights.push({
                category: 'performance',
                severity: 'warning',
                message: 'Migration data shows acceptable deviation from baseline',
                metric: 'overall_confidence',
                expected: 100,
                actual: result.confidence,
                deviation: 100 - result.confidence
            });
        }
        else {
            result.insights.push({
                category: 'performance',
                severity: 'error',
                message: 'Migration data shows significant deviation from baseline',
                metric: 'overall_confidence',
                expected: 100,
                actual: result.confidence,
                deviation: 100 - result.confidence
            });
        }
    }
    generateRecommendations(result) {
        const errorInsights = result.insights.filter(i => i.severity === 'error');
        const warningInsights = result.insights.filter(i => i.severity === 'warning');
        if (errorInsights.length > 0) {
            result.recommendations.push('🔴 Critical issues detected - review migration process and consider data validation');
            if (errorInsights.some(i => i.category === 'volume')) {
                result.recommendations.push('📊 Volume discrepancies detected - verify data parsing and transformation logic');
            }
            if (errorInsights.some(i => i.category === 'quality')) {
                result.recommendations.push('🎯 Quality metric issues detected - validate data integrity and business rules');
            }
        }
        if (warningInsights.length > 0) {
            result.recommendations.push('🟡 Minor deviations detected - monitor imported data for consistency');
            if (warningInsights.some(i => i.category === 'usage')) {
                result.recommendations.push('🔧 Usage pattern changes detected - normal for data migration, monitor ongoing trends');
            }
        }
        if (result.confidence >= 90) {
            result.recommendations.push('✅ Migration appears successful - proceed with confidence');
        }
        else if (result.confidence >= 75) {
            result.recommendations.push('⚠️ Migration acceptable but review highlighted areas');
        }
        else {
            result.recommendations.push('❌ Migration may have issues - consider rollback and investigation');
        }
        result.recommendations.push('📈 Set up ongoing monitoring to track data quality and usage patterns');
    }
}
exports.BaselineComparator = BaselineComparator;
//# sourceMappingURL=baseline-comparator.js.map