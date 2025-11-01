# Command Directory Migration - Troubleshooting Guide

**Version:** 1.0.0
**Last Updated:** October 29, 2025
**Related TRD:** [Command Directory Reorganization](../TRD/command-directory-reorganization-trd.md)

---

## Table of Contents

1. [Quick Diagnostic](#quick-diagnostic)
2. [Common Issues](#common-issues)
3. [Error Messages](#error-messages)
4. [Performance Issues](#performance-issues)
5. [Command Resolution Problems](#command-resolution-problems)
6. [Rollback Issues](#rollback-issues)
7. [Advanced Troubleshooting](#advanced-troubleshooting)
8. [Getting Help](#getting-help)

---

## Quick Diagnostic

### Run Diagnostic Check

```bash
# Quick health check
npx @fortium/ai-mesh validate

# Expected output:
# ✅ Directory structure: Valid
# ✅ Command files: 11 found
# ✅ YAML sources: 11 valid
# ✅ Command resolution: All passing
```

### Check Migration Status

```bash
# Verify migration state
ls -la ~/.claude/commands/

# If migrated, you should see:
# - ai-mesh/ directory with commands
# - No loose command files in root

# If not migrated, you should see:
# - Command files in root directory
# - No ai-mesh/ directory
```

---

## Common Issues

### Issue 1: Migration Fails Immediately

**Symptoms:**
- Migration exits with error before starting
- No backup created
- No files moved

**Possible Causes:**

1. **Insufficient Permissions**
   ```bash
   # Check permissions
   ls -la ~/.claude/commands/

   # Fix: Update ownership
   sudo chown -R $(whoami):staff ~/.claude/

   # Fix: Update permissions
   chmod -R 755 ~/.claude/commands/
   ```

2. **Claude Code Running**
   ```bash
   # Check for active processes
   ps aux | grep -i claude

   # Fix: Close all Claude Code windows
   pkill -f "claude.*code"
   ```

3. **Corrupted Package**
   ```bash
   # Reinstall package
   npm cache clean --force
   npx @fortium/ai-mesh@latest install
   ```

### Issue 2: Partial Migration Completed

**Symptoms:**
- Some files migrated, others remain in root
- Mixed directory structure
- Warning messages during migration

**Diagnosis:**
```bash
# Check what's in root vs ai-mesh/
echo "Root files:"
ls ~/.claude/commands/*.yaml 2>/dev/null | wc -l

echo "AI-mesh files:"
ls ~/.claude/commands/ai-mesh/ 2>/dev/null | wc -l
```

**Solutions:**

**Option A: Complete Migration Manually**
```bash
cd ~/.claude/commands

# Move remaining ai-mesh commands
for file in create-trd implement-trd fold-prompt plan-product; do
  if [ -f "$file" ]; then
    mv "$file" ai-mesh/
    echo "Moved: $file"
  fi
done
```

**Option B: Rollback and Retry**
```bash
# Restore original state
npx @fortium/ai-mesh rollback

# Retry migration with debug mode
npx @fortium/ai-mesh install --debug
```

### Issue 3: Commands Not Found After Migration

**Symptoms:**
- `/create-trd` not recognized
- "Unknown command" errors
- Commands worked before migration

**Solutions:**

1. **Restart Claude Code**
   ```bash
   # Close all windows
   pkill -f "claude.*code"

   # Restart and test
   claude code
   # Try: /create-trd
   ```

2. **Verify Directory Structure**
   ```bash
   # Check ai-mesh directory exists
   ls -la ~/.claude/commands/ai-mesh/

   # Verify command files present
   ls ~/.claude/commands/ai-mesh/create-trd
   ```

3. **Check File Permissions**
   ```bash
   # Files must be readable
   chmod 644 ~/.claude/commands/ai-mesh/*
   chmod 755 ~/.claude/commands/ai-mesh/
   ```

### Issue 4: YAML Syntax Errors

**Symptoms:**
- Migration completes but validation fails
- YAML parsing errors in logs
- Commands load but behave incorrectly

**Diagnosis:**
```bash
# Find YAML files with syntax errors
find ~/.claude -name "*.yaml" -exec yamllint {} \; 2>&1 | grep -i error
```

**Solutions:**

1. **Restore from Backup**
   ```bash
   # Restore YAML files from backup
   BACKUP_DIR=$(ls -td ~/.claude/commands.backup.*/ | head -1)
   cp "$BACKUP_DIR"commands/*.yaml commands/
   ```

2. **Fix Manually**
   ```bash
   # Open problematic YAML file
   nano ~/.claude/commands/ai-mesh/create-trd.yaml

   # Common issues to fix:
   # - Incorrect indentation (use 2 spaces)
   # - Missing quotes around paths with spaces
   # - Unclosed strings or lists
   ```

### Issue 5: Backup Not Created

**Symptoms:**
- No backup directory exists
- Cannot rollback
- Migration completed without backup

**Solutions:**

1. **Create Manual Backup Now**
   ```bash
   cd ~/.claude
   timestamp=$(date +%Y-%m-%d-%H-%M-%S)
   cp -R commands/ "commands.backup.$timestamp/"
   echo "Backup created: commands.backup.$timestamp/"
   ```

2. **Enable Backup for Future Migrations**
   ```bash
   # Verify backup setting
   cat ~/.ai-mesh/config.json | grep createBackup

   # Should show: "createBackup": true
   ```

---

## Error Messages

### Error: EACCES: permission denied

**Full Error:**
```
❌ Error: EACCES: permission denied, open '~/.claude/commands/ai-mesh/create-trd'
```

**Cause:** Insufficient file permissions

**Solution:**
```bash
# Fix permissions
chmod -R 755 ~/.claude/commands/
sudo chown -R $(whoami):staff ~/.claude/

# Retry migration
npx @fortium/ai-mesh install
```

### Error: ENOSPC: no space left on device

**Full Error:**
```
❌ Error: ENOSPC: no space left on device, write
```

**Cause:** Insufficient disk space

**Solution:**
```bash
# Check available space
df -h ~/.claude

# Free up space (examples):
# - Empty trash
# - Delete old backups: rm -rf ~/.claude/commands.backup.old/
# - Clear npm cache: npm cache clean --force

# Retry migration
npx @fortium/ai-mesh install
```

### Error: YAML parsing failed

**Full Error:**
```
❌ Error: YAML parsing failed: bad indentation of a mapping entry at line 15
```

**Cause:** Invalid YAML syntax in source file

**Solution:**
```bash
# Identify problematic file
npx @fortium/ai-mesh validate --verbose

# Fix YAML syntax
nano commands/problematic-command.yaml

# Validate fix
yamllint commands/problematic-command.yaml
```

### Error: Backup restoration failed

**Full Error:**
```
❌ Error: Backup restoration failed: source backup directory not found
```

**Cause:** Backup directory missing or corrupted

**Solution:**
```bash
# List available backups
ls -la ~/.claude/commands.backup.*/

# If no backups exist, reinstall
npx @fortium/ai-mesh install --force

# This will regenerate all command files
```

---

## Performance Issues

### Issue: Migration Takes Too Long

**Symptoms:**
- Migration hangs or takes >30 seconds
- Progress bar stuck
- System becomes unresponsive

**Solutions:**

1. **Check for File Locks**
   ```bash
   # Find processes using command files
   lsof ~/.claude/commands/

   # Kill locking processes
   pkill -f "claude.*code"
   ```

2. **Disable Antivirus Temporarily**
   - Real-time scanning can slow file operations
   - Add `~/.claude/` to antivirus exclusions

3. **Check Network File System**
   ```bash
   # If ~/.claude is on network drive, migration may be slow
   # Solution: Move to local disk
   rsync -av ~/.claude/ ~/local-claude/
   export CLAUDE_CONFIG_DIR=~/local-claude/
   ```

### Issue: High CPU Usage During Migration

**Symptoms:**
- CPU usage spikes to 100%
- System fans running loud
- Other apps slow down

**Solutions:**

1. **Close Unnecessary Apps**
   - Free up system resources
   - Pause intensive background tasks

2. **Run Migration During Low Activity**
   ```bash
   # Schedule for off-peak time
   at 2am <<EOF
   npx @fortium/ai-mesh install
   EOF
   ```

---

## Command Resolution Problems

### Issue: Commands Resolve to Wrong Files

**Symptoms:**
- `/create-trd` executes different command
- Command behavior changed after migration
- Multiple versions of same command

**Diagnosis:**
```bash
# Find duplicate commands
find ~/.claude/commands -name "create-trd*"

# Expected: Only ~/.claude/commands/ai-mesh/create-trd
# Problem: Multiple files found
```

**Solution:**
```bash
# Remove duplicates from root
cd ~/.claude/commands
rm -f create-trd  # Keep only ai-mesh/create-trd

# Verify only one exists
find . -name "create-trd*"
```

### Issue: Custom Commands Stop Working

**Symptoms:**
- Custom commands not found
- Third-party commands missing
- Commands without metadata headers broken

**Cause:** Custom commands accidentally migrated

**Solution:**
```bash
# Custom commands should stay in root directory
# Move them back from ai-mesh/
cd ~/.claude/commands
mv ai-mesh/custom-command ./

# Verify custom commands don't have @ai-mesh-command header
head -n 5 custom-command
```

---

## Rollback Issues

### Issue: Rollback Fails to Restore Files

**Symptoms:**
- Rollback completes but files missing
- Error during rollback process
- Commands still in ai-mesh/ after rollback

**Solutions:**

1. **Manual Rollback**
   ```bash
   # Identify latest backup
   BACKUP=$(ls -td ~/.claude/commands.backup.*/ | head -1)

   # Remove current commands
   rm -rf ~/.claude/commands/*

   # Restore from backup
   cp -R "$BACKUP"* ~/.claude/commands/

   # Verify
   ls ~/.claude/commands/
   ```

2. **Force Reinstall**
   ```bash
   # Nuclear option: Reinstall from package
   rm -rf ~/.claude/commands/
   npx @fortium/ai-mesh install --force
   ```

### Issue: Multiple Backups, Unsure Which to Restore

**Symptoms:**
- Several backup directories exist
- Unclear which is correct
- Different file counts in each

**Solution:**
```bash
# Compare backup directories
for dir in ~/.claude/commands.backup.*/; do
  echo "Backup: $dir"
  echo "  Files: $(ls -1 "$dir" | wc -l)"
  echo "  Date: $(stat -f %Sm -t '%Y-%m-%d %H:%M:%S' "$dir")"
  echo "  Size: $(du -sh "$dir" | cut -f1)"
  echo ""
done

# Restore from most recent with correct file count (12 files expected)
BACKUP=$(ls -td ~/.claude/commands.backup.*/ | head -1)
npx @fortium/ai-mesh rollback --backup="$(basename $BACKUP)"
```

---

## Advanced Troubleshooting

### Enable Debug Logging

```bash
# Run with maximum verbosity
DEBUG=* npx @fortium/ai-mesh install --debug 2>&1 | tee migration-debug.log

# Analyze log for issues
grep -i "error\|fail\|warn" migration-debug.log
```

### Check System Compatibility

```bash
# Verify Node.js version
node --version  # Should be >=18.0.0

# Verify npm version
npm --version  # Should be >=9.0.0

# Check file system type
df -T ~/.claude  # APFS, ext4, etc.

# Check OS version
uname -a  # macOS, Linux, etc.
```

### Inspect Package Installation

```bash
# Verify package integrity
npm list @fortium/ai-mesh

# Check for corrupted installation
npm cache verify

# Reinstall if needed
npm cache clean --force
npm install -g @fortium/ai-mesh
```

### Test Migration in Isolation

```bash
# Create test environment
mkdir -p /tmp/test-migration/commands
cp -R ~/.claude/commands/* /tmp/test-migration/commands/

# Run migration on test copy
npx @fortium/ai-mesh install --target=/tmp/test-migration --dry-run

# If successful, apply to real directory
npx @fortium/ai-mesh install
```

---

## Getting Help

### Before Requesting Support

1. **Collect Information:**
   ```bash
   # System info
   uname -a > ~/migration-support.txt
   node --version >> ~/migration-support.txt
   npm --version >> ~/migration-support.txt

   # Package info
   npm list @fortium/ai-mesh >> ~/migration-support.txt

   # Error logs
   cat ~/.ai-mesh/logs/migration.log >> ~/migration-support.txt

   # Directory state
   ls -laR ~/.claude/commands/ >> ~/migration-support.txt
   ```

2. **Try Solutions in This Guide**
3. **Run Diagnostic Check**
   ```bash
   npx @fortium/ai-mesh validate --verbose
   ```

### Support Channels

1. **GitHub Issues**: [Report a bug](https://github.com/FortiumPartners/claude-config/issues/new)
   - Include output from steps above
   - Describe what you were doing when issue occurred
   - Mention if you've tried rollback

2. **Community Slack**: #claude-config-support
   - For questions and discussions
   - Search existing threads first

3. **Documentation**: Review these guides:
   - [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
   - [Dry-Run Mode Guide](./DRY_RUN_GUIDE.md)
   - [TRD - Technical Requirements](../TRD/command-directory-reorganization-trd.md)

---

## Prevention Tips

### Before Migration

- ✅ Run dry-run mode first
- ✅ Close Claude Code completely
- ✅ Ensure adequate disk space (>100MB free)
- ✅ Back up custom commands separately
- ✅ Note current command count for validation

### During Migration

- ✅ Don't interrupt the process
- ✅ Monitor output for warnings
- ✅ Note any error messages
- ✅ Watch progress bar completion

### After Migration

- ✅ Test key commands immediately
- ✅ Verify file count matches expectations
- ✅ Keep backup directory for 30 days
- ✅ Document any issues for team awareness

---

## Version History

- **v1.0.0** (2025-10-29): Initial troubleshooting guide
  - Common issues and solutions
  - Error message reference
  - Performance troubleshooting
  - Command resolution problems
  - Rollback troubleshooting
  - Advanced diagnostic procedures

---

**Related Documentation:**
- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Dry-Run Mode Guide](./DRY_RUN_GUIDE.md)
- [Command Directory Reorganization TRD](../TRD/command-directory-reorganization-trd.md)
