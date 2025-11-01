# Troubleshooting Guide

**Version:** 1.0.0
**Last Updated:** October 31, 2025
**Status:** Production-Ready

---

## Table of Contents

1. [Command Migration Issues](#command-migration-issues)
2. [Installation Issues](#installation-issues)
3. [Agent Issues](#agent-issues)
4. [Performance Issues](#performance-issues)
5. [YAML Configuration Issues](#yaml-configuration-issues)
6. [Hook Framework Issues](#hook-framework-issues)
7. [MCP Server Issues](#mcp-server-issues)
8. [General Troubleshooting](#general-troubleshooting)

---

## Command Migration Issues

### Commands not found after migration

**Symptoms:**
- Commands not loading in Claude Code
- `/create-trd` shows "command not found"
- Command list is empty

**Diagnosis:**
```bash
# Check if ai-mesh directory exists
ls ~/.claude/commands/ai-mesh/  # Global
ls .claude/commands/ai-mesh/    # Local

# Expected: 24 files (12 commands × 2 formats)
ls -1 ~/.claude/commands/ai-mesh/ | wc -l
```

**Solution:**
```bash
# 1. Verify migration completed
ls ~/.claude/commands/ai-mesh/ | wc -l
# Expected: 24 files

# 2. If missing, check backup exists
ls ~/.claude/commands-backup-*/

# 3. Restore from backup if needed
cp -r ~/.claude/commands-backup-YYYYMMDD-HHMMSS/* ~/.claude/commands/

# 4. Re-run installation
npx @fortium/ai-mesh install --global --force

# 5. Restart Claude Code
pkill -f "Claude Code" && open -a "Claude Code"
```

### Migration failed during installation

**Symptoms:**
- Error messages during npm install or bash install
- Partial migration (some files moved, some not)
- Installation hangs or times out

**Diagnosis:**
```bash
# Check backup directory
ls -la ~/.claude/commands-backup-*/

# Check permissions
ls -la ~/.claude/commands/

# Check disk space
df -h ~/.claude/
```

**Solution:**
```bash
# 1. Check for backup directory
ls ~/.claude/commands-backup-*

# 2. Restore from backup manually
cp -r ~/.claude/commands-backup-YYYYMMDD-HHMMSS/* ~/.claude/commands/
rm -rf ~/.claude/commands/ai-mesh/  # Clean partial migration

# 3. Fix permissions if needed
chmod -R 755 ~/.claude/commands/

# 4. Re-run installation with verbose logging
DEBUG=ai-mesh:* npx @fortium/ai-mesh install --global

# 5. If still failing, use bash installer
./install.sh
```

### YAML paths not updated

**Symptoms:**
- Commands generate files in wrong location
- Files created at root instead of `ai-mesh/`
- Command execution errors

**Diagnosis:**
```bash
# Check YAML files for correct paths
cat ~/.claude/commands/yaml/create-trd.yaml | grep output_path
# Expected: output_path: "ai-mesh/create-trd.md"

# Check for any YAML files missing ai-mesh prefix
grep -r "output_path" ~/.claude/commands/yaml/ | grep -v "ai-mesh"
# Expected: No output (all should have ai-mesh/)
```

**Solution:**
```bash
# 1. Manually run YAML rewriter
cd /path/to/claude-config
node src/installer/yaml-rewriter.js ~/.claude/commands

# 2. Or re-run validation (triggers YAML rewrite)
npx @fortium/ai-mesh validate

# 3. Verify fix
grep -r "output_path" ~/.claude/commands/yaml/ | head -5

# 4. Each should show: output_path: "ai-mesh/COMMAND_NAME.md"
```

### Performance issues during migration

**Symptoms:**
- Migration takes longer than expected (>1 second for Node.js, >2 seconds for bash)
- Installation appears stuck
- High CPU or disk usage

**Diagnosis:**
```bash
# Test disk I/O performance
time ls -la ~/.claude/commands/

# Check available disk space
df -h ~/.claude/

# Monitor installation with verbose logging
DEBUG=ai-mesh:migration npx @fortium/ai-mesh install --global
```

**Solution:**
```bash
# 1. Free up disk space if needed
du -sh ~/.claude/*
# Delete unnecessary backups if space is low

# 2. Check for filesystem issues
diskutil verifyVolume /  # macOS
# Or: fsck for Linux

# 3. Use bash installer (more robust for slow systems)
./install.sh

# 4. If persistent, contact support with logs
```

---

## Installation Issues

### Installation hangs or times out

**Symptoms:**
- Installation process appears stuck
- No progress for >30 seconds
- Terminal unresponsive

**Solution:**
```bash
# 1. Cancel installation (Ctrl+C)
# 2. Check for zombie processes
ps aux | grep ai-mesh

# 3. Kill any hanging processes
pkill -f ai-mesh

# 4. Clean partial installation
rm -rf ~/.claude/agents-temp/
rm -rf ~/.claude/commands-temp/

# 5. Re-run with timeout
timeout 120s npx @fortium/ai-mesh install --global
```

### Permission denied errors

**Symptoms:**
- "EACCES: permission denied" errors
- Cannot create directories
- Cannot write files

**Solution:**
```bash
# 1. Check ownership
ls -la ~/.claude/

# 2. Fix ownership if needed
chown -R $USER:staff ~/.claude/

# 3. Fix permissions
chmod -R 755 ~/.claude/

# 4. Re-run installation
npx @fortium/ai-mesh install --global
```

### NPM package not found

**Symptoms:**
- "Package @fortium/ai-mesh not found"
- 404 errors from NPM registry

**Solution:**
```bash
# 1. Check NPM registry
npm config get registry
# Expected: https://registry.npmjs.org/

# 2. Clear NPM cache
npm cache clean --force

# 3. Verify package exists
npm view @fortium/ai-mesh

# 4. Use npx with latest version
npx @fortium/ai-mesh@latest install --global

# 5. Or clone from GitHub
git clone https://github.com/FortiumPartners/claude-config.git
cd claude-config
./install.sh
```

---

## Agent Issues

### Agent not responding or timing out

**Symptoms:**
- Agent doesn't respond to prompts
- Long delays before response
- Timeout errors

**Solution:**
```bash
# 1. Restart Claude Code
pkill -f "Claude Code" && open -a "Claude Code"

# 2. Check agent file exists
ls ~/.claude/agents/infrastructure-developer.yaml

# 3. Validate agent YAML syntax
npx js-yaml ~/.claude/agents/infrastructure-developer.yaml

# 4. Check agent file size (should be reasonable, not corrupted)
ls -lh ~/.claude/agents/infrastructure-developer.yaml

# 5. Re-install agents if needed
npx @fortium/ai-mesh install --global --force
```

### Agent using wrong tools

**Symptoms:**
- Agent attempts unauthorized operations
- Tool permission errors
- Unexpected behavior

**Solution:**
```bash
# 1. Check agent YAML for correct tool permissions
cat ~/.claude/agents/AGENT_NAME.yaml | grep "tools:"

# 2. Verify agent follows least-privilege principle
# Most agents should only have: Read, Edit, Write

# 3. Re-install agents to reset permissions
npx @fortium/ai-mesh install --global --force
```

---

## Performance Issues

### Slow command execution

**Symptoms:**
- Commands take >5 seconds to execute
- High latency in responses
- Sluggish performance

**Diagnosis:**
```bash
# 1. Time command execution
time ls ~/.claude/commands/ai-mesh/

# 2. Check system resources
top -l 1 | head -10

# 3. Check disk I/O
iostat 1 5
```

**Solution:**
```bash
# 1. Clear Claude Code cache
rm -rf ~/.claude/cache/

# 2. Restart Claude Code
pkill -f "Claude Code"

# 3. Check for background processes
ps aux | grep claude

# 4. Reduce agent count if needed (use orchestrators)
```

### High memory usage

**Symptoms:**
- Claude Code using excessive RAM
- System slowdown
- Out of memory errors

**Solution:**
```bash
# 1. Check memory usage
ps aux | grep "Claude Code" | awk '{print $4,$11}'

# 2. Reduce agent context size
# Edit agent YAML files to shorten prompts

# 3. Limit concurrent agent sessions
# Use orchestrators instead of direct agent calls

# 4. Restart Claude Code regularly
```

---

## YAML Configuration Issues

### YAML syntax errors

**Symptoms:**
- "YAML parse error" messages
- Agents or commands not loading
- Invalid configuration warnings

**Diagnosis:**
```bash
# Validate all agent YAML files
for file in ~/.claude/agents/*.yaml; do
  echo "Checking $file"
  npx js-yaml "$file" > /dev/null || echo "ERROR in $file"
done

# Validate all command YAML files
for file in ~/.claude/commands/yaml/*.yaml; do
  echo "Checking $file"
  npx js-yaml "$file" > /dev/null || echo "ERROR in $file"
done
```

**Solution:**
```bash
# 1. Identify problematic YAML file
npx js-yaml ~/.claude/agents/AGENT_NAME.yaml

# 2. Common YAML issues:
#    - Incorrect indentation (use spaces, not tabs)
#    - Missing quotes around special characters
#    - Unbalanced brackets or braces
#    - Invalid UTF-8 characters

# 3. Re-install to restore clean YAML files
npx @fortium/ai-mesh install --global --force

# 4. Or manually fix YAML syntax
# Use online YAML validator: https://www.yamllint.com/
```

### Schema validation failures

**Symptoms:**
- "Schema validation failed" errors
- Missing required fields
- Invalid field types

**Solution:**
```bash
# 1. Validate against schema
cd /path/to/claude-config
node -e "
const Ajv = require('ajv');
const fs = require('fs');
const yaml = require('js-yaml');

const ajv = new Ajv();
const schema = JSON.parse(fs.readFileSync('schemas/agent-schema.json'));
const doc = yaml.load(fs.readFileSync(process.argv[1]));

const valid = ajv.validate(schema, doc);
console.log(valid ? 'Valid' : ajv.errorsText());
" ~/.claude/agents/AGENT_NAME.yaml

# 2. Re-install to restore valid schemas
npx @fortium/ai-mesh install --global --force
```

---

## Hook Framework Issues

### Hook not executing

**Symptoms:**
- Hooks not triggering on events
- No hook output or logs
- Silent failures

**Solution:**
```bash
# Note: Hooks are NOT installed by default as of v2.8.0
# Manual installation required

# 1. Check if hooks are installed
ls ~/.claude/hooks/

# 2. Install hooks manually (if needed)
cd /path/to/claude-config
cp -r hooks/ ~/.claude/hooks/
chmod +x ~/.claude/hooks/*.js

# 3. Test hook execution
node ~/.claude/hooks/tool-metrics.js Read '{"file_path": "/tmp/test.txt"}' true

# 4. Check hook permissions
ls -la ~/.claude/hooks/*.js
# Should show: -rwxr-xr-x
```

### User profile issues

**Symptoms:**
- No activities in feed
- Wrong user attribution
- Missing authentication token

**Solution:**
```bash
# 1. Check if user profile exists
ls ~/.ai-mesh/profile/user.json

# 2. View current profile
node hooks/user-profile.js show

# 3. Reset and recreate profile
node hooks/user-profile.js reset

# 4. Verify authentication token
node hooks/get-auth-token.js
```

---

## MCP Server Issues

### MCP server not connecting

**Symptoms:**
- "MCP server unavailable" errors
- Timeout when calling MCP tools
- Connection refused errors

**Solution:**
```bash
# 1. List installed MCP servers
claude mcp list

# 2. Restart MCP server
claude mcp restart SERVER_NAME

# 3. Re-add server if needed
claude mcp remove SERVER_NAME
claude mcp add SERVER_NAME --scope user -- npx -y PACKAGE_NAME

# 4. Check server logs
ls ~/.claude/mcp-logs/
```

### Context7 authentication issues

**Solution:**
```bash
# 1. Re-authenticate with Context7
claude mcp remove context7
claude mcp add context7 --scope user -- npx -y @upstash/context7-mcp@latest

# 2. Follow OAuth flow in browser
# 3. Verify connection
# Try using Context7 in a Claude Code prompt
```

---

## General Troubleshooting

### Logs and diagnostics

**Collect diagnostic information:**
```bash
# 1. Installation validation
npx @fortium/ai-mesh validate > validation-report.txt

# 2. System information
uname -a > system-info.txt
node --version >> system-info.txt
npm --version >> system-info.txt

# 3. Installation structure
ls -la ~/.claude/ > structure.txt
du -sh ~/.claude/* >> structure.txt

# 4. Recent logs (if using hooks)
tail -100 ~/.ai-mesh/logs/metrics.log > recent-logs.txt

# 5. Compress for support
tar -czf claude-config-diagnostics.tar.gz \
  validation-report.txt \
  system-info.txt \
  structure.txt \
  recent-logs.txt
```

### Clean reinstall

**When all else fails:**
```bash
# 1. Backup important data
cp -r ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# 2. Remove installation
rm -rf ~/.claude/agents/
rm -rf ~/.claude/commands/
rm -rf ~/.claude/hooks/

# 3. Clear cache
rm -rf ~/.claude/cache/

# 4. Fresh install
npx @fortium/ai-mesh install --global --force

# 5. Restart Claude Code
pkill -f "Claude Code" && open -a "Claude Code"

# 6. Verify installation
npx @fortium/ai-mesh validate
```

### Performance benchmarks

**Expected performance targets:**

| Operation | Target | Typical | Maximum |
|-----------|--------|---------|---------|
| Command migration (Node.js) | <100ms | 10ms | 50ms |
| Command migration (Bash) | <5s | 200ms | 1s |
| YAML rewrite | <100ms | 20ms | 50ms |
| Validation | <1s | 160ms | 500ms |
| Agent load | <500ms | 100ms | 300ms |
| Hook execution | <50ms | 10ms | 25ms |

---

## Getting Help

### Before contacting support

1. ✅ Check this troubleshooting guide
2. ✅ Review [Migration Guide](migration/COMMAND_MIGRATION_GUIDE.md)
3. ✅ Run validation: `npx @fortium/ai-mesh validate`
4. ✅ Collect diagnostics (see above)
5. ✅ Check GitHub Issues for similar problems

### Support channels

- **GitHub Issues**: https://github.com/FortiumPartners/claude-config/issues
- **Documentation**: https://github.com/FortiumPartners/claude-config/blob/main/README.md
- **Fortium Customer Portal**: For licensed customers
- **Email Support**: support@fortiumsoftware.com

### When reporting issues

Please include:

1. **System information**: OS, Node.js version, NPM version
2. **Installation type**: Global or local
3. **Error messages**: Full error output
4. **Steps to reproduce**: What you did before the error
5. **Diagnostic report**: Output from validation and logs
6. **Expected vs actual**: What you expected to happen vs what actually happened

---

**Fortium Software Configuration Team**
Last Updated: October 31, 2025
Version: 1.0.0
