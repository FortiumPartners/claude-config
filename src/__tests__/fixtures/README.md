# Test Fixtures

This directory contains test fixtures for command migration testing.

## Directory Structure

```
fixtures/
├── commands/           # Mock command files for testing
│   ├── valid/         # Valid AI Mesh commands with proper headers
│   │   ├── test-command.md           # Basic test command
│   │   ├── plan-product.md           # Product planning command
│   │   ├── create-trd.md             # TRD creation command
│   │   └── implement-trd.md          # TRD implementation command
│   ├── invalid/       # Invalid commands for error handling tests
│   │   ├── missing-header.md         # No @ai-mesh-command header
│   │   ├── incomplete-metadata.md    # Missing required metadata fields
│   │   └── corrupted-yaml.md         # Invalid YAML frontmatter
│   └── third-party/   # Third-party commands that should not migrate
│       ├── custom-tool.md            # External developer tool
│       └── community-plugin.md       # Community contribution
└── yaml/              # Mock YAML source files
    ├── simple-command.yaml           # Basic output_path rewriting
    ├── already-migrated.yaml         # Existing ai-mesh/ prefix
    ├── corrupted.yaml                # Invalid YAML syntax
    └── third-party.yaml              # Third-party command source
```

## Command Fixtures

### Valid Commands (`commands/valid/`)

#### `test-command.md`
- **Purpose**: Basic test command for standard migration testing
- **Category**: testing
- **Expected**: Migrate to `ai-mesh/test-command.md`

#### `plan-product.md`
- **Purpose**: Test real-world Fortium command (product planning)
- **Category**: planning
- **Expected**: Migrate to `ai-mesh/plan-product.md`

#### `create-trd.md`
- **Purpose**: Test PRD to TRD conversion command
- **Category**: planning
- **Expected**: Migrate to `ai-mesh/create-trd.md`

#### `implement-trd.md`
- **Purpose**: Test TRD implementation orchestration command
- **Category**: development
- **Expected**: Migrate to `ai-mesh/implement-trd.md`

### Invalid Commands (`commands/invalid/`)

#### `missing-header.md`
- **Purpose**: Test detection of commands without @ai-mesh-command header
- **Expected**: Skip migration, log as non-Fortium command

#### `incomplete-metadata.md`
- **Purpose**: Test validation of required metadata fields
- **Expected**: Detect missing fields (Category, Source, Maintainer), log error, skip file

#### `corrupted-yaml.md`
- **Purpose**: Test YAML parsing error handling
- **Expected**: Detect YAML syntax error, log error, skip file, continue with others

### Third-Party Commands (`commands/third-party/`)

#### `custom-tool.md`
- **Purpose**: Test third-party command identification (Source: third-party)
- **Expected**: Do not migrate, remain in root directory

#### `community-plugin.md`
- **Purpose**: Test community contribution handling (Source: community)
- **Expected**: Do not migrate, remain in root directory

## YAML Fixtures

See [yaml/README.md](yaml/README.md) for detailed documentation on YAML source file fixtures used for testing the YAML rewriter component.

## Usage

Test fixtures are used by the migration test suite to verify:

1. **Metadata Detection**: Proper identification of AI Mesh commands via @ai-mesh-command header
2. **Metadata Validation**: Required fields present and correctly formatted
3. **Migration Logic**: Correct file movement to `ai-mesh/` subdirectory
4. **Error Handling**: Graceful handling of invalid files with partial completion
5. **Third-Party Handling**: Correct exclusion of third-party commands based on Source field
6. **YAML Rewriting**: Automatic update of output_path in source YAML files
7. **Rollback Functionality**: Successful restoration from backups on failure

## Test Scenarios

### Scenario 1: Successful Migration
**Files**: `valid/test-command.md`, `valid/plan-product.md`
**Expected**: Both files migrate to `ai-mesh/` subdirectory
**Validation**: Files exist at new location, metadata preserved

### Scenario 2: Partial Completion
**Files**: Mix of valid and invalid commands
**Expected**: Valid files migrate, invalid files skipped with errors logged
**Validation**: Migration summary shows success and failure counts

### Scenario 3: Third-Party Exclusion
**Files**: `third-party/custom-tool.md`, `third-party/community-plugin.md`
**Expected**: Files remain in root directory
**Validation**: Source field checked, files not moved

### Scenario 4: Error Recovery
**Files**: `invalid/corrupted-yaml.md`
**Expected**: Error logged, other files processed successfully
**Validation**: Partial completion, error report generated

## Adding New Fixtures

When adding new test fixtures:

1. Follow the metadata header specification in `docs/command-metadata-specification.md`
2. Include both positive and negative test cases
3. Document the expected behavior in test file comments
4. Update this README with fixture purpose and usage
5. Add corresponding test cases to `src/__tests__/migration/command-migrator.test.js`

## Metadata Header Specification

All valid Fortium commands must include:

```markdown
# @ai-mesh-command
# Command: command-name
# Version: x.y.z
# Category: category-name
# Source: fortium
# Maintainer: Team Name
# Last Updated: YYYY-MM-DD
```

Third-party commands use `Source: third-party` or `Source: community` to prevent migration.
