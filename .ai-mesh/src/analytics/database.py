"""
Task 4.2: SQLite database schema implementation for task tracking

This module implements the database schema defined in:
.agent-os/specs/2025-09-02-task-execution-enforcement-#19/sub-specs/database-schema.md

Privacy-first approach using local SQLite storage.
"""
import sqlite3
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Manages SQLite database connections and schema operations for analytics.
    
    Implements privacy-first local storage with comprehensive schema management
    and migration support.
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize database manager with optional custom path.
        
        Args:
            db_path: Custom database file path. Defaults to local .analytics/
        """
        if db_path:
            self.db_path = Path(db_path)
        else:
            # Use local analytics directory for privacy
            analytics_dir = Path.cwd() / '.analytics'
            analytics_dir.mkdir(exist_ok=True)
            self.db_path = analytics_dir / 'enforcement.db'
            
        self.schema_version = "1.0.0"
        
    @contextmanager
    def get_connection(self):
        """Context manager for database connections with automatic cleanup."""
        conn = None
        try:
            conn = sqlite3.connect(str(self.db_path))
            conn.execute("PRAGMA foreign_keys = ON")
            conn.row_factory = sqlite3.Row  # Enable dict-like access
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def initialize_database(self) -> bool:
        """
        Initialize database with complete schema.
        
        Returns:
            True if initialization successful, False otherwise
        """
        try:
            with self.get_connection() as conn:
                # Create all tables
                self._create_enforcement_events_table(conn)
                self._create_compliance_metrics_table(conn)
                self._create_override_requests_table(conn)
                self._create_user_sessions_table(conn)
                self._create_enforcement_config_table(conn)
                
                # Create indexes
                self._create_indexes(conn)
                
                # Insert default configuration
                self._insert_default_config(conn)
                
                # Record schema version
                self._record_schema_version(conn)
                
                conn.commit()
                logger.info("Database initialized successfully")
                return True
                
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            return False
    
    def _create_enforcement_events_table(self, conn: sqlite3.Connection):
        """Create enforcement_events table for tracking all enforcement interactions."""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enforcement_events (
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
            )
        """)
        
    def _create_compliance_metrics_table(self, conn: sqlite3.Connection):
        """Create compliance_metrics table for aggregated compliance statistics."""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS compliance_metrics (
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
            )
        """)
        
    def _create_override_requests_table(self, conn: sqlite3.Connection):
        """Create override_requests table for logging all override usage."""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS override_requests (
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
            )
        """)
        
    def _create_user_sessions_table(self, conn: sqlite3.Connection):
        """Create user_sessions table for tracking user workflow patterns."""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_id TEXT UNIQUE NOT NULL,
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                enforcement_escalation_level INTEGER DEFAULT 1 CHECK (enforcement_escalation_level BETWEEN 1 AND 3),
                total_operations INTEGER DEFAULT 0,
                compliant_operations INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT 1
            )
        """)
        
    def _create_enforcement_config_table(self, conn: sqlite3.Connection):
        """Create enforcement_config table for system configuration."""
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enforcement_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
    def _create_indexes(self, conn: sqlite3.Connection):
        """Create performance indexes for common queries."""
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_enforcement_events_user_timestamp ON enforcement_events(user_id, timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_enforcement_events_session ON enforcement_events(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_compliance_metrics_user_date ON compliance_metrics(user_id, date)",
            "CREATE INDEX IF NOT EXISTS idx_override_requests_user_timestamp ON override_requests(user_id, timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, active)",
            "CREATE INDEX IF NOT EXISTS idx_override_requests_event_id ON override_requests(enforcement_event_id)"
        ]
        
        for index_sql in indexes:
            conn.execute(index_sql)
            
    def _insert_default_config(self, conn: sqlite3.Connection):
        """Insert default enforcement configuration."""
        default_configs = [
            ('escalation_reminder_threshold', '1', 'Number of violations before showing reminders'),
            ('escalation_warning_threshold', '3', 'Number of violations before showing warnings'),
            ('escalation_blocking_threshold', '5', 'Number of violations before blocking operations'),
            ('session_timeout_minutes', '60', 'Minutes before session escalation resets'),
            ('analytics_retention_days', '90', 'Days to retain detailed analytics data'),
            ('enable_productivity_tracking', 'true', 'Enable productivity metrics collection'),
            ('enable_override_system', 'true', 'Enable override authorization system')
        ]
        
        for key, value, description in default_configs:
            conn.execute("""
                INSERT OR IGNORE INTO enforcement_config (key, value, description, updated_at) 
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            """, (key, value, description))
            
    def _record_schema_version(self, conn: sqlite3.Connection):
        """Record the current schema version."""
        conn.execute("""
            INSERT OR REPLACE INTO enforcement_config (key, value, description, updated_at)
            VALUES ('schema_version', ?, 'Database schema version', CURRENT_TIMESTAMP)
        """, (self.schema_version,))
        
    def get_config_value(self, key: str, default: str = None) -> Optional[str]:
        """
        Get configuration value by key.
        
        Args:
            key: Configuration key
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.execute(
                    "SELECT value FROM enforcement_config WHERE key = ?", (key,)
                )
                result = cursor.fetchone()
                return result['value'] if result else default
        except Exception as e:
            logger.error(f"Error getting config value {key}: {e}")
            return default
            
    def set_config_value(self, key: str, value: str, description: str = None) -> bool:
        """
        Set configuration value.
        
        Args:
            key: Configuration key
            value: Configuration value
            description: Optional description
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO enforcement_config (key, value, description, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (key, value, description))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error setting config value {key}: {e}")
            return False
            
    def validate_schema(self) -> Tuple[bool, List[str]]:
        """
        Validate database schema integrity.
        
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        try:
            with self.get_connection() as conn:
                # Check if all required tables exist
                required_tables = [
                    'enforcement_events', 'compliance_metrics', 
                    'override_requests', 'user_sessions', 'enforcement_config'
                ]
                
                cursor = conn.execute("""
                    SELECT name FROM sqlite_master WHERE type='table'
                """)
                existing_tables = {row['name'] for row in cursor.fetchall()}
                
                for table in required_tables:
                    if table not in existing_tables:
                        issues.append(f"Missing required table: {table}")
                        
                # Check if indexes exist
                cursor = conn.execute("""
                    SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'
                """)
                existing_indexes = {row['name'] for row in cursor.fetchall()}
                
                if len(existing_indexes) < 6:  # We create 6 indexes
                    issues.append("Some performance indexes are missing")
                    
                # Check schema version
                version = self.get_config_value('schema_version')
                if not version:
                    issues.append("Schema version not recorded")
                elif version != self.schema_version:
                    issues.append(f"Schema version mismatch: {version} vs {self.schema_version}")
                    
        except Exception as e:
            issues.append(f"Schema validation error: {e}")
            
        return len(issues) == 0, issues
        
    def get_database_stats(self) -> Dict[str, Any]:
        """
        Get database statistics for monitoring.
        
        Returns:
            Dictionary with database statistics
        """
        stats = {
            'db_path': str(self.db_path),
            'db_size_mb': 0,
            'table_counts': {},
            'last_activity': None,
            'schema_version': self.get_config_value('schema_version')
        }
        
        try:
            # Get file size
            if self.db_path.exists():
                stats['db_size_mb'] = round(self.db_path.stat().st_size / (1024 * 1024), 2)
                
            with self.get_connection() as conn:
                # Get table row counts
                tables = ['enforcement_events', 'compliance_metrics', 'override_requests', 'user_sessions']
                for table in tables:
                    cursor = conn.execute(f"SELECT COUNT(*) as count FROM {table}")
                    stats['table_counts'][table] = cursor.fetchone()['count']
                    
                # Get last activity
                cursor = conn.execute("""
                    SELECT MAX(timestamp) as last_activity FROM enforcement_events
                """)
                result = cursor.fetchone()
                stats['last_activity'] = result['last_activity'] if result['last_activity'] else None
                
        except Exception as e:
            logger.error(f"Error getting database stats: {e}")
            stats['error'] = str(e)
            
        return stats


# Convenience function for getting default database instance
_default_db = None

def get_database() -> DatabaseManager:
    """Get default database manager instance."""
    global _default_db
    if _default_db is None:
        _default_db = DatabaseManager()
    return _default_db