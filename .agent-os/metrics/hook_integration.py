#!/usr/bin/env python3
"""
Hook Integration for MetricsCollector
Created: 2025-08-30 for Manager Dashboard Metrics Implementation

Integration layer between shell hooks and Python MetricsCollector service.
"""

import sys
import os
from pathlib import Path
import time
import json

# Add metrics module to path
metrics_dir = Path(__file__).parent
sys.path.insert(0, str(metrics_dir))

try:
    from metrics_collector import get_global_collector
    METRICS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: MetricsCollector not available: {e}", file=sys.stderr)
    METRICS_AVAILABLE = False


def collect_command_start(command: str, session_id: str = None) -> dict:
    """
    Collect metrics for command start.
    Called by command-start.sh hook.
    
    Args:
        command: Command being executed
        session_id: Optional session ID
        
    Returns:
        dict: Response with session info
    """
    if not METRICS_AVAILABLE:
        return {"status": "disabled", "session_id": session_id or "unknown"}
    
    try:
        collector = get_global_collector()
        
        # Store command start time for duration calculation
        start_time = int(time.time() * 1000)  # milliseconds
        context_file = Path.home() / '.agent-os' / 'metrics' / f'.cmd-start-{session_id or "default"}'
        
        with open(context_file, 'w') as f:
            json.dump({
                'command': command,
                'start_time': start_time,
                'session_id': session_id or collector.session_id
            }, f)
        
        return {
            "status": "started",
            "session_id": session_id or collector.session_id,
            "start_time": start_time
        }
        
    except Exception as e:
        print(f"Error in collect_command_start: {e}", file=sys.stderr)
        return {"status": "error", "error": str(e)}


def collect_command_complete(command: str, exit_code: int, duration_ms: int = None, 
                           session_id: str = None) -> dict:
    """
    Collect metrics for command completion.
    Called by command-complete.sh hook.
    
    Args:
        command: Command that was executed
        exit_code: Exit code of the command
        duration_ms: Duration in milliseconds (calculated if not provided)
        session_id: Optional session ID
        
    Returns:
        dict: Response with collection status
    """
    if not METRICS_AVAILABLE:
        return {"status": "disabled"}
    
    try:
        collector = get_global_collector()
        
        # Try to load start context if duration not provided
        if duration_ms is None:
            context_file = Path.home() / '.agent-os' / 'metrics' / f'.cmd-start-{session_id or "default"}'
            try:
                with open(context_file, 'r') as f:
                    context = json.load(f)
                    start_time = context.get('start_time', 0)
                    current_time = int(time.time() * 1000)
                    duration_ms = current_time - start_time
                    
                # Cleanup context file
                context_file.unlink(missing_ok=True)
                
            except (FileNotFoundError, json.JSONDecodeError):
                duration_ms = 0  # Fallback
        
        # Collect the metric
        success = collector.collect_command_metric(
            command=command,
            duration_ms=duration_ms,
            exit_code=exit_code,
            session_id=session_id
        )
        
        return {
            "status": "collected" if success else "failed",
            "duration_ms": duration_ms,
            "metrics_count": collector.metrics_count
        }
        
    except Exception as e:
        print(f"Error in collect_command_complete: {e}", file=sys.stderr)
        return {"status": "error", "error": str(e)}


def collect_agent_invocation(agent_name: str, task_description: str, 
                           duration_ms: int, success: bool = True,
                           session_id: str = None) -> dict:
    """
    Collect metrics for agent invocation.
    Called by agent-invocation.sh hook.
    
    Args:
        agent_name: Name of the agent
        task_description: Description of the task
        duration_ms: Duration in milliseconds
        success: Whether the agent succeeded
        session_id: Optional session ID
        
    Returns:
        dict: Response with collection status
    """
    if not METRICS_AVAILABLE:
        return {"status": "disabled"}
    
    try:
        collector = get_global_collector()
        
        # Calculate complexity score based on task description
        complexity_score = calculate_task_complexity(task_description)
        
        success = collector.collect_agent_metric(
            agent_name=agent_name,
            task_description=task_description,
            duration_ms=duration_ms,
            success=success,
            complexity_score=complexity_score,
            session_id=session_id
        )
        
        return {
            "status": "collected" if success else "failed",
            "complexity_score": complexity_score,
            "metrics_count": collector.metrics_count
        }
        
    except Exception as e:
        print(f"Error in collect_agent_invocation: {e}", file=sys.stderr)
        return {"status": "error", "error": str(e)}


def collect_tool_usage(tool_name: str, operation: str, duration_ms: int,
                      success: bool = True, resource_impact: dict = None,
                      session_id: str = None) -> dict:
    """
    Collect metrics for tool usage.
    Called by tool-*.sh hooks.
    
    Args:
        tool_name: Name of the tool
        operation: Operation performed
        duration_ms: Duration in milliseconds  
        success: Whether the operation succeeded
        resource_impact: Resource usage metrics
        session_id: Optional session ID
        
    Returns:
        dict: Response with collection status
    """
    if not METRICS_AVAILABLE:
        return {"status": "disabled"}
    
    try:
        collector = get_global_collector()
        
        success = collector.collect_tool_metric(
            tool_name=tool_name,
            operation=operation,
            duration_ms=duration_ms,
            success=success,
            resource_impact=resource_impact or {},
            session_id=session_id
        )
        
        return {
            "status": "collected" if success else "failed",
            "metrics_count": collector.metrics_count
        }
        
    except Exception as e:
        print(f"Error in collect_tool_usage: {e}", file=sys.stderr)
        return {"status": "error", "error": str(e)}


def calculate_task_complexity(task_description: str) -> float:
    """
    Calculate task complexity score based on description.
    
    Args:
        task_description: Description of the task
        
    Returns:
        float: Complexity score from 1.0 to 10.0
    """
    if not task_description:
        return 1.0
    
    desc_lower = task_description.lower()
    complexity = 1.0
    
    # Length-based complexity
    if len(task_description) > 100:
        complexity += 1.0
    elif len(task_description) > 50:
        complexity += 0.5
    
    # Keyword-based complexity
    high_complexity_keywords = ['implement', 'create', 'build', 'develop', 'design']
    medium_complexity_keywords = ['modify', 'update', 'fix', 'refactor']
    
    if any(keyword in desc_lower for keyword in high_complexity_keywords):
        complexity += 2.0
    elif any(keyword in desc_lower for keyword in medium_complexity_keywords):
        complexity += 1.0
    
    # Technical keywords
    tech_keywords = ['algorithm', 'database', 'api', 'integration', 'security']
    if any(keyword in desc_lower for keyword in tech_keywords):
        complexity += 1.5
    
    # Cap at 10.0
    return min(complexity, 10.0)


def get_metrics_status() -> dict:
    """
    Get current metrics collection status.
    
    Returns:
        dict: Status information
    """
    if not METRICS_AVAILABLE:
        return {"status": "disabled", "reason": "MetricsCollector not available"}
    
    try:
        collector = get_global_collector()
        summary = collector.get_metrics_summary()
        
        return {
            "status": "active",
            "session_id": summary.get('session_id'),
            "metrics_collected": summary.get('metrics_collected', 0),
            "uptime_seconds": summary.get('uptime_seconds', 0),
            "storage_path": summary.get('storage_path')
        }
        
    except Exception as e:
        return {"status": "error", "error": str(e)}


if __name__ == '__main__':
    """Command-line interface for hook integration."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Hook integration for MetricsCollector')
    subparsers = parser.add_subparsers(dest='action', help='Action to perform')
    
    # Command start
    cmd_start = subparsers.add_parser('command-start', help='Record command start')
    cmd_start.add_argument('command', help='Command being executed')
    cmd_start.add_argument('--session-id', help='Session ID')
    
    # Command complete
    cmd_complete = subparsers.add_parser('command-complete', help='Record command completion')
    cmd_complete.add_argument('command', help='Command that was executed')
    cmd_complete.add_argument('exit_code', type=int, help='Exit code')
    cmd_complete.add_argument('--duration-ms', type=int, help='Duration in milliseconds')
    cmd_complete.add_argument('--session-id', help='Session ID')
    
    # Agent invocation
    agent = subparsers.add_parser('agent', help='Record agent invocation')
    agent.add_argument('agent_name', help='Agent name')
    agent.add_argument('task_description', help='Task description')
    agent.add_argument('duration_ms', type=int, help='Duration in milliseconds')
    agent.add_argument('--success', type=bool, default=True, help='Success status')
    agent.add_argument('--session-id', help='Session ID')
    
    # Tool usage
    tool = subparsers.add_parser('tool', help='Record tool usage')
    tool.add_argument('tool_name', help='Tool name')
    tool.add_argument('operation', help='Operation performed')
    tool.add_argument('duration_ms', type=int, help='Duration in milliseconds')
    tool.add_argument('--success', type=bool, default=True, help='Success status')
    tool.add_argument('--session-id', help='Session ID')
    
    # Status
    subparsers.add_parser('status', help='Get metrics status')
    
    args = parser.parse_args()
    
    if args.action == 'command-start':
        result = collect_command_start(args.command, args.session_id)
        print(json.dumps(result))
    
    elif args.action == 'command-complete':
        result = collect_command_complete(args.command, args.exit_code, args.duration_ms, args.session_id)
        print(json.dumps(result))
    
    elif args.action == 'agent':
        result = collect_agent_invocation(args.agent_name, args.task_description, 
                                        args.duration_ms, args.success, args.session_id)
        print(json.dumps(result))
    
    elif args.action == 'tool':
        result = collect_tool_usage(args.tool_name, args.operation, args.duration_ms, 
                                   args.success, {}, args.session_id)
        print(json.dumps(result))
    
    elif args.action == 'status':
        result = get_metrics_status()
        print(json.dumps(result, indent=2))
    
    else:
        parser.print_help()