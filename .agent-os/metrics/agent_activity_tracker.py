#!/usr/bin/env python3
"""
Agent Activity Tracker - Task 1.2.1 Implementation

Thread-safe agent invocation tracking with JSONL persistence and complexity estimation.
Integrates with existing metrics collection framework for comprehensive productivity analytics.

Performance: <2% overhead, <10ms per tracking call
Storage: JSONL format in .agent-os/metrics/data/agent_invocations_{date}.jsonl
"""

import json
import threading
import uuid
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
import re
import hashlib
import os

# Import existing metrics collector for integration
try:
    from .metrics_collector import MetricsCollector
except ImportError:
    MetricsCollector = None


@dataclass
class AgentInvocation:
    """
    Agent invocation data structure for tracking agent activity.
    
    Attributes:
        agent_name: Name of the invoked agent
        invocation_id: Unique identifier for this invocation
        start_time: When the agent was invoked
        task_description: Description of the task being performed
        complexity_score: Estimated complexity (1-10 scale)
        context: Additional context data
        end_time: When the agent completed (None if still running)
        success: Whether the agent completed successfully
        outcome_summary: Brief summary of the outcome
    """
    agent_name: str
    invocation_id: str
    start_time: datetime
    task_description: str
    complexity_score: int
    context: Dict[str, Any]
    end_time: Optional[datetime] = None
    success: Optional[bool] = None
    outcome_summary: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary with ISO formatted timestamps."""
        data = asdict(self)
        data['start_time'] = self.start_time.isoformat()
        if self.end_time:
            data['end_time'] = self.end_time.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AgentInvocation':
        """Create from dictionary with timestamp parsing."""
        data = data.copy()
        data['start_time'] = datetime.fromisoformat(data['start_time'])
        if data.get('end_time'):
            data['end_time'] = datetime.fromisoformat(data['end_time'])
        return cls(**data)


class AgentActivityTracker:
    """
    Thread-safe agent activity tracker with JSONL persistence.
    
    Features:
    - Thread-safe concurrent tracking
    - JSONL file persistence by date
    - Complexity estimation algorithm
    - Integration with metrics collector
    - Minimal performance overhead (<2%)
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """Singleton pattern for global tracker instance."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance
    
    def __init__(self):
        """Initialize tracker with thread safety and data directory setup."""
        if hasattr(self, '_initialized') and self._initialized:
            return
            
        self._file_lock = threading.Lock()
        self._active_invocations: Dict[str, AgentInvocation] = {}
        self._data_dir = Path(__file__).parent / "data"
        self._data_dir.mkdir(exist_ok=True)
        
        # Integration with existing metrics collector
        self._metrics_collector = None
        if MetricsCollector:
            try:
                self._metrics_collector = MetricsCollector()
            except Exception:
                pass  # Fallback to standalone mode
        
        self._initialized = True
    
    def _get_data_file(self, date: datetime) -> Path:
        """Get JSONL file path for given date."""
        date_str = date.strftime("%Y-%m-%d")
        return self._data_dir / f"agent_invocations_{date_str}.jsonl"
    
    def _write_invocation(self, invocation: AgentInvocation) -> None:
        """Thread-safe write of invocation to JSONL file."""
        data_file = self._get_data_file(invocation.start_time)
        
        with self._file_lock:
            try:
                with open(data_file, 'a', encoding='utf-8') as f:
                    json.dump(invocation.to_dict(), f, ensure_ascii=False)
                    f.write('\n')
            except Exception as e:
                # Fail silently to avoid disrupting agent workflows
                # Log to stderr for debugging if needed
                import sys
                print(f"Warning: Failed to write agent invocation: {e}", file=sys.stderr)
    
    def track_agent_invocation(self, 
                             agent_name: str, 
                             task_description: str, 
                             complexity_score: Optional[int] = None,
                             context: Optional[Dict[str, Any]] = None) -> str:
        """
        Track the start of an agent invocation.
        
        Args:
            agent_name: Name of the agent being invoked
            task_description: Description of the task
            complexity_score: Optional manual complexity score (1-10)
            context: Optional additional context data
            
        Returns:
            invocation_id: Unique identifier for this invocation
            
        Performance: <10ms per call
        """
        invocation_id = str(uuid.uuid4())
        
        # Estimate complexity if not provided
        if complexity_score is None:
            complexity_score = self.estimate_task_complexity(task_description)
        
        # Ensure valid complexity score range
        complexity_score = max(1, min(10, complexity_score))
        
        invocation = AgentInvocation(
            agent_name=agent_name,
            invocation_id=invocation_id,
            start_time=datetime.now(),
            task_description=task_description,
            complexity_score=complexity_score,
            context=context or {}
        )
        
        # Store in active invocations for completion tracking
        with self._lock:
            self._active_invocations[invocation_id] = invocation
        
        # Write to persistence layer
        self._write_invocation(invocation)
        
        # Integrate with metrics collector if available
        if self._metrics_collector:
            try:
                self._metrics_collector.record_event({
                    'type': 'agent_invocation_start',
                    'agent_name': agent_name,
                    'invocation_id': invocation_id,
                    'complexity_score': complexity_score,
                    'timestamp': invocation.start_time.isoformat()
                })
            except Exception:
                pass  # Non-critical integration failure
        
        return invocation_id
    
    def track_agent_completion(self, 
                             invocation_id: str, 
                             success: bool, 
                             outcome_summary: Optional[str] = None) -> bool:
        """
        Track the completion of an agent invocation.
        
        Args:
            invocation_id: The invocation ID returned from track_agent_invocation
            success: Whether the agent completed successfully
            outcome_summary: Optional brief summary of the outcome
            
        Returns:
            bool: True if completion was tracked successfully
            
        Performance: <10ms per call
        """
        with self._lock:
            if invocation_id not in self._active_invocations:
                return False
            
            invocation = self._active_invocations.pop(invocation_id)
        
        # Update invocation with completion data
        invocation.end_time = datetime.now()
        invocation.success = success
        invocation.outcome_summary = outcome_summary
        
        # Write updated invocation to persistence
        self._write_invocation(invocation)
        
        # Integrate with metrics collector if available
        if self._metrics_collector:
            try:
                duration = (invocation.end_time - invocation.start_time).total_seconds()
                self._metrics_collector.record_event({
                    'type': 'agent_invocation_complete',
                    'agent_name': invocation.agent_name,
                    'invocation_id': invocation_id,
                    'success': success,
                    'duration_seconds': duration,
                    'complexity_score': invocation.complexity_score,
                    'timestamp': invocation.end_time.isoformat()
                })
            except Exception:
                pass  # Non-critical integration failure
        
        return True
    
    def estimate_task_complexity(self, task_description: str) -> int:
        """
        Estimate task complexity based on description analysis.
        
        Uses multiple heuristics:
        - Text length and vocabulary complexity
        - Technical keywords and patterns
        - Action words indicating multi-step processes
        - Uncertainty markers
        
        Args:
            task_description: Description of the task to analyze
            
        Returns:
            int: Complexity score from 1 (simple) to 10 (very complex)
        """
        if not task_description or not task_description.strip():
            return 1
        
        text = task_description.lower().strip()
        complexity = 1
        
        # Base complexity from length
        if len(text) > 200:
            complexity += 2
        elif len(text) > 100:
            complexity += 1
        
        # Technical complexity indicators
        technical_keywords = [
            'implement', 'architecture', 'algorithm', 'optimization', 'integration',
            'security', 'performance', 'scalability', 'database', 'api', 'framework',
            'testing', 'deployment', 'infrastructure', 'authentication', 'authorization',
            'microservices', 'containerization', 'orchestration', 'monitoring'
        ]
        
        technical_count = sum(1 for keyword in technical_keywords if keyword in text)
        complexity += min(3, technical_count)
        
        # Multi-step process indicators
        process_keywords = [
            'analyze', 'design', 'implement', 'test', 'deploy', 'configure',
            'integrate', 'optimize', 'validate', 'document', 'review'
        ]
        
        process_count = sum(1 for keyword in process_keywords if keyword in text)
        if process_count >= 3:
            complexity += 2
        elif process_count >= 2:
            complexity += 1
        
        # Uncertainty and research indicators
        uncertainty_keywords = [
            'research', 'investigate', 'explore', 'evaluate', 'compare',
            'determine', 'analyze', 'assess', 'might', 'could', 'should consider'
        ]
        
        uncertainty_count = sum(1 for keyword in uncertainty_keywords if keyword in text)
        if uncertainty_count >= 2:
            complexity += 1
        
        # Multiple entity/component indicators
        if len(re.findall(r'\b(and|or|with|plus|\+)\b', text)) >= 2:
            complexity += 1
        
        # Number of sentences as complexity indicator
        sentence_count = len(re.findall(r'[.!?]+', text))
        if sentence_count >= 5:
            complexity += 1
        
        # File operation complexity
        if any(keyword in text for keyword in ['file', 'directory', 'folder', 'path']):
            complexity += 1
        
        # Ensure score stays within valid range
        return max(1, min(10, complexity))
    
    def get_active_invocations(self) -> List[AgentInvocation]:
        """Get list of currently active invocations."""
        with self._lock:
            return list(self._active_invocations.values())
    
    def get_invocation_stats(self, days: int = 7) -> Dict[str, Any]:
        """
        Get aggregated statistics for recent invocations.
        
        Args:
            days: Number of days to look back
            
        Returns:
            Dictionary with statistics including:
            - total_invocations: Total number of invocations
            - success_rate: Percentage of successful invocations
            - avg_complexity: Average complexity score
            - agent_usage: Usage count per agent
            - avg_duration: Average duration in seconds
        """
        from datetime import timedelta
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        invocations = []
        current_date = start_date.date()
        
        # Read invocations from all relevant date files
        while current_date <= end_date.date():
            data_file = self._get_data_file(datetime.combine(current_date, datetime.min.time()))
            if data_file.exists():
                try:
                    with open(data_file, 'r', encoding='utf-8') as f:
                        for line in f:
                            if line.strip():
                                data = json.loads(line.strip())
                                invocation = AgentInvocation.from_dict(data)
                                if invocation.start_time >= start_date:
                                    invocations.append(invocation)
                except Exception:
                    pass  # Skip corrupted files
            
            current_date += timedelta(days=1)
        
        if not invocations:
            return {
                'total_invocations': 0,
                'success_rate': 0.0,
                'avg_complexity': 0.0,
                'agent_usage': {},
                'avg_duration': 0.0
            }
        
        # Calculate statistics
        completed = [inv for inv in invocations if inv.end_time is not None]
        successful = [inv for inv in completed if inv.success]
        
        agent_usage = {}
        total_complexity = 0
        total_duration = 0
        
        for inv in invocations:
            agent_usage[inv.agent_name] = agent_usage.get(inv.agent_name, 0) + 1
            total_complexity += inv.complexity_score
            
            if inv.end_time:
                duration = (inv.end_time - inv.start_time).total_seconds()
                total_duration += duration
        
        return {
            'total_invocations': len(invocations),
            'success_rate': (len(successful) / len(completed)) * 100 if completed else 0.0,
            'avg_complexity': total_complexity / len(invocations),
            'agent_usage': agent_usage,
            'avg_duration': total_duration / len(completed) if completed else 0.0
        }


# Global tracker instance for convenience functions
_tracker = AgentActivityTracker()


def track_agent_invocation(agent_name: str, 
                         task_description: str, 
                         complexity_score: Optional[int] = None,
                         context: Optional[Dict[str, Any]] = None) -> str:
    """
    Convenience function to track agent invocation start.
    
    Args:
        agent_name: Name of the agent being invoked
        task_description: Description of the task
        complexity_score: Optional manual complexity score (1-10)
        context: Optional additional context data
        
    Returns:
        invocation_id: Unique identifier for this invocation
    """
    return _tracker.track_agent_invocation(agent_name, task_description, complexity_score, context)


def track_agent_completion(invocation_id: str, 
                         success: bool, 
                         outcome_summary: Optional[str] = None) -> bool:
    """
    Convenience function to track agent completion.
    
    Args:
        invocation_id: The invocation ID from track_agent_invocation
        success: Whether the agent completed successfully
        outcome_summary: Optional brief summary of the outcome
        
    Returns:
        bool: True if completion was tracked successfully
    """
    return _tracker.track_agent_completion(invocation_id, success, outcome_summary)


def estimate_task_complexity(task_description: str) -> int:
    """
    Convenience function to estimate task complexity.
    
    Args:
        task_description: Description of the task to analyze
        
    Returns:
        int: Complexity score from 1 (simple) to 10 (very complex)
    """
    return _tracker.estimate_task_complexity(task_description)


def get_tracker() -> AgentActivityTracker:
    """Get the global agent activity tracker instance."""
    return _tracker


if __name__ == "__main__":
    # Example usage and testing
    tracker = get_tracker()
    
    # Test complexity estimation
    test_tasks = [
        "Create a simple function",
        "Implement user authentication with JWT tokens and role-based authorization",
        "Research and implement a microservices architecture with container orchestration",
        "Fix a minor bug in the login form",
        "Design, implement, test, and deploy a scalable API with monitoring and security"
    ]
    
    print("Complexity Estimation Tests:")
    for task in test_tasks:
        complexity = estimate_task_complexity(task)
        print(f"Task: {task[:50]}...")
        print(f"Complexity: {complexity}/10\n")
    
    # Test tracking
    print("\nTesting invocation tracking:")
    inv_id = track_agent_invocation("test-agent", "Test task for demonstration", context={"test": True})
    print(f"Started invocation: {inv_id}")
    
    import time
    time.sleep(0.1)  # Simulate work
    
    success = track_agent_completion(inv_id, True, "Test completed successfully")
    print(f"Completion tracked: {success}")
    
    # Show stats
    stats = tracker.get_invocation_stats(days=1)
    print(f"\nStats: {stats}")