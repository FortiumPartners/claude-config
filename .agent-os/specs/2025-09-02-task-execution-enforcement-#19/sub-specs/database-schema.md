# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-02-task-execution-enforcement-#19/spec.md

> Created: 2025-09-02
> Version: 1.0.0

## Schema Changes

### New Tables

**enforcement_events** - Track all enforcement interactions and violations
**compliance_metrics** - Store aggregated compliance statistics
**override_requests** - Log all override usage and approvals
**user_sessions** - Track user workflow patterns and enforcement escalation

### Table Specifications

#### enforcement_events
```sql
CREATE TABLE enforcement_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('reminder', 'warning', 'blocking', 'override')),
    file_path TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'edit', 'delete')),
    enforcement_level INTEGER NOT NULL CHECK (enforcement_level BETWEEN 1 AND 3),
    suggested_command TEXT,
    user_action TEXT CHECK (user_action IN ('complied', 'overrode', 'ignored')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON blob for additional context
);
```

#### compliance_metrics
```sql
CREATE TABLE compliance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_file_operations INTEGER DEFAULT 0,
    compliant_operations INTEGER DEFAULT 0,
    violations_reminder INTEGER DEFAULT 0,
    violations_warning INTEGER DEFAULT 0,
    violations_blocking INTEGER DEFAULT 0,
    override_usage INTEGER DEFAULT 0,
    productivity_score REAL, -- Calculated productivity metric
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);
```

#### override_requests
```sql
CREATE TABLE override_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    enforcement_event_id INTEGER REFERENCES enforcement_events(id),
    justification TEXT NOT NULL,
    approved BOOLEAN NOT NULL,
    approver_id TEXT,
    file_path TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER -- How long override was active
);
```

#### user_sessions
```sql
CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    enforcement_escalation_level INTEGER DEFAULT 1 CHECK (enforcement_escalation_level BETWEEN 1 AND 3),
    total_operations INTEGER DEFAULT 0,
    compliant_operations INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT 1
);
```

### Indexes and Constraints

```sql
-- Performance indexes for common queries
CREATE INDEX idx_enforcement_events_user_timestamp ON enforcement_events(user_id, timestamp);
CREATE INDEX idx_enforcement_events_session ON enforcement_events(session_id);
CREATE INDEX idx_compliance_metrics_user_date ON compliance_metrics(user_id, date);
CREATE INDEX idx_override_requests_user_timestamp ON override_requests(user_id, timestamp);
CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, active);

-- Foreign key constraints
CREATE INDEX idx_override_requests_event_id ON override_requests(enforcement_event_id);
```

### Initial Migration Script

```sql
-- Initialize enforcement tracking database
-- Run this script to set up the database schema

PRAGMA foreign_keys = ON;

-- Create all tables
-- (Table creation SQL from above)

-- Insert default configuration
INSERT OR IGNORE INTO user_sessions (user_id, session_id, enforcement_escalation_level) 
VALUES ('default', 'system-default', 1);

-- Create configuration table for enforcement settings
CREATE TABLE enforcement_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default enforcement configuration
INSERT OR REPLACE INTO enforcement_config VALUES
    ('escalation_reminder_threshold', '1', 'Number of violations before showing reminders', CURRENT_TIMESTAMP),
    ('escalation_warning_threshold', '3', 'Number of violations before showing warnings', CURRENT_TIMESTAMP),
    ('escalation_blocking_threshold', '5', 'Number of violations before blocking operations', CURRENT_TIMESTAMP),
    ('session_timeout_minutes', '60', 'Minutes before session escalation resets', CURRENT_TIMESTAMP),
    ('analytics_retention_days', '90', 'Days to retain detailed analytics data', CURRENT_TIMESTAMP);
```

## Rationale

### Privacy-First Design
- Local SQLite storage ensures user data never leaves their machine
- No external database connections or cloud storage requirements
- User can delete or backup their own analytics data

### Performance Optimization
- Indexed columns for efficient querying of enforcement events and metrics
- Partitioned data by user_id and date for fast dashboard generation
- Efficient foreign key relationships for data integrity

### Data Integrity
- Check constraints ensure data validity (enforcement levels, event types)
- Unique constraints prevent duplicate metrics entries
- Foreign key relationships maintain referential integrity

### Analytics Requirements
- Support for real-time compliance rate calculations
- Productivity trend analysis over time
- Violation pattern identification
- Override usage auditing and reporting

### Scalability Considerations
- Configurable data retention policies to prevent unlimited growth
- Efficient indexing strategy for performance at scale
- Batch processing capabilities for analytics aggregation

## Data Migration Strategy

### Version 1.0.0 → Future Versions
- Use SQLite's ALTER TABLE for schema modifications
- Maintain backward compatibility with existing analytics data
- Provide migration scripts for schema evolution
- Preserve user privacy during any future changes

### Backup and Recovery
- Simple file-based backup (copy SQLite database file)
- Export capabilities for analytics data portability
- Import mechanisms for team compliance reporting
- Recovery procedures for corrupted database files