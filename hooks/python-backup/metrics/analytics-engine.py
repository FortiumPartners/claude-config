#!/usr/bin/env python3
"""
Analytics Engine for Manager Dashboard Metrics
Processes collected metrics data to generate insights and recommendations
"""

import json
import os
import statistics
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np

class MetricsAnalyzer:
    """Advanced analytics engine for productivity metrics."""
    
    def __init__(self, metrics_dir: Optional[Path] = None):
        self.metrics_dir = metrics_dir or Path.home() / ".agent-os" / "metrics"
        self.metrics_dir.mkdir(parents=True, exist_ok=True)
    
    def calculate_productivity_score(self, session_data: Dict[str, Any]) -> float:
        """Calculate comprehensive productivity score (0-10 scale)."""
        baseline = self.load_baseline()
        
        # Get session metrics
        duration_hours = session_data.get("duration_hours", 0.1)
        commands = session_data.get("metrics", {}).get("commands_executed", 0)
        lines = session_data.get("metrics", {}).get("lines_changed", 0)
        success_rate = session_data.get("metrics", {}).get("success_rate", 100) / 100
        agents_used = session_data.get("metrics", {}).get("agents_used", 0)
        
        # Calculate component scores
        velocity_score = min(2.5, (commands / duration_hours) / baseline.get("average_commands_per_hour", 15) * 2.5)
        output_score = min(2.5, (lines / duration_hours) / baseline.get("average_lines_per_hour", 120) * 2.5)
        quality_score = success_rate * 2.0
        efficiency_score = min(1.5, agents_used / 3 * 1.5)  # Bonus for using AI agents
        focus_score = min(1.5, duration_hours / 2 * 1.5)  # Bonus for sustained focus
        
        total_score = velocity_score + output_score + quality_score + efficiency_score + focus_score
        return min(10.0, max(0.0, total_score))
    
    def detect_anomalies(self, current_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Detect productivity anomalies requiring attention."""
        anomalies = []
        baseline = self.load_baseline()
        history = self.load_recent_sessions(30)
        
        if not history:
            return anomalies
        
        # Calculate historical averages
        historical_commands_per_hour = [
            s.get("metrics", {}).get("commands_executed", 0) / max(s.get("duration_hours", 0.1), 0.1)
            for s in history
        ]
        historical_success_rates = [
            s.get("metrics", {}).get("success_rate", 100) for s in history
        ]
        
        avg_commands_per_hour = statistics.mean(historical_commands_per_hour) if historical_commands_per_hour else 15
        avg_success_rate = statistics.mean(historical_success_rates) if historical_success_rates else 95
        
        # Current session metrics
        current_commands_per_hour = current_metrics.get("commands_executed", 0) / max(current_metrics.get("duration_hours", 0.1), 0.1)
        current_success_rate = current_metrics.get("success_rate", 100)
        
        # Velocity anomaly detection
        if current_commands_per_hour < avg_commands_per_hour * 0.5:
            anomalies.append({
                "type": "low_velocity",
                "severity": "warning",
                "message": f"Command velocity {current_commands_per_hour:.1f}/hr is {(1 - current_commands_per_hour/avg_commands_per_hour)*100:.0f}% below average",
                "recommendation": "Consider using /execute-tasks or agent delegation to improve efficiency"
            })
        elif current_commands_per_hour > avg_commands_per_hour * 1.5:
            anomalies.append({
                "type": "high_velocity",
                "severity": "info",
                "message": f"Excellent velocity! {current_commands_per_hour:.1f}/hr is {(current_commands_per_hour/avg_commands_per_hour-1)*100:.0f}% above average",
                "recommendation": "Great work! Maintain current workflow patterns"
            })
        
        # Success rate anomaly detection
        if current_success_rate < avg_success_rate * 0.8:
            anomalies.append({
                "type": "low_success_rate",
                "severity": "alert",
                "message": f"Success rate {current_success_rate:.1f}% is significantly below average ({avg_success_rate:.1f}%)",
                "recommendation": "Use test-runner agent and code-reviewer for better quality"
            })
        
        # Agent usage patterns
        agents_used = current_metrics.get("agents_used", 0)
        if agents_used == 0 and current_commands_per_hour > 10:
            anomalies.append({
                "type": "no_agent_usage",
                "severity": "suggestion",
                "message": "High activity detected but no AI agents used",
                "recommendation": "Consider using Task tool with specialized agents to boost productivity"
            })
        
        return anomalies
    
    def generate_recommendations(self, metrics: Dict[str, Any], history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate actionable recommendations based on metrics analysis."""
        recommendations = []
        
        # Agent usage optimization
        tools_used = metrics.get("tools_used", {})
        agents_invoked = metrics.get("agents_invoked", {})
        
        if len(agents_invoked) < 3 and metrics.get("commands_executed", 0) > 10:
            recommendations.append({
                "priority": "high",
                "category": "agent_usage",
                "title": "Increase AI Agent Utilization",
                "description": "You executed many commands but used few agents. Agents can automate complex workflows.",
                "action": "Try: Task tool with frontend-developer, code-reviewer, or test-runner agents",
                "impact": "15-30% productivity improvement expected"
            })
        
        # Workflow optimization
        if tools_used.get("Read", 0) > tools_used.get("Edit", 0) * 3:
            recommendations.append({
                "priority": "medium",
                "category": "workflow",
                "title": "Optimize Read/Edit Ratio",
                "description": "High read-to-edit ratio suggests research-heavy session.",
                "action": "Consider using context-fetcher agent to gather information more efficiently",
                "impact": "Reduce information gathering time by 40%"
            })
        
        # Quality improvement
        success_rate = metrics.get("success_rate", 100)
        if success_rate < 90:
            recommendations.append({
                "priority": "high",
                "category": "quality",
                "title": "Improve Success Rate",
                "description": f"Current success rate {success_rate:.1f}% is below optimal.",
                "action": "Use test-runner agent after changes and code-reviewer before commits",
                "impact": "Reduce debugging time by 50%"
            })
        
        # Productivity patterns from history
        if history and len(history) >= 5:
            recent_scores = [self.calculate_productivity_score(s) for s in history[-5:]]
            if len(recent_scores) >= 3:
                trend = np.polyfit(range(len(recent_scores)), recent_scores, 1)[0]
                
                if trend < -0.5:
                    recommendations.append({
                        "priority": "medium",
                        "category": "trend",
                        "title": "Declining Productivity Trend",
                        "description": "Productivity has been decreasing over recent sessions.",
                        "action": "Review workflow patterns and consider process improvements",
                        "impact": "Arrest decline and return to baseline performance"
                    })
        
        # Focus and efficiency
        duration = metrics.get("duration_hours", 0)
        if duration < 0.5 and metrics.get("commands_executed", 0) < 5:
            recommendations.append({
                "priority": "low",
                "category": "efficiency",
                "title": "Short Session Detected",
                "description": "Brief sessions may indicate interruptions or task switching.",
                "action": "Try to batch related tasks for longer, focused work sessions",
                "impact": "Improve deep work and reduce context switching overhead"
            })
        
        return recommendations
    
    def calculate_team_metrics(self) -> Dict[str, Any]:
        """Calculate team-wide productivity metrics."""
        history = self.load_recent_sessions(90)  # Last 90 days
        
        if not history:
            return {"error": "No historical data available"}
        
        # Team productivity metrics
        total_sessions = len(history)
        avg_productivity_score = statistics.mean([
            self.calculate_productivity_score(s) for s in history
        ])
        
        total_commands = sum(s.get("metrics", {}).get("commands_executed", 0) for s in history)
        total_hours = sum(s.get("duration_hours", 0) for s in history)
        total_lines = sum(s.get("metrics", {}).get("lines_changed", 0) for s in history)
        
        # Agent usage statistics
        all_agents = {}
        for session in history:
            for agent, count in session.get("metrics", {}).get("agents_invoked", {}).items():
                all_agents[agent] = all_agents.get(agent, 0) + count
        
        # Calculate trends
        if len(history) >= 7:
            recent_week = history[-7:]
            previous_week = history[-14:-7] if len(history) >= 14 else []
            
            recent_avg = statistics.mean([self.calculate_productivity_score(s) for s in recent_week])
            previous_avg = statistics.mean([self.calculate_productivity_score(s) for s in previous_week]) if previous_week else recent_avg
            
            trend_change = ((recent_avg - previous_avg) / previous_avg * 100) if previous_avg > 0 else 0
        else:
            trend_change = 0
        
        return {
            "team_summary": {
                "total_sessions": total_sessions,
                "avg_productivity_score": round(avg_productivity_score, 1),
                "total_commands": total_commands,
                "total_hours": round(total_hours, 1),
                "total_lines_changed": total_lines,
                "commands_per_hour": round(total_commands / max(total_hours, 0.1), 1),
                "lines_per_hour": round(total_lines / max(total_hours, 0.1), 1)
            },
            "trend_analysis": {
                "week_over_week_change": round(trend_change, 1),
                "direction": "improving" if trend_change > 2 else "declining" if trend_change < -2 else "stable"
            },
            "agent_leaderboard": sorted(
                [(agent, count) for agent, count in all_agents.items()],
                key=lambda x: x[1],
                reverse=True
            )[:10],
            "last_updated": datetime.utcnow().isoformat() + "Z"
        }
    
    def load_baseline(self) -> Dict[str, Any]:
        """Load current productivity baseline."""
        baseline_file = self.metrics_dir / "historical-baseline.json"
        default = {
            "average_commands_per_hour": 15,
            "average_lines_per_hour": 120,
            "average_success_rate": 95
        }
        
        if baseline_file.exists():
            try:
                with open(baseline_file) as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        
        return default
    
    def load_recent_sessions(self, days: int = 30) -> List[Dict[str, Any]]:
        """Load recent session data for analysis."""
        history_file = self.metrics_dir / "session-history.jsonl"
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        sessions = []
        if history_file.exists():
            try:
                with open(history_file) as f:
                    for line in f:
                        if line.strip():
                            session = json.loads(line)
                            session_date = datetime.fromisoformat(session.get("start_time", "").rstrip("Z"))
                            if session_date > cutoff_date:
                                sessions.append(session)
            except (json.JSONDecodeError, IOError):
                pass
        
        return sessions

def generate_dashboard_data() -> Dict[str, Any]:
    """Generate comprehensive dashboard data for manager view."""
    analyzer = MetricsAnalyzer()
    
    # Current session indicators
    indicators_file = analyzer.metrics_dir / "productivity-indicators.json"
    current_indicators = {}
    if indicators_file.exists():
        try:
            with open(indicators_file) as f:
                current_indicators = json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    
    # Team metrics
    team_metrics = analyzer.calculate_team_metrics()
    
    # Recent anomalies
    anomalies = []
    if current_indicators:
        anomalies = analyzer.detect_anomalies(current_indicators)
    
    # Recommendations
    history = analyzer.load_recent_sessions(30)
    recommendations = []
    if current_indicators:
        recommendations = analyzer.generate_recommendations(current_indicators, history)
    
    return {
        "current_session": current_indicators,
        "team_metrics": team_metrics,
        "anomalies": anomalies,
        "recommendations": recommendations,
        "dashboard_updated": datetime.utcnow().isoformat() + "Z"
    }

if __name__ == "__main__":
    # Generate dashboard data when run directly
    dashboard_data = generate_dashboard_data()
    
    # Save to dashboard data file
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    dashboard_file = metrics_dir / "dashboard-data.json"
    
    with open(dashboard_file, "w") as f:
        json.dump(dashboard_data, f, indent=2)
    
    print("📊 Dashboard data generated successfully")