"""
Task 4.4: Performance analytics calculation logic

Advanced analytics engine for calculating productivity trends, compliance patterns,
and workflow optimization insights based on enforcement data.
"""
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from statistics import mean, stdev
import json

from .database import DatabaseManager, get_database
from .metrics_collector import MetricsCollector, ComplianceMetrics

logger = logging.getLogger(__name__)


@dataclass
class ProductivityTrend:
    """Represents productivity trend analysis over time."""
    period_start: date
    period_end: date
    baseline_score: float
    current_score: float
    trend_direction: str  # 'improving', 'declining', 'stable'
    improvement_rate: float
    confidence_level: float


@dataclass
class ComplianceInsight:
    """Represents compliance pattern insights."""
    insight_type: str
    description: str
    impact_level: str  # 'high', 'medium', 'low'
    recommendation: str
    affected_areas: List[str]
    metrics: Dict[str, float]


@dataclass
class PerformanceReport:
    """Comprehensive performance analysis report."""
    user_id: str
    analysis_period: Tuple[date, date]
    overall_score: float
    trends: List[ProductivityTrend]
    insights: List[ComplianceInsight]
    recommendations: List[str]
    comparative_metrics: Dict[str, Any]


class PerformanceAnalytics:
    """
    Advanced analytics engine for calculating performance metrics,
    trend analysis, and optimization insights.
    """
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None,
                 metrics_collector: Optional[MetricsCollector] = None):
        """
        Initialize performance analytics engine.
        
        Args:
            db_manager: Optional database manager instance
            metrics_collector: Optional metrics collector instance
        """
        self.db = db_manager or get_database()
        self.metrics = metrics_collector or MetricsCollector(self.db)
        
    def calculate_productivity_trend(self, user_id: str, days: int = 30) -> ProductivityTrend:
        """
        Calculate productivity trend for a user over specified period.
        
        Args:
            user_id: User identifier
            days: Number of days to analyze (default 30)
            
        Returns:
            ProductivityTrend object with trend analysis
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get metrics for the period
        metrics_data = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
        
        if not metrics_data:
            return ProductivityTrend(
                period_start=start_date,
                period_end=end_date,
                baseline_score=0.0,
                current_score=0.0,
                trend_direction='stable',
                improvement_rate=0.0,
                confidence_level=0.0
            )
            
        # Calculate baseline (first week) vs current (last week) scores
        first_week = [m for m in metrics_data if (m.date - start_date).days < 7]
        last_week = [m for m in metrics_data if (end_date - m.date).days < 7]
        
        baseline_score = mean([m.productivity_score or 0 for m in first_week]) if first_week else 0.0
        current_score = mean([m.productivity_score or 0 for m in last_week]) if last_week else 0.0
        
        # Calculate improvement rate
        improvement_rate = ((current_score - baseline_score) / baseline_score * 100) if baseline_score > 0 else 0.0
        
        # Determine trend direction
        if abs(improvement_rate) < 5:
            trend_direction = 'stable'
        elif improvement_rate > 0:
            trend_direction = 'improving'
        else:
            trend_direction = 'declining'
            
        # Calculate confidence level based on data consistency
        all_scores = [m.productivity_score or 0 for m in metrics_data]
        confidence_level = self._calculate_confidence_level(all_scores)
        
        return ProductivityTrend(
            period_start=start_date,
            period_end=end_date,
            baseline_score=baseline_score,
            current_score=current_score,
            trend_direction=trend_direction,
            improvement_rate=improvement_rate,
            confidence_level=confidence_level
        )
        
    def analyze_compliance_patterns(self, user_id: str, days: int = 30) -> List[ComplianceInsight]:
        """
        Analyze compliance patterns and generate actionable insights.
        
        Args:
            user_id: User identifier
            days: Number of days to analyze
            
        Returns:
            List of ComplianceInsight objects
        """
        insights = []
        
        try:
            # Get violation patterns
            patterns = self.metrics.get_violation_patterns(user_id, days)
            
            # Analyze common violation types
            if patterns.get('most_common_violations'):
                top_violation = patterns['most_common_violations'][0]
                if top_violation['count'] > 5:  # Significant pattern
                    insights.append(ComplianceInsight(
                        insight_type='violation_pattern',
                        description=f"Frequent {top_violation['type']} violations ({top_violation['count']} occurrences)",
                        impact_level='medium' if top_violation['count'] < 15 else 'high',
                        recommendation=f"Focus on reducing {top_violation['type']} violations through workflow training",
                        affected_areas=['workflow_compliance'],
                        metrics={'violation_count': top_violation['count']}
                    ))
                    
            # Analyze file type patterns
            if patterns.get('file_types_most_violated'):
                most_violated_type = max(patterns['file_types_most_violated'].items(), key=lambda x: x[1])
                if most_violated_type[1] > 3:
                    insights.append(ComplianceInsight(
                        insight_type='file_type_pattern',
                        description=f"{most_violated_type[0]} files have the most violations ({most_violated_type[1]})",
                        impact_level='medium',
                        recommendation=f"Create specialized workflows for {most_violated_type[0]} file editing",
                        affected_areas=['file_operations'],
                        metrics={'violation_count': most_violated_type[1]}
                    ))
                    
            # Analyze suggested commands
            if patterns.get('commands_most_suggested'):
                top_command = max(patterns['commands_most_suggested'].items(), key=lambda x: x[1])
                insights.append(ComplianceInsight(
                    insight_type='workflow_opportunity',
                    description=f"Most suggested command: {top_command[0]} ({top_command[1]} times)",
                    impact_level='low',
                    recommendation=f"Consider creating shortcuts or training for {top_command[0]} command",
                    affected_areas=['workflow_efficiency'],
                    metrics={'suggestion_count': top_command[1]}
                ))
                
            # Analyze overall compliance trend
            end_date = date.today()
            start_date = end_date - timedelta(days=days)
            metrics_data = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
            
            if metrics_data:
                recent_compliance = mean([m.compliance_rate for m in metrics_data[-7:]])  # Last week
                earlier_compliance = mean([m.compliance_rate for m in metrics_data[:7]])  # First week
                
                if recent_compliance < earlier_compliance - 10:  # Significant decline
                    insights.append(ComplianceInsight(
                        insight_type='compliance_decline',
                        description=f"Compliance rate declined from {earlier_compliance:.1f}% to {recent_compliance:.1f}%",
                        impact_level='high',
                        recommendation="Review recent workflow changes and provide additional training",
                        affected_areas=['overall_compliance'],
                        metrics={'compliance_change': recent_compliance - earlier_compliance}
                    ))
                    
        except Exception as e:
            logger.error(f"Error analyzing compliance patterns: {e}")
            
        return insights
        
    def generate_performance_report(self, user_id: str, days: int = 30) -> PerformanceReport:
        """
        Generate comprehensive performance analysis report.
        
        Args:
            user_id: User identifier
            days: Number of days to analyze
            
        Returns:
            PerformanceReport with complete analysis
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get core metrics
        metrics_data = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
        overall_score = mean([m.productivity_score or 0 for m in metrics_data]) if metrics_data else 0.0
        
        # Calculate trends
        productivity_trend = self.calculate_productivity_trend(user_id, days)
        trends = [productivity_trend]
        
        # Generate insights
        insights = self.analyze_compliance_patterns(user_id, days)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(user_id, insights, productivity_trend)
        
        # Calculate comparative metrics
        comparative_metrics = self._calculate_comparative_metrics(user_id, days)
        
        return PerformanceReport(
            user_id=user_id,
            analysis_period=(start_date, end_date),
            overall_score=overall_score,
            trends=trends,
            insights=insights,
            recommendations=recommendations,
            comparative_metrics=comparative_metrics
        )
        
    def calculate_team_performance_benchmark(self, user_ids: List[str], days: int = 30) -> Dict[str, Any]:
        """
        Calculate team performance benchmarks for comparative analysis.
        
        Args:
            user_ids: List of user IDs to include
            days: Number of days to analyze
            
        Returns:
            Dictionary with team benchmarks
        """
        benchmarks = {
            'team_size': len(user_ids),
            'analysis_period_days': days,
            'metrics': {
                'avg_compliance_rate': 0.0,
                'avg_productivity_score': 0.0,
                'avg_violations_per_day': 0.0,
                'avg_override_usage': 0.0
            },
            'percentiles': {
                'productivity_p25': 0.0,
                'productivity_p50': 0.0,
                'productivity_p75': 0.0,
                'productivity_p90': 0.0
            },
            'trends': {
                'improving_users': 0,
                'declining_users': 0,
                'stable_users': 0
            }
        }
        
        all_scores = []
        all_compliance = []
        all_violations = []
        all_overrides = []
        trend_counts = {'improving': 0, 'declining': 0, 'stable': 0}
        
        for user_id in user_ids:
            # Get user metrics
            end_date = date.today()
            start_date = end_date - timedelta(days=days)
            user_metrics = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
            
            if user_metrics:
                scores = [m.productivity_score or 0 for m in user_metrics]
                compliance = [m.compliance_rate for m in user_metrics]
                violations = [m.violations_reminder + m.violations_warning + m.violations_blocking 
                             for m in user_metrics]
                overrides = [m.override_usage for m in user_metrics]
                
                all_scores.extend(scores)
                all_compliance.extend(compliance)
                all_violations.extend(violations)
                all_overrides.extend(overrides)
                
                # Get trend for this user
                trend = self.calculate_productivity_trend(user_id, days)
                trend_counts[trend.trend_direction] += 1
                
        # Calculate team averages
        if all_scores:
            benchmarks['metrics']['avg_productivity_score'] = mean(all_scores)
            benchmarks['metrics']['avg_compliance_rate'] = mean(all_compliance)
            benchmarks['metrics']['avg_violations_per_day'] = mean(all_violations)
            benchmarks['metrics']['avg_override_usage'] = mean(all_overrides)
            
            # Calculate percentiles
            all_scores.sort()
            benchmarks['percentiles']['productivity_p25'] = self._percentile(all_scores, 25)
            benchmarks['percentiles']['productivity_p50'] = self._percentile(all_scores, 50)
            benchmarks['percentiles']['productivity_p75'] = self._percentile(all_scores, 75)
            benchmarks['percentiles']['productivity_p90'] = self._percentile(all_scores, 90)
            
        # Update trend counts
        benchmarks['trends']['improving_users'] = trend_counts['improving']
        benchmarks['trends']['declining_users'] = trend_counts['declining']
        benchmarks['trends']['stable_users'] = trend_counts['stable']
        
        return benchmarks
        
    def predict_future_performance(self, user_id: str, prediction_days: int = 7) -> Dict[str, Any]:
        """
        Predict future performance based on historical trends.
        
        Args:
            user_id: User identifier
            prediction_days: Number of days to predict ahead
            
        Returns:
            Dictionary with performance predictions
        """
        # Get historical data for trend analysis
        historical_days = 30
        end_date = date.today()
        start_date = end_date - timedelta(days=historical_days)
        
        metrics_data = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
        
        predictions = {
            'user_id': user_id,
            'prediction_period_days': prediction_days,
            'predicted_metrics': {
                'productivity_score': 0.0,
                'compliance_rate': 0.0,
                'violation_risk': 'low'
            },
            'confidence_level': 0.0,
            'risk_factors': [],
            'improvement_opportunities': []
        }
        
        if not metrics_data or len(metrics_data) < 7:
            predictions['confidence_level'] = 0.0
            predictions['risk_factors'].append('Insufficient historical data for prediction')
            return predictions
            
        try:
            # Calculate trends for prediction
            scores = [m.productivity_score or 0 for m in metrics_data]
            compliance_rates = [m.compliance_rate for m in metrics_data]
            
            # Simple linear trend prediction
            days_sequence = list(range(len(scores)))
            
            # Calculate slope for productivity score trend
            if len(scores) > 1:
                score_slope = self._calculate_slope(days_sequence, scores)
                current_score = scores[-1]
                predicted_score = current_score + (score_slope * prediction_days)
                predictions['predicted_metrics']['productivity_score'] = max(0.0, min(100.0, predicted_score))
                
            # Calculate slope for compliance rate trend
            if len(compliance_rates) > 1:
                compliance_slope = self._calculate_slope(days_sequence, compliance_rates)
                current_compliance = compliance_rates[-1]
                predicted_compliance = current_compliance + (compliance_slope * prediction_days)
                predictions['predicted_metrics']['compliance_rate'] = max(0.0, min(100.0, predicted_compliance))
                
            # Assess violation risk
            recent_violations = sum(
                m.violations_reminder + m.violations_warning + m.violations_blocking
                for m in metrics_data[-7:]  # Last week
            )
            
            if recent_violations < 3:
                predictions['predicted_metrics']['violation_risk'] = 'low'
            elif recent_violations < 8:
                predictions['predicted_metrics']['violation_risk'] = 'medium'  
            else:
                predictions['predicted_metrics']['violation_risk'] = 'high'
                
            # Calculate confidence level
            score_consistency = 1.0 - (stdev(scores[-14:]) / 100.0) if len(scores) >= 14 else 0.5
            data_recency = min(1.0, len(metrics_data) / 30.0)  # More data = higher confidence
            predictions['confidence_level'] = (score_consistency + data_recency) / 2.0
            
            # Identify risk factors
            if predicted_score < current_score - 5:
                predictions['risk_factors'].append('Declining productivity trend detected')
            if predicted_compliance < 80:
                predictions['risk_factors'].append('Compliance rate may fall below acceptable threshold')
            if recent_violations > 10:
                predictions['risk_factors'].append('High violation frequency in recent period')
                
            # Identify improvement opportunities
            if predicted_score > current_score + 5:
                predictions['improvement_opportunities'].append('Strong positive trend - maintain current practices')
            if predictions['predicted_metrics']['compliance_rate'] > 90:
                predictions['improvement_opportunities'].append('High compliance predicted - consider advanced workflows')
                
        except Exception as e:
            logger.error(f"Error predicting future performance: {e}")
            predictions['confidence_level'] = 0.0
            predictions['risk_factors'].append(f'Prediction error: {str(e)}')
            
        return predictions
        
    def _calculate_confidence_level(self, scores: List[float]) -> float:
        """Calculate confidence level based on data consistency."""
        if len(scores) < 3:
            return 0.0
            
        try:
            # Higher consistency = higher confidence
            std_dev = stdev(scores) if len(scores) > 1 else 0
            mean_score = mean(scores)
            
            # Normalize standard deviation to 0-1 scale
            if mean_score > 0:
                coefficient_of_variation = std_dev / mean_score
                confidence = max(0.0, 1.0 - coefficient_of_variation)
            else:
                confidence = 0.0
                
            return min(1.0, confidence)
            
        except Exception:
            return 0.0
            
    def _generate_recommendations(self, user_id: str, insights: List[ComplianceInsight], 
                                trend: ProductivityTrend) -> List[str]:
        """Generate actionable recommendations based on analysis."""
        recommendations = []
        
        # Trend-based recommendations
        if trend.trend_direction == 'declining':
            recommendations.append("Review recent workflow changes and identify potential disruptions")
            recommendations.append("Consider additional training on enforcement workflow compliance")
            
        elif trend.trend_direction == 'improving':
            recommendations.append("Continue current practices - positive trend detected")
            recommendations.append("Document successful workflow patterns for team sharing")
            
        # Insight-based recommendations
        for insight in insights:
            if insight.impact_level == 'high':
                recommendations.append(f"PRIORITY: {insight.recommendation}")
            else:
                recommendations.append(insight.recommendation)
                
        # General recommendations if no specific insights
        if not recommendations:
            recommendations.append("Maintain current workflow compliance practices")
            recommendations.append("Continue using suggested commands for better efficiency")
            
        return recommendations[:5]  # Limit to top 5 recommendations
        
    def _calculate_comparative_metrics(self, user_id: str, days: int) -> Dict[str, Any]:
        """Calculate metrics for comparison with team/historical averages."""
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        metrics_data = self.metrics.get_user_metrics_range(user_id, start_date, end_date)
        
        comparative = {
            'current_period': {
                'avg_productivity_score': 0.0,
                'avg_compliance_rate': 0.0,
                'total_violations': 0,
                'total_operations': 0
            },
            'previous_period': {
                'avg_productivity_score': 0.0,
                'avg_compliance_rate': 0.0,
                'total_violations': 0,
                'total_operations': 0
            },
            'changes': {
                'productivity_change': 0.0,
                'compliance_change': 0.0,
                'violation_change': 0
            }
        }
        
        if metrics_data:
            # Current period metrics
            comparative['current_period']['avg_productivity_score'] = mean([m.productivity_score or 0 for m in metrics_data])
            comparative['current_period']['avg_compliance_rate'] = mean([m.compliance_rate for m in metrics_data])
            comparative['current_period']['total_violations'] = sum(
                m.violations_reminder + m.violations_warning + m.violations_blocking for m in metrics_data
            )
            comparative['current_period']['total_operations'] = sum(m.total_file_operations for m in metrics_data)
            
            # Previous period metrics
            prev_start = start_date - timedelta(days=days)
            prev_metrics = self.metrics.get_user_metrics_range(user_id, prev_start, start_date)
            
            if prev_metrics:
                comparative['previous_period']['avg_productivity_score'] = mean([m.productivity_score or 0 for m in prev_metrics])
                comparative['previous_period']['avg_compliance_rate'] = mean([m.compliance_rate for m in prev_metrics])
                comparative['previous_period']['total_violations'] = sum(
                    m.violations_reminder + m.violations_warning + m.violations_blocking for m in prev_metrics
                )
                comparative['previous_period']['total_operations'] = sum(m.total_file_operations for m in prev_metrics)
                
                # Calculate changes
                comparative['changes']['productivity_change'] = (
                    comparative['current_period']['avg_productivity_score'] - 
                    comparative['previous_period']['avg_productivity_score']
                )
                comparative['changes']['compliance_change'] = (
                    comparative['current_period']['avg_compliance_rate'] - 
                    comparative['previous_period']['avg_compliance_rate']
                )
                comparative['changes']['violation_change'] = (
                    comparative['current_period']['total_violations'] - 
                    comparative['previous_period']['total_violations']
                )
                
        return comparative
        
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile value from sorted data."""
        if not data:
            return 0.0
        size = len(data)
        index = (percentile / 100) * (size - 1)
        if index.is_integer():
            return data[int(index)]
        else:
            lower = data[int(index)]
            upper = data[int(index) + 1]
            return lower + (upper - lower) * (index - int(index))
            
    def _calculate_slope(self, x_values: List[int], y_values: List[float]) -> float:
        """Calculate slope of linear trend."""
        if len(x_values) != len(y_values) or len(x_values) < 2:
            return 0.0
            
        n = len(x_values)
        sum_x = sum(x_values)
        sum_y = sum(y_values)
        sum_xy = sum(x * y for x, y in zip(x_values, y_values))
        sum_x_squared = sum(x * x for x in x_values)
        
        denominator = n * sum_x_squared - sum_x * sum_x
        if denominator == 0:
            return 0.0
            
        slope = (n * sum_xy - sum_x * sum_y) / denominator
        return slope


# Convenience function for getting default performance analytics
_default_analytics = None

def get_performance_analytics() -> PerformanceAnalytics:
    """Get default performance analytics instance."""
    global _default_analytics
    if _default_analytics is None:
        _default_analytics = PerformanceAnalytics()
    return _default_analytics