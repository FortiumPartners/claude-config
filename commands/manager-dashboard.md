---
name: manager-dashboard
description: Generate comprehensive team productivity dashboards with metrics, analytics, and reporting
usage: /manager-dashboard [weekly|team|agent-usage|productivity] [options]
agent: manager-dashboard-agent
allowed-tools: Read, Edit, Bash, Grep, Glob
---

# Manager Dashboard Command

**Purpose**: Generate comprehensive team productivity dashboards by combining metrics from the manager-dashboard-agent with git activity and optional task management integration

**Trigger**:

- `/manager-dashboard` - Display current team metrics
- `/manager-dashboard weekly` - Generate weekly performance report
- `/manager-dashboard team [team-name]` - Team-specific analytics
- `/manager-dashboard agent-usage` - Sub-agent utilization metrics
- `/manager-dashboard productivity` - Productivity improvement tracking

**Prerequisites**:

- Dashboard settings configured in `.agent-os/dashboard-settings.yml`
- Manager dashboard agent operational for metrics collection
- Git repository with commit history
- Optional: MCP server access for task management integration

**Command Flow**:

1. Load dashboard settings and team configuration
2. Invoke manager-dashboard-agent to collect/update metrics
3. Gather recent git activity and development metrics
4. Optional: Fetch external task data via MCP servers
5. Generate formatted dashboard with visualizations
6. Export results in requested format

## Command Implementation

### Settings Integration

```bash
# Load dashboard configuration
settings_file="$HOME/.agent-os/dashboard-settings.yml"
if [[ ! -f "$settings_file" ]]; then
    echo "⚠️  Dashboard settings not found. Please configure .agent-os/dashboard-settings.yml"
    exit 1
fi

# Parse team information and goals
team_name=$(yq '.teams.engineering.name' "$settings_file")
productivity_target=$(yq '.goals.productivity_improvement' "$settings_file")
current_improvement=$(yq '.goals.current_improvement' "$settings_file")
sprint_name=$(yq '.current_sprint.name' "$settings_file")
```

### Agent Delegation

```bash
# Invoke manager-dashboard-agent for metrics collection
echo "📊 Collecting team metrics..."
claude_command="Please use the manager-dashboard-agent to collect and analyze current team metrics, including git activity, agent usage, and productivity trends."

# Agent handles:
# - Git metrics collection and analysis
# - Historical data processing and storage
# - Trend calculations and predictions
# - Quality metrics compilation
```

### MCP Server Integration

```bash
# Optional external task management integration
if [[ "$mcp_linear_enabled" == "true" ]]; then
    echo "🔗 Fetching Linear workspace metrics..."
    # MCP call to Linear server for sprint data
    linear_metrics=$(mcp_call linear getTeamMetrics --team engineering --timeframe 7d)
fi

if [[ "$mcp_github_enabled" == "true" ]]; then
    echo "📋 Fetching GitHub repository metrics..."
    # MCP call to GitHub server for PR and issue data
    github_metrics=$(mcp_call github getRepoMetrics --repo claude-config --timeframe 7d)
fi
```

### Dashboard Generation

#### Executive Summary Panel

```bash
generate_executive_summary() {
    cat << EOF
┌─────────────────────────────────────────────────────────────┐
│ FORTIUM AI-AUGMENTED DEVELOPMENT DASHBOARD                 │
├─────────────────────────────────────────────────────────────┤
│ Current Sprint: $sprint_name        Week: $(date +%V/%Y)   │
│ Productivity Gain: +${current_improvement}% ↑      Target: ${productivity_target}% │
│ Active Developers: $active_devs     Active Agents: $agent_count │
│ Commands Executed: $commands_run    Success Rate: ${success_rate}% │
└─────────────────────────────────────────────────────────────┘
EOF
}
```

#### Team-Specific Analytics

```bash
generate_team_report() {
    local team_name="$1"

    # Get team members from settings
    team_members=$(yq ".teams.${team_name}.members[].name" "$settings_file")

    echo "┌─────────────────────────────────────────────────────────┐"
    echo "│ TEAM: $(echo $team_name | tr '[:lower:]' '[:upper:]')                                          │"
    echo "├─────────────────────────────────────────────────────────┤"

    for member in $team_members; do
        # Get individual metrics from agent data
        commits=$(get_developer_commits "$member" 7)
        prs=$(get_developer_prs "$member" 7)
        ai_usage=$(yq ".teams.${team_name}.members[] | select(.name == \"$member\") | .ai_usage_level" "$settings_file")
        productivity_delta=$(calculate_productivity_delta "$member")

        printf "│ %-15s │ %7s │ %3s │ %8s │ %4s%% │\n" \
            "$member" "$commits" "$prs" "$ai_usage" "$productivity_delta"
    done

    echo "└─────────────────────────────────────────────────────────┘"
}
```

#### Agent Usage Analytics

```bash
generate_agent_usage() {
    echo "📊 Agent Usage Analytics (Last 7 Days)"
    echo "┌──────────────────────────────────────────────────┐"
    echo "│ Agent                  │ Calls │ Success │ Time │"
    echo "├──────────────────────────────────────────────────┤"

    # Get agent metrics from manager-dashboard-agent data
    for agent in meta-agent frontend-developer code-reviewer git-workflow; do
        calls=$(get_agent_calls "$agent" 7)
        success_rate=$(get_agent_success_rate "$agent" 7)
        avg_time=$(get_agent_avg_time "$agent" 7)

        printf "│ %-22s │ %5s │ %6s%% │ %4ss │\n" \
            "$agent" "$calls" "$success_rate" "$avg_time"
    done

    echo "└──────────────────────────────────────────────────┘"
}
```

#### Velocity and Quality Trends

```bash
generate_velocity_chart() {
    echo "📈 Sprint Velocity Trend"
    echo "Story Points Completed"
    echo "│"

    # ASCII chart generation based on historical data
    for sprint in $(seq -w 17 24); do
        points=$(get_sprint_points "S$sprint")
        bar_length=$((points / 3))

        printf "│ %3s ┤" "$points"
        printf "%*s" "$bar_length" "" | tr ' ' '─'
        echo
    done

    echo "└─────┴────┴────┴────┴────┴────┴────┴────"
    echo "     S17  S18  S19  S20  S21  S22  S23  S24"
    echo
    echo "     Pre-AI Era ────  AI-Augmented Era ────"
}
```

### Export and Integration Options

#### Format Options

```bash
case "$export_format" in
    "terminal"|"")
        # Default ASCII dashboard output
        generate_terminal_dashboard
        ;;
    "csv")
        # Export metrics as CSV for analysis
        generate_csv_export > "dashboard-$(date +%Y%m%d).csv"
        ;;
    "json")
        # Structured JSON for API integration
        generate_json_export > "dashboard-$(date +%Y%m%d).json"
        ;;
    "slack")
        # Slack-formatted summary
        generate_slack_summary | post_to_slack
        ;;
    "pdf")
        # Generate PDF report (requires pandoc)
        generate_markdown_report | pandoc -o "dashboard-$(date +%Y%m%d).pdf"
        ;;
esac
```

#### Notification Integration

```bash
send_notifications() {
    local report_type="$1"

    # Check alert thresholds from settings
    productivity_decline=$(yq '.alerts.productivity_decline_threshold' "$settings_file")

    if [[ "$current_productivity_change" -lt "-$productivity_decline" ]]; then
        # Send alert via configured channels
        send_slack_alert "🚨 Productivity decline detected: ${current_productivity_change}%"
        send_email_alert "Productivity Alert" "engineering-team@fortium.com"
    fi

    # Success notifications
    if [[ "$current_improvement" -ge "$productivity_target" ]]; then
        send_slack_alert "🎯 Productivity goal achieved: ${current_improvement}%!"
    fi
}
```

## Command Arguments

### Basic Usage

```bash
# Display current team dashboard
/manager-dashboard

# Weekly report for specific team
/manager-dashboard weekly --team engineering

# Agent usage analysis
/manager-dashboard agent-usage --period 30d

# Individual developer focus
/manager-dashboard developer leo.dangelo --compare baseline

# Export for stakeholders
/manager-dashboard export --format pdf --recipient cto@fortium.com
```

### Advanced Options

```bash
# Real-time monitoring mode
/manager-dashboard monitor --refresh 30s

# Historical analysis
/manager-dashboard historical --from 2024-08-01 --to 2024-08-29

# Sprint-specific analysis
/manager-dashboard sprint "Sprint 24" --include-predictions

# Quality metrics focus
/manager-dashboard quality --include-security --include-debt
```

## Integration Points

### Manager Dashboard Agent

- **Input**: Team configuration, time ranges, metric types
- **Processing**: Data collection, analysis, storage
- **Output**: Structured metrics data, recommendations, alerts

### Settings Configuration

- **Team Setup**: Member definitions, roles, baselines
- **Goals**: Productivity targets, quality thresholds
- **Integrations**: MCP server configurations, notification channels
- **Customization**: Metric weights, alert thresholds, reporting schedules

### MCP Server Integration

- **Linear/Jira**: Sprint metrics, story points, cycle time
- **GitHub**: Repository activity, PR metrics, issue resolution
- **Slack**: Team communication patterns, collaboration metrics
- **Custom**: Extensible integration framework for additional tools

## Success Metrics

### Command Effectiveness

- **Response Time**: Dashboard generation < 30 seconds
- **Data Accuracy**: Metrics accuracy > 95% vs manual calculation
- **User Adoption**: 100% engineering manager usage for weekly reports
- **Action Rate**: 70% of insights result in team process changes

### Technical Performance

- **Reliability**: 99% successful execution rate
- **Data Freshness**: Metrics updated within 5 minutes of git activity
- **Integration Success**: 95% MCP server call success rate
- **Export Quality**: All format exports validate correctly

---

_Manager Dashboard Command: Orchestrating comprehensive team analytics through intelligent agent delegation and external system integration_
_Version: 1.0.0 | Fortium Configuration Framework_
