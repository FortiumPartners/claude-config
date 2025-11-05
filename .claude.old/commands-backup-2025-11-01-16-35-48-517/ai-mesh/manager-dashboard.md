# @ai-mesh-command
# Command: manager-dashboard
# Version: 1.0.0
# Category: analysis
# Source: fortium
# Maintainer: Fortium Software Configuration Team
# Last Updated: 2025-10-13

---
name: manager-dashboard
description: Generate real-time productivity metrics and team analytics dashboard
version: 1.0.0
category: analysis
---

## Mission

Generate a comprehensive management dashboard with real-time productivity metrics,
team analytics, sprint progress, and actionable insights for engineering managers
and technical leads.



## Workflow

### Phase 1: Data Collection

1. **Metrics Gathering**: Collect productivity metrics from all sources
   - Git commit history
   - Test coverage reports
   - Sprint task completion
   - Code review metrics

### Phase 2: Analysis

1. **Trend Analysis**: Analyze productivity trends over time
2. **Insight Generation**: Generate actionable insights

### Phase 3: Dashboard Generation

1. **Dashboard Creation**: Generate HTML/Markdown dashboard
   - **Delegates to**: manager-dashboard-agent
   - **Context**: Collected metrics and analysis results


## Expected Output

**Format**: Interactive Dashboard

**Structure**:
- **Productivity Metrics**: Development velocity, error rates, automation coverage
- **Team Analytics**: Individual and team performance metrics
- **Sprint Progress**: Current sprint status and burndown
