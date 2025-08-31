# Configuration Guide: Automatic Issue Creation

> Last Updated: 2025-08-30  
> Version: 1.0.0  
> Status: Production Ready

## Overview

This guide provides comprehensive configuration instructions for the automatic issue creation system. Learn how to set up team-specific configurations, customize templates, and integrate with your preferred ticketing systems.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration Schema](#configuration-schema)
3. [Team Setup](#team-setup)
4. [Ticketing System Integration](#ticketing-system-integration)
5. [Template Configuration](#template-configuration)
6. [Project Management Features](#project-management-features)
7. [Notification Setup](#notification-setup)
8. [Advanced Configuration](#advanced-configuration)
9. [Environment Variables](#environment-variables)
10. [Validation and Testing](#validation-and-testing)

## Quick Start

### 1. Basic Setup (5 minutes)

Create your team configuration file:

```bash
mkdir -p .agent-os/config
cat > .agent-os/config/team-config.yml << 'EOF'
schema_version: "1.0"
team_name: "Development Team"

automatic_issue_creation:
  enabled: true
  dry_run: false

ticketing_systems:
  github:
    system_type: "github"
    repository_owner: "your-org"
    repository_name: "your-repo"

templates:
  feature:
    title_prefix: "[FEATURE]"
    labels: ["feature", "auto-generated"]
EOF
```

### 2. Test Configuration

```bash
# Validate configuration
python3 -m configuration_manager validate

# Test in dry-run mode
/create-spec "Test Feature" --auto-issues --dry-run
```

### 3. Enable Production Use

```bash
# Remove dry-run mode
sed -i 's/dry_run: true/dry_run: false/' .agent-os/config/team-config.yml

# Create your first automated issues
/create-spec "User Authentication System" --auto-issues
```

## Configuration Schema

### Complete Schema Reference

```yaml
# team-config.yml - Complete Reference
schema_version: "1.0"           # Required: Schema version for compatibility
team_name: "Your Team Name"     # Required: Team identifier

# Core Settings
automatic_issue_creation:
  enabled: true                 # Enable/disable automatic issue creation
  dry_run: false               # Preview mode (doesn't create real issues)
  use_advanced_detection: true  # Enable ML-based issue classification
  min_confidence_threshold: 0.5 # Minimum confidence for auto-classification
  apply_templates: true         # Apply team templates to issues
  template_path: null          # Optional: Custom template directory

# Ticketing System Configurations
ticketing_systems:
  github:                      # GitHub Issues integration
    system_type: "github"      # Required: System identifier
    repository_owner: "org"    # Required: GitHub organization/user
    repository_name: "repo"    # Required: Repository name
    default_assignee: "@team"  # Default assignee for created issues
    default_labels:            # Default labels for all issues
      - "auto-generated"
      - "specification"
    api_endpoint: null         # Optional: Custom GitHub API endpoint
    
  linear:                      # Linear integration
    system_type: "linear"      # Required: System identifier
    team_id: "DEV"            # Required: Linear team ID
    project_id: null          # Optional: Default project ID
    default_assignee: "user-id" # Default assignee (Linear user ID)
    default_labels:
      - "Auto-Generated"
      - "Specification"

# Template Definitions
templates:
  # Feature template
  feature:
    title_prefix: "[FEATURE]"
    title_suffix: ""
    description_template: |
      ## Generated from Specification
      
      **Spec File:** {spec_file}
      **Generated:** {timestamp}
      **Team:** {team_name}
      
      ## Description
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Implementation Notes
      - Follow team coding standards
      - Include comprehensive tests
      - Update documentation
      
      ---
      *Created by Automatic Issue Creation v{version}*
    labels: ["feature", "auto-generated"]
    priority: "medium"
    assignee: null            # Override default assignee
    
  # Epic template
  epic:
    title_prefix: "[EPIC]"
    description_template: |
      ## Epic Overview
      
      **Specification:** {spec_file}
      **Created:** {timestamp}
      **Estimated Stories:** {child_count}
      
      ## Description
      {description}
      
      ## Success Criteria
      {acceptance_criteria}
      
      ## Breakdown
      This epic will be broken down into the following stories:
      {child_issues}
      
      ## Definition of Done
      - [ ] All child stories completed
      - [ ] End-to-end testing completed
      - [ ] Documentation updated
      - [ ] Stakeholder review completed
    labels: ["epic", "planning"]
    priority: "high"
    
  # Bug template
  bug:
    title_prefix: "[BUG]"
    description_template: |
      ## Bug Report
      
      **Reported in Spec:** {spec_file}
      **Priority:** {priority}
      
      ## Description
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Investigation Steps
      - [ ] Reproduce the issue
      - [ ] Identify root cause
      - [ ] Develop fix with tests
      - [ ] Verify resolution
    labels: ["bug", "needs-investigation"]
    priority: "high"

# Project Management Integration
project_management:
  milestone_config:
    default_milestone: "Current Sprint"
    epic_milestone_pattern: "Epic: {title}"
    sprint_milestone_pattern: "Sprint {number}"
    auto_create_milestones: false
    milestone_due_date_offset_days: 30
    
  project_board_config:
    default_project_id: null
    epic_column_name: "Epics"
    feature_column_name: "Features"
    bug_column_name: "Bugs"
    task_column_name: "Tasks"
    auto_create_columns: false

# Team Notifications
notifications:
  enabled: true
  slack_webhook_url: null      # Slack webhook for notifications
  discord_webhook_url: null    # Discord webhook for notifications
  teams_webhook_url: null      # Microsoft Teams webhook
  github_owner: null           # For GitHub comment notifications
  github_repo: null
  team_mentions:
    slack: "@dev-team"
    discord: "@developers"
    github: "@dev-team"
  notification_events:         # Events that trigger notifications
    - "issue_created"
    - "progress_milestone"
    - "hierarchy_completed"
    - "error_occurred"

# Custom Template Variables
template_variables:
  company_name: "Your Company"
  support_email: "support@company.com"
  documentation_url: "https://docs.company.com"
  style_guide_url: "https://style.company.com"
```

## Team Setup

### Small Team Configuration (2-5 developers)

```yaml
schema_version: "1.0"
team_name: "Small Dev Team"

automatic_issue_creation:
  enabled: true
  dry_run: false

ticketing_systems:
  github:
    system_type: "github"
    repository_owner: "small-company"
    repository_name: "main-product"
    default_assignee: "@dev-team"
    default_labels: ["feature", "small-team"]

templates:
  feature:
    title_prefix: ""           # No prefix for simple workflow
    description_template: |
      {description}
      
      ## Todo
      {acceptance_criteria}
    labels: ["feature"]
    priority: "medium"

notifications:
  enabled: true
  slack_webhook_url: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
  team_mentions:
    slack: "@here"
  notification_events:
    - "issue_created"
    - "error_occurred"
```

### Enterprise Team Configuration (10+ developers)

```yaml
schema_version: "1.0"
team_name: "Enterprise Development Team"

automatic_issue_creation:
  enabled: true
  dry_run: false
  use_advanced_detection: true
  min_confidence_threshold: 0.7

ticketing_systems:
  linear:
    system_type: "linear"
    team_id: "ENG"
    project_id: 123
    default_labels: ["Auto-Generated", "Specification", "Enterprise"]

templates:
  epic:
    title_prefix: "[EPIC]"
    description_template: |
      ## Epic: {title}
      
      **Business Owner:** {business_owner}
      **Technical Lead:** {tech_lead}
      **Target Release:** {target_release}
      
      ## Business Case
      {business_case}
      
      ## Technical Description
      {description}
      
      ## Success Metrics
      {success_metrics}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Dependencies
      {dependencies}
      
      ## Risk Assessment
      {risk_assessment}
      
      ## Definition of Done
      - [ ] All child stories completed and tested
      - [ ] Performance requirements met
      - [ ] Security review completed
      - [ ] Documentation updated
      - [ ] Stakeholder sign-off received
    labels: ["epic", "enterprise", "planning"]
    priority: "high"
    
  feature:
    title_prefix: "[STORY]"
    description_template: |
      ## User Story
      
      **As a** {user_type}
      **I want** {user_want}  
      **So that** {user_benefit}
      
      ## Context
      **Epic:** {parent_epic}
      **Sprint:** {target_sprint}
      **Estimate:** {story_points} points
      
      ## Technical Details
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Technical Requirements
      - [ ] Unit tests with >90% coverage
      - [ ] Integration tests included
      - [ ] Performance benchmarks met
      - [ ] Security review completed
      - [ ] Documentation updated
      
      ## Dependencies
      {dependencies}
    labels: ["story", "enterprise"]
    priority: "medium"

project_management:
  milestone_config:
    auto_create_milestones: true
    epic_milestone_pattern: "Epic: {title}"
    milestone_due_date_offset_days: 60
    
  project_board_config:
    auto_create_columns: true
    
notifications:
  enabled: true
  slack_webhook_url: "https://hooks.slack.com/services/ENTERPRISE/WEBHOOK"
  teams_webhook_url: "https://company.webhook.office.com/webhookb2/..."
  team_mentions:
    slack: "@eng-team"
    teams: "@engineering"
  notification_events:
    - "issue_created"
    - "milestone_reached"
    - "hierarchy_completed"

template_variables:
  company_name: "Enterprise Corp"
  support_email: "engineering@enterprise.com"
  documentation_url: "https://docs.enterprise.com"
  security_review_url: "https://security.enterprise.com"
```

## Ticketing System Integration

### GitHub Issues Setup

#### Prerequisites
```bash
# Install GitHub MCP server if not already installed
claude mcp add github --scope user -- npx -y @modelcontextprotocol/server-github

# Verify installation
claude mcp list | grep github
```

#### Configuration
```yaml
ticketing_systems:
  github:
    system_type: "github"
    repository_owner: "your-organization"    # Required
    repository_name: "your-repository"       # Required
    default_assignee: "@dev-team"           # Optional: Team mention
    default_labels:                         # Optional: Default labels
      - "auto-generated"
      - "specification"
      - "needs-review"
    api_endpoint: null                      # Optional: Enterprise GitHub URL
```

#### Authentication
GitHub authentication is handled by the MCP server. Ensure your GitHub token has the following permissions:
- `repo` - Full repository access
- `read:org` - Read organization membership
- `write:discussion` - Create and edit discussions (if using)

### Linear Integration Setup

#### Prerequisites
```bash
# Install Linear MCP server if not already installed
claude mcp add linear --scope user -- npx -y linear-mcp-server

# Verify installation
claude mcp list | grep linear
```

#### Configuration
```yaml
ticketing_systems:
  linear:
    system_type: "linear"
    team_id: "DEV"                         # Required: Your Linear team ID
    project_id: 123                        # Optional: Default project
    default_assignee: "user-uuid-here"     # Optional: Linear user ID
    default_labels:                        # Optional: Default labels
      - "Auto-Generated"
      - "Specification"
      - "Development"
```

#### Finding Your Linear Team ID
```bash
# List Linear teams (requires Linear MCP server)
python3 -c "
import asyncio
from linear_integration import LinearIntegration
# This would show your team IDs in a real implementation
print('Check Linear settings > Team > Team ID')
"
```

### Multi-System Configuration

You can configure multiple ticketing systems and choose which one to use:

```yaml
ticketing_systems:
  github:
    system_type: "github"
    repository_owner: "company"
    repository_name: "backend"
    
  linear:
    system_type: "linear" 
    team_id: "BACKEND"
    
  github_frontend:
    system_type: "github"
    repository_owner: "company"
    repository_name: "frontend"
```

Usage:
```bash
# Use specific system
/create-spec "Backend API" --auto-issues --system github
/create-spec "UI Feature" --auto-issues --system linear
/create-spec "Frontend" --auto-issues --system github_frontend
```

## Template Configuration

### Template Variables

Available variables in all templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{title}` | Issue title | "User Authentication" |
| `{description}` | Issue description | "Implement OAuth2..." |
| `{acceptance_criteria}` | Formatted criteria | "- [ ] Login endpoint..." |
| `{spec_file}` | Specification filename | "auth-system.md" |
| `{timestamp}` | Creation timestamp | "2025-08-30 10:30:00 UTC" |
| `{team_name}` | Team name from config | "Development Team" |
| `{priority}` | Issue priority | "high" |
| `{child_count}` | Number of child issues | "5" |
| `{child_issues}` | List of child issue links | "- #123: Login API..." |
| `{version}` | System version | "1.0.0" |

### Custom Variables

Add custom variables to your configuration:

```yaml
template_variables:
  company_name: "Acme Corp"
  support_email: "dev@acme.com"
  jira_project: "ACME"
  confluence_space: "DEV"
```

Use in templates:
```yaml
templates:
  feature:
    description_template: |
      ## {title}
      
      **Company:** {company_name}
      **Contact:** {support_email}
      
      {description}
      
      ## Documentation
      See: {confluence_space} space for details
```

### Conditional Templates

Create templates based on issue characteristics:

```yaml
templates:
  # Small features (< 3 acceptance criteria)
  small_feature:
    condition: "len(acceptance_criteria) < 3"
    title_prefix: "[QUICK]"
    description_template: |
      Quick feature implementation.
      
      {description}
      
      ## Todo
      {acceptance_criteria}
    
  # Large features (>= 5 acceptance criteria) 
  large_feature:
    condition: "len(acceptance_criteria) >= 5"
    title_prefix: "[COMPLEX]"
    description_template: |
      Complex feature requiring careful planning.
      
      {description}
      
      ## Planning Required
      This feature has {acceptance_criteria|length} acceptance criteria
      and may require breaking into smaller tasks.
      
      {acceptance_criteria}
      
      ## Next Steps
      - [ ] Technical design review
      - [ ] Break into smaller tasks
      - [ ] Estimate effort
```

### Template Inheritance

Create base templates and extend them:

```yaml
templates:
  # Base template
  base:
    description_template: |
      **Generated:** {timestamp}
      **Team:** {team_name}
      
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
    labels: ["auto-generated"]
    
  # Feature extends base
  feature:
    extends: "base"
    title_prefix: "[FEATURE]"
    description_template: |
      ## Feature Request
      
      {{ base.description_template }}
      
      ## Implementation Notes
      - Follow coding standards
      - Include tests
    labels: ["feature", "auto-generated"]  # Merges with base
```

## Project Management Features

### Milestone Management

Automatically assign issues to milestones:

```yaml
project_management:
  milestone_config:
    default_milestone: "Current Sprint"
    epic_milestone_pattern: "Epic: {title}"
    sprint_milestone_pattern: "Sprint {number}"
    auto_create_milestones: true
    milestone_due_date_offset_days: 14
```

### Project Board Integration

Organize issues on project boards:

```yaml
project_management:
  project_board_config:
    default_project_id: 123
    epic_column_name: "Epics"
    feature_column_name: "To Do"
    bug_column_name: "Bugs"
    task_column_name: "Tasks"
    auto_create_columns: true
```

### Advanced Project Management

```yaml
project_management:
  # Sprint planning integration
  sprint_config:
    current_sprint: "Sprint 24"
    sprint_duration_days: 14
    auto_assign_to_sprint: true
    sprint_capacity_points: 40
    
  # Release planning
  release_config:
    current_release: "v2.1"
    release_date: "2025-09-15"
    feature_freeze_date: "2025-09-01"
    
  # Estimation
  estimation_config:
    auto_estimate: true
    estimation_model: "fibonacci"  # 1, 2, 3, 5, 8, 13
    default_estimate: 3
    
  # Dependencies
  dependency_tracking:
    auto_detect_dependencies: true
    dependency_label: "depends-on"
```

## Notification Setup

### Slack Integration

```yaml
notifications:
  enabled: true
  slack_webhook_url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
  team_mentions:
    slack: "@dev-team"
  notification_events:
    - "issue_created"
    - "hierarchy_completed"
    - "error_occurred"
```

Get your Slack webhook URL:
1. Go to https://api.slack.com/apps
2. Create new app or select existing
3. Go to "Incoming Webhooks"
4. Create webhook for your channel

### Discord Integration

```yaml
notifications:
  discord_webhook_url: "https://discord.com/api/webhooks/123456789/abcdefgh..."
  team_mentions:
    discord: "@developers"
```

### Microsoft Teams

```yaml
notifications:
  teams_webhook_url: "https://company.webhook.office.com/webhookb2/..."
  team_mentions:
    teams: "@engineering"
```

### Multi-Channel Notifications

```yaml
notifications:
  enabled: true
  
  # Development team notifications
  slack_webhook_url: "https://hooks.slack.com/.../dev-team"
  
  # Management notifications  
  teams_webhook_url: "https://company.webhook.office.com/.../management"
  
  # Different events to different channels
  notification_routing:
    issue_created: ["slack"]
    error_occurred: ["slack", "teams"]
    hierarchy_completed: ["teams"]
    milestone_reached: ["slack", "teams", "email"]
    
  team_mentions:
    slack: "@dev-team"
    teams: "@engineering @management"
```

### Email Notifications

```yaml
notifications:
  email_config:
    smtp_server: "smtp.company.com"
    smtp_port: 587
    username: "notifications@company.com" 
    password_env_var: "SMTP_PASSWORD"
    from_address: "Dev Team <dev@company.com>"
    to_addresses:
      - "team-lead@company.com"
      - "product-manager@company.com"
    subject_template: "[Issues] {event_type}: {title}"
```

## Advanced Configuration

### Hierarchical Configuration

Support different configurations for different contexts:

```
.agent-os/
├── config/
│   ├── team-config.yml          # Global team config
│   ├── projects/
│   │   ├── backend-config.yml   # Backend-specific
│   │   ├── frontend-config.yml  # Frontend-specific
│   │   └── mobile-config.yml    # Mobile-specific
│   └── environments/
│       ├── development.yml      # Development environment
│       ├── staging.yml          # Staging environment
│       └── production.yml       # Production environment
```

Configuration precedence (highest to lowest):
1. Project-specific configuration
2. Environment-specific configuration  
3. Team configuration
4. Global defaults

### Dynamic Configuration

Load configuration based on context:

```yaml
dynamic_config:
  # Choose config based on spec file location
  path_based:
    "backend/": "projects/backend-config.yml"
    "frontend/": "projects/frontend-config.yml"
    "mobile/": "projects/mobile-config.yml"
    
  # Choose config based on spec content
  content_based:
    patterns:
      "API|endpoint|service": "api-config.yml"
      "UI|component|interface": "ui-config.yml"
      "database|migration|schema": "data-config.yml"
      
  # Choose config based on environment
  environment_based:
    development: "environments/dev-config.yml"
    staging: "environments/staging-config.yml"
    production: "environments/prod-config.yml"
```

### Plugin System

Extend functionality with plugins:

```yaml
plugins:
  enabled: true
  plugin_directory: ".agent-os/plugins"
  
  # Custom processors
  processors:
    - name: "jira_processor"
      path: "plugins/jira_processor.py"
      config:
        jira_url: "https://company.atlassian.net"
        project_key: "DEV"
        
    - name: "slack_enhancer"
      path: "plugins/slack_enhancer.py"
      config:
        bot_token: "xoxb-..."
        channel_mapping:
          epic: "#product-planning"
          feature: "#development"
          bug: "#bug-triage"
```

### Performance Tuning

Optimize for large teams and high throughput:

```yaml
performance:
  # Parallel processing
  max_concurrent_issues: 10
  batch_size: 5
  
  # Caching
  template_cache_enabled: true
  config_cache_ttl: 300  # seconds
  
  # Rate limiting
  api_rate_limit:
    github: 5000  # requests per hour
    linear: 1000  # requests per hour
    
  # Timeouts
  api_timeout: 30        # seconds
  total_timeout: 300     # seconds (5 minutes)
  
  # Retry logic
  max_retries: 3
  retry_delay: 1         # seconds
  backoff_multiplier: 2
```

## Environment Variables

### Core Variables

```bash
# Enable/disable automatic issue creation
export AGENT_OS_AUTO_ISSUES=true

# Default ticketing system
export AGENT_OS_TICKETING_SYSTEM=github

# Configuration file path
export AGENT_OS_CONFIG_PATH=".agent-os/config/team-config.yml"

# Template selection
export AGENT_OS_DEFAULT_TEMPLATE=feature

# Debug logging
export AGENT_OS_DEBUG=true

# Dry run mode
export AGENT_OS_DRY_RUN=true
```

### Authentication Variables

```bash
# GitHub (handled by MCP server)
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"

# Linear (handled by MCP server)
export LINEAR_API_KEY="lin_api_xxxxxxxxxxxx"

# Notification webhooks
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

### Override Variables

```bash
# Override specific configuration values
export AGENT_OS_TEAM_NAME="Override Team"
export AGENT_OS_DEFAULT_ASSIGNEE="@override-team"
export AGENT_OS_DEFAULT_LABELS="override,testing"

# Environment-specific overrides
export AGENT_OS_ENV=development
export AGENT_OS_PROJECT=backend
export AGENT_OS_COMPONENT=api
```

## Validation and Testing

### Configuration Validation

```bash
# Validate configuration syntax
python3 -m configuration_manager validate

# Validate with specific config file
python3 -m configuration_manager validate --config .agent-os/config/custom-config.yml

# Check template rendering
python3 -m template_engine test --template feature

# Validate ticketing system connectivity
python3 -m github_integration test-connection
python3 -m linear_integration test-connection
```

### Testing Commands

```bash
# Run all tests
python3 -m pytest .agent-os/specs/automatic-issue-creation-spec/

# Test specific functionality
python3 -m test_template_system
python3 -m test_integration
python3 -m test_e2e_workflow

# Performance testing
python3 -m test_performance --issues 50 --concurrent 10

# Load testing
python3 -m test_load --duration 300 --rate 10
```

### Dry Run Testing

```bash
# Test with dry run (no real issues created)
/create-spec "Test Feature" --auto-issues --dry-run

# Test specific template
/create-spec "Test Epic" --auto-issues --dry-run --template epic

# Test with verbose output
AGENT_OS_DEBUG=true /create-spec "Test Feature" --auto-issues --dry-run
```

### Integration Testing

Create test specifications:

```bash
# Create test spec directory
mkdir -p test-specs

# Create test specification
cat > test-specs/test-feature.md << 'EOF'
# Test Feature

## Description
This is a test feature for validation.

## Acceptance Criteria
- [ ] Test criterion 1
- [ ] Test criterion 2  
- [ ] Test criterion 3

## Epic: Test Epic
This feature is part of a larger epic.

## Tasks
- Implementation task 1
- Implementation task 2
EOF

# Test automatic issue creation
/create-spec test-specs/test-feature.md --auto-issues --dry-run
```

### Monitoring and Observability

```yaml
monitoring:
  enabled: true
  
  # Metrics collection
  metrics:
    - name: "issues_created_total"
      type: "counter"
    - name: "creation_duration_seconds"
      type: "histogram"  
    - name: "template_render_time"
      type: "histogram"
    - name: "api_errors_total"
      type: "counter"
      
  # Health checks
  health_checks:
    - name: "config_valid"
      interval: 300  # seconds
    - name: "mcp_servers_reachable"
      interval: 60
    - name: "templates_valid"
      interval: 600
      
  # Alerting
  alerts:
    - name: "high_error_rate"
      condition: "error_rate > 0.05"
      notification: "slack"
    - name: "slow_creation"
      condition: "avg_duration > 30"
      notification: "email"
```

---

## Troubleshooting Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Configuration not found | Check path: `.agent-os/config/team-config.yml` |
| YAML syntax error | Validate with: `yq eval config.yml` |
| MCP server not found | Run: `claude mcp list` and install if needed |
| Template rendering error | Test with: `python3 -m template_engine test` |
| API authentication error | Check MCP server authentication |
| Rate limit exceeded | Reduce `max_concurrent_issues` in config |
| Issues not created | Verify `dry_run: false` in config |

---

## Next Steps

After configuring your system:

1. **Start with Dry Run**: Test thoroughly before creating real issues
2. **Monitor Performance**: Watch for API limits and timing issues  
3. **Iterate on Templates**: Refine based on team feedback
4. **Scale Gradually**: Start with simple specs, add complexity
5. **Train Team**: Ensure everyone understands the new workflow

## Related Documentation

- [Create-Spec Integration Guide](./CREATE_SPEC_INTEGRATION_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Template Reference](./TEMPLATE_REFERENCE.md)

---

*Complete configuration reference for the automatic issue creation system. For additional support, see the troubleshooting guide or contact your development team.*