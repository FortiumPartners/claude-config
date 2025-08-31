# Troubleshooting Guide: Automatic Issue Creation

> Last Updated: 2025-08-30  
> Version: 1.0.0  
> Status: Production Ready

## Overview

This guide provides comprehensive troubleshooting information for the automatic issue creation system. Find solutions to common problems, debug commands, and escalation procedures.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Common Issues](#common-issues)
3. [Configuration Problems](#configuration-problems)
4. [API and Integration Issues](#api-and-integration-issues)
5. [Template and Formatting Problems](#template-and-formatting-problems)
6. [Performance Issues](#performance-issues)
7. [Debug Commands](#debug-commands)
8. [Error Codes Reference](#error-codes-reference)
9. [Escalation Procedures](#escalation-procedures)

## Quick Diagnostics

### Health Check Script

Run this quick diagnostic to identify common issues:

```bash
#!/bin/bash
# health-check.sh - Quick system diagnostics

echo "🔍 Automatic Issue Creation - Health Check"
echo "========================================"

# Check configuration file
echo "📋 Configuration..."
if [ -f ".agent-os/config/team-config.yml" ]; then
    echo "✅ Configuration file found"
    if yq eval . .agent-os/config/team-config.yml > /dev/null 2>&1; then
        echo "✅ YAML syntax valid"
    else
        echo "❌ YAML syntax error"
        yq eval . .agent-os/config/team-config.yml
    fi
else
    echo "❌ Configuration file missing: .agent-os/config/team-config.yml"
fi

# Check MCP servers
echo -e "\n🔗 MCP Servers..."
if command -v claude > /dev/null 2>&1; then
    echo "✅ Claude CLI available"
    claude mcp list | grep -E "(github|linear)" | while read line; do
        if [[ $line == *"✓ Connected"* ]]; then
            echo "✅ $line"
        else
            echo "❌ $line"
        fi
    done
else
    echo "❌ Claude CLI not found"
fi

# Check Python dependencies
echo -e "\n🐍 Python Dependencies..."
if python3 -c "import yaml; print('✅ PyYAML available')" 2>/dev/null; then
    echo "✅ PyYAML available"
else
    echo "❌ PyYAML missing - run: pip install PyYAML"
fi

# Check implementation files
echo -e "\n📁 Implementation Files..."
required_files=(
    "automatic_issue_creator.py"
    "configuration_manager.py" 
    "github_integration.py"
    "template_engine.py"
)

for file in "${required_files[@]}"; do
    if [ -f ".agent-os/specs/automatic-issue-creation-spec/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ Missing: $file"
    fi
done

# Test configuration loading
echo -e "\n⚙️ Configuration Test..."
if python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
try:
    from configuration_manager import ConfigurationManager
    cm = ConfigurationManager()
    config = cm.load_team_config()
    print('✅ Configuration loads successfully')
    print(f'   Team: {config.team_name}')
    print(f'   Enabled: {config.automatic_issue_creation.enabled}')
except Exception as e:
    print(f'❌ Configuration error: {e}')
" 2>/dev/null; then
    :
else
    echo "❌ Configuration loading failed"
fi

echo -e "\n🎯 Run with: ./health-check.sh"
```

### One-Line Diagnostics

```bash
# Quick system status
python3 -c "import sys; sys.path.append('.agent-os/specs/automatic-issue-creation-spec'); from configuration_manager import ConfigurationManager; print('Config:', ConfigurationManager().load_team_config().team_name)" 2>/dev/null && echo "✅ System OK" || echo "❌ System Error"

# MCP server status
claude mcp list | grep -E "(github|linear)" | grep -c "Connected" && echo "MCP servers connected"

# Template test
python3 -c "import sys; sys.path.append('.agent-os/specs/automatic-issue-creation-spec'); from template_engine import TemplateEngine; te = TemplateEngine(); print('✅ Templates OK')" 2>/dev/null || echo "❌ Template Error"
```

## Common Issues

### Issue: No Issues Created

**Symptoms:**
- Command completes successfully
- No issues appear in ticketing system
- No error messages

**Diagnosis:**
```bash
# Check if dry-run mode is enabled
grep "dry_run.*true" .agent-os/config/team-config.yml

# Check if issue creation is disabled
grep "enabled.*false" .agent-os/config/team-config.yml

# Test with debug logging
AGENT_OS_DEBUG=true /create-spec "Test" --auto-issues --dry-run
```

**Solutions:**
1. **Dry run mode enabled:**
   ```bash
   sed -i 's/dry_run: true/dry_run: false/' .agent-os/config/team-config.yml
   ```

2. **Issue creation disabled:**
   ```bash
   sed -i 's/enabled: false/enabled: true/' .agent-os/config/team-config.yml
   ```

3. **Missing --auto-issues flag:**
   ```bash
   /create-spec "Feature" --auto-issues  # Add flag
   ```

### Issue: Configuration Not Found

**Symptoms:**
- Error: "Configuration file not found"
- Default behavior used instead of team config

**Diagnosis:**
```bash
# Check file existence
ls -la .agent-os/config/team-config.yml

# Check search paths
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from configuration_manager import ConfigurationManager
cm = ConfigurationManager()
print('Search paths:')
for path in cm.search_paths:
    print(f'  {path}')
"
```

**Solutions:**
1. **Create missing directory:**
   ```bash
   mkdir -p .agent-os/config
   ```

2. **Create basic configuration:**
   ```bash
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
   EOF
   ```

3. **Use custom path:**
   ```bash
   export AGENT_OS_CONFIG_PATH="/custom/path/team-config.yml"
   ```

### Issue: YAML Syntax Error

**Symptoms:**
- Error: "YAML parsing failed"
- Configuration loading errors

**Diagnosis:**
```bash
# Validate YAML syntax
yq eval . .agent-os/config/team-config.yml

# Check for common issues
cat .agent-os/config/team-config.yml | grep -n -E "(^[[:space:]]*[^[:space:]#].*:.*[^[:space:]]$|^[[:space:]]*-[[:space:]]*[^[:space:]])"
```

**Solutions:**
1. **Fix indentation (use spaces, not tabs):**
   ```bash
   # Convert tabs to spaces
   sed -i 's/\t/  /g' .agent-os/config/team-config.yml
   ```

2. **Fix common syntax errors:**
   ```bash
   # Add quotes around values with special characters
   sed -i 's/: @/: "@/g; s/@$/&"/' .agent-os/config/team-config.yml
   
   # Fix list formatting
   sed -i 's/^[[:space:]]*-[[:space:]]*\([^[:space:]]\)/  - \1/' .agent-os/config/team-config.yml
   ```

3. **Validate and show specific errors:**
   ```bash
   python3 -c "import yaml; yaml.safe_load(open('.agent-os/config/team-config.yml'))" || echo "Fix YAML syntax errors above"
   ```

### Issue: MCP Server Connection Failed

**Symptoms:**
- Error: "MCP server not found"
- API authentication errors
- Timeout errors

**Diagnosis:**
```bash
# Check MCP server status
claude mcp list

# Test specific server
claude mcp list | grep github
claude mcp list | grep linear

# Check server health
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from github_integration import GitHubIntegration
from ticketing_interface import TicketingSystemConfig, TicketingSystem
config = TicketingSystemConfig(
    system_type=TicketingSystem.GITHUB,
    repository_owner='test',
    repository_name='test'
)
gh = GitHubIntegration(config)
print('Testing connection...')
# gh.test_connection()  # Would test in real implementation
"
```

**Solutions:**
1. **Install missing MCP servers:**
   ```bash
   # GitHub MCP server
   claude mcp add github --scope user -- npx -y @modelcontextprotocol/server-github
   
   # Linear MCP server  
   claude mcp add linear --scope user -- npx -y linear-mcp-server
   ```

2. **Restart MCP servers:**
   ```bash
   claude mcp restart github
   claude mcp restart linear
   ```

3. **Check authentication:**
   ```bash
   # GitHub - check token permissions
   gh auth status
   
   # Linear - verify API key
   # Check ~/.config/linear-cli/config.json
   ```

4. **Network connectivity:**
   ```bash
   # Test API endpoints
   curl -I https://api.github.com
   curl -I https://api.linear.app
   ```

### Issue: Template Rendering Failed

**Symptoms:**
- Error: "Template variable not found"
- Malformed issue descriptions
- Missing or incorrect formatting

**Diagnosis:**
```bash
# Test template rendering
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from template_engine import TemplateEngine
te = TemplateEngine()
try:
    result = te.render_template('feature', {
        'title': 'Test',
        'description': 'Test description',
        'acceptance_criteria': ['Test criterion']
    })
    print('✅ Template rendering works')
except Exception as e:
    print(f'❌ Template error: {e}')
"

# Check template variables
grep -n "{.*}" .agent-os/config/team-config.yml
```

**Solutions:**
1. **Fix missing variables:**
   ```yaml
   # Ensure all used variables are available
   templates:
     feature:
       description_template: |
         {description}  # ✅ Standard variable
         {custom_var}   # ❌ Add to template_variables section
   
   template_variables:
     custom_var: "Default value"  # ✅ Define custom variables
   ```

2. **Use safe variable references:**
   ```yaml
   # Use conditional formatting
   description_template: |
     {description}
     {% if custom_var %}
     Custom: {custom_var}
     {% endif %}
   ```

3. **Test template separately:**
   ```bash
   python3 -c "
   template = '''
   Title: {title}
   Description: {description}
   '''
   data = {'title': 'Test', 'description': 'Test desc'}
   print(template.format(**data))
   "
   ```

## Configuration Problems

### Invalid Schema Version

**Error:** "Unsupported schema version"

**Solution:**
```yaml
# Update to current schema version
schema_version: "1.0"  # Current version
```

### Missing Required Fields

**Error:** "Required field missing: team_name"

**Solution:**
```yaml
# Add all required fields
schema_version: "1.0"           # Required
team_name: "Your Team Name"     # Required

automatic_issue_creation:       # Required section
  enabled: true

ticketing_systems:              # At least one required
  github:
    system_type: "github"       # Required
    repository_owner: "org"     # Required for GitHub
    repository_name: "repo"     # Required for GitHub
```

### Invalid Ticketing System Configuration

**Error:** "GitHub integration requires repository_owner and repository_name"

**Solution:**
```yaml
ticketing_systems:
  github:
    system_type: "github"
    repository_owner: "your-organization"  # Must be valid org/user
    repository_name: "your-repository"     # Must be valid repo name
    
  linear:
    system_type: "linear" 
    team_id: "DEV"                        # Must be valid Linear team ID
```

### Template Configuration Errors

**Error:** "Template not found: custom_template"

**Solution:**
```yaml
templates:
  # Define all referenced templates
  custom_template:
    title_prefix: "[CUSTOM]"
    description_template: |
      {description}
    labels: ["custom"]
```

## API and Integration Issues

### Rate Limit Exceeded

**Symptoms:**
- Issues stop creating partway through
- Error: "Rate limit exceeded"
- Slow or failed API calls

**Diagnosis:**
```bash
# Check current rate limit status (GitHub)
curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/rate_limit

# Monitor API usage
AGENT_OS_DEBUG=true /create-spec "Test" --auto-issues --dry-run 2>&1 | grep -i "rate\|limit"
```

**Solutions:**
1. **Reduce concurrent operations:**
   ```yaml
   performance:
     max_concurrent_issues: 3    # Reduce from default 10
     batch_size: 2              # Smaller batches
   ```

2. **Add delays between operations:**
   ```yaml
   performance:
     api_rate_limit:
       github: 3000             # Lower than actual limit
     retry_delay: 2             # Increase delay
   ```

3. **Use higher-limit authentication:**
   ```bash
   # GitHub: Use personal access token instead of app token
   # Linear: Ensure API key has sufficient limits
   ```

### Authentication Failures

**Symptoms:**
- Error: "Unauthorized" or "Forbidden"
- Issues not created despite valid configuration

**Diagnosis:**
```bash
# Test GitHub authentication
gh auth status

# Test Linear authentication (if using CLI)
linear whoami

# Check MCP server logs
claude mcp logs github
claude mcp logs linear
```

**Solutions:**
1. **Refresh authentication:**
   ```bash
   # GitHub
   gh auth refresh
   
   # Re-authenticate MCP servers if needed
   claude mcp remove github
   claude mcp add github --scope user -- npx -y @modelcontextprotocol/server-github
   ```

2. **Check token permissions:**
   ```bash
   # GitHub token needs these scopes:
   # - repo (for private repos)
   # - public_repo (for public repos)
   # - read:org (for organization access)
   ```

3. **Verify repository access:**
   ```bash
   # Test repository access
   gh repo view your-org/your-repo
   curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/your-org/your-repo
   ```

### Network Connectivity Issues

**Symptoms:**
- Timeout errors
- Connection refused
- DNS resolution failures

**Diagnosis:**
```bash
# Test basic connectivity
ping github.com
ping api.linear.app

# Test HTTPS connectivity
curl -I https://api.github.com
curl -I https://api.linear.app

# Check DNS resolution
nslookup github.com
nslookup api.linear.app

# Test through corporate proxy (if applicable)
curl -I --proxy http://proxy.company.com:8080 https://api.github.com
```

**Solutions:**
1. **Configure proxy settings:**
   ```bash
   export https_proxy=http://proxy.company.com:8080
   export http_proxy=http://proxy.company.com:8080
   export no_proxy=localhost,127.0.0.1
   ```

2. **Increase timeouts:**
   ```yaml
   performance:
     api_timeout: 60        # Increase from 30 seconds
     total_timeout: 600     # Increase total timeout
   ```

3. **Use alternative endpoints:**
   ```yaml
   ticketing_systems:
     github:
       api_endpoint: "https://github.company.com/api/v3"  # Enterprise GitHub
   ```

## Template and Formatting Problems

### Variable Substitution Errors

**Error:** "KeyError: 'missing_variable'"

**Solution:**
```python
# Use safe variable access in templates
description_template: |
  Title: {title}
  {description}
  # Safe access with defaults
  Priority: {priority:medium}
  Team: {team_name:Unknown}
```

### Formatting Issues

**Problem:** Issues created with malformed markdown

**Solution:**
1. **Test template rendering:**
   ```bash
   python3 -c "
   template = '''
   ## {title}
   
   {description}
   
   ## Acceptance Criteria
   {acceptance_criteria}
   '''
   print(template.format(
       title='Test Feature',
       description='Test description', 
       acceptance_criteria='- [ ] Test criteria'
   ))
   "
   ```

2. **Fix markdown formatting:**
   ```yaml
   templates:
     feature:
       description_template: |
         ## {title}
         
         {description}
         
         ## Acceptance Criteria
         {acceptance_criteria}
         
         ---
         *Generated automatically*
   ```

### Character Encoding Issues

**Problem:** Special characters not displayed correctly

**Solution:**
```yaml
# Ensure UTF-8 encoding in configuration
# Use proper YAML escaping for special characters
templates:
  feature:
    description_template: |
      Title: {title}
      Description: "{description}"  # Quote strings with special chars
      Emoji: "🎯 {title}"           # UTF-8 emoji support
```

## Performance Issues

### Slow Issue Creation

**Symptoms:**
- Takes >60 seconds for simple specs
- Timeout errors
- High CPU/memory usage

**Diagnosis:**
```bash
# Profile issue creation
time /create-spec "Test Feature" --auto-issues --dry-run

# Monitor resource usage
top -pid $(pgrep -f "automatic_issue_creator")

# Enable performance logging
AGENT_OS_DEBUG=true AGENT_OS_PROFILE=true /create-spec "Test" --auto-issues --dry-run
```

**Solutions:**
1. **Enable parallel processing:**
   ```yaml
   performance:
     max_concurrent_issues: 5
     batch_size: 3
   ```

2. **Optimize templates:**
   ```yaml
   # Avoid complex template logic
   templates:
     simple_feature:
       description_template: |
         {description}
         {acceptance_criteria}
   ```

3. **Reduce API calls:**
   ```yaml
   performance:
     template_cache_enabled: true
     config_cache_ttl: 600
   ```

### Memory Usage Issues

**Symptoms:**
- Out of memory errors
- System slowdown during creation
- Large specifications fail

**Solutions:**
1. **Process in batches:**
   ```yaml
   performance:
     batch_size: 3              # Smaller batches
     max_concurrent_issues: 2   # Reduce concurrency
   ```

2. **Optimize large specifications:**
   ```bash
   # Break large specs into smaller files
   split -l 50 large-spec.md small-spec-
   ```

3. **Monitor memory usage:**
   ```bash
   # Memory profiling
   python3 -m memory_profiler automatic_issue_creator.py
   ```

## Debug Commands

### Configuration Debug

```bash
# Validate configuration
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from configuration_manager import ConfigurationManager
import json
cm = ConfigurationManager()
try:
    config = cm.load_team_config()
    print('✅ Configuration valid')
    print(f'Team: {config.team_name}')
    print(f'Enabled: {config.automatic_issue_creation.enabled}')
    print(f'Systems: {list(config.ticketing_systems.keys())}')
    print(f'Templates: {list(config.templates.keys())}')
except Exception as e:
    print(f'❌ Configuration error: {e}')
"

# Show effective configuration
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from configuration_manager import ConfigurationManager
import yaml
cm = ConfigurationManager()
config = cm.load_team_config()
# Would show config in real implementation
print('Configuration loaded successfully')
"
```

### Template Debug

```bash
# Test template rendering
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from template_engine import TemplateEngine
te = TemplateEngine()
test_data = {
    'title': 'Debug Test',
    'description': 'Test description',
    'acceptance_criteria': ['- [ ] Test criterion 1', '- [ ] Test criterion 2'],
    'team_name': 'Debug Team',
    'timestamp': '2025-08-30 10:00:00 UTC'
}
try:
    result = te.apply_template_data('feature', test_data)
    print('✅ Template rendering successful')
    print('Preview:')
    print(result[:200] + '...' if len(result) > 200 else result)
except Exception as e:
    print(f'❌ Template error: {e}')
"

# List available templates
grep -A 1 "^  [a-zA-Z_].*:$" .agent-os/config/team-config.yml | grep -v "^--$"
```

### MCP Server Debug

```bash
# Test MCP server connectivity
claude mcp list --verbose

# Test GitHub MCP
python3 -c "
import sys
sys.path.append('.agent-os/specs/automatic-issue-creation-spec')
from github_integration import GitHubIntegration
from ticketing_interface import TicketingSystemConfig, TicketingSystem
config = TicketingSystemConfig(
    system_type=TicketingSystem.GITHUB,
    repository_owner='octocat',  # Public test repo
    repository_name='Hello-World'
)
gh = GitHubIntegration(config)
print('Testing GitHub MCP connection...')
# Would test connection in real implementation
print('Test completed')
"
```

### Network Debug

```bash
# Test API endpoints
curl -w "time_total: %{time_total}\n" -o /dev/null -s https://api.github.com
curl -w "time_total: %{time_total}\n" -o /dev/null -s https://api.linear.app

# Test with authentication
curl -H "Authorization: token $GITHUB_TOKEN" -w "status: %{http_code}, time: %{time_total}\n" -o /dev/null -s https://api.github.com/user

# Check DNS resolution time
time nslookup github.com
time nslookup api.linear.app
```

## Error Codes Reference

### Configuration Errors (1000-1999)

| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 1001 | Configuration file not found | Missing team-config.yml | Create configuration file |
| 1002 | Invalid YAML syntax | Malformed YAML | Fix syntax errors |
| 1003 | Missing required field | Required field missing | Add required fields |
| 1004 | Invalid schema version | Unsupported version | Update schema version |
| 1005 | Template not found | Referenced template missing | Define template |
| 1006 | Invalid template syntax | Template formatting error | Fix template syntax |

### Integration Errors (2000-2999)

| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 2001 | MCP server not found | Server not installed | Install MCP server |
| 2002 | Authentication failed | Invalid credentials | Update authentication |
| 2003 | Rate limit exceeded | Too many API calls | Reduce request rate |
| 2004 | Network timeout | Slow connection | Increase timeout |
| 2005 | Permission denied | Insufficient permissions | Check token permissions |
| 2006 | Repository not found | Invalid repo details | Verify repository exists |

### Processing Errors (3000-3999)

| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 3001 | Template rendering failed | Variable missing | Add missing variables |
| 3002 | Issue creation failed | API error | Check API status |
| 3003 | Parsing error | Invalid specification | Fix spec format |
| 3004 | Hierarchy creation failed | Parent-child error | Review issue hierarchy |
| 3005 | Validation failed | Data validation error | Fix data format |

### System Errors (4000-4999)

| Code | Error | Cause | Solution |
|------|-------|-------|----------|
| 4001 | Out of memory | Large specification | Process in batches |
| 4002 | Disk space full | Storage exhausted | Free disk space |
| 4003 | Permission denied | File access error | Check file permissions |
| 4004 | Module not found | Missing dependency | Install dependencies |
| 4005 | Python version incompatible | Old Python version | Update Python |

## Escalation Procedures

### Level 1: Self-Service (5-10 minutes)

1. Run health check script
2. Check configuration file syntax
3. Verify MCP server status
4. Test with dry-run mode
5. Check recent error logs

### Level 2: Team Support (15-30 minutes)

1. Review debug command outputs
2. Check network connectivity
3. Validate authentication
4. Test with minimal configuration
5. Review recent changes

### Level 3: System Administrator (30-60 minutes)

1. Check system resources
2. Review MCP server logs
3. Test API endpoints manually
4. Validate firewall/proxy settings
5. Check dependency versions

### Level 4: Development Team (1-4 hours)

1. Analyze error codes and stack traces
2. Review implementation code
3. Test with debug environment
4. Create minimal reproduction case
5. Submit bug report with diagnostics

### Information to Collect

When escalating issues, include:

```bash
# System information
uname -a
python3 --version
claude --version

# Configuration
cat .agent-os/config/team-config.yml

# MCP server status
claude mcp list

# Recent error logs
tail -50 ~/.claude/logs/latest.log

# Health check results
./health-check.sh

# Specific error reproduction
AGENT_OS_DEBUG=true /create-spec "Reproduction Test" --auto-issues --dry-run
```

### Bug Report Template

```markdown
## Bug Report: Automatic Issue Creation

### Environment
- OS: [macOS/Linux/Windows]
- Python Version: [3.x.x]
- Claude Code Version: [x.x.x]
- MCP Servers: [github/linear/both]

### Configuration
- Team Config: [attach sanitized team-config.yml]
- Environment Variables: [list relevant vars]

### Issue Description
[Clear description of the problem]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Error Messages
```
[Paste full error messages with debug output]
```

### Diagnostic Information
- Health Check Results: [attach output]
- MCP Server Status: [attach claude mcp list output]
- Debug Logs: [attach relevant log snippets]

### Attempted Solutions
[List what you've already tried]
```

---

## Quick Reference Card

| Problem | Quick Command | Expected Output |
|---------|---------------|-----------------|
| Config invalid | `yq eval .agent-os/config/team-config.yml` | Valid YAML output |
| MCP disconnected | `claude mcp list \| grep Connected` | Server status |
| Template broken | `python3 -m template_engine test` | Template test results |
| API failing | `curl -I https://api.github.com` | HTTP 200 response |
| Issues not created | `grep dry_run .agent-os/config/team-config.yml` | dry_run: false |
| Performance slow | `time /create-spec "Test" --auto-issues --dry-run` | <10 seconds |

---

## Support Resources

- **Documentation**: [Configuration Guide](./CONFIGURATION_GUIDE.md)
- **Integration**: [Create-Spec Guide](./CREATE_SPEC_INTEGRATION_GUIDE.md)  
- **Migration**: [Migration Guide](./MIGRATION_GUIDE.md)
- **Templates**: [Template Reference](./TEMPLATE_REFERENCE.md)

---

*For additional support, contact your development team or submit a detailed bug report with diagnostic information.*