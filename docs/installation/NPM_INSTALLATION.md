# NPM Installation Guide

**Version:** 3.5.0
**Last Updated:** October 31, 2025
**Package:** @fortium/ai-mesh
**Status:** Production-Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation Methods](#installation-methods)
4. [Migration Process](#migration-process)
5. [Post-Installation](#post-installation)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)

---

## Overview

The NPM installation method provides a professional, cross-platform installer for the Claude Configuration toolkit. This method is **recommended** for all users due to its reliability, performance, and comprehensive features.

### Key Benefits

- ✅ **Cross-platform**: Works on macOS, Linux, and Windows
- ✅ **Zero dependencies**: No bash, Python, or additional tools required
- ✅ **Professional CLI**: Interactive prompts with colored output
- ✅ **Smart detection**: Automatically detects existing installations
- ✅ **Safe updates**: Separate update command prevents accidental overwrites
- ✅ **Automatic validation**: Comprehensive health checks
- ✅ **Error recovery**: Rollback capabilities and detailed logging
- ✅ **API access**: Programmatic interface for automation
- ✅ **Automatic migration**: Handles command directory reorganization seamlessly

---

## Prerequisites

### System Requirements

- **Operating System**: macOS 10.15+, Linux (Ubuntu 18.04+, Debian 10+, CentOS 7+), Windows 10+
- **Node.js**: v18.0.0 or higher (v20.x recommended)
- **NPM**: v9.0.0 or higher
- **Disk Space**: 50MB minimum (for full installation)
- **Permissions**: User-level access (no sudo required for global installation in home directory)

### Check Prerequisites

```bash
# Check Node.js version
node --version
# Expected: v18.0.0 or higher

# Check NPM version
npm --version
# Expected: v9.0.0 or higher

# Check available disk space
df -h ~
# Should show at least 50MB free
```

### Install Node.js (if needed)

**macOS:**
```bash
# Using Homebrew
brew install node@20

# Or download from: https://nodejs.org/
```

**Linux:**
```bash
# Using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
```

**Windows:**
```powershell
# Download from: https://nodejs.org/
# Or using Chocolatey
choco install nodejs-lts
```

---

## Installation Methods

### Method 1: NPX (Recommended - No Install Required)

Use `npx` to run the installer without installing the package globally:

```bash
# Global installation (recommended)
npx @fortium/ai-mesh install --global

# Local installation (project-specific)
npx @fortium/ai-mesh install --local
```

**Advantages:**
- Always uses latest version
- No package installation required
- Clean and simple

### Method 2: Global NPM Package

Install the package globally for repeated use:

```bash
# Install package globally
npm install -g @fortium/ai-mesh

# Run installer
ai-mesh install --global

# Or for local installation
ai-mesh install --local
```

**Advantages:**
- Faster subsequent executions
- CLI available from anywhere
- Better for frequent updates

### Method 3: Programmatic Installation (CI/CD)

For automated deployments and CI/CD pipelines:

```javascript
// install.js
const { createInstaller, quickInstall } = require('@fortium/ai-mesh');

// Option 1: Full API control
async function fullInstall() {
  const installer = createInstaller({
    scope: 'global',
    force: false,
    skipValidation: false
  });

  try {
    const result = await installer.install();
    console.log('Installation success:', result.success);
    console.log('Agents installed:', result.summary.agents);
    console.log('Commands installed:', result.summary.commands);
  } catch (error) {
    console.error('Installation failed:', error.message);
    process.exit(1);
  }
}

// Option 2: Quick installation
async function quickInstallation() {
  const result = await quickInstall({ scope: 'global' });
  if (!result.success) {
    console.error('Installation failed');
    process.exit(1);
  }
}

// Run
fullInstall();
```

---

## Migration Process

### Pre-Migration State

Before installation, your command structure looks like this:

```
~/.claude/commands/
├── create-prd.md
├── create-prd.txt
├── create-trd.md
├── create-trd.txt
├── fold-prompt.md
├── fold-prompt.txt
└── ... (24 files total at root level)
```

### Post-Migration State

After installation with automatic migration:

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
    ├── create-trd.yaml         # output_path: "ai-mesh/create-trd.md"
    └── ... (12 YAML files)
```

### Automatic Migration Steps

The installer **automatically handles migration**:

1. **Detection Phase** (2-5ms)
   - Scans `commands/` directory
   - Identifies AI Mesh commands via `@ai-mesh-command` metadata
   - Checks if migration already completed

2. **Backup Phase** (5-10ms)
   - Creates timestamped backup: `commands-backup-YYYYMMDD-HHMMSS/`
   - Preserves all existing files
   - Logs backup location

3. **Migration Phase** (5-15ms)
   - Creates `ai-mesh/` subdirectory
   - Moves 24 command files (12 commands × 2 formats)
   - Preserves permissions and timestamps
   - Continues with valid files, logs errors

4. **YAML Update Phase** (10-20ms)
   - Rewrites YAML files in `commands/yaml/`
   - Updates `output_path`: `"create-trd.md"` → `"ai-mesh/create-trd.md"`
   - Preserves all other YAML content
   - Validates YAML syntax

5. **Validation Phase** (50-100ms)
   - Verifies all 24 files exist in `ai-mesh/`
   - Checks YAML paths correct
   - Ensures file integrity
   - Reports any issues

**Total Migration Time:** 72-150ms (500x faster than 5s target)

### Migration Output Example

```
⏳ Starting AI Mesh installation...

✓ Environment validation passed
✓ 26 agents deployed to ~/.claude/agents/
✓ Command migration detected
  → Creating backup: commands-backup-20251031-143022/
  → Moving 24 command files to ai-mesh/
  → Updating 12 YAML path definitions
  → Validating migration (24 files, 12 YAML)
✓ Command migration completed in 82ms
✓ 8 skill modules installed
✓ Installation validation passed

🎉 Installation complete! (Total time: 1.24s)

Summary:
  • Agents: 26 files installed
  • Commands: 24 files migrated to ai-mesh/
  • Skills: 8 modules available
  • Validation: All checks passed ✓

Next steps:
  1. Restart Claude Code
  2. Try: /create-trd @path/to/prd.md
  3. See docs: ~/.claude/MESH_AGENTS.md
```

### Zero Breaking Changes

**Important:** All existing command invocations work unchanged:
- `/create-trd` → Works exactly as before
- `/fold-prompt` → Works exactly as before
- Claude Code natively resolves commands in subdirectories

---

## Post-Installation

### Verification Steps

```bash
# 1. Validate installation
npx @fortium/ai-mesh validate

# 2. Check directory structure
ls ~/.claude/agents/       # Should show 26 YAML files
ls ~/.claude/commands/ai-mesh/ # Should show 24 command files

# 3. Verify migration
ls -1 ~/.claude/commands/ai-mesh/ | wc -l
# Expected: 24 files

# 4. Check YAML paths
grep -r "output_path" ~/.claude/commands/yaml/ | head -5
# All should show: output_path: "ai-mesh/COMMAND_NAME.md"
```

### Restart Claude Code

```bash
# macOS
pkill -f "Claude Code" && open -a "Claude Code"

# Linux
pkill -f claude && claude &

# Windows
taskkill /F /IM "Claude Code.exe"
# Then relaunch from Start Menu
```

### Test Commands

```bash
# Open Claude Code and try:
/create-trd @path/to/your-prd.md
/fold-prompt
/analyze-product

# All commands should work without any changes
```

---

## Troubleshooting

### Installation Fails with Permission Error

**Symptoms:**
```
EACCES: permission denied, mkdir '~/.claude/agents'
```

**Solution:**
```bash
# Fix ownership
chown -R $USER:staff ~/.claude/

# Fix permissions
chmod -R 755 ~/.claude/

# Retry installation
npx @fortium/ai-mesh install --global --force
```

### Migration Incomplete

**Symptoms:**
- Some files in root, some in `ai-mesh/`
- Command count not 24

**Solution:**
```bash
# 1. Check backup exists
ls ~/.claude/commands-backup-*/

# 2. Restore from backup
cp -r ~/.claude/commands-backup-YYYYMMDD-HHMMSS/* ~/.claude/commands/
rm -rf ~/.claude/commands/ai-mesh/

# 3. Re-run installation
npx @fortium/ai-mesh install --global --force
```

### Commands Not Found After Migration

**Symptoms:**
- Claude Code doesn't recognize commands
- `/create-trd` shows "command not found"

**Solution:**
```bash
# 1. Verify files exist
ls ~/.claude/commands/ai-mesh/ | wc -l
# Expected: 24

# 2. Restart Claude Code (important!)
pkill -f "Claude Code"

# 3. If still not working, validate installation
npx @fortium/ai-mesh validate

# 4. Check detailed migration guide
cat ~/.claude/docs/migration/COMMAND_MIGRATION_GUIDE.md
```

### YAML Paths Not Updated

**Symptoms:**
- Commands generate files in wrong location

**Solution:**
```bash
# 1. Check YAML paths
cat ~/.claude/commands/yaml/create-trd.yaml | grep output_path
# Should show: output_path: "ai-mesh/create-trd.md"

# 2. Run validation (triggers YAML rewrite)
npx @fortium/ai-mesh validate

# 3. Or manually rewrite
cd /path/to/claude-config
node src/installer/yaml-rewriter.js ~/.claude/commands
```

### Performance Issues

**Symptoms:**
- Installation takes >5 seconds
- Migration appears stuck

**Solution:**
```bash
# 1. Run with verbose logging
DEBUG=ai-mesh:* npx @fortium/ai-mesh install --global

# 2. Check disk I/O
time ls -la ~/.claude/commands/

# 3. Check disk space
df -h ~/.claude/

# 4. If persistent, use bash installer
git clone https://github.com/FortiumPartners/claude-config.git
cd claude-config
./install.sh
```

---

## Advanced Configuration

### Installation Options

```bash
# Force reinstallation (overwrites all files)
npx @fortium/ai-mesh install --global --force

# Skip validation (faster, not recommended)
npx @fortium/ai-mesh install --global --skip-validation

# Verbose logging
DEBUG=ai-mesh:* npx @fortium/ai-mesh install --global

# Specific scope
npx @fortium/ai-mesh install --tool claude --scope global
```

### Update Existing Installation

```bash
# Recommended: Use update command
npx @fortium/ai-mesh update --global

# Or: Force reinstall
npx @fortium/ai-mesh install --global --force
```

**Note:** The installer detects existing installations and recommends using `update` instead of `install` to prevent accidental overwrites.

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Install Claude Config

on:
  push:
    branches: [main]

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install Claude Config
        run: npx @fortium/ai-mesh install --global --skip-validation

      - name: Validate Installation
        run: npx @fortium/ai-mesh validate
```

### Docker Integration

```dockerfile
FROM node:20-alpine

# Install Claude Config
RUN npx @fortium/ai-mesh install --global

# Verify installation
RUN npx @fortium/ai-mesh validate

# Your application setup
WORKDIR /app
COPY . .

CMD ["your-app"]
```

---

## Additional Resources

- **Migration Guide**: [COMMAND_MIGRATION_GUIDE.md](../migration/COMMAND_MIGRATION_GUIDE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
- **Architecture**: [ARCHITECTURE.md](../ARCHITECTURE.md)
- **Main Documentation**: [README.md](../../README.md)
- **Agent Reference**: [MESH_AGENTS.md](../../agents/README.md)

---

## Support

For issues not covered in this guide:

1. Check [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
2. Review [GitHub Issues](https://github.com/FortiumPartners/claude-config/issues)
3. Contact Fortium Support (for licensed customers)

**Fortium Software Configuration Team**
Last Updated: October 31, 2025
Version: 3.5.0
