# Command Metadata Specification

**Version:** 1.0.0
**Last Updated:** October 29, 2025
**Owner:** Fortium Software Configuration Team

---

## Overview

This document defines the metadata header format for Claude Code slash commands in the Fortium AI Mesh system. Metadata headers enable:

- **Automated Migration**: Identify AI Mesh commands for directory reorganization
- **Source Attribution**: Distinguish between Fortium and third-party commands
- **Version Tracking**: Maintain command versioning and compatibility
- **Maintainer Information**: Track ownership and support contacts

---

## Metadata Header Format

### Standard Header Template

```markdown
# @ai-mesh-command
# Command: <command-name>
# Version: <semantic-version>
# Category: <category-name>
# Source: <fortium|third-party>
# Maintainer: <team-or-person-name>
# Last Updated: <YYYY-MM-DD>

[Rest of command file content...]
```

### Field Specifications

#### 1. `@ai-mesh-command` (Required)

**Purpose**: Primary identifier for AI Mesh command detection
**Format**: Literal string `# @ai-mesh-command`
**Position**: Must be first line of file
**Detection**: Used by migration scripts to identify commands for relocation

**Example**:
```markdown
# @ai-mesh-command
```

#### 2. `Command` (Required)

**Purpose**: Command name in kebab-case
**Format**: `# Command: <name>`
**Pattern**: `^[a-z][a-z0-9-]*$`
**Examples**:
- `# Command: create-prd`
- `# Command: implement-trd`
- `# Command: fold-prompt`

#### 3. `Version` (Required)

**Purpose**: Semantic version for compatibility tracking
**Format**: `# Version: <major>.<minor>.<patch>`
**Pattern**: `^\d+\.\d+\.\d+$`
**Examples**:
- `# Version: 1.0.0` (Initial release)
- `# Version: 2.1.0` (Feature addition)
- `# Version: 2.1.1` (Bug fix)

**Versioning Guidelines**:
- **Major**: Breaking changes to command interface or behavior
- **Minor**: New features, backward-compatible enhancements
- **Patch**: Bug fixes, documentation updates

#### 4. `Category` (Required)

**Purpose**: Command classification for organization and discovery
**Format**: `# Category: <category>`
**Valid Values**:
- `planning` - Product/technical planning commands
- `implementation` - Development and coding commands
- `testing` - Test execution and validation commands
- `documentation` - Documentation generation commands
- `deployment` - Release and deployment commands
- `analysis` - Project analysis and optimization commands

**Examples**:
```markdown
# Category: planning
# Category: implementation
# Category: analysis
```

#### 5. `Source` (Required)

**Purpose**: Command origin for migration targeting and support
**Format**: `# Source: <source-type>`
**Valid Values**:
- `fortium` - Official Fortium AI Mesh commands (migrated to `ai-mesh/`)
- `third-party` - Community or user-created commands (remain in root)

**Examples**:
```markdown
# Source: fortium
# Source: third-party
```

#### 6. `Maintainer` (Required)

**Purpose**: Support contact and ownership information
**Format**: `# Maintainer: <team-or-person>`
**Examples**:
- `# Maintainer: Fortium Software Configuration Team`
- `# Maintainer: John Doe (john@example.com)`
- `# Maintainer: Infrastructure Team`

#### 7. `Last Updated` (Required)

**Purpose**: Track last modification date
**Format**: `# Last Updated: YYYY-MM-DD`
**Example**: `# Last Updated: 2025-10-29`

---

## Complete Examples

### Example 1: Official AI Mesh Command

```markdown
# @ai-mesh-command
# Command: create-prd
# Version: 1.0.0
# Category: planning
# Source: fortium
# Maintainer: Fortium Software Configuration Team
# Last Updated: 2025-10-13

You are the **Product Management Orchestrator**, responsible for creating comprehensive Product Requirements Documents (PRDs) from product descriptions or feature ideas.

## Mission

Create a comprehensive Product Requirements Document (PRD) from a product description or feature idea. Delegate to specialized agents for user analysis, acceptance criteria definition, and structured requirements documentation.

[Rest of command content...]
```

### Example 2: Third-Party Command

```markdown
# @ai-mesh-command
# Command: custom-analyzer
# Version: 1.2.0
# Category: analysis
# Source: third-party
# Maintainer: Jane Smith (jane@company.com)
# Last Updated: 2025-09-15

You are a specialized code analyzer for custom business logic validation.

[Rest of command content...]
```

---

## Migration Behavior

### Fortium Commands (`Source: fortium`)

**Current Location**: `commands/create-prd.md`
**Migrated Location**: `commands/ai-mesh/create-prd.md`
**Detection**: Metadata header with `Source: fortium`
**Action**: Automatically moved to `ai-mesh/` subdirectory during installation

### Third-Party Commands (`Source: third-party`)

**Current Location**: `commands/custom-tool.md`
**Migrated Location**: `commands/custom-tool.md` (unchanged)
**Detection**: Metadata header with `Source: third-party`
**Action**: Remain in root commands directory

### Commands Without Headers

**Location**: Remain in original location
**Detection**: No `@ai-mesh-command` header found
**Action**: No migration performed (assumed third-party or legacy)

---

## Validation Rules

### Required Validations

1. **Header Presence**: First line must be `# @ai-mesh-command`
2. **Required Fields**: All 7 fields must be present (Command, Version, Category, Source, Maintainer, Last Updated)
3. **Field Format**: Each field must match its specified pattern
4. **Category Validation**: Category must be one of the 6 valid values
5. **Source Validation**: Source must be either `fortium` or `third-party`
6. **Version Format**: Version must follow semantic versioning (x.y.z)
7. **Date Format**: Last Updated must be YYYY-MM-DD format

### Validation Error Examples

```markdown
# Invalid: Missing @ai-mesh-command header
# Command: my-command
# Version: 1.0.0
...

# Invalid: Incorrect version format
# @ai-mesh-command
# Command: my-command
# Version: 1.0
...

# Invalid: Invalid category
# @ai-mesh-command
# Command: my-command
# Version: 1.0.0
# Category: custom-category
...

# Invalid: Missing required field
# @ai-mesh-command
# Command: my-command
# Version: 1.0.0
# Category: planning
# (Missing Source, Maintainer, Last Updated)
...
```

---

## Implementation Tools

### Detection Function (JavaScript)

```javascript
/**
 * Detect if a file has valid AI Mesh command metadata header
 * @param {string} filePath - Path to command file
 * @returns {Promise<boolean>} - True if valid header found
 */
async function hasAiMeshMetadata(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').map(l => l.trim());

    // Check for @ai-mesh-command marker
    if (lines[0] !== '# @ai-mesh-command') {
      return false;
    }

    // Check for required fields
    const requiredFields = ['Command:', 'Version:', 'Category:', 'Source:', 'Maintainer:', 'Last Updated:'];
    const headerLines = lines.slice(1, 8); // Next 7 lines

    for (const field of requiredFields) {
      const found = headerLines.some(line => line.startsWith(`# ${field}`));
      if (!found) return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}
```

### Detection Function (Bash)

```bash
# Detect if a file has AI Mesh command metadata header
# Usage: has_ai_mesh_metadata "path/to/file.md"
has_ai_mesh_metadata() {
    local file="$1"

    # Check if file exists
    [ ! -f "$file" ] && return 1

    # Check for @ai-mesh-command marker on first line
    head -n 1 "$file" | grep -q "^# @ai-mesh-command$" || return 1

    # Check for required fields in first 8 lines
    local required_fields=("Command:" "Version:" "Category:" "Source:" "Maintainer:" "Last Updated:")
    local header=$(head -n 8 "$file")

    for field in "${required_fields[@]}"; do
        echo "$header" | grep -q "^# ${field}" || return 1
    done

    return 0
}
```

---

## YAML Source File Integration

Command metadata should be mirrored in the corresponding YAML source file for consistency:

```yaml
metadata:
  name: create-prd
  description: Create comprehensive Product Requirements Document from product description
  version: 1.0.0
  lastUpdated: "2025-10-13"
  category: planning
  output_path: ai-mesh/create-prd.md  # New field for migration target
  source: fortium  # New field for migration filtering

mission:
  summary: |
    Create a comprehensive Product Requirements Document (PRD)...
```

---

## Migration Script Usage

### Example: Scan and Migrate Commands

```javascript
const { CommandMigrator } = require('./src/installer/migrate-commands');

async function migrateAiMeshCommands() {
  const migrator = new CommandMigrator('~/.claude');

  // Scan for commands with valid metadata
  const commands = await migrator.scanExistingCommands();
  console.log(`Found ${commands.length} AI Mesh commands to migrate`);

  // Migrate commands to ai-mesh/ subdirectory
  const result = await migrator.migrate();

  if (result.success) {
    console.log(`Successfully migrated ${result.migrated} commands`);
  } else {
    console.error(`Migration failed with ${result.errors.length} errors`);
  }
}
```

---

## Maintenance Guidelines

### Adding New Commands

1. Start with metadata header template
2. Fill in all required fields
3. Set `Source: fortium` for official commands
4. Use appropriate category from valid list
5. Validate header format before committing

### Updating Existing Commands

1. Increment version according to semantic versioning
2. Update `Last Updated` field with current date
3. Maintain existing command name and source
4. Update category if command purpose changes

### Third-Party Command Guidelines

1. Set `Source: third-party` to prevent migration
2. Include maintainer contact information
3. Follow same metadata format for consistency
4. Document any custom categories in command body

---

## Related Documentation

- **Technical Requirements Document**: `docs/TRD/command-directory-reorganization-trd.md`
- **Command Schema**: `schemas/command-schema.json`
- **Migration Implementation**: `src/installer/migrate-commands.js`
- **Installation Guide**: `README.md`

---

_Command Metadata Specification v1.0.0_
_Fortium AI-Augmented Development Process_
_October 2025_
