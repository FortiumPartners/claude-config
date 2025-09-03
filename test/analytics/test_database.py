"""
Task 4.1: Database schema tests and migration validation

Comprehensive test suite for database schema implementation with validation
of table creation, constraints, indexes, and migration capabilities.
"""
import pytest
import sqlite3
import tempfile
import os
from pathlib import Path
from unittest.mock import patch

import sys
sys.path.append(str(Path(__file__).parent.parent.parent / 'src'))

from analytics.database import DatabaseManager


@pytest.fixture
def temp_db():
    """Create temporary database for testing."""
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_file.close()
    db_manager = DatabaseManager(temp_file.name)
    
    yield db_manager
    
    # Cleanup
    try:
        os.unlink(temp_file.name)
    except OSError:
        pass


@pytest.fixture
def initialized_db(temp_db):
    """Create initialized temporary database."""
    temp_db.initialize_database()
    return temp_db


class TestDatabaseInitialization:
    """Test database initialization and schema creation."""
    
    def test_database_initialization_success(self, temp_db):
        """Test successful database initialization."""
        result = temp_db.initialize_database()
        assert result is True
        
        # Verify database file was created
        assert Path(temp_db.db_path).exists()
        
    def test_database_initialization_creates_all_tables(self, initialized_db):
        """Test that all required tables are created."""
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
            """)
            tables = [row['name'] for row in cursor.fetchall()]
            
        required_tables = [
            'compliance_metrics',
            'enforcement_config', 
            'enforcement_events',
            'override_requests',
            'user_sessions'
        ]
        
        for table in required_tables:
            assert table in tables, f"Required table {table} not created"
            
    def test_enforcement_events_table_structure(self, initialized_db):
        """Test enforcement_events table has correct structure."""
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("PRAGMA table_info(enforcement_events)")
            columns = {row['name']: row['type'] for row in cursor.fetchall()}
            
        expected_columns = {
            'id': 'INTEGER',
            'user_id': 'TEXT',
            'session_id': 'TEXT',
            'event_type': 'TEXT',
            'file_path': 'TEXT',
            'operation_type': 'TEXT',
            'enforcement_level': 'INTEGER',
            'suggested_command': 'TEXT',
            'user_action': 'TEXT',
            'timestamp': 'DATETIME',
            'metadata': 'TEXT'
        }
        
        for col_name, col_type in expected_columns.items():
            assert col_name in columns, f"Column {col_name} missing"
            assert columns[col_name] == col_type, f"Column {col_name} wrong type"
            
    def test_compliance_metrics_table_structure(self, initialized_db):
        """Test compliance_metrics table has correct structure."""
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("PRAGMA table_info(compliance_metrics)")
            columns = {row['name']: row['type'] for row in cursor.fetchall()}
            
        expected_columns = {
            'id': 'INTEGER',
            'user_id': 'TEXT',
            'date': 'DATE',
            'total_file_operations': 'INTEGER',
            'compliant_operations': 'INTEGER',
            'violations_reminder': 'INTEGER',
            'violations_warning': 'INTEGER',
            'violations_blocking': 'INTEGER',
            'override_usage': 'INTEGER',
            'productivity_score': 'REAL',
            'timestamp': 'DATETIME'
        }
        
        for col_name, col_type in expected_columns.items():
            assert col_name in columns, f"Column {col_name} missing"
            
    def test_check_constraints_enforcement(self, initialized_db):
        """Test that CHECK constraints are properly enforced."""
        with initialized_db.get_connection() as conn:
            # Test event_type constraint
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute("""
                    INSERT INTO enforcement_events 
                    (user_id, session_id, event_type, file_path, operation_type, enforcement_level)
                    VALUES ('user1', 'session1', 'invalid_type', '/path/file.txt', 'edit', 1)
                """)
                
            # Test enforcement_level constraint
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute("""
                    INSERT INTO enforcement_events 
                    (user_id, session_id, event_type, file_path, operation_type, enforcement_level)
                    VALUES ('user1', 'session1', 'reminder', '/path/file.txt', 'edit', 5)
                """)
                
    def test_unique_constraints(self, initialized_db):
        """Test unique constraints are enforced."""
        with initialized_db.get_connection() as conn:
            # Insert first record
            conn.execute("""
                INSERT INTO compliance_metrics (user_id, date)
                VALUES ('user1', '2025-09-02')
            """)
            conn.commit()
            
            # Try to insert duplicate - should fail
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute("""
                    INSERT INTO compliance_metrics (user_id, date)
                    VALUES ('user1', '2025-09-02')
                """)
                
    def test_indexes_created(self, initialized_db):
        """Test that performance indexes are created."""
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'
            """)
            indexes = [row['name'] for row in cursor.fetchall()]
            
        expected_indexes = [
            'idx_enforcement_events_user_timestamp',
            'idx_enforcement_events_session',
            'idx_compliance_metrics_user_date',
            'idx_override_requests_user_timestamp',
            'idx_user_sessions_user_active',
            'idx_override_requests_event_id'
        ]
        
        for index in expected_indexes:
            assert index in indexes, f"Index {index} not created"
            
    def test_default_config_inserted(self, initialized_db):
        """Test that default configuration values are inserted."""
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("SELECT key FROM enforcement_config")
            config_keys = [row['key'] for row in cursor.fetchall()]
            
        expected_keys = [
            'escalation_reminder_threshold',
            'escalation_warning_threshold', 
            'escalation_blocking_threshold',
            'session_timeout_minutes',
            'analytics_retention_days',
            'enable_productivity_tracking',
            'enable_override_system',
            'schema_version'
        ]
        
        for key in expected_keys:
            assert key in config_keys, f"Config key {key} not found"


class TestConfigurationManagement:
    """Test configuration value management."""
    
    def test_get_config_value_existing(self, initialized_db):
        """Test getting existing configuration value."""
        value = initialized_db.get_config_value('escalation_reminder_threshold')
        assert value == '1'
        
    def test_get_config_value_missing_with_default(self, initialized_db):
        """Test getting missing configuration value with default."""
        value = initialized_db.get_config_value('nonexistent_key', 'default_value')
        assert value == 'default_value'
        
    def test_get_config_value_missing_no_default(self, initialized_db):
        """Test getting missing configuration value without default."""
        value = initialized_db.get_config_value('nonexistent_key')
        assert value is None
        
    def test_set_config_value_new(self, initialized_db):
        """Test setting new configuration value."""
        result = initialized_db.set_config_value('new_key', 'new_value', 'Test description')
        assert result is True
        
        value = initialized_db.get_config_value('new_key')
        assert value == 'new_value'
        
    def test_set_config_value_update_existing(self, initialized_db):
        """Test updating existing configuration value."""
        # Update existing value
        result = initialized_db.set_config_value('escalation_reminder_threshold', '2')
        assert result is True
        
        value = initialized_db.get_config_value('escalation_reminder_threshold')
        assert value == '2'


class TestSchemaValidation:
    """Test database schema validation."""
    
    def test_validate_schema_complete_database(self, initialized_db):
        """Test schema validation on complete database."""
        is_valid, issues = initialized_db.validate_schema()
        assert is_valid is True
        assert len(issues) == 0
        
    def test_validate_schema_missing_tables(self, temp_db):
        """Test schema validation detects missing tables."""
        # Initialize database partially (without calling initialize_database)
        with temp_db.get_connection() as conn:
            temp_db._create_enforcement_events_table(conn)
            # Missing other tables
            conn.commit()
            
        is_valid, issues = temp_db.validate_schema()
        assert is_valid is False
        assert len(issues) > 0
        assert any('Missing required table' in issue for issue in issues)
        
    def test_validate_schema_missing_indexes(self, temp_db):
        """Test schema validation detects missing indexes."""
        with temp_db.get_connection() as conn:
            # Create tables but no indexes
            temp_db._create_enforcement_events_table(conn)
            temp_db._create_compliance_metrics_table(conn)
            temp_db._create_override_requests_table(conn)
            temp_db._create_user_sessions_table(conn)
            temp_db._create_enforcement_config_table(conn)
            temp_db._insert_default_config(conn)
            temp_db._record_schema_version(conn)
            conn.commit()
            
        is_valid, issues = temp_db.validate_schema()
        assert is_valid is False
        assert any('indexes are missing' in issue for issue in issues)
        
    def test_validate_schema_version_mismatch(self, initialized_db):
        """Test schema validation detects version mismatches."""
        # Update schema version in database to different value
        initialized_db.set_config_value('schema_version', '0.9.0')
        
        is_valid, issues = initialized_db.validate_schema()
        assert is_valid is False
        assert any('Schema version mismatch' in issue for issue in issues)


class TestDatabaseStats:
    """Test database statistics functionality."""
    
    def test_get_database_stats_empty_database(self, initialized_db):
        """Test getting stats from empty database."""
        stats = initialized_db.get_database_stats()
        
        assert 'db_path' in stats
        assert 'db_size_mb' in stats
        assert 'table_counts' in stats
        assert 'schema_version' in stats
        
        # All tables should have 0 rows initially
        for table, count in stats['table_counts'].items():
            assert count == 0, f"Table {table} should be empty"
            
    def test_get_database_stats_with_data(self, initialized_db):
        """Test getting stats with data in database."""
        # Insert test data
        with initialized_db.get_connection() as conn:
            conn.execute("""
                INSERT INTO enforcement_events 
                (user_id, session_id, event_type, file_path, operation_type, enforcement_level)
                VALUES ('user1', 'session1', 'reminder', '/test.txt', 'edit', 1)
            """)
            conn.execute("""
                INSERT INTO user_sessions (user_id, session_id)
                VALUES ('user1', 'session1')
            """)
            conn.commit()
            
        stats = initialized_db.get_database_stats()
        
        assert stats['table_counts']['enforcement_events'] == 1
        assert stats['table_counts']['user_sessions'] == 1
        assert stats['last_activity'] is not None


class TestConnectionManagement:
    """Test database connection management."""
    
    def test_connection_context_manager(self, initialized_db):
        """Test connection context manager works correctly."""
        with initialized_db.get_connection() as conn:
            assert isinstance(conn, sqlite3.Connection)
            # Test row factory is set
            cursor = conn.execute("SELECT 1 as test_col")
            row = cursor.fetchone()
            assert row['test_col'] == 1  # Dict-like access
            
    def test_connection_foreign_keys_enabled(self, initialized_db):
        """Test that foreign keys are enabled."""
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("PRAGMA foreign_keys")
            result = cursor.fetchone()
            assert result[0] == 1  # Foreign keys enabled
            
    def test_connection_error_rollback(self, initialized_db):
        """Test that errors trigger rollback."""
        try:
            with initialized_db.get_connection() as conn:
                conn.execute("INSERT INTO enforcement_events (user_id) VALUES (?)", ('user1',))
                # This will fail due to NOT NULL constraints
                conn.execute("INSERT INTO enforcement_events (user_id) VALUES (NULL)")
                conn.commit()
        except sqlite3.IntegrityError:
            pass  # Expected error
            
        # Verify no partial data was committed
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM enforcement_events")
            count = cursor.fetchone()[0]
            assert count == 0  # No data should be committed


class TestErrorHandling:
    """Test error handling scenarios."""
    
    def test_invalid_database_path(self):
        """Test handling of invalid database path."""
        invalid_path = "/nonexistent/directory/database.db"
        db_manager = DatabaseManager(invalid_path)
        
        # Should handle gracefully
        result = db_manager.initialize_database()
        assert result is False
        
    @patch('analytics.database.logger')
    def test_database_errors_logged(self, mock_logger, temp_db):
        """Test that database errors are properly logged."""
        # Force a database error by corrupting the path
        temp_db.db_path = Path("/invalid/path/db.sqlite")
        
        result = temp_db.initialize_database()
        assert result is False
        mock_logger.error.assert_called()
        
    def test_config_operations_with_database_error(self, temp_db):
        """Test config operations handle database errors gracefully."""
        # Don't initialize database to cause errors
        value = temp_db.get_config_value('test_key', 'default')
        assert value == 'default'  # Should return default on error
        
        result = temp_db.set_config_value('test_key', 'test_value')
        assert result is False  # Should return False on error


class TestMigrationSupport:
    """Test database migration capabilities."""
    
    def test_schema_version_recording(self, initialized_db):
        """Test that schema version is properly recorded."""
        version = initialized_db.get_config_value('schema_version')
        assert version == "1.0.0"
        
    def test_migration_preparation(self, initialized_db):
        """Test database is prepared for future migrations."""
        # Verify we have schema_version for migration tracking
        with initialized_db.get_connection() as conn:
            cursor = conn.execute("""
                SELECT key, value FROM enforcement_config WHERE key = 'schema_version'
            """)
            result = cursor.fetchone()
            assert result is not None
            assert result['value'] == "1.0.0"
            
        # Verify configuration system supports migration settings
        initialized_db.set_config_value('migration_test', 'success')
        assert initialized_db.get_config_value('migration_test') == 'success'


class TestDataIntegrity:
    """Test data integrity constraints and validation."""
    
    def test_foreign_key_constraints(self, initialized_db):
        """Test foreign key relationships are enforced."""
        with initialized_db.get_connection() as conn:
            # Insert valid enforcement event first
            conn.execute("""
                INSERT INTO enforcement_events 
                (user_id, session_id, event_type, file_path, operation_type, enforcement_level)
                VALUES ('user1', 'session1', 'reminder', '/test.txt', 'edit', 1)
            """)
            event_id = conn.lastrowid
            
            # Should be able to reference valid event
            conn.execute("""
                INSERT INTO override_requests 
                (user_id, session_id, enforcement_event_id, justification, approved, file_path, operation_type)
                VALUES ('user1', 'session1', ?, 'Emergency fix', 1, '/test.txt', 'edit')
            """, (event_id,))
            
            # Should fail with invalid foreign key (when foreign keys enabled)
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute("""
                    INSERT INTO override_requests 
                    (user_id, session_id, enforcement_event_id, justification, approved, file_path, operation_type)
                    VALUES ('user1', 'session1', 99999, 'Invalid reference', 1, '/test.txt', 'edit')
                """)
                
    def test_timestamp_defaults(self, initialized_db):
        """Test that timestamp defaults are working."""
        with initialized_db.get_connection() as conn:
            conn.execute("""
                INSERT INTO enforcement_events 
                (user_id, session_id, event_type, file_path, operation_type, enforcement_level)
                VALUES ('user1', 'session1', 'reminder', '/test.txt', 'edit', 1)
            """)
            conn.commit()
            
            cursor = conn.execute("""
                SELECT timestamp FROM enforcement_events WHERE user_id = 'user1'
            """)
            result = cursor.fetchone()
            assert result['timestamp'] is not None
            
    def test_boolean_handling(self, initialized_db):
        """Test boolean values are handled correctly."""
        with initialized_db.get_connection() as conn:
            # Insert session with active=True
            conn.execute("""
                INSERT INTO user_sessions (user_id, session_id, active)
                VALUES ('user1', 'session1', 1)
            """)
            
            # Insert override request with approved=False
            conn.execute("""
                INSERT INTO override_requests 
                (user_id, session_id, justification, approved, file_path, operation_type)
                VALUES ('user1', 'session1', 'Test justification', 0, '/test.txt', 'edit')
            """)
            conn.commit()
            
            # Verify boolean values
            cursor = conn.execute("SELECT active FROM user_sessions WHERE user_id = 'user1'")
            assert cursor.fetchone()['active'] == 1
            
            cursor = conn.execute("SELECT approved FROM override_requests WHERE user_id = 'user1'")
            assert cursor.fetchone()['approved'] == 0