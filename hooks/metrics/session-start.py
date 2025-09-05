#!/usr/bin/env python3
"""
Session Start Hook for Manager Dashboard
Initializes productivity tracking session and sets baseline metrics
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any
from cchooks import safe_create_context, SessionStartContext

def initialize_session_metrics() -> Dict[str, Any]:
    """Initialize session tracking with baseline metrics."""
    session_data = {
        "session_id": str(uuid.uuid4()),
        "start_time": datetime.utcnow().isoformat() + "Z",
        "user": os.getenv("USER", "unknown"),
        "working_directory": os.getcwd(),
        "git_branch": get_git_branch(),
        "productivity_metrics": {
            "commands_executed": 0,
            "tools_invoked": 0,
            "files_read": 0,
            "files_modified": 0,
            "lines_changed": 0,
            "agents_used": [],
            "focus_blocks": 0,
            "interruptions": 0
        },
        "quality_metrics": {
            "tests_run": 0,
            "tests_passed": 0,
            "builds_attempted": 0,
            "builds_successful": 0,
            "reviews_requested": 0
        },
        "workflow_metrics": {
            "git_commits": 0,
            "prs_created": 0,
            "context_switches": 0
        }
    }
    
    return session_data

def get_git_branch() -> str:
    """Get current git branch if available."""
    try:
        import subprocess
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return "unknown"

def setup_dashboard_integration() -> None:
    """Setup integration points for real-time dashboard updates."""
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    
    # Create realtime directory structure
    realtime_dir = metrics_dir / "realtime"
    realtime_dir.mkdir(exist_ok=True)
    
    # Initialize activity log
    activity_log = realtime_dir / "activity.log"
    with open(activity_log, "a") as f:
        f.write(f"{datetime.utcnow().isoformat()}|session_start|new_session|active\n")
    
    # Create dashboard active flag
    dashboard_flag = metrics_dir / ".dashboard-active"
    with open(dashboard_flag, "w") as f:
        f.write(f"active_since:{datetime.utcnow().isoformat()}\n")
    
    # Initialize real-time log for notifications
    realtime_log = metrics_dir / "realtime.log"
    with open(realtime_log, "a") as f:
        f.write(f"🚀 [{datetime.now().strftime('%H:%M:%S')}] Productivity tracking session started\n")

def load_historical_baseline() -> Dict[str, Any]:
    """Load historical productivity baseline for comparison."""
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    baseline_file = metrics_dir / "historical-baseline.json"
    
    default_baseline = {
        "average_commands_per_hour": 15,
        "average_lines_per_hour": 120,
        "average_success_rate": 0.92,
        "average_focus_time_minutes": 45,
        "average_context_switches": 3
    }
    
    if baseline_file.exists():
        try:
            with open(baseline_file) as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    
    return default_baseline

def main():
    """Main hook execution for session start."""
    context = safe_create_context()
    
    if not isinstance(context, SessionStartContext):
        return
    
    # Initialize session metrics
    session_data = initialize_session_metrics()
    
    # Set session ID in environment for other hooks
    os.environ["CLAUDE_SESSION_ID"] = session_data["session_id"]
    
    # Setup metrics directory structure
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    sessions_dir = metrics_dir / "sessions"
    sessions_dir.mkdir(parents=True, exist_ok=True)
    
    # Save session initialization data
    session_file = sessions_dir / f"{session_data['session_id']}.json"
    with open(session_file, "w") as f:
        json.dump(session_data, f, indent=2)
    
    # Create session JSONL for streaming events
    session_log = sessions_dir / f"{session_data['session_id']}.jsonl"
    with open(session_log, "w") as f:
        f.write(json.dumps({
            "event": "session_start",
            "timestamp": session_data["start_time"],
            "session_id": session_data["session_id"],
            "user": session_data["user"],
            "git_branch": session_data["git_branch"],
            "working_directory": session_data["working_directory"]
        }) + "\n")
    
    # Setup dashboard integration
    setup_dashboard_integration()
    
    # Load historical baseline for productivity comparison
    baseline = load_historical_baseline()
    baseline_file = metrics_dir / "current-baseline.json"
    with open(baseline_file, "w") as f:
        json.dump(baseline, f, indent=2)
    
    # Initialize productivity indicators
    indicators = {
        "session_id": session_data["session_id"],
        "start_time": session_data["start_time"],
        "baseline": baseline,
        "current_metrics": session_data["productivity_metrics"],
        "last_update": session_data["start_time"],
        "productivity_score": 0.0,
        "trend": "starting"
    }
    
    indicators_file = metrics_dir / "productivity-indicators.json"
    with open(indicators_file, "w") as f:
        json.dump(indicators, f, indent=2)
    
    print(f"🎯 Productivity tracking initialized for session: {session_data['session_id'][:8]}...")

if __name__ == "__main__":
    main()