# /create-spec Integration Guide: Automatic Issue Creation

> Last Updated: 2025-08-30  
> Version: 1.0.0  
> Status: Production Ready  

## Overview

This guide documents the integration of automatic issue creation functionality into the `/create-spec` command workflow. Phase 2.5 of the `/create-spec` command now automatically creates issues in GitHub/Linear when specifications are generated, eliminating manual ticket creation and ensuring perfect traceability.

## Phase 2.5: Automatic Issue Creation Integration

### Workflow Enhancement

The `/create-spec` command now includes an optional Phase 2.5 that seamlessly integrates with the existing workflow:

```
Phase 1: Requirements Gathering
Phase 2: Specification Generation
Phase 2.5: Automatic Issue Creation ← NEW
Phase 3: Validation and Review
Phase 4: Documentation Update
```

### Command Usage

#### Basic Usage (Issues Disabled)
```bash
/create-spec "Feature: User Authentication System"
```

#### Enable Automatic Issue Creation
```bash
# Enable for current command
/create-spec "Feature: User Authentication System" --auto-issues

# Configure globally
export AGENT_OS_AUTO_ISSUES=true
/create-spec "Feature: User Authentication System"
```

#### Advanced Configuration
```bash
# Specify ticketing system
/create-spec "Feature: Auth" --auto-issues --system github

# Use custom template
/create-spec "Feature: Auth" --auto-issues --template enterprise

# Dry run (show what would be created)
/create-spec "Feature: Auth" --auto-issues --dry-run
```

## Configuration

### Project Configuration

Create `.agent-os/config/team-config.yml`:

```yaml
# Team Configuration for Automatic Issue Creation
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
    default_assignee: "@dev-team"
    default_labels: ["feature", "spec-generated"]
  
  linear:
    system_type: "linear"
    team_id: "DEV"
    default_assignee: "dev-team-id"
    default_labels: ["Feature", "Auto-Generated"]

templates:
  feature:
    title_prefix: "[FEATURE]"
    description_template: |
      ## Generated from Specification
      
      **Spec File:** {spec_file}
      **Generated:** {timestamp}
      
      ## Description
      {description}
      
      ## Acceptance Criteria
      {acceptance_criteria}
    labels: ["feature", "auto-generated"]
    priority: "medium"
    
  epic:
    title_prefix: "[EPIC]"
    description_template: |
      ## Epic Overview
      
      **Specification:** {spec_file}
      **Created:** {timestamp}
      
      {description}
      
      ## Success Criteria
      {acceptance_criteria}
      
      ## Child Issues
      This epic will be broken down into smaller issues.
    labels: ["epic", "planning"]
    priority: "high"
```

### Environment Variables

```bash
# Global enable/disable
export AGENT_OS_AUTO_ISSUES=true|false

# Default system selection
export AGENT_OS_TICKETING_SYSTEM=github|linear

# Configuration path override
export AGENT_OS_CONFIG_PATH="/path/to/config"

# Template selection
export AGENT_OS_DEFAULT_TEMPLATE=feature|epic|bug
```

## Integration Details

### Phase 2.5 Execution Flow

1. **Trigger Detection**
   - Automatic when `--auto-issues` flag present
   - Checks for enabled configuration
   - Validates MCP server connectivity

2. **Specification Parsing**
   - Analyzes generated specification structure
   - Identifies epics, features, and tasks
   - Extracts acceptance criteria and metadata

3. **Issue Hierarchy Creation**
   - Creates parent issues for epics
   - Generates child issues for features/tasks
   - Establishes proper parent-child relationships

4. **Template Application**
   - Applies team-specific templates
   - Populates dynamic variables
   - Formats titles and descriptions

5. **Ticketing System Integration**
   - Creates issues via MCP servers
   - Assigns labels, priorities, assignees
   - Links issues to milestones/projects

6. **Bidirectional Linking**
   - Updates specification with issue links
   - Adds spec references to issue descriptions
   - Maintains traceability mapping

7. **Progress Reporting**
   - Real-time creation progress
   - Success/failure notifications
   - Summary report generation

### Generated Issue Format

#### Epic Issue Example
```markdown
# [EPIC] User Authentication System

## Generated from Specification

**Spec File:** user-authentication-system.md
**Generated:** 2025-08-30 10:30:00 UTC

## Description
Implement comprehensive user authentication system with OAuth2 support, 
multi-factor authentication, and role-based access control.

## Success Criteria
- [ ] Users can register with email/password
- [ ] OAuth2 integration (Google, GitHub)
- [ ] Multi-factor authentication support
- [ ] Role-based permissions system
- [ ] Session management and security

## Child Issues
- #123 - User Registration Service
- #124 - OAuth2 Integration
- #125 - MFA Implementation
- #126 - Role Management System

---
**Specification Link:** [user-authentication-system.md](./specs/user-authentication-system.md)
**Created by:** Automatic Issue Creation v1.0.0
```

#### Feature Issue Example
```markdown
# [FEATURE] User Registration Service

## Generated from Specification

**Spec File:** user-authentication-system.md
**Parent Epic:** #122 - User Authentication System
**Generated:** 2025-08-30 10:30:15 UTC

## Description
Implement user registration endpoint with email verification, 
password validation, and duplicate prevention.

## Acceptance Criteria
- [ ] POST /api/auth/register endpoint
- [ ] Email validation and uniqueness checking
- [ ] Password strength requirements enforcement
- [ ] Email verification workflow
- [ ] Rate limiting and security measures

## Implementation Notes
- Use bcrypt for password hashing
- Implement email templates for verification
- Add comprehensive input validation
- Include audit logging

---
**Epic:** #122 - User Authentication System
**Specification:** [user-authentication-system.md](./specs/user-authentication-system.md)
```

## Error Handling and Rollback

### Common Issues and Solutions

#### Configuration Errors
```bash
# Error: Missing team configuration
Solution: Create .agent-os/config/team-config.yml with required fields

# Error: Invalid YAML syntax
Solution: Validate YAML using: yq eval .agent-os/config/team-config.yml

# Error: Missing MCP server
Solution: Install GitHub/Linear MCP server and verify connectivity
```

#### API Failures
```bash
# Error: GitHub API rate limit exceeded
Solution: Configure personal access token with higher limits

# Error: Linear team not found
Solution: Verify team_id in Linear settings

# Error: Permission denied
Solution: Ensure MCP server has required permissions
```

#### Rollback Procedures
```bash
# Dry run before actual creation
/create-spec "Feature: Auth" --auto-issues --dry-run

# Manual cleanup if needed
# 1. Delete created issues from ticketing system
# 2. Remove issue links from specification file
# 3. Clean up any created milestones/projects
```

## Advanced Features

### Custom Templates

Create custom templates in your team configuration:

```yaml
templates:
  custom_feature:
    title_prefix: "[CUSTOM]"
    description_template: |
      ## Custom Template
      
      **Team:** {team_name}
      **Priority:** {priority}
      
      {description}
      
      ## Implementation Checklist
      - [ ] Design review completed
      - [ ] Security assessment done
      - [ ] Performance requirements defined
      - [ ] Test strategy documented
      
      {acceptance_criteria}
    labels: ["custom", "feature"]
    assignee: "lead-developer"
```

### Project Board Integration

Automatically add issues to project boards:

```yaml
project_management:
  github_projects:
    default_project_id: 123
    column_mapping:
      epic: "Epics"
      feature: "Features"
      bug: "Bugs"
      task: "Tasks"
  
  milestone_assignment:
    auto_create: true
    pattern: "Sprint {number}"
    due_date_offset: 14  # days
```

### Team Notifications

Configure team notifications for issue creation:

```yaml
notifications:
  slack_webhook: "https://hooks.slack.com/services/..."
  discord_webhook: "https://discord.com/api/webhooks/..."
  team_mentions:
    slack: "@dev-team"
    discord: "@developers"
  events:
    - issue_created
    - epic_completed
    - error_occurred
```

## Testing and Validation

### Testing Commands

```bash
# Test configuration validity
python3 -m automatic_issue_creator.configuration_manager validate

# Test MCP server connectivity
python3 -m automatic_issue_creator.github_integration test-connection

# Run integration tests
python3 -m automatic_issue_creator.test_integration

# Performance testing
python3 -m automatic_issue_creator.test_e2e_workflow --performance
```

### Validation Checklist

- [ ] Team configuration file is valid YAML
- [ ] MCP servers are accessible and authenticated
- [ ] Templates render correctly with test data
- [ ] Issue creation works in dry-run mode
- [ ] Rollback procedures are documented and tested

## Migration Guide

### From Manual Process

1. **Audit Current Issues**
   - Identify manually created issues
   - Document existing templates and patterns
   - Note team-specific requirements

2. **Configure Automatic System**
   - Create team configuration file
   - Set up templates matching current patterns
   - Configure MCP servers and authentication

3. **Gradual Rollout**
   - Start with dry-run mode for testing
   - Enable for new specifications only
   - Monitor and adjust templates as needed

4. **Full Migration**
   - Enable automatic creation by default
   - Update team documentation
   - Train team members on new workflow

### Best Practices

- **Start Small**: Begin with simple templates and gradually add complexity
- **Test Thoroughly**: Use dry-run mode extensively before production
- **Monitor Performance**: Watch for API rate limits and timing issues  
- **Maintain Templates**: Regularly review and update templates based on team feedback
- **Document Changes**: Keep track of configuration changes and their impacts

## Troubleshooting

### Debug Commands

```bash
# Enable debug logging
export AGENT_OS_DEBUG=true

# Check configuration loading
python3 -c "from configuration_manager import ConfigurationManager; cm = ConfigurationManager(); print(cm.load_team_config())"

# Test template rendering
python3 -c "from template_engine import TemplateEngine; te = TemplateEngine(); print(te.render_template('feature', {'title': 'Test'}))"

# Verify MCP connectivity
claude mcp list | grep -E "(github|linear)"
```

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Configuration not loaded | Issues not created, no error | Check config file path and syntax |
| Template rendering fails | Malformed issue descriptions | Validate template variables |
| MCP server timeout | Slow issue creation | Check network and server status |
| Permission denied | Issues not created, auth errors | Verify MCP server permissions |
| Rate limit exceeded | Creation fails after some issues | Implement retry logic, check limits |

## Performance Considerations

### Optimization Tips

- **Batch Operations**: Create issues in batches to reduce API calls
- **Parallel Processing**: Use async operations for multiple issues
- **Caching**: Cache template rendering for similar issues
- **Rate Limiting**: Respect API limits and implement backoff
- **Progress Reporting**: Provide real-time feedback for long operations

### Performance Metrics

- **Target**: <10 seconds for typical specification (5-10 issues)
- **Scalability**: Support up to 50 issues per specification
- **Reliability**: 99% success rate under normal conditions
- **Overhead**: <10% additional time compared to manual creation

---

## Related Documentation

- [Configuration Guide](./CONFIGURATION_GUIDE.md) - Detailed configuration options
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions
- [Migration Guide](./MIGRATION_GUIDE.md) - Upgrade from manual workflows
- [Template Reference](./TEMPLATE_REFERENCE.md) - Complete template documentation

---

*This integration enables seamless transition from specification generation to development tracking, eliminating manual overhead and ensuring perfect traceability between planning and implementation.*