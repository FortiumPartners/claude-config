# Command Directory Migration - Dry-Run Mode Guide

**Version:** 1.0.0
**Last Updated:** October 29, 2025
**Related TRD:** [Command Directory Reorganization](../TRD/command-directory-reorganization-trd.md)

---

## Table of Contents

1. [What is Dry-Run Mode?](#what-is-dry-run-mode)
2. [When to Use Dry-Run](#when-to-use-dry-run)
3. [How to Enable Dry-Run](#how-to-enable-dry-run)
4. [Reading Dry-Run Output](#reading-dry-run-output)
5. [Common Use Cases](#common-use-cases)
6. [Limitations](#limitations)

---

## What is Dry-Run Mode?

Dry-run mode simulates the migration process **without making any actual changes** to your file system. It provides:

- **Preview**: See exactly what changes will be made
- **Validation**: Identify potential issues before migration
- **Safety**: No risk of data loss or corruption
- **Reporting**: Detailed simulation output with statistics

### What Gets Simulated

✅ **Included in Simulation:**
- File scanning and metadata detection
- Directory structure creation
- File movement operations
- YAML source file updates
- Validation checks
- Backup creation

❌ **NOT Actually Performed:**
- No files are moved or copied
- No directories are created
- No YAML files are modified
- No backups are created
- No changes persist after dry-run

---

## When to Use Dry-Run

### Recommended Scenarios

1. **First-Time Migration**: Preview changes before committing
2. **Custom Configuration**: Verify custom commands are handled correctly
3. **Troubleshooting**: Debug migration issues without risk
4. **CI/CD Testing**: Validate migration behavior in automated pipelines
5. **Documentation**: Generate migration reports for team review

### Example Decision Flow

```
Need to migrate commands?
    ↓
Never migrated before? → YES → Use dry-run first
    ↓ NO
Have custom commands? → YES → Use dry-run to verify
    ↓ NO
Experienced user? → YES → Optional dry-run
    ↓ NO
Use dry-run for peace of mind
```

---

## How to Enable Dry-Run

### NPM Installer Method (Recommended)

```bash
# Basic dry-run
npx @fortium/ai-mesh install --dry-run

# Dry-run with verbose output
npx @fortium/ai-mesh install --dry-run --debug

# Dry-run for global installation
npx @fortium/ai-mesh install --global --dry-run

# Dry-run for local installation
npx @fortium/ai-mesh install --local --dry-run
```

### Bash Installer Method

```bash
# Clone repository
git clone https://github.com/FortiumPartners/claude-config.git
cd claude-config

# Run installer with DRY_RUN environment variable
DRY_RUN=true ./install.sh
```

### Programmatic API Method

```javascript
const { createInstaller } = require('@fortium/ai-mesh');

const installer = createInstaller({
  scope: 'global',
  dryRun: true
});

installer.install().then(result => {
  console.log('Dry-run completed:', result);
});
```

---

## Reading Dry-Run Output

### Sample Output

```bash
$ npx @fortium/ai-mesh install --dry-run

🔄 AI Mesh Installation (DRY-RUN MODE)
═══════════════════════════════════════════════════════════

⚠️  DRY-RUN MODE: No changes will be applied

[1/7] Scanning existing commands...
      Found: 12 command files
      • create-trd (ai-mesh command)
      • implement-trd (ai-mesh command)
      • fold-prompt (ai-mesh command)
      • custom-command (third-party, skipped)
      ...

[2/7] Creating directory structure...
      [DRY RUN] Would create: ~/.claude/commands/ai-mesh/

[3/7] Migrating command files...
      [DRY RUN] Would move: create-trd → ai-mesh/create-trd
      [DRY RUN] Would move: implement-trd → ai-mesh/implement-trd
      [DRY RUN] Would move: fold-prompt → ai-mesh/fold-prompt
      ...

[4/7] Updating YAML source files...
      [DRY RUN] Would update: commands/create-trd.yaml
      [DRY RUN] Would update: commands/implement-trd.yaml
      ...

[5/7] Creating backup...
      [DRY RUN] Would backup: ~/.claude/commands → commands.backup.2025-10-29-15-45-00/

[6/7] Validating migration...
      [DRY RUN] Would validate: 11 migrated files
      [DRY RUN] Would validate: 11 YAML source files

[7/7] Finalizing migration...
      [DRY RUN] Would verify command resolution

═══════════════════════════════════════════════════════════
  Dry-Run Migration Summary
═══════════════════════════════════════════════════════════

  Total files scanned: 12
  Would migrate: 11 files
  Would skip: 1 file (third-party)
  YAML sources to update: 11 files
  Backup would be created: Yes

  Estimated duration: ~2-3 seconds
  Disk space required: ~50KB

═══════════════════════════════════════════════════════════
  ✅ Dry-run completed successfully!
═══════════════════════════════════════════════════════════

💡 To perform the actual migration, run:
   npx @fortium/ai-mesh install

⚠️  Recommendation: Review the output above before proceeding.
```

### Output Sections Explained

#### Section 1: Scanning
- Lists all command files found
- Identifies ai-mesh vs third-party commands
- Shows metadata detection results

#### Section 2: Directory Structure
- Shows `ai-mesh/` subdirectory creation
- Displays target paths

#### Section 3: File Migration
- Lists each file that would be moved
- Shows source → destination paths
- Indicates skipped files

#### Section 4: YAML Updates
- Shows which source YAML files would be modified
- Lists `output_path` field updates

#### Section 5: Backup
- Displays backup directory path
- Shows what would be included in backup

#### Section 6: Validation
- Previews validation checks
- Shows expected validation scope

#### Section 7: Summary
- Overall migration statistics
- Resource requirements (time, disk space)
- Recommendations

---

## Common Use Cases

### Use Case 1: Preview Migration Before Executing

**Scenario**: First-time user wants to see what will happen

```bash
# Step 1: Run dry-run
npx @fortium/ai-mesh install --dry-run > migration-preview.txt

# Step 2: Review output
cat migration-preview.txt

# Step 3: If satisfied, run actual migration
npx @fortium/ai-mesh install
```

### Use Case 2: Verify Custom Command Handling

**Scenario**: User has custom commands and wants to ensure they're not affected

```bash
# Run dry-run with debug mode for detailed output
npx @fortium/ai-mesh install --dry-run --debug

# Look for lines like:
# "custom-command (third-party, skipped)"
```

### Use Case 3: Test Migration in CI/CD Pipeline

**Scenario**: Automated testing before production deployment

```yaml
# .github/workflows/test-migration.yml
name: Test Migration

on: [pull_request]

jobs:
  test-migration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Dry-run migration
        run: npx @fortium/ai-mesh install --dry-run
```

### Use Case 4: Generate Migration Report for Team

**Scenario**: Team lead needs to document migration impact

```bash
# Generate detailed report
npx @fortium/ai-mesh install --dry-run --debug > docs/migration-report.txt

# Add to documentation
git add docs/migration-report.txt
git commit -m "docs: add migration impact report"
```

### Use Case 5: Troubleshoot Migration Issues

**Scenario**: Migration failed previously, investigating causes

```bash
# Run dry-run with full debugging
npx @fortium/ai-mesh install --dry-run --debug 2>&1 | tee dry-run-debug.log

# Analyze log for issues
grep -i "error\|warning" dry-run-debug.log
```

---

## Limitations

### What Dry-Run Cannot Detect

1. **Permission Issues**: File system permissions not fully validated
2. **Disk Space**: Exact space calculations may vary
3. **Timing Issues**: Race conditions or concurrent access not simulated
4. **External Dependencies**: Third-party tool integration not tested

### Differences from Actual Migration

| Aspect | Dry-Run | Actual Migration |
|--------|---------|------------------|
| File System Changes | None | Yes, permanent |
| Backup Creation | Simulated | Real backup created |
| YAML Modifications | None | Source files updated |
| Validation | Simulation | Real syntax checks |
| Error Handling | Predicted | Actual errors caught |
| Duration | <1 second | 2-5 seconds |
| Rollback Available | N/A | Yes, automatic |

### Known Edge Cases

1. **Symbolic Links**: Dry-run may not accurately predict symlink behavior
2. **Network File Systems**: Remote FS performance not simulated
3. **Concurrent Users**: Multi-user scenarios not fully modeled
4. **Custom Hooks**: Pre/post-migration hooks not executed in dry-run

---

## Best Practices

### Before Dry-Run

1. ✅ Ensure NPM package is up-to-date
2. ✅ Close Claude Code to avoid file locks
3. ✅ Review current command directory structure

### During Dry-Run

1. ✅ Save output to file for review
2. ✅ Look for warnings and skipped files
3. ✅ Verify expected file counts match

### After Dry-Run

1. ✅ Review summary statistics carefully
2. ✅ Address any warnings before actual migration
3. ✅ Decide: proceed or investigate further

### Recommended Workflow

```bash
# 1. Initial dry-run to preview
npx @fortium/ai-mesh install --dry-run > preview.txt

# 2. Review output
less preview.txt

# 3. If issues found, investigate with debug mode
npx @fortium/ai-mesh install --dry-run --debug

# 4. When confident, perform actual migration
npx @fortium/ai-mesh install

# 5. Verify success
ls -la ~/.claude/commands/ai-mesh/
```

---

## Frequently Asked Questions

**Q: How long does dry-run take?**
A: Typically <1 second, as no actual file operations occur.

**Q: Can I run dry-run multiple times?**
A: Yes, dry-run has no side effects and can be run repeatedly.

**Q: Will dry-run affect my existing commands?**
A: No, dry-run makes zero changes to your file system.

**Q: Can I use dry-run to test rollback?**
A: Yes, use `npx @fortium/ai-mesh rollback --dry-run`.

**Q: Is dry-run required before migration?**
A: No, but strongly recommended for first-time users.

**Q: Can I automate dry-run in scripts?**
A: Yes, dry-run is fully scriptable and CI/CD friendly.

---

## Support

For issues with dry-run mode:

1. **Check output**: Look for error messages or warnings
2. **Enable debug mode**: Add `--debug` flag for detailed output
3. **Review documentation**: [Migration Troubleshooting Guide](./MIGRATION_TROUBLESHOOTING.md)
4. **Report bugs**: [GitHub Issues](https://github.com/FortiumPartners/claude-config/issues)

---

## Related Documentation

- [Rollback Procedures](./ROLLBACK_PROCEDURES.md)
- [Migration Troubleshooting Guide](./MIGRATION_TROUBLESHOOTING.md)
- [Command Directory Reorganization TRD](../TRD/command-directory-reorganization-trd.md)

---

**Version History:**
- **v1.0.0** (2025-10-29): Initial dry-run mode documentation
  - Basic usage instructions
  - Output format explanation
  - Common use cases
  - Limitations and best practices
