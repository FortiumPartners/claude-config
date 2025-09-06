#!/usr/bin/env python3
"""
Session End Hook for Manager Dashboard
Finalizes productivity metrics, generates session summary, and updates historical data
"""

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional
from cchooks import safe_create_context, SessionEndContext

def calculate_session_summary(session_data: Dict[str, Any], final_indicators: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate comprehensive session productivity summary."""
    start_time = datetime.fromisoformat(session_data["start_time"].rstrip("Z"))
    end_time = datetime.utcnow()
    duration = end_time - start_time
    
    # Calculate productivity metrics
    hours_worked = duration.total_seconds() / 3600
    commands_per_hour = final_indicators.get("commands_executed", 0) / max(hours_worked, 0.1)
    lines_per_hour = final_indicators.get("lines_changed", 0) / max(hours_worked, 0.1)
    
    # Calculate productivity score (0-10 scale)
    baseline = load_baseline()
    score_factors = {
        "velocity": min(2.0, commands_per_hour / max(baseline.get("average_commands_per_hour", 15), 1)),
        "code_output": min(2.0, lines_per_hour / max(baseline.get("average_lines_per_hour", 120), 1)),
        "success_rate": final_indicators.get("success_rate", 100) / 100,
        "focus": min(2.0, duration.total_seconds() / 3600),  # Max 2 points for 2+ hour sessions
        "agent_efficiency": min(2.0, len(final_indicators.get("agents_invoked", {})) / 3)  # Bonus for using agents
    }
    
    productivity_score = sum(score_factors.values()) * 2  # Scale to 10
    productivity_score = min(10.0, max(0.0, productivity_score))
    
    # Determine productivity trend
    if productivity_score >= 8.0:
        trend = "excellent"
    elif productivity_score >= 6.0:
        trend = "good"
    elif productivity_score >= 4.0:
        trend = "average"
    else:
        trend = "needs_improvement"
    
    summary = {
        "session_id": session_data["session_id"],
        "start_time": session_data["start_time"],
        "end_time": end_time.isoformat() + "Z",
        "duration_hours": round(hours_worked, 2),
        "productivity_score": round(productivity_score, 1),
        "trend": trend,
        "metrics": {
            "commands_executed": final_indicators.get("commands_executed", 0),
            "files_modified": final_indicators.get("files_modified", 0),
            "lines_changed": final_indicators.get("lines_changed", 0),
            "agents_used": len(final_indicators.get("agents_invoked", {})),
            "tools_used": len(final_indicators.get("tools_used", {})),
            "success_rate": round(final_indicators.get("success_rate", 100), 1)
        },
        "performance": {
            "commands_per_hour": round(commands_per_hour, 1),
            "lines_per_hour": round(lines_per_hour, 1),
            "vs_baseline_velocity": round((commands_per_hour / baseline.get("average_commands_per_hour", 15) - 1) * 100, 1),
            "vs_baseline_output": round((lines_per_hour / baseline.get("average_lines_per_hour", 120) - 1) * 100, 1)
        },
        "recommendations": generate_recommendations(score_factors, final_indicators)
    }
    
    return summary

def generate_recommendations(score_factors: Dict[str, float], indicators: Dict[str, Any]) -> list:
    """Generate actionable recommendations based on session performance."""
    recommendations = []
    
    if score_factors["velocity"] < 0.8:
        recommendations.append({
            "priority": "medium",
            "category": "productivity",
            "message": "Consider using more automated commands to increase velocity",
            "action": "Try /execute-tasks for multi-step workflows"
        })
    
    if score_factors["agent_efficiency"] < 0.5:
        recommendations.append({
            "priority": "high",
            "category": "automation",
            "message": "Leverage AI agents more to boost productivity",
            "action": "Use Task tool with specialized agents (frontend-developer, code-reviewer, etc.)"
        })
    
    if indicators.get("success_rate", 100) < 90:
        recommendations.append({
            "priority": "high",
            "category": "quality",
            "message": "Focus on reducing errors to improve success rate",
            "action": "Use test-runner agent before making changes"
        })
    
    if score_factors["code_output"] < 0.7:
        recommendations.append({
            "priority": "medium",
            "category": "efficiency",
            "message": "Consider batching similar tasks for better code output",
            "action": "Group related file modifications together"
        })
    
    # Positive reinforcement for good performance
    if score_factors["velocity"] > 1.2:
        recommendations.append({
            "priority": "info",
            "category": "achievement",
            "message": "Excellent velocity! You're 20% above baseline",
            "action": "Maintain current workflow patterns"
        })
    
    return recommendations

def load_baseline() -> Dict[str, Any]:
    """Load current productivity baseline."""
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    baseline_file = metrics_dir / "current-baseline.json"
    
    default = {
        "average_commands_per_hour": 15,
        "average_lines_per_hour": 120,
        "average_success_rate": 0.92
    }
    
    if baseline_file.exists():
        try:
            with open(baseline_file) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    
    return default

def update_historical_data(summary: Dict[str, Any]) -> None:
    """Update historical productivity data for trend analysis."""
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    history_file = metrics_dir / "session-history.jsonl"
    
    # Append session summary to history
    with open(history_file, "a") as f:
        f.write(json.dumps(summary) + "\n")
    
    # Update rolling baseline (last 30 sessions)
    try:
        sessions = []
        if history_file.exists():
            with open(history_file) as f:
                for line in f:
                    if line.strip():
                        sessions.append(json.loads(line))
        
        # Keep only recent sessions for baseline calculation
        recent_sessions = sessions[-30:] if len(sessions) > 30 else sessions
        
        if recent_sessions:
            total_commands = sum(s.get("metrics", {}).get("commands_executed", 0) for s in recent_sessions)
            total_hours = sum(s.get("duration_hours", 0) for s in recent_sessions)
            total_lines = sum(s.get("metrics", {}).get("lines_changed", 0) for s in recent_sessions)
            total_success = sum(s.get("metrics", {}).get("success_rate", 100) for s in recent_sessions)
            
            if total_hours > 0:
                new_baseline = {
                    "average_commands_per_hour": total_commands / total_hours,
                    "average_lines_per_hour": total_lines / total_hours,
                    "average_success_rate": total_success / len(recent_sessions),
                    "last_updated": datetime.utcnow().isoformat() + "Z",
                    "sessions_count": len(recent_sessions)
                }
                
                baseline_file = metrics_dir / "historical-baseline.json"
                with open(baseline_file, "w") as f:
                    json.dump(new_baseline, f, indent=2)
    
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Failed to update historical baseline: {e}")

def cleanup_session_files(session_id: str) -> None:
    """Clean up temporary session files and flags."""
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    
    # Remove dashboard active flag
    dashboard_flag = metrics_dir / ".dashboard-active"
    if dashboard_flag.exists():
        dashboard_flag.unlink()
    
    # Archive real-time activity log
    activity_log = metrics_dir / "realtime" / "activity.log"
    if activity_log.exists():
        archive_dir = metrics_dir / "archives"
        archive_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_file = archive_dir / f"activity_{session_id[:8]}_{timestamp}.log"
        activity_log.rename(archive_file)

def main():
    """Main hook execution for session end."""
    context = safe_create_context()
    
    if not isinstance(context, SessionEndContext):
        return
    
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    session_id = os.getenv("CLAUDE_SESSION_ID", "unknown")
    
    # Load session data
    session_file = metrics_dir / "sessions" / f"{session_id}.json"
    if not session_file.exists():
        print(f"Warning: Session file not found for {session_id}")
        return
    
    with open(session_file) as f:
        session_data = json.load(f)
    
    # Load final productivity indicators
    indicators_file = metrics_dir / "productivity-indicators.json"
    final_indicators = {}
    if indicators_file.exists():
        with open(indicators_file) as f:
            final_indicators = json.load(f)
    
    # Calculate comprehensive session summary
    summary = calculate_session_summary(session_data, final_indicators)
    
    # Update session JSONL with end event
    session_log = metrics_dir / "sessions" / f"{session_id}.jsonl"
    with open(session_log, "a") as f:
        f.write(json.dumps({
            "event": "session_end",
            "timestamp": summary["end_time"],
            "session_id": session_id,
            "duration_hours": summary["duration_hours"],
            "productivity_score": summary["productivity_score"],
            "final_metrics": summary["metrics"]
        }) + "\n")
    
    # Save final session summary
    summary_file = metrics_dir / "sessions" / f"{session_id}_summary.json"
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)
    
    # Update historical data
    update_historical_data(summary)
    
    # Clean up temporary files
    cleanup_session_files(session_id)
    
    # Display session summary
    print(f"\n🎯 Productivity Session Summary")
    print(f"📊 Score: {summary['productivity_score']}/10 ({summary['trend']})")
    print(f"⏱️  Duration: {summary['duration_hours']} hours")
    print(f"⚡ Commands: {summary['metrics']['commands_executed']} ({summary['performance']['commands_per_hour']}/hr)")
    print(f"📝 Lines: {summary['metrics']['lines_changed']} ({summary['performance']['lines_per_hour']}/hr)")
    print(f"🤖 Agents: {summary['metrics']['agents_used']} used")
    print(f"✅ Success: {summary['metrics']['success_rate']}%")
    
    if summary['recommendations']:
        print(f"\n💡 Recommendations:")
        for rec in summary['recommendations'][:3]:  # Show top 3
            print(f"   {rec['message']}")

if __name__ == "__main__":
    main()