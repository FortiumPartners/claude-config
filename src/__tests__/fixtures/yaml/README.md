# YAML Test Fixtures

This directory contains YAML source files for testing the YAML rewriter component of the command migration system.

## Files

### `simple-command.yaml`
- **Purpose**: Test basic output_path rewriting
- **Expected**: Path should be rewritten to `ai-mesh/simple-command.md`
- **Source**: fortium (should be migrated)

### `already-migrated.yaml`
- **Purpose**: Test that existing ai-mesh/ prefix is preserved
- **Expected**: Path `ai-mesh/already-migrated.md` remains unchanged
- **Source**: fortium (already migrated)

### `corrupted.yaml`
- **Purpose**: Test YAML parsing error handling
- **Expected**: Parser should fail gracefully, log error, continue with other files
- **Source**: fortium (but invalid YAML)

### `third-party.yaml`
- **Purpose**: Test that third-party commands are not rewritten
- **Expected**: Path remains `third-party-command.md` (no ai-mesh/ prefix added)
- **Source**: third-party (should not be migrated)

## Test Scenarios

### Scenario 1: Basic Path Rewriting
**Input**: `output_path: simple-command.md`
**Output**: `output_path: ai-mesh/simple-command.md`
**Validation**: YAML syntax valid, path correctly updated

### Scenario 2: Preserve Existing Migration
**Input**: `output_path: ai-mesh/already-migrated.md`
**Output**: `output_path: ai-mesh/already-migrated.md` (unchanged)
**Validation**: No duplicate ai-mesh/ prefix

### Scenario 3: Handle Corrupted YAML
**Input**: Invalid YAML syntax
**Output**: Error logged, file skipped
**Validation**: Partial completion, other files processed successfully

### Scenario 4: Skip Third-Party Commands
**Input**: `source: third-party`, `output_path: third-party-command.md`
**Output**: File not modified
**Validation**: Third-party detection based on metadata.source field

## Usage in Tests

```javascript
const yaml = require('js-yaml');
const fs = require('fs').promises;
const path = require('path');

// Load fixture
const fixtureDir = path.join(__dirname, '../fixtures/yaml');
const simpleYaml = await fs.readFile(
  path.join(fixtureDir, 'simple-command.yaml'),
  'utf-8'
);

// Parse and test
const parsed = yaml.load(simpleYaml);
expect(parsed.output_path).toBe('simple-command.md');

// After rewriting
expect(rewritten.output_path).toBe('ai-mesh/simple-command.md');
```

## Maintenance

When adding new YAML fixtures:

1. Follow the existing structure with metadata fields
2. Document the test purpose and expected behavior
3. Add both positive and negative test cases
4. Update this README with fixture description
