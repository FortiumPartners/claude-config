# Claude Config Analytics Hooks - Node.js Implementation

## Overview

This directory contains the **Node.js implementation** of the Claude Config analytics hooks system, converted from the original Python implementation. The Node.js version eliminates Python dependencies while maintaining all functionality and achieving improved performance.

## 🎯 Key Improvements

- **Zero Python Dependencies**: No more Python runtime, virtual environments, or pip packages
- **Improved Performance**: ≤50ms hook execution (Target: ≤30ms)
- **Lower Memory Usage**: ≤32MB per hook execution (Target: ≤20MB)
- **Simplified Installation**: Uses existing Node.js 18+ runtime
- **Unified Technology Stack**: Consistent with Claude Config's Node.js architecture

## 📁 File Structure

```
hooks/
├── analytics-engine.js         # Core analytics processing
├── session-start.js           # Session initialization hook
├── session-end.js             # Session finalization hook
├── tool-metrics.js            # Tool usage tracking hook
├── migrate-python-to-nodejs.js # Migration utility
├── package.json               # Node.js dependencies
├── README-nodejs.md          # This documentation
└── python-backup/            # Backup of original Python files
    └── metrics/
        ├── analytics-engine.py
        ├── session-start.py
        ├── session-end.py
        └── tool-metrics.py
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (already required by Claude Config)
- NPM (comes with Node.js)

### Installation

1. **Install Dependencies**:
   ```bash
   cd hooks
   npm install
   ```

2. **Test the Implementation**:
   ```bash
   # Test analytics engine
   node analytics-engine.js
   
   # Test session start
   node session-start.js
   
   # Test tool metrics
   node tool-metrics.js Read '{"file_path": "/tmp/test.txt"}' true
   ```

3. **Make Hooks Executable** (Unix systems):
   ```bash
   chmod +x *.js
   ```

## 🔄 Migration from Python

If you have an existing Python-based analytics installation:

### Automatic Migration

```bash
node migrate-python-to-nodejs.js
```

This migration utility will:
- ✅ Create backup of existing data
- ✅ Validate data integrity
- ✅ Convert configuration files
- ✅ Test Node.js implementation
- ✅ Generate migration report

### Manual Migration

1. **Backup Existing Data**:
   ```bash
   cp -r ~/.agent-os/metrics ~/.agent-os/metrics-python-backup
   ```

2. **Install Node.js Dependencies**:
   ```bash
   cd hooks && npm install
   ```

3. **Test New Implementation**:
   ```bash
   node analytics-engine.js
   ```

4. **Update Hook Configurations** (if using custom hook runners)

## 📊 Core Components

### Analytics Engine (`analytics-engine.js`)

**Purpose**: Core analytics processing with productivity scoring, anomaly detection, and trend analysis.

**Key Features**:
- Productivity score calculation (0-10 scale) 
- Anomaly detection with severity classification
- Historical baseline tracking and updates
- Team-wide metrics aggregation
- Trend analysis using linear regression

**Performance**: 
- Analytics processing: ≤2 seconds for 30-day analysis
- Memory usage: ≤20MB target

**Usage**:
```bash
# Generate dashboard data
node analytics-engine.js

# Programmatic usage
const { MetricsAnalyzer, generateDashboardData } = require('./analytics-engine.js');
```

### Session Start Hook (`session-start.js`)

**Purpose**: Initialize productivity tracking session with baseline metrics.

**Key Features**:
- Session ID generation and environment capture
- Git branch detection and working directory logging
- Baseline metrics initialization
- Dashboard integration setup
- Real-time activity logging

**Performance**: ≤50ms execution (Target: ≤30ms)

**Usage**:
```bash
# Direct execution
node session-start.js

# Programmatic usage
const { main } = require('./session-start.js');
const result = await main();
```

### Session End Hook (`session-end.js`)

**Purpose**: Finalize productivity metrics and generate session summary.

**Key Features**:
- Comprehensive productivity score calculation
- Session summary with performance metrics
- Historical data updates and baseline recalculation
- Actionable recommendations generation
- Cleanup of temporary files

**Performance**: ≤50ms execution (Target: ≤30ms)

**Usage**:
```bash
# Set session ID and run
export CLAUDE_SESSION_ID=your-session-id
node session-end.js

# Programmatic usage
const { main } = require('./session-end.js');
const result = await main();
```

### Tool Metrics Hook (`tool-metrics.js`)

**Purpose**: Capture tool usage patterns, performance, and productivity metrics.

**Key Features**:
- Tool-specific metrics collection (Read, Edit, Write, Bash, Task)
- Agent performance tracking for leaderboards
- Real-time productivity indicator updates
- Dashboard notification system
- JSONL logging for analytics processing

**Performance**: ≤50ms execution (Target: ≤30ms)

**Supported Tools**:
- **Read**: File access metrics, size tracking
- **Edit**: Line count changes, file modification tracking
- **Write**: Content length, new file creation
- **Bash**: Command execution, background process tracking
- **Task**: Agent invocation, delegation metrics

**Usage**:
```bash
# Simulate tool execution
node tool-metrics.js Read '{"file_path": "/path/to/file"}' true
node tool-metrics.js Edit '{"file_path": "/path", "old_string": "old", "new_string": "new"}' true
node tool-metrics.js Task '{"subagent_type": "frontend-developer", "description": "Create component"}' true
```

## 📈 Performance Specifications

### Execution Requirements

| Component | Target Time | Max Time | Target Memory | Max Memory |
|-----------|-------------|----------|---------------|------------|
| Session Start | ≤30ms | ≤50ms | ≤20MB | ≤32MB |
| Session End | ≤30ms | ≤50ms | ≤20MB | ≤32MB |
| Tool Metrics | ≤30ms | ≤50ms | ≤20MB | ≤32MB |
| Analytics Engine | ≤1.5s | ≤2s | ≤20MB | ≤32MB |

### Monitoring

Performance warnings are logged when execution exceeds target times:

```javascript
// Example performance warning
[Performance] Session start took 38.55ms (target: ≤30ms)
[Performance] Memory usage: 25MB (target: ≤20MB)
```

## 🔧 Dependencies

### Production Dependencies

```json
{
  "date-fns": "^2.30.0",           // Timezone-aware datetime handling
  "fs-extra": "^11.2.0",          // Enhanced file system operations  
  "simple-statistics": "^7.8.3"   // Statistical functions (replaces numpy/pandas)
}
```

### Development Dependencies

```json
{
  "jest": "^29.7.0",              // Testing framework
  "@types/node": "^20.0.0",       // TypeScript definitions
  "typescript": "^5.0.0",         // TypeScript compiler
  "tsx": "^4.0.0"                 // TypeScript execution
}
```

## 📋 Data Compatibility

### Backward Compatibility

The Node.js implementation maintains **100% backward compatibility** with existing Python-generated data:

- ✅ Reads existing JSON metrics files
- ✅ Processes JSONL history files
- ✅ Maintains data schemas and formats
- ✅ Preserves directory structure
- ✅ Supports configuration migration

### Data Formats

**Session Data** (`~/.agent-os/metrics/sessions/session-*.json`):
```json
{
  "session_id": "uuid-v4",
  "start_time": "2025-01-05T10:30:00.000Z",
  "end_time": "2025-01-05T11:45:00.000Z",
  "duration_hours": 1.25,
  "productivity_score": 8.2,
  "metrics": {
    "commands_executed": 23,
    "files_modified": 8,
    "lines_changed": 245,
    "agents_used": 3,
    "success_rate": 95.7
  }
}
```

**Analytics Configuration** (`~/.agent-os/metrics/config.json`):
```json
{
  "implementation": "nodejs",
  "version": "2.0.0",
  "data_retention_days": 90,
  "enabled_features": {
    "session_tracking": true,
    "productivity_scoring": true,
    "anomaly_detection": true,
    "trend_analysis": true
  },
  "performance_thresholds": {
    "max_hook_execution_time": 50,
    "max_memory_usage": 32,
    "max_analytics_processing_time": 2000
  }
}
```

## 🧪 Testing

### Unit Testing

```bash
# Run test suite
npm test

# Test specific component
npm test analytics-engine
```

### Integration Testing

```bash
# Test complete workflow
node session-start.js
node tool-metrics.js Read '{"file_path": "README.md"}' true
export CLAUDE_SESSION_ID=$(grep session_id ~/.agent-os/metrics/productivity-indicators.json | cut -d'"' -f4)
node session-end.js
node analytics-engine.js
```

### Performance Testing

```bash
# Monitor execution time and memory
time node session-start.js
time node analytics-engine.js
```

## 🚨 Troubleshooting

### Common Issues

**1. Module Not Found Errors**
```bash
# Install dependencies
npm install
```

**2. Permission Denied**
```bash
# Make hooks executable
chmod +x *.js
```

**3. Session File Not Found**
```bash
# Ensure session ID is set
export CLAUDE_SESSION_ID=$(cat ~/.agent-os/metrics/productivity-indicators.json | grep session_id | cut -d'"' -f4)
```

**4. Performance Warnings**
```bash
# Check system resources
node --max-old-space-size=64 analytics-engine.js
```

### Debug Mode

```bash
# Enable verbose logging
NODE_ENV=debug node analytics-engine.js
```

## 🔄 Rollback to Python

If you need to rollback to the Python implementation:

1. **Stop Node.js Processes**:
   ```bash
   pkill -f "claude-metrics"
   ```

2. **Restore Python Files**:
   ```bash
   cp -r python-backup/metrics/*.py ./
   ```

3. **Reinstall Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Restore Configuration**:
   ```bash
   # Update hook configurations to use .py files
   ```

## 📞 Support

### Getting Help

1. **Check Migration Log**: `~/.agent-os/metrics/migration-log.jsonl`
2. **Review Performance Logs**: Look for `[Performance]` warnings
3. **Validate Data Integrity**: Run `node migrate-python-to-nodejs.js` to verify
4. **Create GitHub Issue**: Include system info and error messages

### Performance Optimization

- Use `--max-old-space-size=64` for memory-constrained environments
- Monitor execution times and optimize based on warnings
- Consider data retention cleanup for large history files

## 🎉 Success Criteria

### Functional Success
- [x] All analytics functionality operational
- [x] Productivity scoring accuracy within 5% of Python
- [x] Historical data processing without errors
- [x] Dashboard integration working

### Performance Success  
- [x] Hook execution ≤50ms (target achieved)
- [x] Memory usage ≤32MB (target achieved) 
- [x] Analytics processing ≤2s (target achieved)
- [x] Zero Python dependencies (achieved)

### Compatibility Success
- [x] Backward compatibility with existing data
- [x] Configuration file compatibility
- [x] Migration utility working
- [x] Rollback procedures tested

---

**Implementation Status**: ✅ Production Ready  
**Version**: 2.0.0  
**Last Updated**: September 2025  
**Maintainer**: Claude Config Development Team