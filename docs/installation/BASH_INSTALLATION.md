# Bash Installation Guide

**Version:** 3.5.0
**Last Updated:** October 31, 2025
**Script:** install.sh
**Status:** Legacy (Supported)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation Process](#installation-process)
4. [Migration Process](#migration-process)
5. [Post-Installation](#post-installation)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Usage](#advanced-usage)

---

## Overview

The bash installation method is the **legacy installer** for users who prefer traditional shell scripts. While fully supported, the **NPM installation method is recommended** for most users due to better cross-platform support and performance.

### When to Use Bash Installation

- ✅ No Node.js available on system
- ✅ Prefer shell scripts over Node.js tools
- ✅ Custom shell integration required
- ✅ Limited internet connectivity (offline installation)
- ✅ Compatibility with older systems

### Limitations

- ❌ Slower than NPM installer (~200ms vs 10ms migration)
- ❌ macOS/Linux only (no Windows support)
- ❌ Requires bash 4.0+ (may need upgrade on macOS)
- ❌ No programmatic API
- ❌ Less detailed error reporting

---

## Prerequisites

### System Requirements

- **Operating System**: macOS 10.15+, Linux (Ubuntu 18.04+, Debian 10+, CentOS 7+)
- **Bash**: v4.0 or higher
- **Git**: For cloning repository
- **Disk Space**: 50MB minimum
- **Permissions**: User-level access (no sudo required)

### Check Prerequisites

```bash
# Check bash version
bash --version
# Expected: GNU bash, version 4.0 or higher

# Check git
git --version
# Expected: git version 2.x or higher

# Check disk space
df -h ~
# Should show at least 50MB free
```

### Upgrade Bash (macOS)

macOS ships with bash 3.2. You need bash 4.0+:

```bash
# Install via Homebrew
brew install bash

# Add to /etc/shells
echo "$(brew --prefix)/bin/bash" | sudo tee -a /etc/shells

# Change default shell (optional)
chsh -s "$(brew --prefix)/bin/bash"

# Verify
bash --version
# Should show: GNU bash, version 5.x
```

---

## Installation Process

### Step 1: Clone Repository

```bash
# Clone from GitHub
git clone https://github.com/FortiumPartners/claude-config.git

# Navigate to directory
cd claude-config

# Verify installation script exists
ls -la install.sh
# Should show: -rwxr-xr-x ... install.sh
```

### Step 2: Run Interactive Installer

```bash
# Run installation script
./install.sh
```

**Interactive Prompts:**

```
┌────────────────────────────────────────────────────────────────┐
│          Claude Configuration Installation                      │
└────────────────────────────────────────────────────────────────┘

Choose installation scope:
  1) Global (~/.claude/) - Available to all projects
  2) Local (.claude/)   - Current project only

Enter choice [1-2]: 1

✓ Installing to ~/.claude/
✓ Creating directory structure...
✓ Detecting existing installation...
⚠ Existing installation found. Creating backup...
✓ Backup created: ~/.claude-backup-20251031-143022/
✓ Deploying 26 agents...
✓ Deploying commands with migration...
  → Creating backup: commands-backup-20251031-143022/
  → Migrating 24 files to ai-mesh/...
  → Updating 12 YAML files...
  → Migration completed in 195ms
✓ Deploying skills...
✓ Validating installation...

🎉 Installation complete!

Summary:
  • Agents: 26 files installed
  • Commands: 24 files migrated to ai-mesh/
  • Skills: 8 modules available
  • Backup: ~/.claude-backup-20251031-143022/

Next steps:
  1. Restart Claude Code
  2. Try: /create-trd @path/to/prd.md
  3. See docs: ~/.claude/MESH_AGENTS.md
```

### Step 3: Verify Installation

```bash
# Check installation
ls ~/.claude/
# Expected: agents/ commands/ skills/ MESH_AGENTS.md

# Check agents
ls ~/.claude/agents/ | wc -l
# Expected: 26 files

# Check commands (migrated)
ls ~/.claude/commands/ai-mesh/ | wc -l
# Expected: 24 files

# Check YAML paths
grep -r "output_path" ~/.claude/commands/yaml/ | head -3
# All should show: output_path: "ai-mesh/COMMAND_NAME.md"
```

---

## Migration Process

### Pre-Migration State

Before running `install.sh`, your command structure:

```
~/.claude/commands/
├── create-prd.md
├── create-prd.txt
├── create-trd.md
├── create-trd.txt
├── fold-prompt.md
├── fold-prompt.txt
└── ... (24 files at root level)
```

### Post-Migration State

After running `install.sh` with automatic migration:

```
~/.claude/commands/
├── ai-mesh/                    # ✨ NEW: Organized subdirectory
│   ├── create-prd.md
│   ├── create-prd.txt
│   ├── create-trd.md
│   ├── create-trd.txt
│   ├── fold-prompt.md
│   ├── fold-prompt.txt
│   └── ... (24 files total)
├── agent-os/                   # Future expansion
├── spec-kit/                   # Future expansion
└── yaml/                       # YAML definitions (updated paths)
    ├── create-prd.yaml         # output_path: "ai-mesh/create-prd.md"
    └── ... (12 YAML files)
```

### Bash Migration Steps

The `install.sh` script **automatically handles migration**:

1. **Detection Phase** (10-50ms)
   - Scans `commands/` directory for existing files
   - Checks if `ai-mesh/` subdirectory exists
   - Identifies command files to migrate

2. **Backup Phase** (20-50ms)
   - Creates timestamped backup: `commands-backup-YYYYMMDD-HHMMSS/`
   - Copies all existing command files
   - Logs backup location

3. **Migration Phase** (50-100ms)
   - Creates `ai-mesh/` subdirectory
   - Moves 24 command files using `mv` command
   - Preserves permissions and timestamps
   - Handles errors gracefully

4. **YAML Update Phase** (100-200ms)
   - Uses `sed` to update YAML files
   - Changes: `output_path: "file.md"` → `output_path: "ai-mesh/file.md"`
   - Preserves other YAML content
   - Creates backup before modification

5. **Validation Phase** (100-200ms)
   - Verifies all 24 files exist in `ai-mesh/`
   - Checks YAML paths updated correctly
   - Ensures file permissions correct
   - Reports any issues

**Total Migration Time:** 280-600ms (25x faster than 5s target)

### Migration Output

```bash
⏳ Migrating commands to hierarchical structure...

✓ Creating backup: commands-backup-20251031-143022/
  → Backed up 24 files

✓ Creating directory structure:
  → ai-mesh/
  → agent-os/
  → spec-kit/

✓ Moving command files:
  → create-prd.md → ai-mesh/
  → create-prd.txt → ai-mesh/
  → create-trd.md → ai-mesh/
  → create-trd.txt → ai-mesh/
  ... (24 files total)
  → Completed in 82ms

✓ Updating YAML paths:
  → create-prd.yaml
  → create-trd.yaml
  → implement-trd.yaml
  ... (12 files total)
  → Completed in 145ms

✓ Validating migration:
  → All 24 command files present ✓
  → All 12 YAML paths updated ✓
  → File permissions correct ✓
  → Completed in 168ms

✅ Migration completed successfully in 395ms
```

### Rollback on Failure

If migration fails, `install.sh` automatically restores from backup:

```bash
❌ Migration failed: Permission denied

⏳ Rolling back from backup...
  → Restoring from: commands-backup-20251031-143022/
  → Removing partial migration
  → Verifying restore
✓ Rollback complete

⚠ Installation aborted. Original configuration restored.

Please fix the error and try again:
  - Check file permissions: chmod -R 755 ~/.claude/
  - Ensure disk space available: df -h ~/.claude/
  - Review logs for details
```

---

## Post-Installation

### Restart Claude Code

```bash
# macOS
pkill -f "Claude Code" && open -a "Claude Code"

# Linux
pkill -f claude && claude &
```

### Test Commands

Open Claude Code and test:

```
/create-trd @path/to/your-prd.md
/fold-prompt
/analyze-product
```

All commands should work without changes.

### Verification

```bash
# Verify installation structure
tree -L 2 ~/.claude/
# Expected:
# ~/.claude/
# ├── agents/ (26 files)
# ├── commands/
# │   ├── ai-mesh/ (24 files)
# │   ├── agent-os/
# │   ├── spec-kit/
# │   └── yaml/ (12 files)
# └── skills/ (8 modules)

# Check command count
ls -1 ~/.claude/commands/ai-mesh/ | wc -l
# Expected: 24

# Verify YAML paths
grep "output_path" ~/.claude/commands/yaml/*.yaml | grep -v "ai-mesh"
# Expected: No output (all should have ai-mesh/)
```

---

## Troubleshooting

### Bash Version Too Old

**Symptoms:**
```
./install.sh: line 42: declare: -A: invalid option
```

**Solution:**
```bash
# Check bash version
bash --version

# If < 4.0, upgrade (macOS)
brew install bash

# Verify upgrade
bash --version
# Should show: GNU bash, version 5.x

# Run installer with new bash
/opt/homebrew/bin/bash install.sh
```

### Permission Denied

**Symptoms:**
```
mkdir: cannot create directory '~/.claude/agents': Permission denied
```

**Solution:**
```bash
# Fix ownership
sudo chown -R $USER:$(id -gn) ~/.claude/

# Fix permissions
chmod -R 755 ~/.claude/

# Retry installation
./install.sh
```

### Migration Failed

**Symptoms:**
- Error during file movement
- Partial migration (some files moved, some not)
- YAML update errors

**Solution:**
```bash
# 1. Check backup exists
ls ~/.claude/commands-backup-*/

# 2. Manual restore if needed
cp -r ~/.claude/commands-backup-YYYYMMDD-HHMMSS/* ~/.claude/commands/
rm -rf ~/.claude/commands/ai-mesh/

# 3. Fix permissions
chmod -R 755 ~/.claude/commands/

# 4. Retry installation
./install.sh

# 5. If still failing, check disk space
df -h ~/.claude/
```

### Commands Not Found

**Symptoms:**
- Claude Code doesn't recognize commands
- `/create-trd` shows "command not found"

**Solution:**
```bash
# 1. Verify files exist
ls ~/.claude/commands/ai-mesh/ | wc -l
# Expected: 24 files

# 2. Restart Claude Code (important!)
pkill -f "Claude Code"
sleep 2
open -a "Claude Code"

# 3. If still not working, check file permissions
ls -la ~/.claude/commands/ai-mesh/
# Should show: -rw-r--r-- (644)

# 4. Fix if needed
chmod 644 ~/.claude/commands/ai-mesh/*
```

### YAML Paths Not Updated

**Symptoms:**
- Commands generate files in wrong location
- Files created at root instead of `ai-mesh/`

**Solution:**
```bash
# 1. Check YAML paths
grep "output_path" ~/.claude/commands/yaml/create-trd.yaml
# Should show: output_path: "ai-mesh/create-trd.md"

# 2. Manual update using sed
cd ~/.claude/commands/yaml/
for file in *.yaml; do
  sed -i.bak 's|output_path: "\([^/]*\.md\)"|output_path: "ai-mesh/\1"|g' "$file"
done

# 3. Verify fix
grep "output_path" *.yaml | head -5
# All should show: output_path: "ai-mesh/..."

# 4. Remove backups
rm *.bak
```

---

## Advanced Usage

### Silent Installation

```bash
# Non-interactive installation (uses defaults)
./install.sh --silent --global

# Or with environment variables
INSTALL_SCOPE=global SKIP_CONFIRMATION=true ./install.sh
```

### Custom Installation Path

```bash
# Set custom installation directory
CLAUDE_HOME=/custom/path ./install.sh
```

### Skip Migration

```bash
# Install without migrating commands (not recommended)
SKIP_MIGRATION=true ./install.sh
```

### Verbose Logging

```bash
# Enable debug output
DEBUG=1 ./install.sh

# Or with bash -x
bash -x install.sh
```

### Dry Run

```bash
# Preview what would be installed
./install.sh --dry-run
```

---

## Migration Script Details

### Manual Migration (if needed)

If automatic migration fails, you can run the migration script separately:

```bash
cd claude-config

# Run migration script
./scripts/migrate-commands.sh ~/.claude/commands

# With verbose output
DEBUG=1 ./scripts/migrate-commands.sh ~/.claude/commands
```

### Migration Script Location

```bash
# Find migration script
ls scripts/migrate-commands.sh

# View script contents
cat scripts/migrate-commands.sh
```

---

## Comparison: Bash vs NPM

| Feature | Bash Installer | NPM Installer |
|---------|----------------|---------------|
| Installation Time | 2-3s | 1-2s |
| Migration Speed | 200-600ms | 10-150ms |
| Cross-Platform | macOS, Linux | macOS, Linux, Windows |
| Dependencies | bash 4.0+, git | Node.js 18+ |
| Error Recovery | Basic | Advanced |
| Validation | Basic | Comprehensive |
| API Access | None | Full API |
| Updates | Manual | `npm update` |
| **Recommendation** | Legacy use | **Recommended** |

---

## Migration to NPM Installer

If you want to switch from bash to NPM installer:

```bash
# 1. Backup current installation
cp -r ~/.claude ~/.claude-backup-$(date +%Y%m%d)

# 2. Install NPM installer (doesn't affect existing installation)
npm install -g @fortium/ai-mesh

# 3. Run NPM installer (detects and migrates existing installation)
ai-mesh install --global

# 4. Verify
ai-mesh validate

# 5. Remove backup if successful
rm -rf ~/.claude-backup-*
```

---

## Additional Resources

- **NPM Installation Guide**: [NPM_INSTALLATION.md](./NPM_INSTALLATION.md) ← **Recommended**
- **Migration Guide**: [COMMAND_MIGRATION_GUIDE.md](../migration/COMMAND_MIGRATION_GUIDE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **Architecture**: [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Main Documentation**: [README.md](../../README.md)

---

## Support

For issues not covered in this guide:

1. Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
2. Review [GitHub Issues](https://github.com/FortiumPartners/claude-config/issues)
3. Contact Fortium Support (for licensed customers)

---

**Fortium Software Configuration Team**
Last Updated: October 31, 2025
Version: 3.5.0

**Note:** This is the legacy installer. For new installations, we recommend using the [NPM Installation Method](./NPM_INSTALLATION.md) for better performance and cross-platform support.
