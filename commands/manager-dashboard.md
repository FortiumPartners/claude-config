# Manager Dashboard Command

**Purpose**: Real-time productivity analytics and team performance insights for engineering managers, tracking the 30% productivity improvement goal and providing actionable intelligence for team optimization

**Trigger**: 
- `/dashboard` - Display current team metrics
- `/dashboard weekly` - Generate weekly performance report
- `/dashboard team [team-name]` - Team-specific analytics
- `/dashboard agent-usage` - Sub-agent utilization metrics
- `/dashboard productivity` - Productivity improvement tracking

**Prerequisites**: 
- Git repository with commit history
- Agent mesh operational (meta-agent, general-purpose)
- MCP server access for enhanced metrics (optional)
- Team member configuration in .agent-os/team/

**Dashboard Components**:

## 1. Executive Summary Panel

### Key Performance Indicators (KPIs)
```
┌─────────────────────────────────────────────────────────────┐
│ FORTIUM AI-AUGMENTED DEVELOPMENT DASHBOARD                 │
├─────────────────────────────────────────────────────────────┤
│ Current Sprint: Sprint 24        Week: 35/2024             │
│ Productivity Gain: +27.3% ↑      Target: 30%               │
│ Active Developers: 12            Active Agents: 17         │
│ Commands Executed: 1,847         Success Rate: 94.2%       │
└─────────────────────────────────────────────────────────────┘
```

### Productivity Metrics Calculation
- **Baseline**: Pre-AI implementation velocity (story points/sprint)
- **Current**: AI-augmented velocity with agent assistance
- **Formula**: ((Current - Baseline) / Baseline) × 100
- **Tracking**: Daily samples, 7-day rolling average

## 2. Team Velocity Tracking

### Sprint Velocity Chart
```
Story Points Completed
│
│ 140 ┤                                    ╭─────
│ 120 ┤                          ╭─────────╯
│ 100 ┤                   ╭──────╯
│  80 ┤         ╭─────────╯ 
│  60 ┤─────────╯
│  40 ┤
└─────┴────┴────┴────┴────┴────┴────┴────┴────
     S17  S18  S19  S20  S21  S22  S23  S24
     
     Pre-AI Era ────  AI-Augmented Era ────
```

### Velocity Metrics
- **Average Velocity**: Story points per sprint
- **Velocity Trend**: Percentage change over time
- **Predictability**: Standard deviation of velocity
- **Cycle Time**: Average time from start to done
- **Lead Time**: Average time from creation to done

## 3. Agent Usage Analytics

### Most Used Agents (Last 7 Days)
```
┌──────────────────────────────────────────────────┐
│ Agent                  │ Calls │ Success │ Time │
├──────────────────────────────────────────────────┤
│ meta-agent            │  423  │  96.2%  │ 2.1s │
│ frontend-developer    │  387  │  94.8%  │ 3.4s │
│ code-reviewer         │  298  │  97.3%  │ 4.2s │
│ git-workflow          │  276  │  99.1%  │ 1.8s │
│ test-runner           │  234  │  91.4%  │ 5.6s │
│ backend-developer     │  198  │  93.2%  │ 3.9s │
│ documentation-specialist│  145  │  98.6%  │ 2.3s │
└──────────────────────────────────────────────────┘
```

### Agent Effectiveness Metrics
- **Success Rate**: Successful completions / Total invocations
- **Average Response Time**: Mean execution duration
- **Error Categories**: Timeout, validation, permission failures
- **Usage Patterns**: Peak hours, workflow sequences
- **ROI per Agent**: Time saved × frequency of use

## 4. Developer Productivity Matrix

### Individual Performance Metrics
```
┌─────────────────────────────────────────────────────────┐
│ Developer     │ Commits │ PRs │ Reviews │ AI Usage │ Δ  │
├─────────────────────────────────────────────────────────┤
│ Sarah Chen    │   47    │ 12  │   18    │  Heavy   │+42%│
│ Mike Johnson  │   38    │  9  │   15    │  Medium  │+28%│
│ Alex Rivera   │   52    │ 14  │   21    │  Heavy   │+38%│
│ Emily Watson  │   41    │ 11  │   16    │  Light   │+15%│
│ David Kim     │   44    │ 10  │   19    │  Medium  │+31%│
└─────────────────────────────────────────────────────────┘
```

### Productivity Indicators
- **Commit Frequency**: Daily commit average
- **PR Throughput**: Pull requests merged per week
- **Review Velocity**: Average review turnaround time
- **AI Adoption Level**: Agent usage classification
- **Productivity Delta**: Individual improvement percentage

## 5. Quality Metrics Dashboard

### Code Quality Trends
```
┌──────────────────────────────────────────────┐
│ Metric            │ Before AI │ With AI │ Δ   │
├──────────────────────────────────────────────┤
│ Bug Density       │   4.2     │  2.1    │-50% │
│ Test Coverage     │   72%     │  87%    │+21% │
│ Security Issues   │   12      │   3     │-75% │
│ Tech Debt Ratio   │   8.3%    │  4.7%   │-43% │
│ Review Cycles     │   3.2     │  1.8    │-44% │
└──────────────────────────────────────────────┘
```

### Quality Improvement Areas
- **Defect Escape Rate**: Bugs found in production
- **Code Review Effectiveness**: Issues caught in review
- **Test Automation Coverage**: Automated vs manual tests
- **Security Vulnerability Trends**: CVEs over time
- **Technical Debt Accumulation**: New vs resolved debt

## 6. Workflow Optimization Insights

### Common Workflow Patterns
```
Top 5 Command Sequences (This Week):
1. /plan → /build → /test → /review (142 times)
2. /analyze-product → /execute-tasks (98 times)
3. /fold-prompt → /plan-product (67 times)
4. git-workflow → code-reviewer → test-runner (234 times)
5. meta-agent → frontend-developer → playwright-tester (189 times)
```

### Bottleneck Analysis
- **Longest Running Tasks**: Identify optimization opportunities
- **Failed Workflows**: Common failure points and causes
- **Resource Contention**: Agent availability issues
- **Queue Depths**: Pending work analysis
- **Context Switches**: Interruption patterns

## 7. Team Health Indicators

### Collaboration Metrics
```
┌────────────────────────────────────────────────┐
│ Team Health Score: 8.4/10 ↑                   │
├────────────────────────────────────────────────┤
│ • Code Review Participation: 92%              │
│ • Knowledge Sharing Sessions: 4/month         │
│ • Pair Programming Hours: 18/week             │
│ • Documentation Updates: 47/week              │
│ • On-call Incidents: 2 (↓ from 7)            │
└────────────────────────────────────────────────┘
```

### Wellbeing Indicators
- **Work-Life Balance**: After-hours commit frequency
- **Cognitive Load**: Context switches per day
- **Team Collaboration**: Cross-team PR reviews
- **Knowledge Distribution**: Bus factor analysis
- **Burnout Risk**: Sustained high activity patterns

## Implementation Details

### Data Collection Points
1. **Git Hooks**: Capture commit, PR, and review events
2. **Agent Telemetry**: Log all agent invocations and results
3. **IDE Metrics**: Track command usage and context switches
4. **CI/CD Pipeline**: Build times, test results, deployment frequency
5. **Issue Tracker**: Story points, cycle time, bug reports

### Metric Storage Schema
```yaml
metrics:
  timestamp: ISO-8601
  developer_id: UUID
  metric_type: enum[velocity, quality, agent_usage, workflow]
  value: float
  metadata:
    sprint: string
    team: string
    context: object
```

### Visualization Options
- **Terminal Dashboard**: ASCII charts and tables (default)
- **Web Dashboard**: HTML export with interactive charts
- **Slack Integration**: Daily/weekly summary posts
- **CSV Export**: Raw data for custom analysis
- **API Endpoints**: Real-time metric access

## Advanced Analytics

### Predictive Insights
```
┌─────────────────────────────────────────────────────┐
│ PREDICTIONS & RECOMMENDATIONS                      │
├─────────────────────────────────────────────────────┤
│ ⚡ Sprint Completion: 92% confidence for 127 points│
│ 📈 Productivity Trend: +2.3% expected next week   │
│ ⚠️  Risk: Frontend capacity constraint detected    │
│ 💡 Suggestion: Increase playwright-tester usage   │
│ 🎯 30% Goal Achievement: Expected in 8 days       │
└─────────────────────────────────────────────────────┘
```

### Machine Learning Features
- **Velocity Forecasting**: Sprint completion predictions
- **Anomaly Detection**: Unusual patterns in metrics
- **Resource Optimization**: Agent allocation recommendations
- **Risk Identification**: Early warning system
- **Improvement Suggestions**: AI-driven optimization tips

## Command Integration

### Usage Examples
```bash
# Basic dashboard
/dashboard

# Weekly team report
/dashboard weekly --team engineering

# Agent effectiveness analysis
/dashboard agent-usage --period 30d

# Individual developer metrics
/dashboard developer sarah.chen --compare baseline

# Export for stakeholders
/dashboard export --format pdf --recipient cto@fortium.com

# Real-time monitoring mode
/dashboard monitor --refresh 30s
```

### Configuration Options
```yaml
# .agent-os/dashboard-config.yml
dashboard:
  default_view: executive_summary
  refresh_interval: 300  # seconds
  metrics_retention: 90  # days
  teams:
    - name: frontend
      members: [sarah, mike, alex]
    - name: backend
      members: [emily, david, john]
  alerts:
    productivity_threshold: 25  # percent
    quality_degradation: 10     # percent
    agent_failure_rate: 5       # percent
```

## Success Metrics

### Dashboard Effectiveness KPIs
- **Manager Adoption**: 100% of engineering managers using weekly
- **Decision Impact**: 50% reduction in meeting time for metrics review
- **Visibility Improvement**: Real-time vs weekly reporting lag
- **Action Rate**: Percentage of insights acted upon
- **ROI Validation**: Documented productivity improvements

### Continuous Improvement
- **User Feedback Loop**: Manager satisfaction surveys
- **Metric Relevance**: Regular review of tracked KPIs
- **Visualization Enhancement**: Iterative UI improvements
- **Integration Expansion**: New data sources and tools
- **Predictive Accuracy**: ML model performance tracking

## Troubleshooting

### Common Issues
1. **Missing Metrics**: Check agent telemetry configuration
2. **Stale Data**: Verify data collection pipeline status
3. **Performance**: Optimize query patterns for large teams
4. **Access Control**: Ensure proper permissions for sensitive metrics
5. **Integration Failures**: Validate MCP server connections

### Debug Commands
```bash
# Verify data collection
/dashboard debug --check-collectors

# Test metric calculations
/dashboard debug --validate-metrics

# Agent connectivity test
/dashboard debug --test-agents

# Export raw metrics
/dashboard debug --export-raw
```

## Related Commands
- `/plan-product` - Strategic planning with metrics context
- `/analyze-product` - Deep dive into project analytics
- `/execute-tasks` - Task execution with performance tracking
- `/fold-prompt` - Optimize environment for better metrics

---

*Manager Dashboard: Transforming team performance through AI-augmented intelligence*
*Version: 1.0.0 | Fortium Configuration Framework*