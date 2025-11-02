# Command Directory Migration - Rollback Procedures

**Version:** 1.0.0
**Last Updated:** October 29, 2025
**Related TRD:** [Command Directory Reorganization](../TRD/command-directory-reorganization-trd.md)

---

## Table of Contents

1. [Overview](#overview)
2. [When to Rollback](#when-to-rollback)
3. [Automatic Rollback](#automatic-rollback)
4. [Manual Rollback](#manual-rollback)
5. [Validation After Rollback](#validation-after-rollback)
6. [Emergency Recovery](#emergency-recovery)
7. [Prevention Best Practices](#prevention-best-practices)

---

## Overview

The command directory migration system includes comprehensive rollback capabilities to ensure safe recovery from failed or problematic migrations. This document provides step-by-step procedures for both automatic and manual rollback operations.

### Rollback Capabilities

- **Automatic Rollback**: Triggered on critical migration failures
- **Manual Rollback**: User-initiated restoration from backup
- **Partial Rollback**: Selective file restoration
- **Validation**: Post-rollback verification of system state

### Backup System

All migrations create rolling backups before making changes:

- **Backup Location**: `~/.claude/commands.backup.{timestamp}/`
- **Backup Contents**: All files from source directory before migration
- **Retention**: Latest 5 backups retained automatically
- **Naming Convention**: `commands.backup.YYYY-MM-DD-HH-mm-ss/`

---

## When to Rollback

### Critical Failure Scenarios

Rollback is **automatically triggered** when:

1. ❌ **Migration Process Fails**: Error during file movement or YAML rewriting
2. ❌ **Validation Fails**: Post-migration validation detects missing or corrupted files
3. ❌ **Command Resolution Fails**: Commands not accessible after migration
4. ❌ **Disk Space Exhausted**: Insufficient space to complete migration

### User-Initiated Rollback

Consider **manual rollback** when:

1. ⚠️  **Unexpected Behavior**: Commands behave differently after migration
2. ⚠️  **Third-Party Conflicts**: Custom or third-party commands break
3. ⚠️  **Performance Issues**: Noticeable slowdown in command resolution
4. ⚠️  **Regret**: User preference to revert to original structure

---

## Automatic Rollback

### How It Works

The migration system monitors critical operations and automatically initiates rollback on failure:

```javascript
// Automatic rollback triggered by:
// 1. File operation errors
// 2. YAML parsing failures
// 3. Validation failures
// 4. System errors during migration
```

### Automatic Rollback Process

1. **Detection**: System detects critical failure during migration
2. **Logging**: Error details logged to `~/.claude/logs/migration-error.log`
3. **Notification**: User notified via CLI with error summary
4. **Restoration**: All files restored from most recent backup
5. **Validation**: Post-rollback validation ensures integrity
6. **Report**: Detailed rollback report displayed

### Example Output

```bash
❌ Migration Failed: Error moving command files

⏪ Initiating automatic rollback...

[1/3] Stopping migration process
[2/3] Restoring files from backup: ~/.claude/commands.backup.2025-10-29-14-30-00/
[3/3] Validating restoration

✅ Rollback Complete!
   • 12 files restored successfully
   • 0 files failed to restore
   • Original state verified

📋 Error Details:
   • Error: EACCES: permission denied
   • File: ~/.claude/commands/ai-mesh/create-trd
   • Suggestion: Check file permissions and try again
```

---

## Manual Rollback

### Prerequisites

Before initiating manual rollback:

1. ✅ Identify the backup to restore from
2. ✅ Ensure no active Claude Code sessions
3. ✅ Have terminal access with appropriate permissions
4. ✅ Backup current state (optional safety measure)

### Method 1: Using NPM Installer (Recommended)

```bash
# List available backups
npx @fortium/ai-mesh rollback --list

# Rollback to most recent backup
npx @fortium/ai-mesh rollback

# Rollback to specific backup
npx @fortium/ai-mesh rollback --backup=2025-10-29-14-30-00

# Dry-run mode (preview without applying)
npx @fortium/ai-mesh rollback --dry-run
```

### Method 2: Using Bash Installer

```bash
cd ~/.claude

# List available backups
ls -la commands.backup.*/

# Restore from most recent backup
BACKUP_DIR=$(ls -td commands.backup.*/ | head -1)
echo "Restoring from: $BACKUP_DIR"

# Remove current ai-mesh directory
rm -rf commands/ai-mesh/

# Restore all files from backup
cp -R "${BACKUP_DIR}"* commands/

# Validate restoration
ls -la commands/

echo "✅ Rollback complete!"
```

### Method 3: Manual File Operations

For granular control:

```bash
cd ~/.claude/commands

# Step 1: Create safety backup of current state
cp -R ai-mesh/ ai-mesh.rollback-safety/

# Step 2: Identify source backup
BACKUP_DIR=~/.claude/commands.backup.2025-10-29-14-30-00

# Step 3: Remove migrated files
rm -rf ai-mesh/

# Step 4: Restore individual files
cp "$BACKUP_DIR/create-trd" ./
cp "$BACKUP_DIR/implement-trd" ./
cp "$BACKUP_DIR/plan-product" ./
# ... repeat for all command files

# Step 5: Verify file count
EXPECTED_COUNT=12
ACTUAL_COUNT=$(ls -1 *.yaml *.md 2>/dev/null | wc -l)

if [ "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT" ]; then
  echo "✅ All $EXPECTED_COUNT files restored"
else
  echo "⚠️  Expected $EXPECTED_COUNT files, found $ACTUAL_COUNT"
fi
```

---

## Validation After Rollback

### Automated Validation

The rollback process includes automatic validation:

```bash
# Validation checks performed:
# 1. File existence verification
# 2. File integrity checks (size, permissions)
# 3. YAML syntax validation
# 4. Command resolution testing
```

### Manual Validation

Verify rollback success manually:

```bash
# 1. Check file count
ls ~/.claude/commands/ | wc -l
# Expected: 12 files (for standard installation)

# 2. Verify no ai-mesh directory exists
ls ~/.claude/commands/ai-mesh/ 2>&1
# Expected: "No such file or directory"

# 3. Test command resolution
claude code
# Then try: /create-trd
# Expected: Command should be recognized

# 4. Check YAML syntax
find ~/.claude/commands -name "*.yaml" -exec yamllint {} \;
# Expected: No syntax errors
```

### Validation Checklist

- [ ] All command files restored to original location
- [ ] No `ai-mesh/` subdirectory exists
- [ ] File count matches pre-migration state
- [ ] All YAML files have valid syntax
- [ ] Commands resolve successfully in Claude Code
- [ ] No permission errors when accessing files

---

## Emergency Recovery

### Scenario: All Backups Corrupted

If backups are corrupted or missing:

```bash
# Option 1: Reinstall from package
npx @fortium/ai-mesh install --force

# Option 2: Restore from git repository
cd ~/.claude
git clone https://github.com/FortiumPartners/claude-config.git temp-restore
cp -R temp-restore/commands/* commands/
rm -rf temp-restore
```

### Scenario: Partial File Loss

If only some files are missing:

```bash
# Identify missing files
cd ~/.claude/commands
EXPECTED_FILES=("create-trd" "implement-trd" "plan-product" "fold-prompt" ...)

for file in "${EXPECTED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing: $file"
  fi
done

# Restore specific files from backup
BACKUP_DIR=~/.claude/commands.backup.2025-10-29-14-30-00
cp "$BACKUP_DIR/create-trd" ./
```

### Scenario: Permission Issues

If permission errors prevent rollback:

```bash
# Fix ownership issues
sudo chown -R $(whoami):staff ~/.claude/commands/

# Fix permission issues
chmod -R 755 ~/.claude/commands/

# Retry rollback
npx @fortium/ai-mesh rollback
```

---

## Prevention Best Practices

### Before Migration

1. ✅ **Verify Backup Exists**: Check `~/.claude/commands.backup.*/` has recent backup
2. ✅ **Document Current State**: List all command files before migration
3. ✅ **Close Claude Code**: Ensure no active sessions during migration
4. ✅ **Check Disk Space**: Ensure adequate space for migration and backup

```bash
# Pre-migration checklist script
cd ~/.claude

# 1. Check backup directory
if [ -d "commands.backup."* ]; then
  echo "✅ Backup directory exists"
else
  echo "⚠️  No backup found - will be created during migration"
fi

# 2. Count command files
echo "Current command files: $(ls -1 commands/*.yaml 2>/dev/null | wc -l)"

# 3. Check disk space (need ~100MB for safety)
AVAILABLE_SPACE=$(df -h ~/.claude | awk 'NR==2 {print $4}')
echo "Available space: $AVAILABLE_SPACE"

# 4. Check for active Claude Code processes
if pgrep -f "claude.*code" > /dev/null; then
  echo "⚠️  Active Claude Code sessions detected - close before migration"
else
  echo "✅ No active Claude Code sessions"
fi
```

### During Migration

1. ✅ **Monitor Progress**: Watch migration output for errors
2. ✅ **Don't Interrupt**: Let migration complete fully
3. ✅ **Save Logs**: Migration logs saved automatically
4. ✅ **Note Timestamps**: Record start/end times for reference

### After Migration

1. ✅ **Test Commands**: Verify key commands work
2. ✅ **Check Logs**: Review migration log for warnings
3. ✅ **Keep Backups**: Don't delete backup directories immediately
4. ✅ **Document Issues**: Note any unexpected behavior

---

## Support and Troubleshooting

### Get Help

- **Migration Troubleshooting Guide**: See [MIGRATION_TROUBLESHOOTING.md](./MIGRATION_TROUBLESHOOTING.md)
- **Dry-Run Mode Guide**: See [DRY_RUN_GUIDE.md](./DRY_RUN_GUIDE.md)
- **GitHub Issues**: [Report problems](https://github.com/FortiumPartners/claude-config/issues)
- **Community Slack**: #claude-config-support

### Common Questions

**Q: How many backups are retained?**
A: The system keeps the 5 most recent backups automatically.

**Q: Can I manually trigger a backup without migrating?**
A: Yes, use `npx @fortium/ai-mesh backup` to create an on-demand backup.

**Q: Will rollback affect my custom commands?**
A: No. Commands without `@ai-mesh-command` metadata headers are not affected by migration or rollback.

**Q: Can I rollback after restarting my computer?**
A: Yes. Backups persist across reboots and remain until explicitly deleted.

**Q: What if I deleted the backup directory?**
A: Use the emergency recovery procedures above to reinstall from the package or git repository.

---

## Version History

- **v1.0.0** (2025-10-29): Initial rollback procedures documentation
  - Automatic rollback procedures
  - Manual rollback methods (NPM, Bash, Manual)
  - Validation procedures
  - Emergency recovery scenarios
  - Prevention best practices

---

**Related Documentation:**
- [Command Directory Reorganization TRD](../TRD/command-directory-reorganization-trd.md)
- [Migration Troubleshooting Guide](./MIGRATION_TROUBLESHOOTING.md)
- [Dry-Run Mode Guide](./DRY_RUN_GUIDE.md)
