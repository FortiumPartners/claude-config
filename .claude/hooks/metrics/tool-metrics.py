#!/usr/bin/env python3
"""
Tool Metrics Collection Hook for Manager Dashboard
Captures tool usage patterns, performance, and productivity metrics
"""

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any
from cchooks import safe_create_context, PostToolUseContext

def log_metrics(data: Dict[str, Any]) -> None:
    """Log metrics data to JSONL format for analytics processing."""
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)
    
    # Main metrics log
    with open(metrics_dir / "tool-metrics.jsonl", "a") as f:
        f.write(json.dumps(data) + "\n")
    
    # Real-time activity log for dashboard
    activity_file = metrics_dir / "realtime" / "activity.log"
    activity_file.parent.mkdir(exist_ok=True)
    
    timestamp = data.get("timestamp", datetime.utcnow().isoformat())
    tool_name = data.get("tool_name", "unknown")
    status = data.get("status", "unknown")
    
    with open(activity_file, "a") as f:
        f.write(f"{timestamp}|tool_complete|{tool_name}|{status}\n")

def main():
    """Main hook execution for tool metrics collection."""
    context = safe_create_context()
    
    if not isinstance(context, PostToolUseContext):
        return
    
    # Capture tool execution metrics
    start_time = time.time()
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    # Basic tool metrics
    metrics_data = {
        "event_type": "tool_execution",
        "timestamp": timestamp,
        "tool_name": context.tool_name,
        "success": not bool(context.error),
        "execution_time_ms": round((time.time() - start_time) * 1000, 2),
        "user": os.getenv("USER", "unknown"),
        "session_id": os.getenv("CLAUDE_SESSION_ID", "default")
    }
    
    # Tool-specific metrics collection
    if context.tool_name == "Read":
        # File read metrics
        file_path = context.tool_input.get("file_path", "")
        try:
            file_size = os.path.getsize(file_path) if file_path and os.path.exists(file_path) else 0
            metrics_data.update({
                "file_path": file_path,
                "file_size_bytes": file_size,
                "lines_requested": context.tool_input.get("limit", "all")
            })
        except (OSError, TypeError):
            pass
    
    elif context.tool_name == "Edit":
        # File edit metrics
        file_path = context.tool_input.get("file_path", "")
        old_string = context.tool_input.get("old_string", "")
        new_string = context.tool_input.get("new_string", "")
        
        lines_removed = len(old_string.split('\n')) if old_string else 0
        lines_added = len(new_string.split('\n')) if new_string else 0
        
        metrics_data.update({
            "file_path": file_path,
            "lines_added": lines_added,
            "lines_removed": lines_removed,
            "net_lines": lines_added - lines_removed,
            "replace_all": context.tool_input.get("replace_all", False)
        })
    
    elif context.tool_name == "Write":
        # File write metrics
        file_path = context.tool_input.get("file_path", "")
        content = context.tool_input.get("content", "")
        
        metrics_data.update({
            "file_path": file_path,
            "content_length": len(content),
            "lines_written": len(content.split('\n')) if content else 0,
            "file_type": Path(file_path).suffix if file_path else "unknown"
        })
    
    elif context.tool_name == "Bash":
        # Command execution metrics
        command = context.tool_input.get("command", "")
        metrics_data.update({
            "command": command,
            "command_type": command.split()[0] if command else "unknown",
            "background": context.tool_input.get("run_in_background", False),
            "timeout": context.tool_input.get("timeout", None)
        })
    
    elif context.tool_name == "Task":
        # Sub-agent invocation metrics
        subagent_type = context.tool_input.get("subagent_type", "unknown")
        description = context.tool_input.get("description", "")
        
        metrics_data.update({
            "subagent_type": subagent_type,
            "task_description": description,
            "delegation": True
        })
        
        # Track agent performance for leaderboard
        agent_metrics = {
            "event_type": "agent_invocation",
            "timestamp": timestamp,
            "agent_name": subagent_type,
            "task_description": description,
            "success": not bool(context.error),
            "execution_time_ms": metrics_data["execution_time_ms"]
        }
        log_metrics(agent_metrics)
    
    # Add error details if present
    if context.error:
        metrics_data.update({
            "error": True,
            "error_message": str(context.error)
        })
    
    # Log the metrics
    log_metrics(metrics_data)
    
    # Update productivity indicators
    update_productivity_indicators(metrics_data)

def update_productivity_indicators(metrics: Dict[str, Any]) -> None:
    """Update real-time productivity indicators for dashboard."""
    metrics_dir = Path.home() / ".agent-os" / "metrics"
    indicators_file = metrics_dir / "productivity-indicators.json"
    
    # Load existing indicators or initialize
    if indicators_file.exists():
        with open(indicators_file) as f:
            indicators = json.load(f)
    else:
        indicators = {
            "session_start": datetime.utcnow().isoformat(),
            "commands_executed": 0,
            "tools_used": {},
            "files_modified": 0,
            "lines_changed": 0,
            "agents_invoked": {},
            "success_rate": 100.0,
            "last_activity": None
        }
    
    # Update indicators based on current metrics
    indicators["commands_executed"] += 1
    indicators["last_activity"] = metrics["timestamp"]
    
    tool_name = metrics["tool_name"]
    indicators["tools_used"][tool_name] = indicators["tools_used"].get(tool_name, 0) + 1
    
    if tool_name in ["Edit", "Write"] and "file_path" in metrics:
        indicators["files_modified"] += 1
    
    if "net_lines" in metrics:
        indicators["lines_changed"] += abs(metrics["net_lines"])
    elif "lines_written" in metrics:
        indicators["lines_changed"] += metrics["lines_written"]
    
    if "subagent_type" in metrics:
        agent = metrics["subagent_type"]
        indicators["agents_invoked"][agent] = indicators["agents_invoked"].get(agent, 0) + 1
    
    # Calculate success rate
    total_commands = indicators["commands_executed"]
    if total_commands > 0:
        # This is a simplified calculation - would need error tracking for accuracy
        if metrics.get("success", True):
            # Maintain or improve success rate
            pass
        else:
            # Adjust success rate down slightly
            indicators["success_rate"] = max(0, indicators["success_rate"] - (1.0 / total_commands))
    
    # Save updated indicators
    with open(indicators_file, "w") as f:
        json.dump(indicators, f, indent=2)
    
    # Signal dashboard update if active
    dashboard_signal = metrics_dir / ".dashboard-active"
    if dashboard_signal.exists():
        realtime_log = metrics_dir / "realtime.log"
        with open(realtime_log, "a") as f:
            f.write(f"📊 [{datetime.now().strftime('%H:%M:%S')}] {tool_name} completed - Productivity: {indicators['commands_executed']} commands, {indicators['files_modified']} files\n")

if __name__ == "__main__":
    main()