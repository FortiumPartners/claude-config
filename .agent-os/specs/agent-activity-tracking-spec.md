# Agent Activity Tracking Specification

> **GitHub Issue**: #5 - [Week 1] User Story 1.2: Agent Activity Tracking  
> **Version**: 1.0.0  
> **Created**: 2025-08-31  
> **Status**: Draft  
> **Dependencies**: Task 1.1.1 (Metrics Collection Service)

## Executive Summary

### Problem Statement

Managers need visibility into agent usage patterns and effectiveness to optimize team workflows and measure AI-augmented development productivity. Currently, there is no systematic tracking of which agents are being invoked, their performance characteristics, or their contribution to overall team productivity metrics.

### Solution Overview

Implement comprehensive agent activity tracking that instruments all agent invocations through the orchestration system. This solution will capture agent usage patterns, performance metrics, and effectiveness indicators while maintaining the <2% performance impact requirement. The tracking system integrates seamlessly with the existing `.agent-os/metrics/` framework and powers the manager dashboard analytics.

### Business Value

- **Workflow Optimization**: Identify most/least effective agents and usage patterns
- **Performance Monitoring**: Track agent execution performance and resource utilization
- **Productivity Measurement**: Quantify agent contribution to 30% productivity increase goal
- **Resource Planning**: Make data-driven decisions about agent development and deployment

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Manager Dashboard                             │
├─────────────────────────────────────────────────────────────────┤
│                    Analytics Engine                              │
├─────────────────────────────────────────────────────────────────┤
│                  Metrics Collection Service                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              Agent Activity Tracker                         │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │ │
│  │  │ Invocation      │  │ Performance     │  │ Context     │  │ │
│  │  │ Logger          │  │ Profiler        │  │ Analyzer    │  │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                     Orchestration                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Frontend        │  │ Backend         │  │ Code Reviewer   │  │
│  │ Developer       │  │ Developer       │  │ Agent           │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture

#### 1. Agent Activity Tracker

- **Location**: `.agent-os/metrics/agent_activity_tracker.py`
- **Purpose**: Central tracking system for all agent invocations
- **Integration**: Hooks into orchastration delegation system

#### 2. Performance Profiler

- **Location**: `.agent-os/metrics/agent_performance_profiler.py`
- **Purpose**: Resource usage and execution time monitoring
- **Integration**: Lightweight profiling with minimal overhead

#### 3. Metrics Storage

- **Location**: `.agent-os/metrics/data/agent_metrics.json`
- **Purpose**: Persistent storage for agent activity data
- **Format**: JSON with time-series structure

### Data Model

```python
@dataclass
class AgentInvocation:
    agent_name: str
    invocation_id: str
    start_time: datetime
    end_time: Optional[datetime]
    success: Optional[bool]
    task_description: str
    complexity_score: int  # 1-10 scale
    context: Dict[str, Any]

@dataclass
class AgentPerformance:
    invocation_id: str
    execution_time_ms: int
    cpu_usage_percent: float
    memory_usage_mb: float
    tokens_used: Optional[int]
    error_details: Optional[str]

@dataclass
class AgentMetrics:
    agent_name: str
    period: str  # hourly, daily, weekly
    total_invocations: int
    success_rate: float
    avg_execution_time_ms: float
    avg_complexity_handled: float
    efficiency_score: float  # success_rate / avg_execution_time
```

## Implementation Details

### Task 1.2.1: Instrument Agent Invocation Tracking (4 hours)

#### 1.1 Hook Integration

**File**: `agents/orchastrator.md` (enhancement)

Add instrumentation section to orchastrator:

````markdown
## Performance Instrumentation

Before delegating to any specialist agent, log the invocation:

```python
from agent_os.metrics.agent_activity_tracker import track_agent_invocation

# At start of agent delegation
invocation_id = track_agent_invocation(
    agent_name="frontend-developer",
    task_description=user_request,
    complexity_score=estimate_task_complexity(user_request),
    context={"file_count": len(files), "task_type": "implementation"}
)

# Delegate to specialist agent
result = delegate_to_agent("frontend-developer", enhanced_request)

# At completion
track_agent_completion(
    invocation_id=invocation_id,
    success=result.success,
    outcome_summary=result.summary
)
```
````

````

#### 1.2 Agent Activity Tracker Implementation

**File**: `.agent-os/metrics/agent_activity_tracker.py`

```python
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
import threading

@dataclass
class AgentInvocation:
    agent_name: str
    invocation_id: str
    start_time: datetime
    task_description: str
    complexity_score: int
    context: Dict[str, Any]
    end_time: Optional[datetime] = None
    success: Optional[bool] = None
    outcome_summary: Optional[str] = None

class AgentActivityTracker:
    def __init__(self, data_dir: Path = None):
        self.data_dir = data_dir or Path(".agent-os/metrics/data")
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.active_invocations: Dict[str, AgentInvocation] = {}
        self._lock = threading.Lock()

    def track_invocation(self, agent_name: str, task_description: str,
                        complexity_score: int, context: Dict[str, Any]) -> str:
        """Start tracking a new agent invocation."""
        invocation_id = str(uuid.uuid4())

        invocation = AgentInvocation(
            agent_name=agent_name,
            invocation_id=invocation_id,
            start_time=datetime.now(timezone.utc),
            task_description=task_description,
            complexity_score=complexity_score,
            context=context
        )

        with self._lock:
            self.active_invocations[invocation_id] = invocation

        return invocation_id

    def track_completion(self, invocation_id: str, success: bool,
                        outcome_summary: str = None):
        """Complete tracking for an agent invocation."""
        with self._lock:
            if invocation_id in self.active_invocations:
                invocation = self.active_invocations[invocation_id]
                invocation.end_time = datetime.now(timezone.utc)
                invocation.success = success
                invocation.outcome_summary = outcome_summary

                # Persist to storage
                self._persist_invocation(invocation)

                # Remove from active tracking
                del self.active_invocations[invocation_id]

    def _persist_invocation(self, invocation: AgentInvocation):
        """Save invocation data to persistent storage."""
        date_str = invocation.start_time.strftime("%Y-%m-%d")
        file_path = self.data_dir / f"agent_invocations_{date_str}.jsonl"

        with file_path.open("a") as f:
            json.dump(asdict(invocation), f, default=str)
            f.write("\n")

# Global tracker instance
_tracker = AgentActivityTracker()

def track_agent_invocation(agent_name: str, task_description: str,
                          complexity_score: int, context: Dict[str, Any]) -> str:
    """Convenient function to start tracking agent invocation."""
    return _tracker.track_invocation(agent_name, task_description,
                                   complexity_score, context)

def track_agent_completion(invocation_id: str, success: bool,
                          outcome_summary: str = None):
    """Convenient function to complete agent tracking."""
    _tracker.track_completion(invocation_id, success, outcome_summary)
````

#### 1.3 Task Complexity Estimation

Add complexity scoring to orchastrator:

```python
def estimate_task_complexity(task_description: str) -> int:
    """Estimate task complexity on 1-10 scale based on keywords and context."""
    complexity_indicators = {
        'simple': ['fix typo', 'update comment', 'change text', 'rename'],
        'medium': ['add feature', 'refactor', 'optimize', 'integrate'],
        'complex': ['architecture', 'migration', 'performance', 'security'],
        'very_complex': ['redesign', 'rewrite', 'scale', 'distributed']
    }

    task_lower = task_description.lower()

    for level, keywords in complexity_indicators.items():
        if any(keyword in task_lower for keyword in keywords):
            if level == 'simple': return 2
            elif level == 'medium': return 5
            elif level == 'complex': return 8
            elif level == 'very_complex': return 10

    # Default medium complexity
    return 5
```

### Task 1.2.2: Create Agent Performance Profiler (3 hours)

#### 2.1 Performance Profiler Implementation

**File**: `.agent-os/metrics/agent_performance_profiler.py`

```python
import psutil
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional, Dict, Any
import threading

@dataclass
class PerformanceMetrics:
    invocation_id: str
    execution_time_ms: int
    cpu_usage_percent: float
    memory_usage_mb: float
    peak_memory_mb: float
    tokens_used: Optional[int] = None
    error_details: Optional[str] = None

class AgentPerformanceProfiler:
    def __init__(self):
        self._active_profiles: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    @contextmanager
    def profile_agent(self, invocation_id: str):
        """Context manager for profiling agent execution."""
        # Start profiling
        start_time = time.time()
        process = psutil.Process()
        start_memory = process.memory_info().rss / 1024 / 1024  # MB
        peak_memory = start_memory

        with self._lock:
            self._active_profiles[invocation_id] = {
                'start_time': start_time,
                'start_memory': start_memory,
                'peak_memory': peak_memory,
                'process': process
            }

        try:
            # Monitor memory usage during execution
            monitor_thread = threading.Thread(
                target=self._monitor_resources,
                args=(invocation_id,)
            )
            monitor_thread.daemon = True
            monitor_thread.start()

            yield

        except Exception as e:
            # Capture error details
            with self._lock:
                if invocation_id in self._active_profiles:
                    self._active_profiles[invocation_id]['error'] = str(e)
            raise
        finally:
            # Stop profiling
            end_time = time.time()
            self._finalize_profile(invocation_id, end_time)

    def _monitor_resources(self, invocation_id: str):
        """Background thread to monitor resource usage."""
        while invocation_id in self._active_profiles:
            try:
                profile_data = self._active_profiles[invocation_id]
                current_memory = profile_data['process'].memory_info().rss / 1024 / 1024
                profile_data['peak_memory'] = max(
                    profile_data['peak_memory'],
                    current_memory
                )
                time.sleep(0.1)  # Monitor every 100ms
            except:
                break

    def _finalize_profile(self, invocation_id: str, end_time: float):
        """Complete profiling and generate metrics."""
        with self._lock:
            if invocation_id not in self._active_profiles:
                return

            profile_data = self._active_profiles[invocation_id]
            start_time = profile_data['start_time']

            metrics = PerformanceMetrics(
                invocation_id=invocation_id,
                execution_time_ms=int((end_time - start_time) * 1000),
                cpu_usage_percent=profile_data['process'].cpu_percent(),
                memory_usage_mb=profile_data['start_memory'],
                peak_memory_mb=profile_data['peak_memory'],
                error_details=profile_data.get('error')
            )

            # Persist metrics
            self._persist_metrics(metrics)

            # Clean up
            del self._active_profiles[invocation_id]

    def _persist_metrics(self, metrics: PerformanceMetrics):
        """Save performance metrics to storage."""
        from .metrics_storage import persist_performance_metrics
        persist_performance_metrics(metrics)

# Global profiler instance
_profiler = AgentPerformanceProfiler()

def profile_agent_execution(invocation_id: str):
    """Context manager for profiling agent execution."""
    return _profiler.profile_agent(invocation_id)
```

## Integration Points

### 1. Orchestration System

**File**: `agents/orchastration.md`

- Add import statements for tracking functions
- Wrap all agent delegations with tracking calls
- Implement error handling to ensure tracking completion

### 2. Metrics Collection Service

**File**: `.agent-os/metrics/metrics_collector.py`

- Extend existing collector to aggregate agent activity data
- Add agent-specific metrics to daily/weekly summaries
- Include agent effectiveness calculations

### 3. Manager Dashboard Integration

**File**: `.claude/commands/manager-dashboard.md`

Add agent activity section:

````markdown
## Agent Activity Analysis

```python
from agent_os.metrics.agent_analytics import AgentAnalytics

analytics = AgentAnalytics()

# Agent usage patterns
agent_usage = analytics.get_agent_usage_summary(days=7)
print("=== Agent Usage (Last 7 Days) ===")
for agent, stats in agent_usage.items():
    print(f"{agent}:")
    print(f"  Invocations: {stats['count']}")
    print(f"  Success Rate: {stats['success_rate']:.1%}")
    print(f"  Avg Duration: {stats['avg_duration_ms']}ms")
    print(f"  Efficiency Score: {stats['efficiency_score']:.2f}")

# Top performing agents
top_agents = analytics.get_top_performing_agents(limit=5)
print("\n=== Top Performing Agents ===")
for agent in top_agents:
    print(f"{agent['name']}: {agent['score']:.2f} efficiency")
```
````

````

## Testing Strategy

### Unit Tests

**File**: `.agent-os/metrics/tests/test_agent_activity_tracker.py`

```python
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from ..agent_activity_tracker import AgentActivityTracker

class TestAgentActivityTracker:
    def test_track_invocation_creates_record(self):
        tracker = AgentActivityTracker()

        invocation_id = tracker.track_invocation(
            agent_name="test-agent",
            task_description="Test task",
            complexity_score=5,
            context={"test": True}
        )

        assert invocation_id in tracker.active_invocations
        invocation = tracker.active_invocations[invocation_id]
        assert invocation.agent_name == "test-agent"
        assert invocation.complexity_score == 5
````

## Performance Requirements

### 1. Overhead Threshold

- **Requirement**: Total tracking overhead must be <2% of agent execution time
- **Measurement**: Compare execution time with/without tracking enabled
- **Monitoring**: Continuous monitoring through performance tests

### 2. Memory Usage

- **Requirement**: Memory overhead for tracking <10MB per active invocation
- **Implementation**: Efficient data structures and prompt data persistence
- **Monitoring**: Track memory usage during profiling operations

## Success Metrics

### 1. Tracking Coverage

- **Target**: 100% of agent invocations tracked
- **Measurement**: Compare tracked invocations vs. known agent executions
- **Validation**: Daily verification through audit logs

### 2. Data Quality

- **Target**: <1% missing or corrupted tracking records
- **Measurement**: Data validation checks and integrity monitoring
- **Resolution**: Automated error detection and recovery procedures

### 3. Performance Impact

- **Target**: <2% overhead on agent execution time
- **Measurement**: Continuous performance monitoring and regression tests
- **Optimization**: Regular performance tuning and overhead reduction

## Implementation Timeline

### Week 1 (Current)

- [ ] Task 1.2.1: Agent invocation tracking implementation (4 hours)
- [ ] Task 1.2.2: Performance profiler implementation (3 hours)
- [ ] Unit test development and validation

### Week 2

- [ ] Integration testing and performance validation
- [ ] Manager dashboard integration
- [ ] Documentation and training materials

### Success Criteria

- [ ] All acceptance criteria met
- [ ] Performance impact <2% validated
- [ ] Integration tests passing
- [ ] Manager dashboard displaying agent metrics
- [ ] Documentation complete and reviewed

---

_This specification follows AgentOS standards and integrates with the existing Fortium Claude Configuration ecosystem for comprehensive agent activity tracking and performance monitoring._
