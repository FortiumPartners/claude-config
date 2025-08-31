# Migration Guide: Automatic Issue Creation

> Last Updated: 2025-08-30  
> Version: 1.0.0  
> Status: Production Ready

## Overview

This guide provides step-by-step instructions for migrating from manual issue creation workflows to the automated system. Whether you're upgrading from a basic setup or implementing for the first time, this guide will help you transition smoothly while maintaining team productivity.

## Table of Contents

1. [Migration Planning](#migration-planning)
2. [Pre-Migration Assessment](#pre-migration-assessment)
3. [Migration Strategies](#migration-strategies)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Configuration Migration](#configuration-migration)
6. [Team Training](#team-training)
7. [Rollback Procedures](#rollback-procedures)
8. [Post-Migration Validation](#post-migration-validation)
9. [Best Practices](#best-practices)

## Migration Planning

### Migration Timeline

**Recommended Timeline: 2-4 weeks**

| Phase | Duration | Activities |
|-------|----------|------------|
| **Week 1: Assessment** | 2-3 days | Audit current process, plan configuration |
| **Week 1-2: Setup** | 3-5 days | Install, configure, test in staging |
| **Week 2-3: Pilot** | 5-7 days | Deploy to small team, gather feedback |
| **Week 3-4: Rollout** | 3-5 days | Full deployment, training, optimization |

### Migration Readiness Checklist

Before starting migration, ensure:

- [ ] **Team Buy-in**: Development team agrees to new process
- [ ] **System Access**: Proper permissions for GitHub/Linear
- [ ] **Backup Plan**: Current process can continue if needed
- [ ] **Test Environment**: Staging setup available for testing
- [ ] **Documentation**: Current templates and patterns documented
- [ ] **Training Materials**: Team training plan prepared
- [ ] **Success Metrics**: Clear definition of migration success

### Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Team resistance | High | Early engagement, training, gradual rollout |
| Configuration errors | Medium | Thorough testing, dry-run validation |
| API rate limits | Medium | Staged deployment, monitoring |
| Integration failures | High | Fallback procedures, manual override |
| Performance issues | Medium | Load testing, optimization |

## Pre-Migration Assessment

### Current Process Audit

Document your existing workflow:

```bash
# Create audit directory
mkdir -p migration-audit

# Document current issues (GitHub example)
gh issue list --limit 50 --json title,body,labels,assignees > migration-audit/current-issues.json

# Analyze issue patterns
cat migration-audit/current-issues.json | jq '.[] | {title: .title, labels: .labels[].name}' > migration-audit/issue-patterns.json

# Document team templates
echo "Current issue templates used by team:" > migration-audit/templates.md
grep -r "template\|format" docs/ >> migration-audit/templates.md
```

### Template Analysis

Identify current patterns:

```bash
# Analyze issue titles
gh issue list --json title | jq -r '.[].title' | grep -oE '^\[[A-Z]+\]' | sort | uniq -c

# Common label patterns
gh issue list --json labels | jq -r '.[].labels[].name' | sort | uniq -c

# Assignee patterns
gh issue list --json assignees | jq -r '.[].assignees[].login' | sort | uniq -c
```

### Performance Baseline

Measure current manual process:

```markdown
## Current Process Performance

### Time Measurements
- **Specification Creation**: X minutes
- **Manual Issue Creation**: Y minutes per issue
- **Issue Linking**: Z minutes
- **Total Overhead**: (Y * average_issues_per_spec) + Z minutes

### Quality Metrics
- **Missing Issues**: X% of specs don't get corresponding issues
- **Link Maintenance**: Y% of spec-issue links become outdated
- **Consistency**: Z% of issues follow standard format

### Team Satisfaction
- **Manual Effort**: High/Medium/Low concern
- **Error Rate**: X errors per week
- **Context Switching**: Y disruptions per spec creation
```

## Migration Strategies

### Strategy 1: Big Bang Migration (1-2 weeks)

**Best for:** Small teams (≤5 people), simple processes

**Approach:**
1. Complete configuration in staging
2. Train entire team
3. Switch all specs to automated process
4. Monitor and adjust

**Pros:** Fast, consistent adoption
**Cons:** Higher risk, potential disruption

### Strategy 2: Gradual Migration (2-4 weeks)

**Best for:** Medium teams (5-15 people), complex workflows

**Approach:**
1. Start with new specifications only
2. Gradually migrate existing workflows
3. Run parallel processes during transition
4. Phase out manual process

**Pros:** Lower risk, smoother transition
**Cons:** Longer timeline, temporary complexity

### Strategy 3: Pilot Program (3-6 weeks)

**Best for:** Large teams (15+ people), enterprise environments

**Approach:**
1. Select pilot team/project
2. Full implementation for pilot
3. Gather feedback and optimize
4. Roll out to remaining teams
5. Organization-wide adoption

**Pros:** Validation, optimization, team confidence
**Cons:** Longest timeline, resource intensive

## Step-by-Step Migration

### Phase 1: Environment Setup (Days 1-3)

#### Step 1.1: Install Prerequisites

```bash
# Verify Claude Code installation
claude --version

# Install required MCP servers
claude mcp add github --scope user -- npx -y @modelcontextprotocol/server-github
claude mcp add linear --scope user -- npx -y linear-mcp-server  # if using Linear

# Verify installations
claude mcp list
```

#### Step 1.2: Create Configuration

```bash
# Create configuration directory
mkdir -p .agent-os/config

# Backup existing configuration (if any)
if [ -f .agent-os/config/team-config.yml ]; then
    cp .agent-os/config/team-config.yml .agent-os/config/team-config.yml.backup.$(date +%Y%m%d)
fi
```

#### Step 1.3: Basic Configuration Template

```yaml
# .agent-os/config/team-config.yml
schema_version: "1.0"
team_name: "Migration Team"

automatic_issue_creation:
  enabled: true
  dry_run: true  # Start with dry run for safety

ticketing_systems:
  github:  # or linear
    system_type: "github"
    repository_owner: "your-org"
    repository_name: "your-repo"
    default_assignee: "@your-team"
    default_labels:
      - "specification"
      - "migrated"  # Track migrated issues

templates:
  # Start with simple templates
  feature:
    title_prefix: "[FEATURE]"
    description_template: |
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ---
      Migrated from manual process
    labels: ["feature", "migrated"]
```

### Phase 2: Configuration Migration (Days 4-7)

#### Step 2.1: Migrate Existing Templates

Analyze your current issue format and create templates:

```bash
# Extract common issue format
gh issue view 123 --json title,body | jq -r '.body' > sample-issue.md

# Create template based on sample
cat > template-draft.md << 'EOF'
## Feature: {title}

**Generated from specification:** {spec_file}

### Description
{description}

### Acceptance Criteria
{acceptance_criteria}

### Labels
- Feature request
- Needs review

---
*Created automatically from specification*
EOF
```

Convert to YAML template:

```yaml
templates:
  feature:
    title_prefix: "[FEATURE]"
    description_template: |
      ## Feature: {title}
      
      **Generated from specification:** {spec_file}
      
      ### Description
      {description}
      
      ### Acceptance Criteria
      {acceptance_criteria}
      
      ### Labels
      - Feature request
      - Needs review
      
      ---
      *Created automatically from specification*
    labels: ["feature", "needs-review"]
    priority: "medium"
```

#### Step 2.2: Configure Team-Specific Settings

```yaml
# Add team-specific configuration
template_variables:
  team_name: "Development Team"
  team_lead: "@team-lead"
  project_url: "https://github.com/org/project"
  documentation_url: "https://docs.company.com"

# Notification settings
notifications:
  enabled: true
  slack_webhook_url: "https://hooks.slack.com/services/..."
  team_mentions:
    slack: "@dev-team"
  notification_events:
    - "issue_created"
    - "error_occurred"
```

#### Step 2.3: Advanced Features Migration

```yaml
# Project management features
project_management:
  milestone_config:
    default_milestone: "Current Sprint"
    auto_create_milestones: false  # Start conservative
    
  project_board_config:
    default_project_id: 123
    auto_create_columns: false
    
# Performance optimization
performance:
  max_concurrent_issues: 3  # Start conservative
  batch_size: 2
```

### Phase 3: Testing and Validation (Days 8-10)

#### Step 3.1: Dry Run Testing

```bash
# Test with existing specifications
find . -name "*.md" -path "*spec*" | head -3 | while read spec; do
    echo "Testing: $spec"
    /create-spec "$spec" --auto-issues --dry-run
done

# Test with new sample specification
cat > test-migration-spec.md << 'EOF'
# Migration Test Feature

## Description
This is a test feature to validate the migration process.

## Acceptance Criteria
- [ ] Feature works as expected
- [ ] Issues are created correctly
- [ ] Templates are applied properly

## Epic
This is part of the migration validation epic.
EOF

/create-spec "test-migration-spec.md" --auto-issues --dry-run
```

#### Step 3.2: Validate Template Output

```bash
# Check template rendering
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from template_engine import TemplateEngine
te = TemplateEngine()
result = te.render_sample('feature')
print('Template Preview:')
print(result)
"
```

#### Step 3.3: Integration Testing

```bash
# Test MCP server connectivity
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from github_integration import GitHubIntegration
from ticketing_interface import TicketingSystemConfig, TicketingSystem
config = TicketingSystemConfig(
    system_type=TicketingSystem.GITHUB,
    repository_owner='your-org',
    repository_name='your-repo'
)
gh = GitHubIntegration(config)
print('Testing GitHub integration...')
# Test would run here
print('Integration test completed')
"
```

### Phase 4: Pilot Deployment (Days 11-14)

#### Step 4.1: Enable for New Specifications

```yaml
# Update configuration to enable for new specs only
automatic_issue_creation:
  enabled: true
  dry_run: false  # Enable real issue creation
  
# Add pilot identification
template_variables:
  migration_phase: "pilot"
```

#### Step 4.2: Create Test Issues

```bash
# Create first real automated issues
/create-spec "Pilot Feature Test" --auto-issues

# Verify issues were created
gh issue list --label "migrated" --limit 5
```

#### Step 4.3: Monitor and Adjust

```bash
# Monitor creation performance
time /create-spec "Performance Test" --auto-issues

# Check error rates
grep -i error ~/.claude/logs/latest.log | tail -10

# Validate issue quality
gh issue list --label "migrated" --json title,body,labels
```

### Phase 5: Full Migration (Days 15-21)

#### Step 5.1: Update Team Process

```bash
# Update team documentation
cat >> DEVELOPMENT_PROCESS.md << 'EOF'

## Issue Creation Process (Updated)

### Automated Issues (Preferred)
1. Create specification using `/create-spec`
2. Add `--auto-issues` flag to create corresponding issues
3. Review created issues for accuracy
4. Proceed with development

### Manual Issues (Exception Cases)
1. Only for urgent fixes or non-spec work
2. Follow standard template format
3. Link to relevant specifications if applicable
EOF
```

#### Step 5.2: Migrate Existing Specifications

```bash
# Find existing specifications without issues
find . -name "*.md" -path "*spec*" | while read spec; do
    if ! grep -q "Issue:" "$spec"; then
        echo "Migrating: $spec"
        /create-spec "$spec" --auto-issues
    fi
done
```

#### Step 5.3: Update Templates Based on Feedback

```yaml
# Refined templates based on pilot feedback
templates:
  feature:
    title_prefix: ""  # Team prefers no prefix
    description_template: |
      **Specification:** {spec_file}
      **Team:** {team_name}
      
      ## Description
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Definition of Done
      - [ ] Implementation completed
      - [ ] Tests written and passing
      - [ ] Code reviewed and approved
      - [ ] Documentation updated
      
      ## Team Notes
      Please review the specification file for full context and implementation details.
      
      /cc {team_lead}
    labels: ["feature", "ready-for-dev"]
    assignee: "{team_lead}"  # Auto-assign to team lead
```

### Phase 6: Optimization (Days 22-28)

#### Step 6.1: Performance Tuning

```yaml
# Optimize based on usage patterns
performance:
  max_concurrent_issues: 8  # Increase after validation
  batch_size: 5
  template_cache_enabled: true
```

#### Step 6.2: Advanced Feature Enablement

```yaml
# Enable advanced features
project_management:
  milestone_config:
    auto_create_milestones: true
    epic_milestone_pattern: "Epic: {title}"
    
  project_board_config:
    auto_create_columns: true
```

## Configuration Migration

### From Manual Templates

If you have documented manual templates:

```markdown
<!-- Old Manual Template -->
# [FEATURE] Feature Name

**Status:** Planning
**Assignee:** @developer
**Labels:** feature, needs-review

## Description
Feature description here

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Implementation Notes
- Technical considerations
- Dependencies
```

Convert to automated template:

```yaml
# New Automated Template
templates:
  feature:
    title_prefix: "[FEATURE]"
    description_template: |
      **Status:** Planning
      **Generated:** {timestamp}
      
      ## Description
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Implementation Notes
      - Follow team coding standards
      - Review technical dependencies
      - Consider performance implications
    labels: ["feature", "needs-review"]
    assignee: "@developer"
```

### From Existing Tools

#### Jira to GitHub/Linear

```yaml
# Map Jira fields to templates
templates:
  story:
    title_prefix: "[STORY]"
    description_template: |
      **Story Points:** {story_points:3}
      **Epic:** {epic_name}
      **Sprint:** {sprint_name}
      
      ## User Story
      As a {user_role}
      I want {user_need}
      So that {user_benefit}
      
      ## Description
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Definition of Done
      - [ ] Development completed
      - [ ] Unit tests > 80% coverage
      - [ ] Code reviewed
      - [ ] QA tested
      - [ ] Documentation updated
    labels: ["story", "backlog"]
    
template_variables:
  story_points: "3"
  sprint_name: "Current Sprint"
  epic_name: "Current Epic"
```

#### Asana to GitHub/Linear

```yaml
templates:
  task:
    title_prefix: ""  # Asana uses clean titles
    description_template: |
      **Project:** {project_name}
      **Due Date:** {due_date}
      **Priority:** {priority}
      
      ## Task Description
      {description}
      
      ## Subtasks
      {acceptance_criteria}
      
      ## Dependencies
      {dependencies}
      
      ## Notes
      {notes}
    labels: ["task", "{priority}"]
    
template_variables:
  project_name: "Development Project"
  due_date: "TBD"
  priority: "medium"
  dependencies: "None specified"
  notes: "Migrated from Asana"
```

## Team Training

### Training Materials

Create team-specific training materials:

```bash
# Create training directory
mkdir -p team-training

# Create quick reference
cat > team-training/QUICK_REFERENCE.md << 'EOF'
# Automatic Issue Creation - Quick Reference

## Basic Usage
```bash
# Create spec with automatic issues
/create-spec "Feature Name" --auto-issues

# Test before creating real issues
/create-spec "Feature Name" --auto-issues --dry-run
```

## Configuration Location
- Team config: `.agent-os/config/team-config.yml`
- Templates: Check team config file

## Common Issues
- Issues not created → Check `dry_run: false` in config
- Template errors → Validate YAML syntax
- MCP errors → Run `claude mcp list`

## Support
- Documentation: See `.agent-os/specs/automatic-issue-creation-spec/`
- Team lead: @team-lead
- Issues: Create ticket with "migration" label
EOF
```

### Training Session Agenda

```markdown
# Team Training: Automatic Issue Creation

## Session 1: Overview and Benefits (30 min)
- Current process pain points
- New automated workflow
- Benefits and time savings
- Demo of basic functionality

## Session 2: Hands-on Practice (45 min)
- Live demo of issue creation
- Practice with sample specifications
- Template customization
- Troubleshooting common issues

## Session 3: Advanced Features (30 min)
- Project management integration
- Notification setup
- Performance optimization
- Best practices

## Session 4: Q&A and Feedback (15 min)
- Address team questions
- Gather feedback for improvements
- Plan next steps
```

### Self-Service Resources

```bash
# Create self-service training specs
cat > team-training/TRAINING_SPEC.md << 'EOF'
# Training: User Authentication Feature

## Description
This is a training specification to practice automatic issue creation.
It demonstrates proper formatting and structure.

## Acceptance Criteria
- [ ] User can register with email and password
- [ ] User can login with valid credentials
- [ ] User receives email verification
- [ ] Invalid login attempts are handled gracefully
- [ ] Password reset functionality works

## Epic: User Management
This feature is part of the larger user management system.

## Implementation Notes
- Use bcrypt for password hashing
- Implement rate limiting for login attempts
- Follow OAuth2 standards where applicable
EOF

# Training command
echo "Practice command: /create-spec team-training/TRAINING_SPEC.md --auto-issues --dry-run"
```

## Rollback Procedures

### Emergency Rollback

If migration needs to be reversed quickly:

```bash
# Disable automatic issue creation
sed -i 's/enabled: true/enabled: false/' .agent-os/config/team-config.yml

# Restore backup configuration (if exists)
if [ -f .agent-os/config/team-config.yml.backup ]; then
    mv .agent-os/config/team-config.yml .agent-os/config/team-config.yml.failed
    mv .agent-os/config/team-config.yml.backup .agent-os/config/team-config.yml
fi

# Switch back to manual process temporarily
echo "MIGRATION ROLLBACK: Using manual issue creation until further notice" > MIGRATION_STATUS.md
```

### Partial Rollback

Return to dry-run mode while fixing issues:

```yaml
# .agent-os/config/team-config.yml
automatic_issue_creation:
  enabled: true
  dry_run: true  # Back to dry run mode
```

### Data Cleanup

If issues were created incorrectly:

```bash
# List issues created during migration
gh issue list --label "migrated" --json number,title,url

# Close incorrect issues (review first!)
gh issue list --label "migrated" --json number | jq -r '.[].number' | while read issue; do
    echo "Review issue #$issue before closing:"
    gh issue view $issue
    echo "Close? (y/N)"
    read answer
    if [ "$answer" = "y" ]; then
        gh issue close $issue --comment "Closing due to migration issue - will recreate correctly"
    fi
done
```

## Post-Migration Validation

### Success Metrics

Measure migration success:

```bash
# Count migrated issues
migrated_issues=$(gh issue list --label "migrated" --json number | jq length)
echo "Migrated issues: $migrated_issues"

# Average creation time
echo "Measuring creation time..."
time /create-spec "Performance Test" --auto-issues --dry-run

# Error rate
error_count=$(grep -c "ERROR" ~/.claude/logs/latest.log)
total_operations=$(grep -c "create-spec" ~/.claude/logs/latest.log)
error_rate=$(echo "scale=2; $error_count / $total_operations * 100" | bc)
echo "Error rate: $error_rate%"
```

### Quality Assessment

```bash
# Check issue quality
gh issue list --label "migrated" --json title,body,labels | jq '.[] | {title, label_count: (.labels | length), body_length: (.body | length)}'

# Template consistency
gh issue list --label "migrated" --json body | jq -r '.[].body' | grep -c "Generated from specification"
```

### Team Feedback Survey

```markdown
# Migration Feedback Survey

## Process Questions
1. How easy was the transition from manual to automated issue creation? (1-5)
2. Are the generated issues meeting your quality expectations? (1-5)
3. Is the time savings significant for your workflow? (1-5)

## Technical Questions
4. Have you encountered any technical issues? (Y/N, details)
5. Are the templates producing the right format for your needs? (Y/N, suggestions)
6. Is the /create-spec command intuitive to use? (Y/N, feedback)

## Open Feedback
7. What do you like most about the new process?
8. What would you change or improve?
9. Any additional features you'd like to see?

## Overall Rating
10. Overall satisfaction with the migration (1-5)
```

## Best Practices

### Gradual Feature Adoption

```markdown
## Migration Best Practices

### Week 1-2: Basic Features Only
- Simple templates
- Dry-run mode initially
- Manual review of all created issues

### Week 3-4: Intermediate Features
- Enable project board integration
- Add notification setup
- Optimize templates based on feedback

### Week 5+: Advanced Features  
- Milestone automation
- Complex template logic
- Performance optimization
```

### Template Evolution

```yaml
# Start simple
templates:
  feature:
    description_template: "{description}\n\n{acceptance_criteria}"
    
# Evolve based on feedback
templates:
  feature:
    description_template: |
      ## Overview
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
      
      ## Team Guidelines
      - Follow coding standards
      - Include unit tests
      - Update documentation
```

### Monitoring and Optimization

```bash
# Weekly optimization check
cat > weekly-optimization.sh << 'EOF'
#!/bin/bash
echo "Weekly Migration Optimization Check"
echo "=================================="

# Performance metrics
echo "Average issue creation time:"
grep "create-spec.*--auto-issues" ~/.claude/logs/latest.log | tail -10 | while read line; do
    # Would measure timing in real implementation
    echo "  ~5 seconds average"
done

# Error analysis
echo "Recent errors:"
grep ERROR ~/.claude/logs/latest.log | tail -5

# Usage statistics
echo "Issues created this week:"
gh issue list --label "migrated" --created "$(date -d '7 days ago' +%Y-%m-%d).." --json number | jq length
EOF

chmod +x weekly-optimization.sh
```

### Documentation Maintenance

```markdown
## Documentation Update Schedule

### Monthly Reviews
- Update configuration guide with new patterns
- Refresh troubleshooting guide with new issues
- Review and update templates

### Quarterly Reviews
- Assess team satisfaction
- Plan advanced feature rollouts
- Update training materials

### Annual Reviews
- Complete process evaluation
- Technology stack updates
- Best practices documentation
```

## Migration Checklist

### Pre-Migration (Complete before starting)
- [ ] Team training scheduled and completed
- [ ] Test environment setup and validated
- [ ] Backup procedures documented and tested
- [ ] Success metrics defined and baseline measured
- [ ] Rollback procedures tested
- [ ] Configuration templates created
- [ ] MCP servers installed and tested

### During Migration (Track progress)
- [ ] Phase 1: Environment setup completed
- [ ] Phase 2: Configuration migrated and tested
- [ ] Phase 3: Dry-run testing passed
- [ ] Phase 4: Pilot deployment successful
- [ ] Phase 5: Full migration completed
- [ ] Phase 6: Optimization and advanced features enabled

### Post-Migration (Validate success)
- [ ] Success metrics achieved
- [ ] Team feedback collected and positive
- [ ] Error rates within acceptable limits
- [ ] Performance targets met
- [ ] Documentation updated
- [ ] Training materials finalized
- [ ] Support procedures established

---

## Support During Migration

### Migration Support Team
- **Technical Lead**: Configuration and troubleshooting
- **Team Lead**: Process and training coordination  
- **Product Manager**: Requirements and acceptance criteria
- **DevOps**: Infrastructure and MCP server management

### Communication Plan
- **Daily Standups**: Migration progress updates during transition weeks
- **Weekly Reviews**: Success metrics and issue resolution
- **Slack Channel**: #migration-support for real-time help
- **Documentation**: Updated troubleshooting guide with migration-specific issues

### Escalation Path
1. **Self-Service**: Documentation and troubleshooting guide
2. **Team Support**: Slack channel and team lead
3. **Technical Support**: Configuration and integration issues
4. **Management**: Process and timeline concerns

---

*This migration guide ensures a smooth transition to automated issue creation while maintaining team productivity and minimizing disruption. Follow the recommended timeline and best practices for optimal results.*