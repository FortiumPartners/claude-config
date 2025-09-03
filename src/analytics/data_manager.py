"""
Task 4.5-4.6: Data retention and cleanup policies, database migration system

This module implements data lifecycle management including retention policies,
cleanup operations, and database migration capabilities.
"""
import logging
import sqlite3
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path
import json
import shutil

from .database import DatabaseManager, get_database

logger = logging.getLogger(__name__)


class DataRetentionPolicy:
    """
    Defines data retention policies for different data types.
    """
    
    def __init__(self):
        self.policies = {
            'enforcement_events': {
                'retention_days': 90,
                'archive_after_days': 60,
                'cleanup_batch_size': 1000
            },
            'compliance_metrics': {
                'retention_days': 365,  # Keep metrics longer for trend analysis
                'archive_after_days': 180,
                'cleanup_batch_size': 500
            },
            'override_requests': {
                'retention_days': 180,  # Important for audit trail
                'archive_after_days': 90,
                'cleanup_batch_size': 500
            },
            'user_sessions': {
                'retention_days': 60,
                'archive_after_days': 30,
                'cleanup_batch_size': 1000
            }
        }
        
    def get_policy(self, data_type: str) -> Dict[str, Any]:
        """Get retention policy for specific data type."""
        return self.policies.get(data_type, {
            'retention_days': 90,
            'archive_after_days': 60,
            'cleanup_batch_size': 1000
        })
        
    def set_policy(self, data_type: str, retention_days: int, 
                   archive_after_days: int = None, cleanup_batch_size: int = 1000):
        """Set custom retention policy for data type."""
        if archive_after_days is None:
            archive_after_days = max(30, retention_days // 2)
            
        self.policies[data_type] = {
            'retention_days': retention_days,
            'archive_after_days': archive_after_days,
            'cleanup_batch_size': cleanup_batch_size
        }


class DatabaseMigration:
    """
    Handles database schema migrations and version management.
    """
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
        self.migrations = {
            '1.0.0': self._migrate_to_1_0_0,
            '1.1.0': self._migrate_to_1_1_0,
        }
        
    def get_current_version(self) -> Optional[str]:
        """Get current schema version from database."""
        return self.db.get_config_value('schema_version')
        
    def get_latest_version(self) -> str:
        """Get latest available schema version."""
        return max(self.migrations.keys()) if self.migrations else '1.0.0'
        
    def needs_migration(self) -> bool:
        """Check if database needs migration to latest version."""
        current = self.get_current_version()
        latest = self.get_latest_version()
        return current != latest
        
    def migrate_to_latest(self) -> Tuple[bool, List[str]]:
        """
        Migrate database to latest schema version.
        
        Returns:
            Tuple of (success, list_of_applied_migrations)
        """
        current_version = self.get_current_version()
        if not current_version:
            return False, ["No current version found"]
            
        applied_migrations = []
        errors = []
        
        try:
            # Create backup before migration
            backup_path = self._create_backup()
            logger.info(f"Created backup at {backup_path}")
            
            # Apply migrations in order
            for version in sorted(self.migrations.keys()):
                if self._version_greater_than(version, current_version):
                    logger.info(f"Applying migration to version {version}")
                    
                    success, error = self.migrations[version]()
                    if success:
                        applied_migrations.append(version)
                        self.db.set_config_value('schema_version', version)
                        current_version = version
                    else:
                        errors.append(f"Migration to {version} failed: {error}")
                        break
                        
            return len(errors) == 0, applied_migrations if not errors else errors
            
        except Exception as e:
            logger.error(f"Migration process failed: {e}")
            return False, [str(e)]
            
    def _create_backup(self) -> str:
        """Create database backup before migration."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(self.db.db_path).parent / 'backups'
        backup_dir.mkdir(exist_ok=True)
        
        backup_path = backup_dir / f"enforcement_backup_{timestamp}.db"
        shutil.copy2(self.db.db_path, backup_path)
        
        return str(backup_path)
        
    def _version_greater_than(self, version1: str, version2: str) -> bool:
        """Compare version strings."""
        v1_parts = [int(x) for x in version1.split('.')]
        v2_parts = [int(x) for x in version2.split('.')]
        
        # Pad shorter version with zeros
        max_len = max(len(v1_parts), len(v2_parts))
        v1_parts.extend([0] * (max_len - len(v1_parts)))
        v2_parts.extend([0] * (max_len - len(v2_parts)))
        
        return v1_parts > v2_parts
        
    def _migrate_to_1_0_0(self) -> Tuple[bool, Optional[str]]:
        """Initial schema migration - already implemented."""
        return True, None
        
    def _migrate_to_1_1_0(self) -> Tuple[bool, Optional[str]]:
        """Example future migration - add performance indexes."""
        try:
            with self.db.get_connection() as conn:
                # Add new performance index
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_enforcement_events_file_type 
                    ON enforcement_events(
                        CASE 
                            WHEN file_path LIKE '%.py' THEN 'python'
                            WHEN file_path LIKE '%.js' OR file_path LIKE '%.ts' THEN 'javascript'
                            WHEN file_path LIKE '%.md' THEN 'markdown'
                            ELSE 'other'
                        END
                    )
                """)
                
                # Add new configuration options
                conn.execute("""
                    INSERT OR IGNORE INTO enforcement_config 
                    (key, value, description) 
                    VALUES ('enable_file_type_analytics', 'true', 'Enable file type analytics')
                """)
                
                conn.commit()
                
            return True, None
            
        except Exception as e:
            return False, str(e)


class DataManager:
    """
    Comprehensive data lifecycle management including retention policies,
    cleanup operations, archiving, and migration management.
    """
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        """
        Initialize data manager.
        
        Args:
            db_manager: Optional database manager instance
        """
        self.db = db_manager or get_database()
        self.retention_policy = DataRetentionPolicy()
        self.migration_manager = DatabaseMigration(self.db)
        
    def apply_retention_policies(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Apply retention policies to all data types.
        
        Args:
            dry_run: If True, only calculate what would be cleaned up
            
        Returns:
            Dictionary with cleanup results
        """
        results = {
            'dry_run': dry_run,
            'tables_processed': 0,
            'records_cleaned': 0,
            'records_archived': 0,
            'space_freed_mb': 0.0,
            'table_results': {}
        }
        
        # Process each table with retention policy
        for table_name in ['enforcement_events', 'compliance_metrics', 'override_requests', 'user_sessions']:
            policy = self.retention_policy.get_policy(table_name)
            table_result = self._cleanup_table(table_name, policy, dry_run)
            results['table_results'][table_name] = table_result
            results['records_cleaned'] += table_result['records_cleaned']
            results['records_archived'] += table_result['records_archived']
            results['tables_processed'] += 1
            
        # Calculate space freed (approximate)
        if results['records_cleaned'] > 0:
            results['space_freed_mb'] = results['records_cleaned'] * 0.001  # Rough estimate
            
        logger.info(f"Retention policy applied: {results}")
        return results
        
    def archive_old_data(self, table_name: str, days_old: int, 
                        archive_path: Optional[str] = None) -> Tuple[bool, int]:
        """
        Archive old data to external storage.
        
        Args:
            table_name: Table to archive from
            days_old: Archive records older than this many days
            archive_path: Custom archive file path
            
        Returns:
            Tuple of (success, number_of_records_archived)
        """
        if not archive_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            archive_dir = Path(self.db.db_path).parent / 'archives'
            archive_dir.mkdir(exist_ok=True)
            archive_path = archive_dir / f"{table_name}_archive_{timestamp}.json"
            
        cutoff_date = (date.today() - timedelta(days=days_old)).isoformat()
        archived_count = 0
        
        try:
            with self.db.get_connection() as conn:
                # Get records to archive
                cursor = conn.execute(f"""
                    SELECT * FROM {table_name} 
                    WHERE timestamp < ?
                    ORDER BY timestamp
                """, (cutoff_date,))
                
                records = cursor.fetchall()
                
                if records:
                    # Convert to JSON format for archiving
                    archive_data = {
                        'table_name': table_name,
                        'archive_date': datetime.now().isoformat(),
                        'cutoff_date': cutoff_date,
                        'record_count': len(records),
                        'records': [dict(record) for record in records]
                    }
                    
                    # Write to archive file
                    with open(archive_path, 'w') as f:
                        json.dump(archive_data, f, indent=2, default=str)
                        
                    # Remove archived records from database
                    conn.execute(f"""
                        DELETE FROM {table_name} WHERE timestamp < ?
                    """, (cutoff_date,))
                    
                    archived_count = len(records)
                    conn.commit()
                    
                    logger.info(f"Archived {archived_count} records from {table_name} to {archive_path}")
                    
            return True, archived_count
            
        except Exception as e:
            logger.error(f"Failed to archive data from {table_name}: {e}")
            return False, 0
            
    def restore_from_archive(self, archive_path: str) -> Tuple[bool, int]:
        """
        Restore data from archive file.
        
        Args:
            archive_path: Path to archive file
            
        Returns:
            Tuple of (success, number_of_records_restored)
        """
        try:
            with open(archive_path, 'r') as f:
                archive_data = json.load(f)
                
            table_name = archive_data['table_name']
            records = archive_data['records']
            
            restored_count = 0
            
            with self.db.get_connection() as conn:
                for record in records:
                    # Get column names for this table
                    cursor = conn.execute(f"PRAGMA table_info({table_name})")
                    columns = [row['name'] for row in cursor.fetchall()]
                    
                    # Filter record to only include valid columns
                    filtered_record = {k: v for k, v in record.items() if k in columns}
                    
                    # Build INSERT statement
                    placeholders = ', '.join(['?' for _ in filtered_record])
                    column_names = ', '.join(filtered_record.keys())
                    
                    conn.execute(f"""
                        INSERT OR IGNORE INTO {table_name} ({column_names})
                        VALUES ({placeholders})
                    """, list(filtered_record.values()))
                    
                    restored_count += 1
                    
                conn.commit()
                
            logger.info(f"Restored {restored_count} records to {table_name} from {archive_path}")
            return True, restored_count
            
        except Exception as e:
            logger.error(f"Failed to restore from archive {archive_path}: {e}")
            return False, 0
            
    def optimize_database(self) -> Dict[str, Any]:
        """
        Optimize database performance through VACUUM and ANALYZE operations.
        
        Returns:
            Dictionary with optimization results
        """
        results = {
            'vacuum_completed': False,
            'analyze_completed': False,
            'size_before_mb': 0.0,
            'size_after_mb': 0.0,
            'space_saved_mb': 0.0,
            'duration_seconds': 0.0
        }
        
        start_time = datetime.now()
        
        try:
            # Get database size before optimization
            if self.db.db_path.exists():
                results['size_before_mb'] = self.db.db_path.stat().st_size / (1024 * 1024)
                
            with self.db.get_connection() as conn:
                # VACUUM - reclaim unused space and defragment
                conn.execute("VACUUM")
                results['vacuum_completed'] = True
                
                # ANALYZE - update query planner statistics
                conn.execute("ANALYZE")
                results['analyze_completed'] = True
                
            # Get database size after optimization
            if self.db.db_path.exists():
                results['size_after_mb'] = self.db.db_path.stat().st_size / (1024 * 1024)
                results['space_saved_mb'] = results['size_before_mb'] - results['size_after_mb']
                
            end_time = datetime.now()
            results['duration_seconds'] = (end_time - start_time).total_seconds()
            
            logger.info(f"Database optimization completed: {results}")
            
        except Exception as e:
            logger.error(f"Database optimization failed: {e}")
            results['error'] = str(e)
            
        return results
        
    def get_data_statistics(self) -> Dict[str, Any]:
        """
        Get comprehensive data statistics for monitoring.
        
        Returns:
            Dictionary with data statistics
        """
        stats = {
            'database_info': self.db.get_database_stats(),
            'retention_policies': self.retention_policy.policies,
            'migration_status': {
                'current_version': self.migration_manager.get_current_version(),
                'latest_version': self.migration_manager.get_latest_version(),
                'needs_migration': self.migration_manager.needs_migration()
            },
            'table_statistics': {},
            'data_age_analysis': {}
        }
        
        try:
            with self.db.get_connection() as conn:
                # Get table-specific statistics
                for table in ['enforcement_events', 'compliance_metrics', 'override_requests', 'user_sessions']:
                    cursor = conn.execute(f"""
                        SELECT 
                            COUNT(*) as total_records,
                            MIN(timestamp) as oldest_record,
                            MAX(timestamp) as newest_record
                        FROM {table}
                    """)
                    result = cursor.fetchone()
                    
                    stats['table_statistics'][table] = {
                        'total_records': result['total_records'],
                        'oldest_record': result['oldest_record'],
                        'newest_record': result['newest_record']
                    }
                    
                    # Calculate data age distribution
                    cursor = conn.execute(f"""
                        SELECT 
                            SUM(CASE WHEN DATE(timestamp) >= DATE('now', '-7 days') THEN 1 ELSE 0 END) as last_7_days,
                            SUM(CASE WHEN DATE(timestamp) >= DATE('now', '-30 days') THEN 1 ELSE 0 END) as last_30_days,
                            SUM(CASE WHEN DATE(timestamp) >= DATE('now', '-90 days') THEN 1 ELSE 0 END) as last_90_days
                        FROM {table}
                    """)
                    age_result = cursor.fetchone()
                    
                    stats['data_age_analysis'][table] = {
                        'last_7_days': age_result['last_7_days'],
                        'last_30_days': age_result['last_30_days'],
                        'last_90_days': age_result['last_90_days']
                    }
                    
        except Exception as e:
            logger.error(f"Error getting data statistics: {e}")
            stats['error'] = str(e)
            
        return stats
        
    def _cleanup_table(self, table_name: str, policy: Dict[str, Any], dry_run: bool) -> Dict[str, Any]:
        """Clean up old records from a specific table based on retention policy."""
        result = {
            'table_name': table_name,
            'records_cleaned': 0,
            'records_archived': 0,
            'policy_applied': policy
        }
        
        try:
            cutoff_date = (date.today() - timedelta(days=policy['retention_days'])).isoformat()
            archive_date = (date.today() - timedelta(days=policy['archive_after_days'])).isoformat()
            
            with self.db.get_connection() as conn:
                # Count records that would be affected
                cursor = conn.execute(f"""
                    SELECT COUNT(*) as count FROM {table_name} WHERE timestamp < ?
                """, (cutoff_date,))
                cleanup_count = cursor.fetchone()['count']
                
                cursor = conn.execute(f"""
                    SELECT COUNT(*) as count FROM {table_name} 
                    WHERE timestamp < ? AND timestamp >= ?
                """, (archive_date, cutoff_date))
                archive_count = cursor.fetchone()['count']
                
                if not dry_run and cleanup_count > 0:
                    # Archive first if needed
                    if archive_count > 0:
                        success, archived = self.archive_old_data(table_name, policy['archive_after_days'])
                        if success:
                            result['records_archived'] = archived
                            
                    # Clean up very old records in batches
                    batch_size = policy['cleanup_batch_size']
                    total_cleaned = 0
                    
                    while True:
                        cursor = conn.execute(f"""
                            DELETE FROM {table_name} 
                            WHERE timestamp < ? 
                            LIMIT ?
                        """, (cutoff_date, batch_size))
                        
                        cleaned_this_batch = cursor.rowcount
                        if cleaned_this_batch == 0:
                            break
                            
                        total_cleaned += cleaned_this_batch
                        conn.commit()
                        
                        # Break if we've cleaned all records
                        if cleaned_this_batch < batch_size:
                            break
                            
                    result['records_cleaned'] = total_cleaned
                else:
                    # Dry run - just report what would be cleaned
                    result['records_cleaned'] = cleanup_count
                    result['records_archived'] = archive_count
                    
        except Exception as e:
            logger.error(f"Error cleaning up {table_name}: {e}")
            result['error'] = str(e)
            
        return result


# Convenience function for getting default data manager
_default_data_manager = None

def get_data_manager() -> DataManager:
    """Get default data manager instance."""
    global _default_data_manager
    if _default_data_manager is None:
        _default_data_manager = DataManager()
    return _default_data_manager