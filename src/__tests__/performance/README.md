# Performance Test Suite

This directory contains performance tests for the command migration system, validating that the system meets the <100ms performance requirement specified in the TRD.

## Overview

Performance tests ensure that:
- **Standard Load**: 12 commands migrate in <100ms
- **Memory Efficiency**: Peak memory usage stays <32MB
- **High Load**: 100+ commands migrate in <1000ms
- **Consistency**: Performance remains stable across multiple runs
- **Cross-Platform**: Tests run on Ubuntu, macOS, and Windows

## Test Files

### `migration-performance.test.js`

Primary performance test suite with the following test categories:

#### 1. Standard Load (12 Commands)
- **Test**: `should complete migration in <100ms`
- **Purpose**: Validate baseline performance requirement
- **Threshold**: <100ms total migration time
- **Metrics**: Duration, memory usage, file count

- **Test**: `should maintain consistent performance across multiple runs`
- **Purpose**: Verify performance stability
- **Runs**: 5 iterations
- **Metrics**: Average, min, max, variance

#### 2. High Load (100+ Commands)
- **Test**: `should handle 100+ commands in <1000ms`
- **Purpose**: Validate scalability
- **Threshold**: <1000ms for 120 commands
- **Scale**: Dynamically generates 120 mock commands

#### 3. Memory Efficiency
- **Test**: `should not leak memory during migration`
- **Purpose**: Detect memory leaks
- **Method**: Run migration 10 times, measure growth
- **Threshold**: <10MB memory growth

#### 4. Concurrency Handling
- **Test**: `should handle concurrent migration attempts safely`
- **Purpose**: Validate thread safety
- **Method**: 5 concurrent migrations
- **Threshold**: <500ms total for all runs

#### 5. Edge Cases
- **Test**: `should handle empty directory quickly`
- **Threshold**: <10ms
- **Purpose**: Validate early exit optimization

- **Test**: `should handle non-existent directory gracefully`
- **Threshold**: <100ms
- **Purpose**: Validate error handling performance

## Running Tests

### Local Development

```bash
# Run all performance tests
npm run test:performance

# Run migration-specific tests
npm run test:performance:migration

# Run high-load tests only
npm run test:performance:high-load

# Watch mode for development
npm run test:performance:watch
```

### With Detailed Output

```bash
# Enable verbose logging
DEBUG=true npm run test:performance

# Run with garbage collection (Node.js must be run with --expose-gc)
node --expose-gc node_modules/.bin/jest src/__tests__/performance
```

### CI/CD Pipeline

Performance tests automatically run in CI/CD on:
- **Pull Requests**: To `main` branch affecting migration code
- **Push to main**: After merge
- **Scheduled**: Daily at 2 AM UTC
- **Manual Trigger**: Via GitHub Actions workflow dispatch

```bash
# Trigger manual CI/CD run
gh workflow run migration-performance.yml -f test_scale=standard
gh workflow run migration-performance.yml -f test_scale=high-load
gh workflow run migration-performance.yml -f test_scale=stress
```

## Performance Metrics

### Standard Metrics

All tests collect the following metrics:

```javascript
{
  duration: 45.23,        // milliseconds
  fileCount: 12,          // number of files processed
  migrated: 10,           // successfully migrated
  skipped: 2,             // third-party or invalid
  errors: 0,              // errors encountered
  memoryUsed: 8.5         // MB
}
```

### Consistency Metrics

Multiple-run tests collect:

```javascript
{
  average: 42.15,         // average duration (ms)
  min: 38.90,             // fastest run (ms)
  max: 47.20,             // slowest run (ms)
  variance: 8.30,         // max - min (ms)
  runs: 5                 // number of runs
}
```

## Thresholds

### Hard Requirements (Must Pass)

| Metric | Threshold | Test | Priority |
|--------|-----------|------|----------|
| Standard Load Duration | <100ms | 12 commands | Critical |
| Memory Usage | <32MB | Peak during migration | Critical |
| High Load Duration | <1000ms | 100+ commands | High |
| Memory Growth | <10MB | After 10 runs | High |
| Empty Directory | <10ms | No files | Medium |

### Soft Requirements (Warnings)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Variance | >50ms | Log warning |
| Concurrent Duration | >500ms | Log warning |
| Error Handling | >100ms | Log warning |

## Interpreting Results

### Success Example

```
Performance Metrics:
-------------------
Duration: 45.67ms ✓ (<100ms)
File Count: 12
Memory Used: 8.23MB ✓ (<32MB)
Migrated: 10
Skipped: 2

✓ All thresholds met
```

### Failure Example

```
Performance Metrics:
-------------------
Duration: 125.34ms ✗ (>100ms threshold)
File Count: 12
Memory Used: 35.12MB ✗ (>32MB threshold)
Migrated: 10
Skipped: 2

✗ Performance regression detected
  - Duration exceeded by 25.34ms
  - Memory exceeded by 3.12MB
```

## Troubleshooting

### Slow Performance

If tests consistently fail performance thresholds:

1. **Check System Load**
   ```bash
   top  # Unix/macOS
   taskmgr  # Windows
   ```

2. **Profile the Code**
   ```bash
   node --prof node_modules/.bin/jest src/__tests__/performance
   node --prof-process isolate-*.log > profile.txt
   ```

3. **Enable Garbage Collection**
   ```bash
   node --expose-gc node_modules/.bin/jest src/__tests__/performance
   ```

### Memory Leaks

If memory growth tests fail:

1. **Run with Heap Snapshots**
   ```bash
   node --inspect node_modules/.bin/jest src/__tests__/performance
   # Open chrome://inspect in Chrome
   ```

2. **Check for Unreleased Resources**
   - File handles not closed
   - Timers not cleared
   - Event listeners not removed

### Inconsistent Results

If variance is high:

1. **Reduce Background Processes**: Close unnecessary applications
2. **Run on CI**: More consistent environment
3. **Increase Sample Size**: Modify test to run more iterations

## Maintenance

### Adding New Performance Tests

1. Create test in `migration-performance.test.js`
2. Document expected metrics and thresholds
3. Add to CI/CD workflow if critical
4. Update this README

### Updating Thresholds

When updating performance thresholds:

1. Update test assertions
2. Update `jest.config.js` if needed
3. Update CI/CD workflow environment variables
4. Update this README
5. Document reason in TRD or CHANGELOG

## Related Documentation

- **TRD**: `docs/TRD/command-directory-reorganization-trd.md`
- **CI/CD Workflow**: `.github/workflows/migration-performance.yml`
- **Jest Config**: `jest.config.js`
- **Test Fixtures**: `src/__tests__/fixtures/`

## Contact

For questions or issues with performance tests:
- **Team**: Fortium Configuration Team
- **Repository**: https://github.com/FortiumPartners/claude-config
- **Issues**: https://github.com/FortiumPartners/claude-config/issues
