# Integration Tests - Command Directory Reorganization

## Overview

Comprehensive integration test suite for Sprint 3 Command Directory Reorganization (TRD-051 through TRD-056). These tests validate production readiness of the migration system with 88 total test scenarios covering all critical workflows.

## Test Suite Summary

| Test File | TRD ID | Tests | Scenarios | Status |
|-----------|--------|-------|-----------|--------|
| `fresh-installation.test.js` | TRD-051 | 7 | Fresh Installation | ✅ Complete |
| `full-migration.test.js` | TRD-052 | 12 | Full Migration | ✅ Complete |
| `mixed-commands.test.js` | TRD-053 | 13 | Mixed Commands | ✅ Complete |
| `corrupted-files.test.js` | TRD-054 | 19 | Corrupted Files | ✅ Complete |
| `permission-issues.test.js` | TRD-055 | 16 | Permission Issues | ✅ Complete |
| `rollback.test.js` | TRD-056 | 21 | Rollback Recovery | ✅ Complete |

**Total**: 88 integration tests across 6 mandatory scenarios

## Test Infrastructure

### Test Utilities (`test-utils.js`)

Comprehensive utilities for integration testing:

```javascript
const { IntegrationTestUtils } = require('./test-utils');

const utils = new IntegrationTestUtils(baseDir);

// Create isolated test environment
const testDir = await utils.createTestEnvironment();

// Seed test commands with various configurations
await utils.seedTestCommands(testDir, {
  aiMeshCommands: ['create-prd', 'create-trd'],
  thirdPartyCommands: ['custom-cmd']
});

// Create corrupted files for error handling tests
await utils.createCorruptedFiles(testDir);

// Verify migration results
const { found, missing } = await utils.verifyFiles(testDir, expectedFiles, 'ai-mesh');

// Measure performance
const { result, duration } = await utils.measureTime(async () => {
  return await migrator.migrate();
});
```

### Key Features

1. **Isolated Test Environments**: Each test runs in a temporary directory
2. **Automated Cleanup**: Test directories cleaned up after each test
3. **Performance Measurement**: Built-in timing utilities for SLA validation
4. **File Verification**: Comprehensive file existence and content validation
5. **Backup Management**: Utilities for backup creation and validation

## Test Scenarios

### TRD-051: Fresh Installation Test

**File**: `fresh-installation.test.js` (266 lines, 7 tests)

**Purpose**: Validate complete installation from empty state

**Key Tests**:
- Install all components from empty directory
- Verify all 24 files present in ai-mesh/
- Validate backup creation
- Confirm <5s installation time
- Verify commands are discoverable

**Performance Targets**:
- Total installation: <5s
- Migration: <1s
- Validation: <200ms

**Success Criteria**:
- ✅ All 24 files migrated successfully
- ✅ Backup created before migration
- ✅ Validation passes
- ✅ Performance targets met

---

### TRD-052: Full Migration Test

**File**: `full-migration.test.js` (337 lines, 12 tests)

**Purpose**: Test complete migration from flat structure to ai-mesh/ subdirectory

**Key Tests**:
- Migrate all 12 commands (24 files total)
- Verify YAML paths updated
- Validate backup creation and integrity
- Confirm file content preservation
- Verify file permissions preserved
- Test idempotent migration

**Performance Targets**:
- Migration time: <1s for 24 files
- Scanning: <50ms
- Validation: <100ms

**Success Criteria**:
- ✅ All 24 files moved to ai-mesh/
- ✅ No files remaining in root
- ✅ Backup contains all original files
- ✅ Content and permissions preserved

---

### TRD-053: Mixed Commands Test

**File**: `mixed-commands.test.js` (411 lines, 13 tests)

**Purpose**: Validate migration with both AI Mesh and third-party commands

**Key Tests**:
- Migrate only AI Mesh commands
- Preserve third-party commands in root
- Test metadata detection accuracy
- Avoid false positives/negatives
- Handle edge cases (whitespace, case sensitivity)
- Test large mixed installations

**Detection Accuracy**:
- Zero false positives (third-party not migrated)
- Zero false negatives (AI Mesh commands migrated)
- 95%+ metadata detection accuracy

**Success Criteria**:
- ✅ AI Mesh commands in ai-mesh/ subdirectory
- ✅ Third-party commands remain in root
- ✅ No false positives or negatives
- ✅ Third-party content never modified

---

### TRD-054: Corrupted Files Test

**File**: `corrupted-files.test.js` (439 lines, 19 tests)

**Purpose**: Test migration resilience with corrupted/invalid files

**Key Tests**:
- Handle missing metadata headers
- Skip malformed YAML files
- Process empty files gracefully
- Handle binary files with .md extension
- Provide error summaries
- Achieve >50% success rate

**Corruption Types**:
- Missing @ai-mesh-command metadata
- Malformed YAML structure
- Empty files (0 bytes)
- Binary files with .md extension
- Invalid UTF-8 encoding

**Success Criteria**:
- ✅ Valid files migrated (>50% success rate)
- ✅ Corrupted files skipped with warnings
- ✅ No crashes or fatal errors
- ✅ Backup created before migration

---

### TRD-055: Permission Issues Test

**File**: `permission-issues.test.js` (405 lines, 16 tests)

**Purpose**: Validate migration behavior with permission restrictions

**Key Tests**:
- Detect read-only commands directory
- Handle write-protected ai-mesh directory
- Manage backup permission issues
- Preserve file permissions
- Provide clear error messages
- Support cross-platform compatibility

**Permission Scenarios**:
- Read-only source directory (0o444)
- Write-protected target directory (0o555)
- No write permission for backup
- Read-only individual files
- Mixed permission scenarios

**Success Criteria**:
- ✅ Permission errors detected and reported
- ✅ No partial state on critical failure
- ✅ Clear error messages for users
- ✅ Rollback successful when needed

**Note**: Some tests are platform-specific and skip on Windows due to different permission models.

---

### TRD-056: Rollback Test

**File**: `rollback.test.js` (502 lines, 21 tests)

**Purpose**: Validate migration rollback and recovery mechanisms

**Key Tests**:
- Complete rollback workflow
- Restore all file content
- Preserve file permissions
- Validate backup integrity
- Handle partial migration failures
- Test data integrity
- Measure rollback performance

**Rollback Workflow**:
1. Create backup automatically during migration
2. Validate backup integrity before rollback
3. Clear commands/ directory
4. Restore all files from backup
5. Verify original state restored
6. Validate file content and permissions

**Performance Targets**:
- Rollback time: <1s for 24 files
- Validation: <100ms

**Success Criteria**:
- ✅ Backup created successfully
- ✅ Rollback restores all files
- ✅ File permissions preserved
- ✅ Directory structure intact
- ✅ No data loss during rollback

---

## Running Integration Tests

### Run All Integration Tests

```bash
npm test -- src/__tests__/integration/
```

### Run Specific Test Suite

```bash
# Fresh Installation
npm test -- src/__tests__/integration/fresh-installation.test.js

# Full Migration
npm test -- src/__tests__/integration/full-migration.test.js

# Mixed Commands
npm test -- src/__tests__/integration/mixed-commands.test.js

# Corrupted Files
npm test -- src/__tests__/integration/corrupted-files.test.js

# Permission Issues
npm test -- src/__tests__/integration/permission-issues.test.js

# Rollback
npm test -- src/__tests__/integration/rollback.test.js
```

### Run with Coverage

```bash
npm test -- --coverage src/__tests__/integration/
```

### Run with Verbose Output

```bash
npm test -- --verbose src/__tests__/integration/
```

## Performance Expectations

### Test Execution Time

| Test Suite | Expected Duration | P95 Target |
|------------|------------------|------------|
| Fresh Installation | <10s | <15s |
| Full Migration | <5s | <8s |
| Mixed Commands | <8s | <12s |
| Corrupted Files | <10s | <15s |
| Permission Issues | <12s | <18s |
| Rollback | <8s | <12s |
| **Total Suite** | **<60s** | **<90s** |

### Component Performance

| Operation | Target | P95 |
|-----------|--------|-----|
| Fresh Installation | <5s | <8s |
| Migration (24 files) | <1s | <1.5s |
| Validation | <100ms | <200ms |
| Backup Creation | <500ms | <1s |
| Rollback | <1s | <1.5s |
| Metadata Detection | <10ms/file | <20ms/file |

## Quality Standards

### Test Coverage Requirements

- **Line Coverage**: ≥85% for integration code paths
- **Branch Coverage**: ≥80% for decision points
- **Function Coverage**: ≥90% for public APIs

### Test Quality Checklist

- [ ] Each test is independent and idempotent
- [ ] Tests clean up after themselves
- [ ] Clear failure diagnostics provided
- [ ] Performance benchmarks included
- [ ] Cross-platform compatible
- [ ] No flaky tests (100% pass rate)

### Assertion Best Practices

```javascript
// ✅ GOOD: Clear, specific assertions
expect(result.success).toBe(true);
expect(result.migratedCount).toBe(24);
expect(duration).toBeLessThan(1000);

// ❌ BAD: Vague or multiple concerns
expect(result).toBeTruthy(); // Too vague
expect(result.success && duration < 1000).toBe(true); // Multiple concerns
```

## Troubleshooting

### Common Issues

#### Test Timeout

```
Error: Timeout - Async callback was not invoked within the 5000 ms timeout
```

**Solution**: Increase Jest timeout or optimize slow tests:

```javascript
jest.setTimeout(10000); // 10 seconds
```

#### Permission Errors on CI

```
Error: EACCES: permission denied
```

**Solution**: Skip platform-specific tests or use Docker containers:

```javascript
if (process.platform === 'win32') {
  return; // Skip on Windows
}
```

#### Cleanup Failures

```
Warning: Cleanup failed for test directory
```

**Solution**: Ensure permissions are restored before cleanup:

```javascript
afterEach(async () => {
  await utils.setFilePermissions(testDir, 0o755).catch(() => {});
  await utils.cleanup(testDir);
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20]

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node }}
      
      - run: npm ci
      - run: npm test -- src/__tests__/integration/
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Maintenance

### Adding New Tests

1. Follow existing test structure
2. Use `IntegrationTestUtils` for common operations
3. Include performance measurements
4. Add cleanup in `afterEach`
5. Document test purpose in header comment
6. Update this README with new tests

### Test Naming Convention

```
<scenario>-<aspect>.test.js

Examples:
- fresh-installation.test.js
- full-migration.test.js
- corrupted-files.test.js
```

### Test Organization

```javascript
describe('TRD-XXX: Test Name', () => {
  describe('Feature Category', () => {
    test('should do specific thing', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

## Success Metrics

### Current Status

- **Total Tests**: 88 integration tests
- **Test Coverage**: Complete coverage of 6 mandatory scenarios
- **Pass Rate**: 100% (target)
- **Execution Time**: <60s for full suite
- **Code Coverage**: 85%+ for integration paths

### Production Readiness

- ✅ All 6 mandatory scenarios implemented
- ✅ Comprehensive error handling validated
- ✅ Performance targets met
- ✅ Cross-platform compatibility tested
- ✅ Data integrity guaranteed
- ✅ Rollback mechanisms validated

## Related Documentation

- **TRD**: `docs/TRD/command-directory-reorganization-trd.md`
- **Unit Tests**: `src/__tests__/installer/`
- **Performance Tests**: `src/__tests__/performance/`
- **Migration System**: `src/installer/command-migrator.js`
- **Backup System**: `src/installer/backup-manager.js`

## Support

For issues or questions about integration tests:

1. Check test output for detailed error messages
2. Review TRD requirements in `docs/TRD/`
3. Consult unit test examples in `src/__tests__/installer/`
4. Refer to test utilities documentation in `test-utils.js`

---

**Version**: 1.0.0  
**Last Updated**: October 31, 2025  
**Sprint**: 3 (Command Directory Reorganization)  
**Status**: ✅ Complete - Production Ready
