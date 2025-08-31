# Specification: Enhance Manager Dashboard Metrics with Claude Code Hooks

> Last Updated: 2025-08-30
> Version: 1.0.0
> Status: Draft
> Author: AI-Augmented Development Team

## Executive Summary

This specification outlines the enhancement of the manager-dashboard metrics system using Claude Code hooks to automatically collect, analyze, and report development productivity metrics in real-time. By leveraging Claude Code's hook system, we will create a comprehensive, automated metrics collection framework that provides deeper insights into team productivity, AI-augmented development effectiveness, and achievement of the 30% productivity improvement goal.

## Problem Statement

### Current Limitations

1. **Manual Metrics Collection**: Current metrics rely on periodic manual collection via commands
2. **Delayed Insights**: Metrics are only updated when dashboard command is explicitly run
3. **Limited Context**: Missing real-time development activity and AI interaction patterns
4. **Incomplete Data**: No automatic capture of Claude Code usage patterns and effectiveness
5. **Reactive Reporting**: Managers only see metrics when actively requesting them

### Impact

- **Visibility Gap**: 6-12 hour delay in productivity insights
- **Missed Opportunities**: Cannot identify productivity bottlenecks in real-time
- **Incomplete Picture**: Missing 40% of AI-augmented development metrics
- **Manual Overhead**: 15 minutes per day spent on manual metrics collection

## Proposed Solution

### Hook-Based Automated Metrics System

Implement a comprehensive Claude Code hooks framework that automatically captures:

1. **Tool Usage Metrics**: Every tool invocation, success rate, and execution time
2. **Agent Performance**: Sub-agent usage patterns, delegation chains, and effectiveness
3. **Development Activity**: File operations, code changes, and workflow patterns
4. **Quality Indicators**: Test execution, review cycles, and error rates
5. **Productivity Signals**: Task completion velocity, context switching, and focus time

### Key Features

#### Real-Time Data Collection
- Automatic capture of all Claude Code interactions
- Zero-overhead background metrics processing
- Event-driven data aggregation and storage

#### Intelligent Analytics
- Pattern recognition for productivity trends
- Anomaly detection for performance issues
- Predictive modeling for sprint completion

#### Proactive Notifications
- Real-time alerts for productivity changes
- Daily digest of team performance
- Weekly trend reports with recommendations

## Technical Architecture

### Hook System Design

```yaml
hooks:
  # Pre-execution hooks for command tracking
  pre-command:
    - name: "metrics-command-start"
      script: "~/.claude/hooks/metrics/command-start.sh"
      async: true
      timeout: 100ms
  
  # Post-execution hooks for result analysis
  post-command:
    - name: "metrics-command-complete"
      script: "~/.claude/hooks/metrics/command-complete.sh"
      async: true
      capture: ["exit_code", "duration", "output_size"]
  
  # Tool-specific hooks
  tool-invocation:
    Read:
      post: "~/.claude/hooks/metrics/tool-read.sh"
    Edit:
      post: "~/.claude/hooks/metrics/tool-edit.sh"
    Bash:
      pre: "~/.claude/hooks/metrics/bash-pre.sh"
      post: "~/.claude/hooks/metrics/bash-post.sh"
    Task:
      post: "~/.claude/hooks/metrics/agent-invocation.sh"
  
  # Workflow hooks
  git-commit:
    post: "~/.claude/hooks/metrics/git-commit.sh"
  pr-create:
    post: "~/.claude/hooks/metrics/pr-create.sh"
  test-run:
    post: "~/.claude/hooks/metrics/test-complete.sh"
```

### Data Collection Schema

```yaml
# ~/.agent-os/metrics/realtime-metrics.yml
metrics:
  session_id: "uuid-v4"
  timestamp: "2025-08-30T10:00:00Z"
  user: "leo.dangelo"
  
  commands:
    - command: "/execute-tasks"
      start_time: "2025-08-30T10:00:00Z"
      duration_ms: 3420
      status: "success"
      tools_used: ["Task", "Read", "Edit", "Bash"]
      agents_invoked: ["meta-agent", "frontend-developer"]
      files_modified: 5
      lines_changed: 127
      test_coverage_delta: +2.3
  
  tool_metrics:
    Read:
      invocations: 45
      total_files: 45
      total_lines: 3421
      avg_response_ms: 23
    Edit:
      invocations: 12
      files_modified: 8
      lines_added: 234
      lines_removed: 89
      success_rate: 100
    Bash:
      invocations: 18
      commands: ["npm test", "git status", "npm run build"]
      success_rate: 94.4
      avg_duration_ms: 1823
  
  agent_metrics:
    meta-agent:
      invocations: 8
      delegations: 15
      success_rate: 100
      avg_response_ms: 2341
    frontend-developer:
      invocations: 4
      tasks_completed: 4
      quality_score: 9.2
  
  productivity_indicators:
    focus_time_minutes: 45
    context_switches: 3
    interruptions: 1
    flow_state_duration: 32
    task_completion_velocity: 1.8
```

### Hook Implementation Examples

#### Command Start Hook
```bash
#!/bin/bash
# ~/.claude/hooks/metrics/command-start.sh

METRICS_DIR="$HOME/.agent-os/metrics"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SESSION_ID="${CLAUDE_SESSION_ID:-$(uuidgen)}"
COMMAND="${1}"
USER="${USER:-$(whoami)}"

# Create metrics entry
cat >> "$METRICS_DIR/sessions/${SESSION_ID}.jsonl" << EOF
{"event":"command_start","timestamp":"${TIMESTAMP}","command":"${COMMAND}","user":"${USER}"}
EOF

# Update real-time dashboard if running
if [[ -f "$METRICS_DIR/.dashboard-active" ]]; then
    echo "📊 Command started: ${COMMAND}" >> "$METRICS_DIR/realtime.log"
fi
```

#### Tool Usage Hook
```bash
#!/bin/bash
# ~/.claude/hooks/metrics/tool-edit.sh

METRICS_DIR="$HOME/.agent-os/metrics"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FILE_PATH="${1}"
LINES_ADDED="${2}"
LINES_REMOVED="${3}"
SUCCESS="${4}"

# Track file modification patterns
cat >> "$METRICS_DIR/tool-metrics.jsonl" << EOF
{"tool":"Edit","timestamp":"${TIMESTAMP}","file":"${FILE_PATH}","added":${LINES_ADDED},"removed":${LINES_REMOVED},"success":${SUCCESS}}
EOF

# Check for productivity patterns
if [[ ${LINES_ADDED} -gt 100 ]]; then
    echo "🚀 High productivity detected: ${LINES_ADDED} lines added to ${FILE_PATH}"
fi
```

#### Agent Performance Hook
```bash
#!/bin/bash
# ~/.claude/hooks/metrics/agent-invocation.sh

METRICS_DIR="$HOME/.agent-os/metrics"
AGENT_NAME="${1}"
TASK_DESCRIPTION="${2}"
START_TIME="${3}"
END_TIME="${4}"
SUCCESS="${5}"

# Calculate duration
DURATION=$((END_TIME - START_TIME))

# Store agent metrics
cat >> "$METRICS_DIR/agent-metrics.jsonl" << EOF
{"agent":"${AGENT_NAME}","task":"${TASK_DESCRIPTION}","duration_ms":${DURATION},"success":${SUCCESS},"timestamp":"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"}
EOF

# Update agent leaderboard
update_agent_leaderboard "${AGENT_NAME}" "${DURATION}" "${SUCCESS}"
```

### Analytics Engine

```python
# ~/.claude/hooks/metrics/analytics.py

import json
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

class MetricsAnalyzer:
    def __init__(self, metrics_dir="~/.agent-os/metrics"):
        self.metrics_dir = Path(metrics_dir).expanduser()
        
    def calculate_productivity_score(self, session_id):
        """Calculate real-time productivity score for current session."""
        metrics = self.load_session_metrics(session_id)
        
        # Weighted scoring factors
        weights = {
            'task_completion': 0.3,
            'code_velocity': 0.25,
            'quality_metrics': 0.2,
            'agent_efficiency': 0.15,
            'focus_time': 0.1
        }
        
        scores = {
            'task_completion': self._score_task_completion(metrics),
            'code_velocity': self._score_code_velocity(metrics),
            'quality_metrics': self._score_quality(metrics),
            'agent_efficiency': self._score_agent_usage(metrics),
            'focus_time': self._score_focus_time(metrics)
        }
        
        return sum(scores[k] * weights[k] for k in weights)
    
    def detect_anomalies(self, current_metrics, historical_baseline):
        """Detect productivity anomalies requiring attention."""
        anomalies = []
        
        # Check for significant deviations
        if current_metrics['error_rate'] > historical_baseline['error_rate'] * 1.5:
            anomalies.append({
                'type': 'high_error_rate',
                'severity': 'warning',
                'message': f"Error rate {current_metrics['error_rate']:.1%} exceeds baseline"
            })
        
        if current_metrics['velocity'] < historical_baseline['velocity'] * 0.7:
            anomalies.append({
                'type': 'low_velocity',
                'severity': 'alert',
                'message': f"Velocity decreased by {30:.0%} from baseline"
            })
            
        return anomalies
    
    def generate_recommendations(self, metrics):
        """Generate actionable recommendations based on metrics."""
        recommendations = []
        
        # Analyze patterns for improvement opportunities
        if metrics['agent_usage']['test-runner'] < 0.2:
            recommendations.append({
                'priority': 'high',
                'action': 'Increase test-runner agent usage',
                'impact': 'Improve code quality by 15-20%',
                'command': '/execute-tasks --prefer-agent test-runner'
            })
        
        if metrics['context_switches'] > 10:
            recommendations.append({
                'priority': 'medium',
                'action': 'Reduce context switching',
                'impact': 'Increase focus time by 25%',
                'suggestion': 'Batch similar tasks together'
            })
            
        return recommendations
```

### Dashboard Integration

```bash
# Enhanced dashboard with real-time metrics
/manager-dashboard --realtime

┌─────────────────────────────────────────────────────────────────┐
│ REAL-TIME PRODUCTIVITY DASHBOARD          [Auto-refresh: 30s]  │
├─────────────────────────────────────────────────────────────────┤
│ Current Session: leo.dangelo                 Started: 10:00 AM │
│ Productivity Score: 8.7/10 ↑                 Trend: +12% ↑     │
├─────────────────────────────────────────────────────────────────┤
│ LIVE METRICS                                                   │
│ ├─ Commands Executed: 23          Success Rate: 95.6%         │
│ ├─ Lines Modified: 456            Test Coverage: 87.3% ↑      │
│ ├─ Active Agents: 4               Efficiency: 92%             │
│ └─ Focus Time: 1h 23m             Context Switches: 2         │
├─────────────────────────────────────────────────────────────────┤
│ RECENT ACTIVITY                                   [10:45 AM]  │
│ ✅ frontend-developer completed UI component (2.3s)           │
│ ✅ test-runner executed 47 tests, all passing (8.1s)         │
│ 🔄 code-reviewer analyzing changes...                         │
├─────────────────────────────────────────────────────────────────┤
│ RECOMMENDATIONS                                                │
│ 1. High productivity detected - maintain current workflow      │
│ 2. Consider using playwright-tester for E2E coverage         │
│ 3. Sprint velocity on track for 30% improvement goal         │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Hook Infrastructure (Week 1)

#### Tasks
1. **Create hook directory structure**
   - Setup ~/.claude/hooks/metrics/ directory
   - Implement base hook scripts for all tool types
   - Add configuration management system

2. **Implement data collection hooks**
   - Command start/end tracking
   - Tool invocation monitoring
   - Agent performance capture
   - Git workflow integration

3. **Setup data storage**
   - JSONL format for streaming metrics
   - SQLite for aggregated analytics
   - File rotation and cleanup policies

### Phase 2: Analytics Engine (Week 2)

#### Tasks
1. **Build analytics core**
   - Productivity scoring algorithm
   - Anomaly detection system
   - Pattern recognition engine

2. **Create aggregation pipeline**
   - Real-time data processing
   - Historical trend analysis
   - Predictive modeling

3. **Implement recommendation engine**
   - Agent usage optimization
   - Workflow improvement suggestions
   - Quality enhancement recommendations

### Phase 3: Dashboard Enhancement (Week 3)

#### Tasks
1. **Enhance manager-dashboard command**
   - Real-time mode with auto-refresh
   - Live activity stream
   - Interactive drill-down capabilities

2. **Add visualization components**
   - ASCII charts for trends
   - Heat maps for activity patterns
   - Agent performance matrix

3. **Create notification system**
   - Slack integration for alerts
   - Email digests for managers
   - In-terminal notifications

### Phase 4: Integration & Testing (Week 4)

#### Tasks
1. **MCP server integration**
   - Linear metrics correlation
   - GitHub activity synchronization
   - External tool data fusion

2. **Performance optimization**
   - Hook execution benchmarking
   - Async processing implementation
   - Resource usage monitoring

3. **User acceptance testing**
   - Beta deployment to Fortium Partners
   - Feedback collection and iteration
   - Documentation and training

## Success Metrics

### Technical Metrics
- **Hook Overhead**: < 50ms per invocation
- **Data Collection Rate**: > 99% capture rate
- **Storage Efficiency**: < 10MB per day per user
- **Analytics Latency**: < 500ms for real-time calculations

### Business Metrics
- **Productivity Visibility**: Real-time insights vs 6-hour delay
- **Manager Engagement**: 100% daily dashboard usage
- **Decision Speed**: 50% faster issue identification
- **Goal Achievement**: 30% productivity improvement validated

### User Experience Metrics
- **Setup Time**: < 5 minutes for full installation
- **Learning Curve**: Immediate value without training
- **Notification Relevance**: > 90% actionable alerts
- **Dashboard Load Time**: < 2 seconds for full render

## Risk Analysis

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Hook performance overhead | High | Low | Async execution, sampling strategies |
| Data storage growth | Medium | Medium | Rotation policies, compression |
| Privacy concerns | High | Low | Local storage only, opt-in features |
| Integration complexity | Medium | Medium | Phased rollout, fallback modes |

### Mitigation Strategies

1. **Performance Protection**
   - Circuit breakers for slow hooks
   - Sampling for high-frequency events
   - Background processing queues

2. **Data Management**
   - Automatic cleanup of old metrics
   - Aggregation for historical data
   - Export capabilities for archival

3. **Privacy & Security**
   - All data stored locally
   - No PII in metrics collection
   - Opt-out configuration options

## Appendix

### A. Hook Configuration Reference

```yaml
# ~/.claude/config/hooks.yml
hooks:
  enabled: true
  metrics:
    enabled: true
    storage_path: "~/.agent-os/metrics"
    retention_days: 90
    
  performance:
    max_execution_time_ms: 100
    async_processing: true
    sampling_rate: 1.0  # 100% capture
    
  notifications:
    slack:
      enabled: false
      webhook_url: "${SLACK_WEBHOOK_URL}"
    email:
      enabled: false
      recipient: "manager@fortium.com"
```

### B. Metrics API Reference

```typescript
interface MetricsEvent {
  event_type: 'command' | 'tool' | 'agent' | 'git' | 'test';
  timestamp: string;
  session_id: string;
  user: string;
  data: Record<string, any>;
}

interface ProductivityMetrics {
  score: number;  // 0-10
  velocity: number;  // lines per hour
  quality: number;  // 0-100
  efficiency: number;  // 0-100
  trends: {
    daily: number[];
    weekly: number[];
  };
}
```

### C. Installation Script

```bash
#!/bin/bash
# install-metrics-hooks.sh

echo "Installing Claude Code Metrics Hooks..."

# Create directory structure
mkdir -p ~/.claude/hooks/metrics
mkdir -p ~/.agent-os/metrics/{sessions,aggregated,exports}

# Copy hook scripts
cp hooks/metrics/*.sh ~/.claude/hooks/metrics/
chmod +x ~/.claude/hooks/metrics/*.sh

# Install Python analytics engine
pip install pandas numpy scipy

# Configure Claude Code
claude config set hooks.enabled true
claude config set hooks.metrics.enabled true

echo "✅ Metrics hooks installed successfully"
echo "📊 Run '/manager-dashboard --realtime' to view live metrics"
```

---

*Specification Version: 1.0.0*
*Last Updated: 2025-08-30*
*Status: Ready for Review*
*Next Steps: Technical review and approval for Phase 1 implementation*