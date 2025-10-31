# Technical Requirements Document: Command Directory Reorganization

**Version:** 1.0.0
**Status:** Ready for Implementation
**Created:** October 29, 2025
**Owner:** Fortium Software Configuration Team
**Priority:** Medium
**Related PRD:** [Command Directory Reorganization PRD](../PRD/command-directory-reorganization.md)

---

## Executive Summary

### Technical Overview

This TRD defines the complete technical implementation for reorganizing Claude Code slash commands from a flat directory structure to a hierarchical `ai-mesh/` subdirectory system. The solution encompasses:

- **Migration Engine**: Intelligent file movement with partial completion support
- **Enhanced CLI**: Progress bars, colored output, and detailed status reporting
- **YAML Path Rewriter**: Automatic source file updates for new directory structure
- **Metadata System**: Third-party command detection via header markers
- **Rollback Mechanism**: Automated backup and restoration for safe migrations
- **Validation System**: Comprehensive post-migration validation and error reporting

### Key Technical Achievements

- ✅ **Zero Breaking Changes**: All existing command invocations work unchanged
- ✅ **98%+ Installation Success**: Maintains production-level reliability
- ✅ **Partial Migration**: Continue with valid files, log errors for problematic ones
- ✅ **Automated Testing**: CI/CD performance validation with <100ms threshold
- ✅ **Enhanced UX**: Rich CLI with progress indicators and detailed feedback

### Architecture Principles

1. **Atomic Operations**: Migration uses rolling backups with automatic rollback on critical failures
2. **Fail-Safe Design**: Partial completion strategy prevents total migration failure
3. **Performance First**: No measurable impact on command resolution (<100ms)
4. **User Experience**: Enhanced CLI provides professional feedback during installation
5. **Backward Compatibility**: Claude Code native subdirectory resolution ensures seamless transition

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technical Requirements](#technical-requirements)
3. [Implementation Phases](#implementation-phases)
4. [Master Task List](#master-task-list)
5. [Sprint Breakdowns](#sprint-breakdowns)
6. [Testing Strategy](#testing-strategy)
7. [Performance Requirements](#performance-requirements)
8. [Risk Mitigation](#risk-mitigation)
9. [Definition of Done](#definition-of-done)
10. [Acceptance Criteria](#acceptance-criteria)
11. [Appendices](#appendices)

---

## System Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Installation Entry Point                    │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  NPM Installer   │              │ Bash Installer   │         │
│  │ (src/installer/) │              │  (install.sh)    │         │
│  └────────┬─────────┘              └────────┬─────────┘         │
│           │                                  │                   │
│           └──────────────┬───────────────────┘                   │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Migration Orchestrator                        │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Pre-Migration Phase                                   │     │
│  │  • Directory detection                                 │     │
│  │  • Existing file inventory                             │     │
│  │  • Rolling backup creation                             │     │
│  │  • Validation setup                                    │     │
│  └────────────────────────────────────────────────────────┘     │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Migration Execution                                   │     │
│  │  • Command file identification (metadata detection)    │     │
│  │  • Directory structure creation                        │     │
│  │  • File movement with error handling                   │     │
│  │  • YAML source file rewriting                          │     │
│  │  • Partial completion logging                          │     │
│  └────────────────────────────────────────────────────────┘     │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Post-Migration Phase                                  │     │
│  │  • Command file validation                             │     │
│  │  • YAML syntax verification                            │     │
│  │  • Path resolution testing                             │     │
│  │  • Success/failure reporting                           │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Support Components                         │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Enhanced CLI    │  │  YAML Rewriter   │  │  Validator   │  │
│  │  • Progress bars │  │  • Parse YAML    │  │  • Syntax    │  │
│  │  • Colors        │  │  • Update paths  │  │  • Schema    │  │
│  │  • Status        │  │  • Write back    │  │  • Links     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Metadata System │  │  Backup Manager  │  │  Rollback    │  │
│  │  • Header detect │  │  • Rolling store │  │  • Restore   │  │
│  │  • Third-party   │  │  • Cleanup       │  │  • Validate  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
User Initiates Installation
         │
         ▼
  ┌──────────────┐
  │ Detect Scope │ (Global: ~/.claude | Local: .claude)
  └──────┬───────┘
         │
         ▼
  ┌──────────────────┐
  │ Scan Existing    │ → Find: create-prd.md, create-trd.md, etc.
  │ Command Files    │   Check: metadata headers
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ Create Rolling   │ → commands.backup/ directory
  │ Backup           │   Copy all existing files
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ Create ai-mesh/  │ → mkdir -p commands/ai-mesh
  │ Directory        │
  └──────┬───────────┘
         │
         ▼
  ┌──────────────────┐
  │ Migrate Files    │ → For each AI Mesh command:
  │ (Partial OK)     │   • Check metadata header
  └──────┬───────────┘   • Move to ai-mesh/
         │               • Log errors, continue
         │               • Update progress bar
         ▼
  ┌──────────────────┐
  │ Rewrite YAML     │ → Parse commands/yaml/*.yaml
  │ Source Files     │   Update: output_path: "ai-mesh/..."
  └──────┬───────────┘   Validate: YAML syntax
         │
         ▼
  ┌──────────────────┐
  │ Validate All     │ → Check: file exists, YAML valid
  │ Migrated Files   │   Test: command resolution
  └──────┬───────────┘   Report: success/failures
         │
         ▼
  ┌──────────────────┐
  │ Success? ────────┼─── Yes ──→ Display summary, cleanup backup
  │                  │
  │                  └─── No ───→ Rollback from backup
  └──────────────────┘              Display errors
```

### Component Specifications

#### 1. NPM Installer Module (`src/installer/`)

**File**: `src/installer/migrate-commands.js`

```javascript
/**
 * Command Migration Module
 * Handles migration of AI Mesh commands to ai-mesh/ subdirectory
 */

const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');
const { validateCommandFile } = require('../utils/validator');

class CommandMigrator {
  constructor(targetPath, options = {}) {
    this.targetPath = targetPath; // ~/.claude or .claude
    this.commandsDir = path.join(targetPath, 'commands');
    this.aiMeshDir = path.join(this.commandsDir, 'ai-mesh');
    this.backupDir = path.join(this.targetPath, 'commands.backup');
    this.dryRun = options.dryRun || false;
    this.errors = [];
    this.successes = [];
  }

  async migrate() {
    try {
      // Phase 1: Pre-migration
      await this.createBackup();
      await this.createAiMeshDirectory();

      // Phase 2: Migration
      const commands = await this.scanExistingCommands();
      await this.migrateCommandFiles(commands);

      // Phase 3: YAML rewriting
      await this.rewriteYamlSources();

      // Phase 4: Validation
      const valid = await this.validateMigration();

      if (!valid && this.errors.length > 0) {
        // Partial failure - continue but report
        logger.warn(`Migration completed with ${this.errors.length} errors`);
        return { success: true, partial: true, errors: this.errors };
      }

      return { success: true, partial: false, migrated: this.successes.length };
    } catch (error) {
      // Critical failure - rollback
      await this.rollback();
      throw error;
    }
  }

  async scanExistingCommands() {
    // Scan for files with @ai-mesh-command metadata header
    // Return list of files to migrate
  }

  async migrateCommandFiles(commands) {
    // Move files to ai-mesh/ with error handling
    // Continue on non-critical errors
  }

  async rewriteYamlSources() {
    // Parse YAML files in commands/yaml/
    // Update output_path to include ai-mesh/ prefix
  }

  async validateMigration() {
    // Check all migrated files exist and are valid
    // Test command resolution
  }

  async rollback() {
    // Restore from backup on critical failure
  }
}
```

**Dependencies**:
- `cli-progress`: Progress bar library
- `chalk`: Colored terminal output
- `js-yaml`: YAML parsing and writing

#### 2. Bash Installer Script (`install.sh`)

**Enhancement Section** (append to existing script):

```bash
# Command Migration Function
migrate_commands() {
    local target_dir="$1"  # ~/.claude or .claude
    local commands_dir="${target_dir}/commands"
    local ai_mesh_dir="${commands_dir}/ai-mesh"
    local backup_dir="${target_dir}/commands.backup"

    echo "🔄 Migrating command files to ai-mesh/ directory..."

    # Create backup
    if [ -d "$commands_dir" ]; then
        echo "📦 Creating rolling backup..."
        rm -rf "$backup_dir"
        cp -r "$commands_dir" "$backup_dir"
    fi

    # Create ai-mesh directory
    mkdir -p "$ai_mesh_dir"

    # Migrate AI Mesh command files (those with @ai-mesh-command header)
    local migrated=0
    local errors=0

    for cmd_file in "$commands_dir"/*.{md,txt}; do
        [ -f "$cmd_file" ] || continue

        # Check for metadata header
        if grep -q "^# @ai-mesh-command" "$cmd_file" 2>/dev/null; then
            local basename=$(basename "$cmd_file")
            if mv "$cmd_file" "$ai_mesh_dir/$basename" 2>/dev/null; then
                ((migrated++))
            else
                ((errors++))
                echo "⚠️  Failed to migrate: $basename"
            fi
        fi
    done

    echo "✅ Migrated $migrated files to ai-mesh/"
    [ $errors -gt 0 ] && echo "⚠️  $errors files failed to migrate"
}
```

#### 3. YAML Path Rewriter

**File**: `src/installer/yaml-rewriter.js`

```javascript
/**
 * YAML Path Rewriter
 * Updates command source YAML files with new ai-mesh/ paths
 */

const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');

class YamlRewriter {
  constructor(yamlDir) {
    this.yamlDir = yamlDir; // commands/yaml/
  }

  async rewriteAllFiles() {
    const files = await fs.readdir(this.yamlDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml'));

    const results = [];
    for (const file of yamlFiles) {
      const result = await this.rewriteFile(path.join(this.yamlDir, file));
      results.push(result);
    }

    return results;
  }

  async rewriteFile(filePath) {
    try {
      // Parse YAML
      const content = await fs.readFile(filePath, 'utf8');
      const data = yaml.load(content);

      // Update output_path if present
      if (data.output_path && !data.output_path.startsWith('ai-mesh/')) {
        data.output_path = `ai-mesh/${data.output_path}`;
      }

      // Write back
      const updatedYaml = yaml.dump(data, { lineWidth: -1 });
      await fs.writeFile(filePath, updatedYaml, 'utf8');

      return { file: filePath, success: true };
    } catch (error) {
      return { file: filePath, success: false, error: error.message };
    }
  }
}
```

#### 4. Metadata Detection System

**Metadata Header Format**:

```markdown
# @ai-mesh-command
# Command: create-prd
# Version: 1.0.0
# Maintainer: Fortium Software Configuration Team

[Rest of command file content...]
```

**Detection Logic**:

```javascript
async function isAiMeshCommand(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const firstLine = content.split('\n')[0];
    return firstLine.trim() === '# @ai-mesh-command';
  } catch (error) {
    return false;
  }
}
```

#### 5. Enhanced CLI Implementation

**File**: `src/installer/cli-ui.js`

```javascript
/**
 * Enhanced CLI User Interface
 * Provides rich terminal output with progress bars and colors
 */

const cliProgress = require('cli-progress');
const chalk = require('chalk');

class EnhancedCLI {
  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} files | {status}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  startMigration(totalFiles) {
    console.log(chalk.bold.blue('\n🔄 Starting Command Migration\n'));
    this.progressBar.start(totalFiles, 0, { status: 'Initializing...' });
  }

  updateProgress(current, status) {
    this.progressBar.update(current, { status });
  }

  stopMigration() {
    this.progressBar.stop();
  }

  displaySuccess(migrated, errors) {
    console.log(chalk.bold.green(`\n✅ Migration Complete!`));
    console.log(chalk.green(`   • ${migrated} files migrated successfully`));
    if (errors.length > 0) {
      console.log(chalk.yellow(`   • ${errors.length} files failed (see log for details)`));
    }
  }

  displayError(message) {
    console.log(chalk.bold.red(`\n❌ Migration Failed: ${message}`));
  }

  displayWarnings(warnings) {
    console.log(chalk.bold.yellow('\n⚠️  Migration Warnings:\n'));
    warnings.forEach(w => console.log(chalk.yellow(`   • ${w}`)));
  }
}
```

#### 6. Rolling Backup System

**Implementation**:

```javascript
class BackupManager {
  constructor(targetPath) {
    this.commandsDir = path.join(targetPath, 'commands');
    this.backupDir = path.join(targetPath, 'commands.backup');
  }

  async createBackup() {
    // Remove old backup
    await fs.rm(this.backupDir, { recursive: true, force: true });

    // Create new backup
    await fs.cp(this.commandsDir, this.backupDir, { recursive: true });

    logger.info(`Backup created at ${this.backupDir}`);
  }

  async restore() {
    // Remove current commands directory
    await fs.rm(this.commandsDir, { recursive: true, force: true });

    // Restore from backup
    await fs.cp(this.backupDir, this.commandsDir, { recursive: true });

    logger.info('Backup restored successfully');
  }

  async cleanup() {
    // Remove backup after successful migration
    await fs.rm(this.backupDir, { recursive: true, force: true });
  }
}
```

---

## Technical Requirements

### TR1: Directory Structure Management

**Mapped from**: FR1 (Directory Structure Creation)

**Implementation Details**:

- **Directory Creation**: Use `fs.mkdir()` with `recursive: true` option
- **Path Detection**: Support both global (`~/.claude`) and local (`.claude`) installations
- **Permissions**: Ensure directories created with 0755 permissions
- **Validation**: Verify directory exists and is writable post-creation

**Technical Specifications**:

```javascript
// Directory creation with error handling
async function createAiMeshDirectory(basePath) {
  const aiMeshPath = path.join(basePath, 'commands', 'ai-mesh');

  try {
    await fs.mkdir(aiMeshPath, { recursive: true, mode: 0o755 });

    // Verify creation
    const stats = await fs.stat(aiMeshPath);
    if (!stats.isDirectory()) {
      throw new Error('Failed to create directory');
    }

    return aiMeshPath;
  } catch (error) {
    logger.error(`Directory creation failed: ${error.message}`);
    throw error;
  }
}
```

**Dependencies**:
- Node.js `fs/promises` module
- `path` module for cross-platform path handling

### TR2: File Migration Engine

**Mapped from**: FR2 (Command File Migration)

**Implementation Details**:

- **File Detection**: Scan for `.md` and `.txt` files with `@ai-mesh-command` metadata
- **Partial Completion**: Continue migration even if individual files fail
- **Error Logging**: Detailed error messages for each failed file
- **Atomic Operations**: Use `fs.rename()` for file-system-level atomicity
- **Validation**: Check file integrity after each move

**Command File List** (12 commands, 24 files total):

1. `create-prd.md` / `create-prd.txt`
2. `create-trd.md` / `create-trd.txt`
3. `implement-trd.md` / `implement-trd.txt`
4. `fold-prompt.md` / `fold-prompt.txt`
5. `manager-dashboard.md` / `manager-dashboard.txt`
6. `analyze-product.md` / `analyze-product.txt`
7. `refine-prd.md` / `refine-prd.txt`
8. `refine-trd.md` / `refine-trd.txt`
9. `sprint-status.md` / `sprint-status.txt`
10. `playwright-test.md` / `playwright-test.txt`
11. `generate-api-docs.md` / `generate-api-docs.txt`
12. `web-metrics-dashboard.md` / `web-metrics-dashboard.txt`

**Migration Algorithm**:

```javascript
async function migrateCommandFiles(commandsDir, aiMeshDir) {
  const files = await fs.readdir(commandsDir);
  const successes = [];
  const errors = [];

  for (const file of files) {
    if (!file.match(/\.(md|txt)$/)) continue;

    const sourcePath = path.join(commandsDir, file);
    const isAiMesh = await detectAiMeshCommand(sourcePath);

    if (isAiMesh) {
      try {
        const targetPath = path.join(aiMeshDir, file);
        await fs.rename(sourcePath, targetPath);

        // Validate moved file
        const exists = await fs.access(targetPath).then(() => true).catch(() => false);
        if (exists) {
          successes.push(file);
        } else {
          errors.push({ file, error: 'File not found after move' });
        }
      } catch (error) {
        errors.push({ file, error: error.message });
      }
    }
  }

  return { successes, errors };
}
```

### TR3: YAML Source File Rewriting

**Mapped from**: FR2 (YAML path updates)

**Implementation Details**:

- **YAML Parsing**: Use `js-yaml` library for safe parsing
- **Path Detection**: Identify `output_path` fields in YAML structure
- **Path Rewriting**: Prepend `ai-mesh/` to output paths
- **Validation**: Ensure YAML syntax remains valid after rewriting
- **Backup**: Keep original YAML in memory before writing

**YAML Update Logic**:

```javascript
async function rewriteYamlOutputPath(yamlFilePath) {
  const content = await fs.readFile(yamlFilePath, 'utf8');
  const data = yaml.load(content);

  // Check if output_path exists and needs updating
  if (data.output_path && !data.output_path.startsWith('ai-mesh/')) {
    data.output_path = `ai-mesh/${data.output_path}`;

    // Write back with proper formatting
    const updatedContent = yaml.dump(data, {
      lineWidth: -1,  // Don't wrap lines
      noRefs: true     // Don't use anchors/aliases
    });

    await fs.writeFile(yamlFilePath, updatedContent, 'utf8');

    // Validate written YAML
    const validation = await validateYamlSyntax(yamlFilePath);
    if (!validation.valid) {
      throw new Error(`YAML validation failed: ${validation.error}`);
    }

    return { updated: true, file: yamlFilePath };
  }

  return { updated: false, file: yamlFilePath };
}
```

**YAML Files to Update**:

Located in `commands/yaml/`:
- `create-prd.yaml`
- `create-trd.yaml`
- `implement-trd.yaml`
- `fold-prompt.yaml`
- `manager-dashboard.yaml`
- `analyze-product.yaml`
- `refine-prd.yaml`
- `refine-trd.yaml`
- `sprint-status.yaml`
- `playwright-test.yaml`
- `generate-api-docs.yaml`
- `web-metrics-dashboard.yaml`

### TR4: Metadata Header System

**Mapped from**: FR2 (Third-party command detection), FR5 (Documentation)

**Implementation Details**:

- **Header Format**: Standardized comment-based metadata at file start
- **Detection Algorithm**: Check first line for `# @ai-mesh-command` marker
- **Validation**: Ensure header doesn't break command parsing
- **Documentation**: Update source YAML files to include headers in generated output

**Metadata Header Specification**:

```markdown
# @ai-mesh-command
# Command: <command-name>
# Version: <semantic-version>
# Maintainer: Fortium Software Configuration Team
# Description: <brief description>

[Command content starts here...]
```

**Header Addition Process**:

```javascript
async function addMetadataHeader(commandFile, metadata) {
  const content = await fs.readFile(commandFile, 'utf8');

  const header = [
    '# @ai-mesh-command',
    `# Command: ${metadata.name}`,
    `# Version: ${metadata.version}`,
    `# Maintainer: ${metadata.maintainer}`,
    `# Description: ${metadata.description}`,
    ''  // Blank line separator
  ].join('\n');

  // Only add if not already present
  if (!content.startsWith('# @ai-mesh-command')) {
    const updatedContent = header + content;
    await fs.writeFile(commandFile, updatedContent, 'utf8');
  }
}
```

### TR5: Enhanced CLI Interface

**Mapped from**: NFR4 (Usability)

**Implementation Details**:

- **Progress Bars**: Use `cli-progress` for visual feedback
- **Colored Output**: Use `chalk` for semantic coloring (success=green, error=red, warning=yellow)
- **Status Messages**: Display current operation, files processed, errors encountered
- **Summary Report**: Display final statistics after migration

**CLI Components**:

1. **Progress Bar**: Real-time migration status
2. **Status Line**: Current file being processed
3. **Error Display**: Immediate error notifications
4. **Summary**: Final report with success/error counts

**Example Output**:

```
🔄 Starting Command Migration

████████████████████████ | 100% | 24/24 files | Validating...

✅ Migration Complete!
   • 24 files migrated successfully
   • 0 files failed
   • YAML sources updated: 12 files
   • Backup retained at: ~/.claude/commands.backup

Command resolution test: ✅ All commands accessible
```

### TR6: Validation System

**Mapped from**: FR2, NFR3 (Reliability)

**Implementation Details**:

- **File Existence**: Verify all expected files present in `ai-mesh/`
- **YAML Syntax**: Parse and validate all YAML files
- **Command Resolution**: Test that Claude Code can resolve commands
- **Link Validation**: Check internal references and file paths

**Validation Checklist**:

```javascript
async function validateMigration(aiMeshDir) {
  const validations = {
    fileExistence: await validateFileExistence(aiMeshDir),
    yamlSyntax: await validateYamlFiles(aiMeshDir),
    commandResolution: await testCommandResolution(aiMeshDir),
    permissions: await validatePermissions(aiMeshDir)
  };

  const allValid = Object.values(validations).every(v => v.valid);

  return {
    valid: allValid,
    details: validations
  };
}

async function validateFileExistence(aiMeshDir) {
  const expectedFiles = [
    'create-prd.md', 'create-prd.txt',
    'create-trd.md', 'create-trd.txt',
    // ... all 24 files
  ];

  const missing = [];
  for (const file of expectedFiles) {
    const exists = await fs.access(path.join(aiMeshDir, file))
      .then(() => true)
      .catch(() => false);

    if (!exists) missing.push(file);
  }

  return {
    valid: missing.length === 0,
    missing
  };
}
```

### TR7: Rollback System

**Mapped from**: NFR2 (Backward Compatibility), NFR3 (Reliability)

**Implementation Details**:

- **Automatic Rollback**: Trigger on critical migration failures
- **Rolling Backup**: Single backup, replaced on next successful migration
- **Restoration**: Full restoration of original directory structure
- **Validation**: Verify restoration completeness

**Rollback Triggers**:

1. **Critical Errors**: File system errors, permission issues
2. **Validation Failures**: More than 50% of files fail validation
3. **YAML Corruption**: Unable to parse or rewrite YAML sources
4. **User Request**: Manual rollback via command flag

**Rollback Implementation**:

```javascript
async function rollbackMigration(backupDir, commandsDir) {
  logger.info('Initiating rollback...');

  try {
    // Remove ai-mesh directory
    const aiMeshDir = path.join(commandsDir, 'ai-mesh');
    await fs.rm(aiMeshDir, { recursive: true, force: true });

    // Restore files from backup
    const backupFiles = await fs.readdir(backupDir);

    for (const file of backupFiles) {
      const sourcePath = path.join(backupDir, file);
      const targetPath = path.join(commandsDir, file);

      await fs.copyFile(sourcePath, targetPath);
    }

    // Validate restoration
    const validation = await validateRestoration(commandsDir, backupDir);

    if (!validation.valid) {
      throw new Error('Rollback validation failed');
    }

    logger.info('Rollback completed successfully');
    return { success: true };
  } catch (error) {
    logger.error(`Rollback failed: ${error.message}`);
    throw new Error('Critical: Rollback failed. Manual intervention required.');
  }
}
```

---

## Implementation Phases

### Phase 1: Preparation (Week 1)

**Goal**: Establish foundation for migration system

**Key Deliverables**:
- Enhanced YAML schema with directory path support
- Metadata headers added to all AI Mesh command source files
- Comprehensive test suite structure
- Rollback procedure documentation
- Enhanced CLI design and implementation
- Dry-run mode for installer

**Technical Focus**:
- Schema validation updates
- Metadata system implementation
- Test infrastructure setup
- CLI component development

### Phase 2: Core Implementation (Week 2)

**Goal**: Build complete migration engine

**Key Deliverables**:
- NPM installer module with migration logic
- YAML path rewriter implementation
- Bash installer script updates
- Automated migration script with partial completion
- Rolling backup mechanism
- Validation system implementation
- Third-party command detection via metadata

**Technical Focus**:
- File system operations
- YAML parsing and rewriting
- Error handling and logging
- Progress tracking and reporting

### Phase 3: Documentation & Testing (Week 3)

**Goal**: Ensure production readiness through comprehensive testing

**Key Deliverables**:
- Complete documentation updates
- Migration guide for existing users
- 85% code coverage with unit and integration tests
- Performance benchmarking via CI/CD
- 6 mandatory test scenarios fully implemented
- Security and permission testing

**Technical Focus**:
- Test coverage completion
- Performance optimization
- Documentation accuracy
- Edge case handling

### Phase 4: Rollout & Monitoring (Week 4)

**Goal**: Production deployment with monitoring

**Key Deliverables**:
- Beta release to early adopters
- Installation success rate monitoring
- User feedback collection system
- Production release with metrics
- Post-deployment support documentation

**Technical Focus**:
- Deployment automation
- Metrics collection
- User support processes
- Continuous monitoring

---

## Master Task List

### Sprint 1: Preparation & Foundation (Week 1)

#### Schema & Metadata Tasks

- [ ] **TRD-001**: Update YAML schema to support directory paths in `output_path` field (2h) - Priority: High - Depends: None
- [ ] **TRD-002**: Create metadata header template and specification document (1h) - Priority: High - Depends: None
- [ ] **TRD-003**: Add `@ai-mesh-command` headers to all 12 command source YAML files (3h) - Priority: High - Depends: TRD-002
- [ ] **TRD-004**: Update command generation script to include metadata headers in output (2h) - Priority: High - Depends: TRD-002

#### Test Infrastructure Tasks

- [ ] **TRD-005**: Create test directory structure and fixtures (1h) - Priority: High - Depends: None
- [ ] **TRD-006**: Implement migration validation test suite skeleton (2h) - Priority: High - Depends: TRD-005
- [ ] **TRD-007**: Create mock command files for testing (1h) - Priority: Medium - Depends: TRD-005
- [ ] **TRD-008**: Set up CI/CD performance testing framework (3h) - Priority: High - Depends: TRD-006

#### Enhanced CLI Tasks

- [ ] **TRD-009**: Design CLI output format and color scheme (1h) - Priority: Medium - Depends: None
- [ ] **TRD-010**: Implement progress bar component with `cli-progress` (2h) - Priority: High - Depends: TRD-009
- [ ] **TRD-011**: Implement colored output system with `chalk` (2h) - Priority: High - Depends: TRD-009
- [ ] **TRD-012**: Create status message formatting utilities (1h) - Priority: Medium - Depends: TRD-011

#### Documentation Tasks

- [ ] **TRD-013**: Document rollback procedures with examples (2h) - Priority: High - Depends: None
- [ ] **TRD-014**: Create dry-run mode usage guide (1h) - Priority: Medium - Depends: None
- [ ] **TRD-015**: Write migration troubleshooting guide (2h) - Priority: Medium - Depends: TRD-013

#### Installer Enhancement Tasks

- [ ] **TRD-016**: Add dry-run mode flag to NPM installer CLI (2h) - Priority: High - Depends: None
- [ ] **TRD-017**: Implement dry-run simulation logic (3h) - Priority: High - Depends: TRD-016

**Sprint 1 Total**: 28 hours across 17 tasks

---

### Sprint 2: Core Implementation (Week 2)

#### NPM Installer Module Tasks

- [ ] **TRD-018**: Create `CommandMigrator` class with core structure (3h) - Priority: High - Depends: TRD-001
- [ ] **TRD-019**: Implement `scanExistingCommands()` with metadata detection (3h) - Priority: High - Depends: TRD-003, TRD-018
- [ ] **TRD-020**: Implement `createAiMeshDirectory()` with permission handling (2h) - Priority: High - Depends: TRD-018
- [ ] **TRD-021**: Implement `migrateCommandFiles()` with partial completion (4h) - Priority: High - Depends: TRD-019, TRD-020
- [ ] **TRD-022**: Implement error logging and reporting system (2h) - Priority: High - Depends: TRD-021
- [ ] **TRD-023**: Integrate enhanced CLI into migration process (3h) - Priority: High - Depends: TRD-010, TRD-011, TRD-021

#### YAML Rewriter Tasks

- [ ] **TRD-024**: Create `YamlRewriter` class with YAML parsing (2h) - Priority: High - Depends: TRD-001
- [ ] **TRD-025**: Implement path detection and rewriting logic (3h) - Priority: High - Depends: TRD-024
- [ ] **TRD-026**: Implement YAML validation after rewriting (2h) - Priority: High - Depends: TRD-025
- [ ] **TRD-027**: Add error handling for corrupted YAML files (2h) - Priority: Medium - Depends: TRD-025

#### Backup & Rollback Tasks

- [ ] **TRD-028**: Create `BackupManager` class with rolling backup logic (3h) - Priority: High - Depends: None
- [ ] **TRD-029**: Implement backup creation with file system operations (2h) - Priority: High - Depends: TRD-028
- [ ] **TRD-030**: Implement rollback restoration logic (3h) - Priority: High - Depends: TRD-028, TRD-029
- [ ] **TRD-031**: Add rollback validation checks (2h) - Priority: High - Depends: TRD-030

#### Bash Installer Tasks

- [ ] **TRD-032**: Create `migrate_commands()` function in `install.sh` (2h) - Priority: High - Depends: TRD-003
- [ ] **TRD-033**: Implement metadata detection in bash (grep-based) (2h) - Priority: High - Depends: TRD-032
- [ ] **TRD-034**: Add error handling and partial completion to bash migration (2h) - Priority: Medium - Depends: TRD-032
- [ ] **TRD-035**: Integrate migration into main installation flow (1h) - Priority: High - Depends: TRD-032, TRD-034

#### Validation System Tasks

- [ ] **TRD-036**: Implement file existence validation (2h) - Priority: High - Depends: TRD-021
- [ ] **TRD-037**: Implement YAML syntax validation for migrated files (2h) - Priority: High - Depends: TRD-026
- [ ] **TRD-038**: Create command resolution test suite (3h) - Priority: High - Depends: TRD-036
- [ ] **TRD-039**: Implement validation summary reporting (2h) - Priority: Medium - Depends: TRD-036, TRD-037, TRD-038

**Sprint 2 Total**: 49 hours across 22 tasks

---

### Sprint 3: Documentation & Testing (Week 3)

#### Documentation Tasks

- [ ] **TRD-040**: Update README.md with new directory structure (2h) - Priority: High - Depends: TRD-021
- [ ] **TRD-041**: Update CLAUDE.md with command path references (2h) - Priority: High - Depends: TRD-021
- [ ] **TRD-042**: Update installation guides with migration information (2h) - Priority: High - Depends: TRD-021
- [ ] **TRD-043**: Create comprehensive migration guide for existing users (3h) - Priority: High - Depends: TRD-040, TRD-041
- [ ] **TRD-044**: Update troubleshooting documentation with path examples (2h) - Priority: Medium - Depends: TRD-042
- [ ] **TRD-045**: Update architecture diagrams if present (2h) - Priority: Low - Depends: TRD-040

#### Unit Testing Tasks

- [ ] **TRD-046**: Write unit tests for `CommandMigrator` class (4h) - Priority: High - Depends: TRD-018
- [ ] **TRD-047**: Write unit tests for `YamlRewriter` class (3h) - Priority: High - Depends: TRD-024
- [ ] **TRD-048**: Write unit tests for `BackupManager` class (3h) - Priority: High - Depends: TRD-028
- [ ] **TRD-049**: Write unit tests for metadata detection logic (2h) - Priority: High - Depends: TRD-019
- [ ] **TRD-050**: Write unit tests for validation system (3h) - Priority: High - Depends: TRD-036, TRD-037

#### Integration Testing Tasks (Mandatory Scenarios)

- [ ] **TRD-051**: Implement **Scenario 1: Fresh Installation** test (3h) - Priority: High - Depends: TRD-046
- [ ] **TRD-052**: Implement **Scenario 2: Full Migration** test (3h) - Priority: High - Depends: TRD-046, TRD-048
- [ ] **TRD-053**: Implement **Scenario 3: Mixed Commands Migration** test (4h) - Priority: High - Depends: TRD-049, TRD-052
- [ ] **TRD-054**: Implement **Scenario 4: Corrupted Files Handling** test (3h) - Priority: High - Depends: TRD-022, TRD-052
- [ ] **TRD-055**: Implement **Scenario 5: Permission Issues** test (3h) - Priority: High - Depends: TRD-022, TRD-052
- [ ] **TRD-056**: Implement **Scenario 6: Rollback After Failure** test (4h) - Priority: High - Depends: TRD-030, TRD-052

#### Performance Testing Tasks

- [ ] **TRD-057**: Create performance benchmarking suite (3h) - Priority: High - Depends: TRD-008
- [ ] **TRD-058**: Implement command resolution performance tests (<100ms) (2h) - Priority: High - Depends: TRD-057
- [ ] **TRD-059**: Implement installer execution time tests (<5% increase) (2h) - Priority: Medium - Depends: TRD-057
- [ ] **TRD-060**: Integrate performance tests into CI/CD pipeline (3h) - Priority: High - Depends: TRD-057, TRD-058

#### Coverage & Quality Tasks

- [ ] **TRD-061**: Measure and verify 85% overall code coverage (2h) - Priority: High - Depends: TRD-046, TRD-047, TRD-048, TRD-049, TRD-050
- [ ] **TRD-062**: Achieve 95% coverage for migration logic (2h) - Priority: High - Depends: TRD-046, TRD-061
- [ ] **TRD-063**: Achieve 90% coverage for validation functions (2h) - Priority: High - Depends: TRD-050, TRD-061
- [ ] **TRD-064**: Achieve 95% coverage for rollback mechanisms (2h) - Priority: High - Depends: TRD-048, TRD-061

**Sprint 3 Total**: 61 hours across 25 tasks

---

### Sprint 4: Rollout & Monitoring (Week 4)

#### Beta Release Tasks

- [ ] **TRD-065**: Create beta release package (2h) - Priority: High - Depends: TRD-061
- [ ] **TRD-066**: Set up early adopter feedback collection system (2h) - Priority: High - Depends: TRD-065
- [ ] **TRD-067**: Deploy beta to early adopter group (3h) - Priority: High - Depends: TRD-065, TRD-066
- [ ] **TRD-068**: Monitor beta installation success rates (4h) - Priority: High - Depends: TRD-067

#### Monitoring & Metrics Tasks

- [ ] **TRD-069**: Implement installation success rate tracking (3h) - Priority: High - Depends: TRD-023
- [ ] **TRD-070**: Set up automated alerting for installation failures (2h) - Priority: Medium - Depends: TRD-069
- [ ] **TRD-071**: Create migration metrics dashboard (3h) - Priority: Medium - Depends: TRD-069
- [ ] **TRD-072**: Implement command discovery time tracking (2h) - Priority: Low - Depends: TRD-071

#### User Feedback Tasks

- [ ] **TRD-073**: Create user satisfaction survey (1h) - Priority: High - Depends: TRD-067
- [ ] **TRD-074**: Collect and analyze beta user feedback (4h) - Priority: High - Depends: TRD-068, TRD-073
- [ ] **TRD-075**: Address critical beta feedback issues (8h) - Priority: High - Depends: TRD-074
- [ ] **TRD-076**: Update documentation based on user feedback (2h) - Priority: Medium - Depends: TRD-074

#### Production Release Tasks

- [ ] **TRD-077**: Prepare production release notes and changelog (2h) - Priority: High - Depends: TRD-075
- [ ] **TRD-078**: Create production deployment plan (2h) - Priority: High - Depends: TRD-077
- [ ] **TRD-079**: Execute production release (3h) - Priority: High - Depends: TRD-078
- [ ] **TRD-080**: Monitor production installation metrics (ongoing, 4h allocation) - Priority: High - Depends: TRD-079

#### Post-Deployment Tasks

- [ ] **TRD-081**: Create post-deployment support documentation (2h) - Priority: High - Depends: TRD-079
- [ ] **TRD-082**: Set up support ticket monitoring for migration issues (2h) - Priority: Medium - Depends: TRD-081
- [ ] **TRD-083**: Conduct post-release retrospective (2h) - Priority: Medium - Depends: TRD-080
- [ ] **TRD-084**: Document lessons learned and improvement opportunities (2h) - Priority: Low - Depends: TRD-083

**Sprint 4 Total**: 49 hours across 20 tasks

---

## Sprint Breakdowns

### Sprint 1: Preparation & Foundation (Week 1)

**Sprint Goal**: Establish complete foundation for migration system with schemas, metadata, testing infrastructure, and enhanced CLI.

**Sprint Backlog**:

| Task ID | Task Description | Estimate | Priority | Category |
|---------|-----------------|----------|----------|----------|
| TRD-001 | Update YAML schema for directory paths | 2h | High | Schema |
| TRD-002 | Create metadata header template | 1h | High | Metadata |
| TRD-003 | Add headers to all command YAML files | 3h | High | Metadata |
| TRD-004 | Update command generation script | 2h | High | Metadata |
| TRD-005 | Create test directory structure | 1h | High | Testing |
| TRD-006 | Implement test suite skeleton | 2h | High | Testing |
| TRD-007 | Create mock command files | 1h | Medium | Testing |
| TRD-008 | Set up CI/CD performance framework | 3h | High | Testing |
| TRD-009 | Design CLI output format | 1h | Medium | CLI |
| TRD-010 | Implement progress bar component | 2h | High | CLI |
| TRD-011 | Implement colored output system | 2h | High | CLI |
| TRD-012 | Create status message utilities | 1h | Medium | CLI |
| TRD-013 | Document rollback procedures | 2h | High | Docs |
| TRD-014 | Create dry-run mode guide | 1h | Medium | Docs |
| TRD-015 | Write migration troubleshooting guide | 2h | Medium | Docs |
| TRD-016 | Add dry-run mode flag to installer | 2h | High | Installer |
| TRD-017 | Implement dry-run simulation logic | 3h | High | Installer |

**Sprint Outcomes**:
- ✅ All YAML schemas support directory paths
- ✅ All command files have metadata headers
- ✅ Test infrastructure ready for development
- ✅ Enhanced CLI components implemented
- ✅ Dry-run mode operational
- ✅ Complete rollback documentation

**Sprint Definition of Done**:
- [ ] YAML schema validated against existing command files
- [ ] All 12 command source files have `@ai-mesh-command` headers
- [ ] Test suite runs successfully (even with placeholder tests)
- [ ] CI/CD framework can execute performance tests
- [ ] CLI progress bar displays correctly in terminal
- [ ] Dry-run mode produces accurate simulation output
- [ ] Rollback documentation includes manual and automated procedures

---

### Sprint 2: Core Implementation (Week 2)

**Sprint Goal**: Build complete migration engine with NPM installer module, YAML rewriter, backup system, and bash installer parity.

**Sprint Backlog**:

| Task ID | Task Description | Estimate | Priority | Category |
|---------|-----------------|----------|----------|----------|
| TRD-018 | Create CommandMigrator class | 3h | High | NPM Module |
| TRD-019 | Implement scanExistingCommands() | 3h | High | NPM Module |
| TRD-020 | Implement createAiMeshDirectory() | 2h | High | NPM Module |
| TRD-021 | Implement migrateCommandFiles() | 4h | High | NPM Module |
| TRD-022 | Implement error logging system | 2h | High | NPM Module |
| TRD-023 | Integrate enhanced CLI | 3h | High | NPM Module |
| TRD-024 | Create YamlRewriter class | 2h | High | YAML |
| TRD-025 | Implement path rewriting logic | 3h | High | YAML |
| TRD-026 | Implement YAML validation | 2h | High | YAML |
| TRD-027 | Add error handling for corrupted YAML | 2h | Medium | YAML |
| TRD-028 | Create BackupManager class | 3h | High | Backup |
| TRD-029 | Implement backup creation | 2h | High | Backup |
| TRD-030 | Implement rollback restoration | 3h | High | Backup |
| TRD-031 | Add rollback validation | 2h | High | Backup |
| TRD-032 | Create migrate_commands() bash function | 2h | High | Bash |
| TRD-033 | Implement metadata detection in bash | 2h | High | Bash |
| TRD-034 | Add error handling to bash migration | 2h | Medium | Bash |
| TRD-035 | Integrate migration into bash installer | 1h | High | Bash |
| TRD-036 | Implement file existence validation | 2h | High | Validation |
| TRD-037 | Implement YAML syntax validation | 2h | High | Validation |
| TRD-038 | Create command resolution tests | 3h | High | Validation |
| TRD-039 | Implement validation summary reporting | 2h | Medium | Validation |

**Sprint Outcomes**:
- ✅ Full NPM installer migration module operational
- ✅ YAML source files automatically updated
- ✅ Rolling backup system implemented
- ✅ Bash installer feature parity with NPM module
- ✅ Comprehensive validation system
- ✅ Error handling and reporting complete

**Sprint Definition of Done**:
- [ ] NPM installer can migrate all 12 commands successfully
- [ ] YAML rewriter updates all source files without syntax errors
- [ ] Backup created before every migration
- [ ] Rollback successfully restores original state
- [ ] Bash installer produces identical results to NPM installer
- [ ] Validation detects and reports all migration issues
- [ ] All code passes linting and formatting checks

---

### Sprint 3: Documentation & Testing (Week 3)

**Sprint Goal**: Achieve production readiness through comprehensive testing (85% coverage, 6 mandatory scenarios) and complete documentation.

**Sprint Backlog**:

| Task ID | Task Description | Estimate | Priority | Category |
|---------|-----------------|----------|----------|----------|
| TRD-040 | Update README.md | 2h | High | Docs |
| TRD-041 | Update CLAUDE.md | 2h | High | Docs |
| TRD-042 | Update installation guides | 2h | High | Docs |
| TRD-043 | Create migration guide | 3h | High | Docs |
| TRD-044 | Update troubleshooting docs | 2h | Medium | Docs |
| TRD-045 | Update architecture diagrams | 2h | Low | Docs |
| TRD-046 | Unit tests for CommandMigrator | 4h | High | Unit Tests |
| TRD-047 | Unit tests for YamlRewriter | 3h | High | Unit Tests |
| TRD-048 | Unit tests for BackupManager | 3h | High | Unit Tests |
| TRD-049 | Unit tests for metadata detection | 2h | High | Unit Tests |
| TRD-050 | Unit tests for validation system | 3h | High | Unit Tests |
| TRD-051 | **Mandatory: Fresh Installation test** | 3h | High | Integration |
| TRD-052 | **Mandatory: Full Migration test** | 3h | High | Integration |
| TRD-053 | **Mandatory: Mixed Commands test** | 4h | High | Integration |
| TRD-054 | **Mandatory: Corrupted Files test** | 3h | High | Integration |
| TRD-055 | **Mandatory: Permission Issues test** | 3h | High | Integration |
| TRD-056 | **Mandatory: Rollback test** | 4h | High | Integration |
| TRD-057 | Create performance benchmark suite | 3h | High | Performance |
| TRD-058 | Command resolution tests (<100ms) | 2h | High | Performance |
| TRD-059 | Installer execution time tests | 2h | Medium | Performance |
| TRD-060 | Integrate performance tests into CI/CD | 3h | High | Performance |
| TRD-061 | Verify 85% overall coverage | 2h | High | Coverage |
| TRD-062 | Achieve 95% migration logic coverage | 2h | High | Coverage |
| TRD-063 | Achieve 90% validation coverage | 2h | High | Coverage |
| TRD-064 | Achieve 95% rollback coverage | 2h | High | Coverage |

**Sprint Outcomes**:
- ✅ All documentation updated and accurate
- ✅ 85% code coverage achieved
- ✅ All 6 mandatory test scenarios passing
- ✅ Performance benchmarks integrated into CI/CD
- ✅ Critical path components exceed coverage targets
- ✅ Complete migration guide for users

**Sprint Definition of Done**:
- [ ] All documentation reviewed and approved
- [ ] Test coverage meets 85% overall target
- [ ] Migration logic coverage ≥ 95%
- [ ] Validation functions coverage ≥ 90%
- [ ] Rollback mechanisms coverage ≥ 95%
- [ ] All 6 mandatory scenarios pass consistently
- [ ] Performance tests pass with <100ms threshold
- [ ] CI/CD pipeline runs all tests automatically

---

### Sprint 4: Rollout & Monitoring (Week 4)

**Sprint Goal**: Execute beta and production releases with comprehensive monitoring, user feedback collection, and post-deployment support.

**Sprint Backlog**:

| Task ID | Task Description | Estimate | Priority | Category |
|---------|-----------------|----------|----------|----------|
| TRD-065 | Create beta release package | 2h | High | Beta |
| TRD-066 | Set up feedback collection system | 2h | High | Beta |
| TRD-067 | Deploy beta to early adopters | 3h | High | Beta |
| TRD-068 | Monitor beta installation rates | 4h | High | Beta |
| TRD-069 | Implement success rate tracking | 3h | High | Monitoring |
| TRD-070 | Set up automated alerting | 2h | Medium | Monitoring |
| TRD-071 | Create migration metrics dashboard | 3h | Medium | Monitoring |
| TRD-072 | Implement discovery time tracking | 2h | Low | Monitoring |
| TRD-073 | Create user satisfaction survey | 1h | High | Feedback |
| TRD-074 | Collect and analyze feedback | 4h | High | Feedback |
| TRD-075 | Address critical beta issues | 8h | High | Feedback |
| TRD-076 | Update docs based on feedback | 2h | Medium | Feedback |
| TRD-077 | Prepare release notes | 2h | High | Production |
| TRD-078 | Create deployment plan | 2h | High | Production |
| TRD-079 | Execute production release | 3h | High | Production |
| TRD-080 | Monitor production metrics | 4h | High | Production |
| TRD-081 | Create support documentation | 2h | High | Post-Deploy |
| TRD-082 | Set up support ticket monitoring | 2h | Medium | Post-Deploy |
| TRD-083 | Conduct retrospective | 2h | Medium | Post-Deploy |
| TRD-084 | Document lessons learned | 2h | Low | Post-Deploy |

**Sprint Outcomes**:
- ✅ Beta release deployed and monitored
- ✅ Critical feedback addressed
- ✅ Production release successful
- ✅ Monitoring and alerting operational
- ✅ Support documentation complete
- ✅ Lessons learned documented

**Sprint Definition of Done**:
- [ ] Beta deployed to at least 10 early adopters
- [ ] Installation success rate ≥ 98%
- [ ] User satisfaction ≥ 90% (survey results)
- [ ] All critical beta issues resolved
- [ ] Production release deployed without rollback
- [ ] Metrics dashboard showing healthy migration trends
- [ ] Support documentation accessible to users
- [ ] Retrospective completed with action items

---

## Task Completion Tracking

### Overall Progress

**Total Tasks**: 84
**Completed**: 0
**In Progress**: 0
**Pending**: 84

**Overall Completion**: 0%

### Sprint Progress

| Sprint | Tasks | Completed | In Progress | Pending | Completion % |
|--------|-------|-----------|-------------|---------|--------------|
| Sprint 1 | 17 | 0 | 0 | 17 | 0% |
| Sprint 2 | 22 | 0 | 0 | 22 | 0% |
| Sprint 3 | 25 | 0 | 0 | 25 | 0% |
| Sprint 4 | 20 | 0 | 0 | 20 | 0% |

### Category Progress

| Category | Tasks | Estimate | Completion % |
|----------|-------|----------|--------------|
| Schema & Metadata | 4 | 8h | 0% |
| Testing Infrastructure | 4 | 7h | 0% |
| Enhanced CLI | 4 | 6h | 0% |
| Documentation | 13 | 24h | 0% |
| NPM Module | 6 | 17h | 0% |
| YAML Rewriter | 4 | 9h | 0% |
| Backup & Rollback | 4 | 10h | 0% |
| Bash Installer | 4 | 7h | 0% |
| Validation | 4 | 9h | 0% |
| Unit Testing | 5 | 15h | 0% |
| Integration Testing | 6 | 20h | 0% |
| Performance Testing | 4 | 10h | 0% |
| Coverage & Quality | 4 | 8h | 0% |
| Beta Release | 4 | 11h | 0% |
| Monitoring | 4 | 10h | 0% |
| User Feedback | 4 | 15h | 0% |
| Production Release | 4 | 11h | 0% |
| Post-Deployment | 4 | 8h | 0% |

---

## Testing Strategy

### Test Coverage Targets

**Overall Coverage**: 85% (minimum across all modules)

**Component-Specific Targets**:

| Component | Coverage Target | Rationale |
|-----------|----------------|-----------|
| Migration Logic | 95% | Critical path, must be bulletproof |
| Installer Modules | 85% | Core functionality, standard target |
| Validation Functions | 90% | Quality assurance, high importance |
| Rollback Mechanisms | 95% | Safety-critical, must be reliable |
| CLI Output/Formatting | 70% | UI layer, lower criticality |
| YAML Rewriter | 85% | Important but isolated functionality |

### Testing Pyramid

```
           ┌────────────────┐
           │  E2E Tests     │  6 mandatory scenarios
           │  (Integration) │  20% of test effort
           └────────────────┘
                  │
         ┌────────────────────┐
         │  Integration Tests │  Component interaction
         │  (Module Level)    │  30% of test effort
         └────────────────────┘
                  │
      ┌──────────────────────────┐
      │     Unit Tests           │  Individual functions
      │  (Function Level)        │  50% of test effort
      └──────────────────────────┘
```

### Mandatory Test Scenarios

#### Scenario 1: Fresh Installation

**Objective**: Verify clean installation creates correct structure

**Pre-conditions**:
- No existing `.claude/commands/` directory
- Clean system environment

**Test Steps**:
1. Run installer with fresh installation flag
2. Verify `ai-mesh/` directory created
3. Verify all 24 command files present in `ai-mesh/`
4. Validate all YAML syntax
5. Test command resolution for all commands

**Expected Results**:
- ✅ Directory `~/.claude/commands/ai-mesh/` exists
- ✅ All 24 files present with correct permissions (0644)
- ✅ All YAML files parse successfully
- ✅ All commands resolve correctly (e.g., `/create-trd`)
- ✅ No backup directory created (not needed for fresh install)

**Success Criteria**: 100% pass rate, zero errors

---

#### Scenario 2: Full Migration

**Objective**: Verify complete migration of all AI Mesh commands

**Pre-conditions**:
- All 24 AI Mesh command files exist in flat structure
- All files have `@ai-mesh-command` metadata headers
- Clean YAML source files

**Test Steps**:
1. Run installer with migration mode
2. Verify backup created in `.backup/` directory
3. Verify all files moved to `ai-mesh/`
4. Validate YAML source files updated
5. Test command resolution
6. Verify no files left in flat structure

**Expected Results**:
- ✅ Backup contains all 24 original files
- ✅ `ai-mesh/` directory contains all 24 files
- ✅ All YAML source files have `ai-mesh/` prefix in `output_path`
- ✅ All commands resolve correctly
- ✅ Flat directory contains no AI Mesh command files

**Success Criteria**: 100% migration success, all validations pass

---

#### Scenario 3: Mixed Commands Migration

**Objective**: Verify selective migration (AI Mesh only, leave third-party)

**Pre-conditions**:
- 24 AI Mesh command files with metadata headers
- 5 third-party command files without metadata headers
- Mixed directory structure

**Test Steps**:
1. Run installer with migration mode
2. Verify AI Mesh files migrated
3. Verify third-party files remain in flat structure
4. Test both AI Mesh and third-party command resolution
5. Validate no interference between command sets

**Expected Results**:
- ✅ 24 AI Mesh files in `ai-mesh/` directory
- ✅ 5 third-party files remain in `commands/` directory
- ✅ All AI Mesh commands resolve correctly
- ✅ All third-party commands resolve correctly
- ✅ No cross-contamination or conflicts

**Success Criteria**: 100% selective migration accuracy

---

#### Scenario 4: Corrupted Files Handling

**Objective**: Verify partial migration with error reporting

**Pre-conditions**:
- 20 valid AI Mesh command files
- 4 corrupted/invalid files (syntax errors, missing headers, etc.)

**Test Steps**:
1. Run installer with migration mode
2. Verify partial migration completes
3. Check error log for failed files
4. Validate successfully migrated files
5. Verify detailed warning report

**Expected Results**:
- ✅ 20 valid files migrated successfully
- ✅ 4 corrupted files logged with specific errors
- ✅ Detailed warning report displayed
- ✅ Migration marked as "partial success"
- ✅ All valid files functional post-migration

**Success Criteria**: Partial completion with accurate error reporting

---

#### Scenario 5: Permission Issues

**Objective**: Verify graceful handling of file system permission errors

**Pre-conditions**:
- Some command files read-only (chmod 444)
- Some directories permission-restricted (chmod 555)
- Mixed permission environment

**Test Steps**:
1. Run installer with migration mode
2. Verify graceful handling of permission errors
3. Check detailed error messages
4. Validate partial migration where possible
5. Verify rollback available if critical

**Expected Results**:
- ✅ Clear error messages for permission failures
- ✅ Partial migration of accessible files
- ✅ Specific guidance for resolving permission issues
- ✅ Rollback available if majority of files fail
- ✅ No silent failures or data corruption

**Success Criteria**: 100% of permission errors caught and reported

---

#### Scenario 6: Rollback After Failure

**Objective**: Verify automatic rollback on critical migration failure

**Pre-conditions**:
- Valid command files in flat structure
- Simulated critical error condition (disk full, etc.)

**Test Steps**:
1. Run installer with simulated failure
2. Verify rollback triggered automatically
3. Check restoration from backup
4. Validate original structure restored
5. Verify clear error reporting

**Expected Results**:
- ✅ Rollback triggered on critical error
- ✅ Original directory structure fully restored
- ✅ All original files intact and functional
- ✅ Backup validation confirms restoration
- ✅ Clear error message with actionable guidance

**Success Criteria**: 100% restoration accuracy, zero data loss

---

### Performance Testing

#### Performance Benchmarks

**Command Resolution Time**:
- **Target**: < 100ms per command invocation
- **Measurement**: 100 sequential command resolutions
- **Pass Criteria**: P95 latency < 100ms

**Installer Execution Time**:
- **Target**: < 5% increase from baseline
- **Baseline**: Current installer execution time (~2-3 seconds)
- **Pass Criteria**: New installer execution time < 3.15 seconds (5% buffer)

**Cold Start Performance**:
- **Target**: First command after Claude Code restart < 150ms
- **Measurement**: Command resolution immediately after restart
- **Pass Criteria**: P95 latency < 150ms

**Concurrent Invocation**:
- **Target**: No degradation with 10 parallel command invocations
- **Measurement**: 10 parallel commands, measure P95 latency
- **Pass Criteria**: P95 latency < 200ms

#### CI/CD Integration

**Automated Performance Tests**:

```yaml
# .github/workflows/performance-tests.yml
name: Performance Testing

on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run performance benchmarks
        run: npm run test:performance

      - name: Check thresholds
        run: |
          node scripts/check-performance-thresholds.js \
            --command-resolution 100 \
            --installer-overhead 5

      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: test-results/performance/
```

**Threshold Monitoring**:

```javascript
// scripts/check-performance-thresholds.js
const fs = require('fs');

function checkThresholds(results, thresholds) {
  const failures = [];

  if (results.commandResolution.p95 > thresholds.commandResolution) {
    failures.push(`Command resolution P95 (${results.commandResolution.p95}ms) exceeds threshold (${thresholds.commandResolution}ms)`);
  }

  if (results.installerOverhead > thresholds.installerOverhead) {
    failures.push(`Installer overhead (${results.installerOverhead}%) exceeds threshold (${thresholds.installerOverhead}%)`);
  }

  if (failures.length > 0) {
    console.error('❌ Performance thresholds violated:');
    failures.forEach(f => console.error(`   • ${f}`));
    process.exit(1);
  }

  console.log('✅ All performance thresholds met');
}
```

---

## Performance Requirements

### NFR1: Command Resolution Performance

**Requirement**: Command resolution time must remain < 100ms

**Implementation**:

- **Baseline Measurement**: Establish current command resolution time
- **Test Methodology**: 100 sequential command invocations, measure P95 latency
- **Monitoring**: CI/CD automated performance tests on every commit
- **Alerting**: Fail build if P95 > 100ms

**Technical Approach**:

```javascript
// test/performance/command-resolution.spec.js
const { performance } = require('perf_hooks');

async function measureCommandResolution(commandPath, iterations = 100) {
  const timings = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await resolveCommand(commandPath);
    const end = performance.now();

    timings.push(end - start);
  }

  // Calculate P95
  timings.sort((a, b) => a - b);
  const p95Index = Math.floor(timings.length * 0.95);
  const p95 = timings[p95Index];

  return {
    p95,
    mean: timings.reduce((a, b) => a + b) / timings.length,
    min: timings[0],
    max: timings[timings.length - 1]
  };
}
```

**Success Criteria**: P95 latency < 100ms across all commands

---

### NFR2: Installer Execution Time

**Requirement**: Installation time increase must be < 5%

**Implementation**:

- **Baseline**: Current installer execution time (~2-3 seconds)
- **Target**: New installer execution time < 3.15 seconds (5% overhead)
- **Measurement**: End-to-end installation including migration
- **Monitoring**: CI/CD performance suite

**Technical Approach**:

```javascript
// test/performance/installer-execution.spec.js
async function measureInstallerPerformance() {
  const start = performance.now();

  // Run full installation
  await runInstaller({
    scope: 'global',
    skipBackup: false,
    verbose: false
  });

  const end = performance.now();
  const duration = end - start;

  const baseline = 2500; // 2.5 seconds baseline
  const overhead = ((duration - baseline) / baseline) * 100;

  return { duration, overhead };
}
```

**Success Criteria**: Execution time overhead < 5%

---

### NFR3: Memory Usage

**Requirement**: Migration process memory footprint < 50MB

**Implementation**:

- **Measurement**: Peak memory usage during migration
- **Monitoring**: Track memory allocation during large migrations (100+ files)
- **Optimization**: Stream processing for large files, cleanup after each step

**Technical Approach**:

```javascript
// src/installer/memory-monitor.js
class MemoryMonitor {
  constructor() {
    this.peak = 0;
  }

  measure() {
    const usage = process.memoryUsage();
    const current = usage.heapUsed / 1024 / 1024; // MB

    if (current > this.peak) {
      this.peak = current;
    }

    return current;
  }

  getPeak() {
    return this.peak;
  }
}
```

**Success Criteria**: Peak memory usage < 50MB

---

## Risk Mitigation

### Technical Risks

#### Risk 1: Command Resolution Breaks

**Impact**: High - Users unable to execute commands
**Probability**: Low - Claude Code native subdirectory support
**Mitigation**:

1. **Comprehensive Testing**: Test all command invocation patterns
2. **Rollback Mechanism**: Automatic restoration on validation failure
3. **Phased Rollout**: Beta testing with early adopters
4. **Monitoring**: Real-time command resolution error tracking

**Contingency Plan**:
- Automatic rollback if > 10% of command invocations fail
- Emergency hotfix process with <2 hour turnaround
- Manual rollback instructions in documentation

---

#### Risk 2: Installation Failures Increase

**Impact**: High - Poor user experience, support burden
**Probability**: Low - Extensive testing and validation
**Mitigation**:

1. **Dry-Run Mode**: Users can test migration before executing
2. **Partial Completion**: Continue with valid files, log errors
3. **Enhanced Error Reporting**: Detailed, actionable error messages
4. **Validation Checks**: Pre-flight checks for common issues

**Contingency Plan**:
- Maintain ≥ 98% installation success rate
- Automated alerting on installation failure rate increase
- Dedicated support channel for migration issues

---

#### Risk 3: YAML Corruption During Rewriting

**Impact**: Medium - Source files damaged, regeneration required
**Probability**: Very Low - YAML validation after every write
**Mitigation**:

1. **Backup Before Rewrite**: Keep original YAML in memory
2. **Validation After Write**: Parse and verify updated YAML
3. **Atomic Operations**: Write to temp file, then rename
4. **Error Recovery**: Restore from backup on validation failure

**Contingency Plan**:
- Automatic restoration from backup on corruption detection
- Manual YAML repair guide in documentation
- Source file version control for recovery

---

#### Risk 4: Third-Party Command Conflicts

**Impact**: Low - Third-party commands accidentally migrated
**Probability**: Low - Metadata detection system
**Mitigation**:

1. **Metadata Headers**: Reliable `@ai-mesh-command` detection
2. **Whitelist Approach**: Only migrate files with metadata
3. **Pre-Migration Report**: Show files to be migrated
4. **Manual Override**: Allow users to exclude specific files

**Contingency Plan**:
- Rollback restores any accidentally migrated third-party files
- Migration log shows all moved files for manual review
- Support guide for manually moving files back

---

#### Risk 5: Performance Degradation

**Impact**: Medium - Slower command resolution
**Probability**: Very Low - Subdirectory resolution optimized by Claude Code
**Mitigation**:

1. **Performance Benchmarking**: Establish baseline, continuous monitoring
2. **CI/CD Performance Tests**: Automated threshold checks
3. **Load Testing**: Test with large command libraries (100+ commands)
4. **Optimization**: Profile and optimize critical paths

**Contingency Plan**:
- Performance regression triggers automatic investigation
- Rollback if P95 latency exceeds 100ms threshold
- Performance optimization sprint if needed

---

### Operational Risks

#### Risk 6: User Confusion During Transition

**Impact**: Medium - Support tickets, user frustration
**Probability**: Medium - New directory structure unfamiliar
**Mitigation**:

1. **Clear Communication**: Migration guide with examples
2. **Enhanced CLI**: Progress bars and status messages
3. **Documentation Updates**: Updated examples and troubleshooting
4. **Beta Testing**: Early feedback from adopters

**Contingency Plan**:
- Dedicated support documentation for migration
- FAQs based on beta feedback
- Quick-start guide for common migration scenarios

---

#### Risk 7: Incomplete Migration Leaves System in Bad State

**Impact**: High - Mixed directory structure, confusion
**Probability**: Low - Partial completion strategy
**Mitigation**:

1. **Partial Completion**: Continue with valid files
2. **Detailed Reporting**: Show successful and failed files
3. **Manual Recovery Guide**: How to complete partial migration
4. **Rollback Option**: Restore original state if preferred

**Contingency Plan**:
- Manual migration script for completing partial migrations
- Support documentation for resolving common partial migration issues
- Rollback guide for users who prefer original structure

---

## Definition of Done

### Sprint 1 Definition of Done

**Preparation & Foundation Complete When**:

- [ ] YAML schema validated against all existing command files
- [ ] All 12 AI Mesh command source YAML files have `@ai-mesh-command` metadata headers
- [ ] Metadata headers successfully generate in output command files
- [ ] Test directory structure created with mock command files
- [ ] Test suite skeleton runs successfully (even with placeholder tests)
- [ ] CI/CD performance testing framework can execute benchmark tests
- [ ] Enhanced CLI components (progress bar, colored output) display correctly in terminal
- [ ] Dry-run mode produces accurate simulation output without making changes
- [ ] Rollback documentation includes both manual and automated procedures
- [ ] All code passes linting (ESLint) and formatting (Prettier) checks
- [ ] No regressions in existing installer functionality

---

### Sprint 2 Definition of Done

**Core Implementation Complete When**:

- [ ] NPM installer can migrate all 12 commands (24 files) successfully in test environment
- [ ] `CommandMigrator` class handles partial completion correctly
- [ ] Error logging system captures and reports all migration issues
- [ ] Enhanced CLI integrated and displays real-time progress during migration
- [ ] YAML rewriter updates all source files without introducing syntax errors
- [ ] YAML validation confirms all rewritten files parse successfully
- [ ] Rolling backup created before every migration
- [ ] Rollback mechanism successfully restores original state from backup
- [ ] Bash installer produces identical directory structure to NPM installer
- [ ] Metadata detection correctly identifies AI Mesh vs third-party commands
- [ ] File existence validation detects missing or corrupted files
- [ ] Command resolution tests confirm all migrated commands accessible
- [ ] Validation summary report displays accurate success/failure statistics
- [ ] All code passes linting (ESLint) and formatting (Prettier) checks
- [ ] No memory leaks detected in migration process
- [ ] Performance profiling shows no significant regressions

---

### Sprint 3 Definition of Done

**Documentation & Testing Complete When**:

- [ ] README.md updated with new directory structure and examples
- [ ] CLAUDE.md updated with accurate command path references
- [ ] Installation guides include comprehensive migration information
- [ ] Migration guide created with troubleshooting and rollback instructions
- [ ] All documentation reviewed and approved by technical lead
- [ ] Overall test coverage ≥ 85% (measured by coverage tool)
- [ ] Migration logic coverage ≥ 95%
- [ ] Validation functions coverage ≥ 90%
- [ ] Rollback mechanisms coverage ≥ 95%
- [ ] All 6 mandatory test scenarios pass consistently (100% pass rate)
- [ ] Performance benchmarks integrated into CI/CD pipeline
- [ ] Command resolution performance tests pass (<100ms threshold)
- [ ] Installer execution time tests pass (<5% overhead threshold)
- [ ] No flaky tests in test suite (3 consecutive runs with same results)
- [ ] All test failures investigated and resolved
- [ ] Code review completed with all feedback addressed
- [ ] Security scan shows no high-severity vulnerabilities

---

### Sprint 4 Definition of Done

**Rollout & Monitoring Complete When**:

- [ ] Beta release package created and tested in staging environment
- [ ] Beta deployed to ≥ 10 early adopter users
- [ ] Feedback collection system operational and receiving responses
- [ ] Installation success rate ≥ 98% across beta users
- [ ] All critical beta feedback issues resolved
- [ ] User satisfaction survey shows ≥ 90% positive response
- [ ] Metrics dashboard operational with real-time migration data
- [ ] Automated alerting configured for installation failures
- [ ] Production release notes and changelog reviewed and approved
- [ ] Production deployment executed without rollback
- [ ] Post-deployment monitoring confirms healthy migration trends
- [ ] Support documentation accessible via README and CLAUDE.md
- [ ] Support ticket monitoring system operational
- [ ] No P0/P1 bugs in production for 48 hours post-release
- [ ] Retrospective completed with documented lessons learned
- [ ] Action items from retrospective assigned and tracked

---

## Acceptance Criteria

### Project-Level Acceptance Criteria

**The Command Directory Reorganization project is COMPLETE when ALL of the following criteria are met**:

#### 1. Functional Acceptance Criteria

- [ ] **FR1**: All AI Mesh commands located in `ai-mesh/` subdirectory
  - ✅ `.claude/commands/ai-mesh/` directory exists (global and local)
  - ✅ All 24 command files present in `ai-mesh/` directory
  - ✅ No duplicate files in flat structure after migration

- [ ] **FR2**: All command files successfully migrated
  - ✅ 12 `.md` files migrated
  - ✅ 12 `.txt` files migrated
  - ✅ All YAML source files updated with `ai-mesh/` prefix
  - ✅ No AI Mesh files left in flat directory structure

- [ ] **FR3**: Command resolution working correctly
  - ✅ `/create-trd` resolves from `ai-mesh/create-trd.md`
  - ✅ All 12 commands resolve correctly
  - ✅ Command help shows full path (e.g., "ai-mesh/create-trd")
  - ✅ Command completion shows hierarchical paths

- [ ] **FR4**: Installer updates operational
  - ✅ NPM installer creates `ai-mesh/` directory
  - ✅ Bash installer creates `ai-mesh/` directory
  - ✅ Both global and local installations supported
  - ✅ Installation validation checks pass
  - ✅ Uninstall removes `ai-mesh/` directory cleanly

- [ ] **FR5**: Documentation updated
  - ✅ README.md reflects new directory structure
  - ✅ CLAUDE.md uses updated command paths
  - ✅ Installation guides reference `ai-mesh/` directory
  - ✅ Migration guide available for existing users
  - ✅ Troubleshooting documentation includes path examples

#### 2. Non-Functional Acceptance Criteria

- [ ] **NFR1: Performance**
  - ✅ Command resolution time < 100ms (P95 latency)
  - ✅ Installer execution time increase < 5%
  - ✅ No impact on Claude Code session startup time
  - ✅ Automated CI/CD performance tests passing

- [ ] **NFR2: Backward Compatibility**
  - ✅ All existing command invocations work unchanged
  - ✅ Migration is automatic on update
  - ✅ Rollback mechanism available and tested
  - ✅ Clear migration status displayed during update

- [ ] **NFR3: Reliability**
  - ✅ Automatic rolling backup before migration
  - ✅ Rollback mechanism tested and functional
  - ✅ Partial migration support operational
  - ✅ Validation of all migrated files successful
  - ✅ Installation success rate ≥ 98%

- [ ] **NFR4: Usability**
  - ✅ ≥ 90% of users find new structure clearer (survey)
  - ✅ Time to locate specific command reduces by ≥ 30%
  - ✅ Support tickets related to command discovery decrease ≥ 40%
  - ✅ Onboarding documentation clarity score improves

#### 3. Testing Acceptance Criteria

- [ ] **Test Coverage**
  - ✅ Overall code coverage ≥ 85%
  - ✅ Migration logic coverage ≥ 95%
  - ✅ Validation functions coverage ≥ 90%
  - ✅ Rollback mechanisms coverage ≥ 95%

- [ ] **Mandatory Test Scenarios**
  - ✅ Scenario 1: Fresh Installation - 100% pass rate
  - ✅ Scenario 2: Full Migration - 100% pass rate
  - ✅ Scenario 3: Mixed Commands Migration - 100% pass rate
  - ✅ Scenario 4: Corrupted Files Handling - 100% pass rate
  - ✅ Scenario 5: Permission Issues - 100% pass rate
  - ✅ Scenario 6: Rollback After Failure - 100% pass rate

- [ ] **Performance Testing**
  - ✅ Command resolution benchmarks passing (<100ms)
  - ✅ Installer execution time benchmarks passing (<5% overhead)
  - ✅ CI/CD performance tests integrated and passing

#### 4. Deployment Acceptance Criteria

- [ ] **Beta Release**
  - ✅ Beta deployed to ≥ 10 early adopters
  - ✅ Installation success rate ≥ 98% across beta users
  - ✅ User satisfaction ≥ 90% (survey)
  - ✅ All critical beta issues resolved

- [ ] **Production Release**
  - ✅ Production release deployed successfully
  - ✅ No rollback required within 48 hours
  - ✅ Metrics dashboard showing healthy trends
  - ✅ No P0/P1 bugs in production

- [ ] **Monitoring & Support**
  - ✅ Automated alerting operational
  - ✅ Support documentation published
  - ✅ Support ticket monitoring active
  - ✅ Post-deployment metrics within acceptable ranges

#### 5. Documentation Acceptance Criteria

- [ ] **User Documentation**
  - ✅ README.md updated and reviewed
  - ✅ CLAUDE.md updated and reviewed
  - ✅ Migration guide published
  - ✅ Troubleshooting guide published
  - ✅ All documentation accurate and up-to-date

- [ ] **Technical Documentation**
  - ✅ API documentation for installer modules
  - ✅ Architecture diagrams updated
  - ✅ Rollback procedures documented
  - ✅ Testing guide available for contributors

---

## Appendices

### Appendix A: Rollback Procedures

#### Automatic Rollback (Triggered by System)

**Triggers**:
1. Critical file system errors during migration
2. More than 50% of files fail validation
3. YAML corruption detected in source files
4. Installer crash or timeout

**Process**:

```javascript
async function automaticRollback(backupDir, commandsDir) {
  logger.warn('Critical failure detected, initiating automatic rollback');

  try {
    // Step 1: Remove ai-mesh directory
    const aiMeshDir = path.join(commandsDir, 'ai-mesh');
    if (await fs.access(aiMeshDir).then(() => true).catch(() => false)) {
      await fs.rm(aiMeshDir, { recursive: true, force: true });
      logger.info('Removed ai-mesh directory');
    }

    // Step 2: Restore files from backup
    const backupFiles = await fs.readdir(backupDir);
    for (const file of backupFiles) {
      const source = path.join(backupDir, file);
      const target = path.join(commandsDir, file);
      await fs.copyFile(source, target);
    }
    logger.info(`Restored ${backupFiles.length} files from backup`);

    // Step 3: Validate restoration
    const validation = await validateRestoration(commandsDir, backupDir);
    if (!validation.valid) {
      throw new Error('Rollback validation failed');
    }

    // Step 4: Display success message
    console.log(chalk.green('✅ Rollback completed successfully'));
    console.log(chalk.yellow('   Original directory structure restored'));
    console.log(chalk.yellow('   Please review error logs before retrying'));

    return { success: true, filesRestored: backupFiles.length };
  } catch (error) {
    logger.error(`Rollback failed: ${error.message}`);
    console.log(chalk.red('❌ CRITICAL: Automatic rollback failed'));
    console.log(chalk.red('   Manual intervention required'));
    console.log(chalk.yellow('   See documentation: docs/troubleshooting.md#rollback'));
    throw error;
  }
}
```

#### Manual Rollback (User-Initiated)

**Command-Line Flag**:

```bash
# NPM installer
npx @fortium/ai-mesh install --rollback

# Bash installer
./install.sh --rollback
```

**Manual Steps** (if automation fails):

```bash
# Global installation
cd ~/.claude/commands/

# Step 1: Remove ai-mesh directory
rm -rf ai-mesh/

# Step 2: Restore from backup
if [ -d "../commands.backup" ]; then
  cp -r ../commands.backup/* .
  echo "✅ Files restored from backup"
else
  echo "❌ No backup found at ~/.claude/commands.backup"
  exit 1
fi

# Step 3: Validate restoration
for cmd in create-prd create-trd implement-trd fold-prompt manager-dashboard \
           analyze-product refine-prd refine-trd sprint-status playwright-test \
           generate-api-docs web-metrics-dashboard; do
  if [ ! -f "${cmd}.md" ]; then
    echo "⚠️  Missing file: ${cmd}.md"
  fi
done

echo "✅ Rollback complete - verify commands work"
```

**Verification**:

```bash
# Test command resolution
claude --help | grep create-trd

# Should show command available
# If not, restart Claude Code
```

---

### Appendix B: Validation Checklist

#### Pre-Migration Validation

**Before starting migration, verify**:

- [ ] Backup directory does not exist (will be created fresh)
- [ ] Write permissions on `commands/` directory
- [ ] Sufficient disk space (at least 2x command directory size)
- [ ] All YAML source files parse successfully
- [ ] No uncommitted changes in version control (if applicable)

**Command**:

```bash
# Pre-migration check
npx @fortium/ai-mesh install --dry-run --verbose
```

#### Post-Migration Validation

**After migration completes, verify**:

- [ ] `ai-mesh/` directory exists
- [ ] All 24 command files present in `ai-mesh/`
- [ ] No AI Mesh files left in flat directory
- [ ] All YAML files parse successfully
- [ ] All commands resolve correctly
- [ ] Command completion shows hierarchical paths
- [ ] Backup directory exists with original files

**Automated Validation Script**:

```bash
#!/bin/bash
# validate-migration.sh

COMMANDS_DIR="$HOME/.claude/commands"
AI_MESH_DIR="$COMMANDS_DIR/ai-mesh"
BACKUP_DIR="$HOME/.claude/commands.backup"

echo "🔍 Validating migration..."

# Check ai-mesh directory exists
if [ ! -d "$AI_MESH_DIR" ]; then
  echo "❌ ai-mesh directory not found"
  exit 1
fi

# Check file count
FILE_COUNT=$(ls -1 "$AI_MESH_DIR" | wc -l)
if [ "$FILE_COUNT" -ne 24 ]; then
  echo "⚠️  Expected 24 files, found $FILE_COUNT"
fi

# Check backup exists
if [ ! -d "$BACKUP_DIR" ]; then
  echo "⚠️  Backup directory not found"
fi

# Test command resolution
if claude --help | grep -q "ai-mesh/create-trd"; then
  echo "✅ Command resolution working"
else
  echo "⚠️  Command resolution may have issues"
fi

echo "✅ Migration validation complete"
```

#### Continuous Validation (Post-Deployment)

**Monitoring checks**:

- [ ] Installation success rate ≥ 98%
- [ ] Command resolution error rate < 1%
- [ ] Support ticket volume stable or decreasing
- [ ] User satisfaction survey ≥ 90% positive

**Metrics Dashboard**:

```javascript
// metrics/dashboard.js
const metrics = {
  installationSuccessRate: 0.99,  // 99%
  commandResolutionErrorRate: 0.005,  // 0.5%
  supportTicketVolume: 12,  // last 30 days
  userSatisfaction: 0.92  // 92% positive
};

function checkHealth(metrics) {
  const issues = [];

  if (metrics.installationSuccessRate < 0.98) {
    issues.push('Installation success rate below target');
  }

  if (metrics.commandResolutionErrorRate > 0.01) {
    issues.push('Command resolution errors elevated');
  }

  if (metrics.userSatisfaction < 0.90) {
    issues.push('User satisfaction below target');
  }

  return {
    healthy: issues.length === 0,
    issues
  };
}
```

---

### Appendix C: File Mapping Reference

#### Command File Mapping (Before → After)

| Original Path | New Path | File Size |
|--------------|----------|-----------|
| `commands/create-prd.md` | `commands/ai-mesh/create-prd.md` | 3.0 KB |
| `commands/create-prd.txt` | `commands/ai-mesh/create-prd.txt` | 1.4 KB |
| `commands/create-trd.md` | `commands/ai-mesh/create-trd.md` | 16 KB |
| `commands/create-trd.txt` | `commands/ai-mesh/create-trd.txt` | 2.4 KB |
| `commands/implement-trd.md` | `commands/ai-mesh/implement-trd.md` | 33 KB |
| `commands/implement-trd.txt` | `commands/ai-mesh/implement-trd.txt` | 2.5 KB |
| `commands/fold-prompt.md` | `commands/ai-mesh/fold-prompt.md` | 16 KB |
| `commands/fold-prompt.txt` | `commands/ai-mesh/fold-prompt.txt` | 1.4 KB |
| `commands/manager-dashboard.md` | `commands/ai-mesh/manager-dashboard.md` | 11 KB |
| `commands/manager-dashboard.txt` | `commands/ai-mesh/manager-dashboard.txt` | 942 B |
| `commands/analyze-product.md` | `commands/ai-mesh/analyze-product.md` | 4.2 KB |
| `commands/analyze-product.txt` | `commands/ai-mesh/analyze-product.txt` | 1.1 KB |
| `commands/refine-prd.md` | `commands/ai-mesh/refine-prd.md` | 2.2 KB |
| `commands/refine-prd.txt` | `commands/ai-mesh/refine-prd.txt` | 901 B |
| `commands/refine-trd.md` | `commands/ai-mesh/refine-trd.md` | 1.4 KB |
| `commands/refine-trd.txt` | `commands/ai-mesh/refine-trd.txt` | 765 B |
| `commands/sprint-status.md` | `commands/ai-mesh/sprint-status.md` | 4.8 KB |
| `commands/sprint-status.txt` | `commands/ai-mesh/sprint-status.txt` | 765 B |
| `commands/playwright-test.md` | `commands/ai-mesh/playwright-test.md` | 1.6 KB |
| `commands/playwright-test.txt` | `commands/ai-mesh/playwright-test.txt` | 1.2 KB |
| `commands/generate-api-docs.md` | `commands/ai-mesh/generate-api-docs.md` | 7.6 KB |
| `commands/generate-api-docs.txt` | `commands/ai-mesh/generate-api-docs.txt` | 830 B |
| `commands/web-metrics-dashboard.md` | `commands/ai-mesh/web-metrics-dashboard.md` | 17 KB |
| `commands/web-metrics-dashboard.txt` | `commands/ai-mesh/web-metrics-dashboard.txt` | 788 B |

**Total Files**: 24
**Total Size**: ~133 KB

#### YAML Source File Updates

**Before**:

```yaml
# commands/yaml/create-trd.yaml
name: create-trd
description: Create Technical Requirements Document
output_path: "create-trd.md"
```

**After**:

```yaml
# commands/yaml/create-trd.yaml
name: create-trd
description: Create Technical Requirements Document
output_path: "ai-mesh/create-trd.md"
```

**Files to Update** (12 total):

1. `commands/yaml/create-prd.yaml`
2. `commands/yaml/create-trd.yaml`
3. `commands/yaml/implement-trd.yaml`
4. `commands/yaml/fold-prompt.yaml`
5. `commands/yaml/manager-dashboard.yaml`
6. `commands/yaml/analyze-product.yaml`
7. `commands/yaml/refine-prd.yaml`
8. `commands/yaml/refine-trd.yaml`
9. `commands/yaml/sprint-status.yaml`
10. `commands/yaml/playwright-test.yaml`
11. `commands/yaml/generate-api-docs.yaml`
12. `commands/yaml/web-metrics-dashboard.yaml`

---

### Appendix D: Dependencies

#### NPM Dependencies

**Production Dependencies**:

```json
{
  "dependencies": {
    "cli-progress": "^3.12.0",
    "chalk": "^4.1.2",
    "js-yaml": "^4.1.0"
  }
}
```

**Development Dependencies**:

```json
{
  "devDependencies": {
    "jest": "^29.5.0",
    "@types/jest": "^29.5.0",
    "eslint": "^8.40.0",
    "prettier": "^2.8.8",
    "husky": "^8.0.3",
    "lint-staged": "^13.2.2"
  }
}
```

#### System Dependencies

**Required**:
- Node.js ≥ 18.x
- npm ≥ 9.x
- Bash ≥ 4.x (for bash installer)

**Optional**:
- Git (for version control)
- Claude Code ≥ 1.0 (for command resolution testing)

---

### Appendix E: Glossary

**AI Mesh**: Fortium's suite of Claude Code commands and agents for AI-augmented development

**Command Resolution**: Process by which Claude Code finds and loads command files

**Flat Structure**: Original directory organization with all command files in single directory

**Hierarchical Structure**: New directory organization with commands grouped in subdirectories

**Metadata Header**: Comment-based marker at file start (`# @ai-mesh-command`) for identifying AI Mesh commands

**Migration**: Process of moving command files from flat to hierarchical structure

**Partial Completion**: Migration strategy that continues with valid files and logs errors for problematic ones

**Rolling Backup**: Single backup that is replaced on each successful migration (not retained indefinitely)

**YAML Rewriter**: Tool that updates YAML source files to reference new directory paths

**Third-Party Commands**: Command files not maintained by Fortium (e.g., spec-kit, user-created)

**Validation**: Post-migration checks to ensure all files migrated correctly and are functional

**Rollback**: Process of restoring original directory structure from backup

**DoD (Definition of Done)**: Checklist of criteria that must be met before task/sprint is considered complete

**P95 Latency**: 95th percentile response time (5% of requests may be slower)

---

## Summary

This Technical Requirements Document provides complete specifications for implementing the Command Directory Reorganization project. The TRD covers:

✅ **Complete System Architecture** with component diagrams and data flow
✅ **84 Detailed Tasks** organized into 4 weekly sprints with estimates and dependencies
✅ **Comprehensive Testing Strategy** with 85% coverage targets and 6 mandatory scenarios
✅ **Performance Requirements** with CI/CD integration for continuous validation
✅ **Risk Mitigation** with contingency plans for all identified technical risks
✅ **Definition of Done** for each sprint with clear success criteria
✅ **Acceptance Criteria** for overall project completion

The implementation follows a **checkbox-driven development approach**, making this TRD immediately usable with the `/implement-trd` command for structured, trackable progress through all implementation phases.

**Total Effort Estimate**: 187 hours across 4 weeks
**Team Size**: 2-3 developers
**Risk Level**: Low-Medium (comprehensive mitigation in place)
**Success Probability**: High (≥ 95% given thorough planning and testing strategy)

---

**Document Status**: ✅ Ready for Implementation
**Next Step**: Execute `/implement-trd @docs/TRD/command-directory-reorganization-trd.md` to begin checkbox-driven development

---

_This TRD follows AgentOS standards and implements Leo's AI-Augmented Development Process for structured technical planning._

**Created**: October 29, 2025
**Document Version**: 1.0.0
**Related PRD Version**: 1.1.0
