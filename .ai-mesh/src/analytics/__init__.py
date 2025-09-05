"""
Analytics package for Claude Code task execution enforcement.

This package provides comprehensive analytics capabilities including:
- SQLite database management with privacy-first local storage
- Real-time metrics collection and compliance tracking
- Performance analytics and trend analysis
- Data retention policies and lifecycle management
- Export services for reporting and dashboard integration

Main Components:
- DatabaseManager: SQLite schema and connection management
- MetricsCollector: Real-time compliance and performance metrics
- PerformanceAnalytics: Advanced analytics and trend analysis
- DataManager: Data retention, cleanup, and migration management
- ExportService: Comprehensive reporting and data export

Usage:
    from analytics import get_database, get_metrics_collector
    
    db = get_database()
    db.initialize_database()
    
    collector = get_metrics_collector()
    collector.record_enforcement_event(event)
"""

from .database import DatabaseManager, get_database
from .metrics_collector import (
    MetricsCollector, 
    EnforcementEvent, 
    ComplianceMetrics,
    EventType,
    OperationType, 
    UserAction,
    get_metrics_collector
)
from .performance_analytics import (
    PerformanceAnalytics,
    ProductivityTrend,
    ComplianceInsight, 
    PerformanceReport,
    get_performance_analytics
)
from .data_manager import (
    DataManager,
    DataRetentionPolicy,
    DatabaseMigration,
    get_data_manager
)
from .export_service import (
    ExportService,
    ExportFormat,
    get_export_service
)

__version__ = "1.0.0"
__all__ = [
    # Core classes
    "DatabaseManager",
    "MetricsCollector", 
    "PerformanceAnalytics",
    "DataManager",
    "ExportService",
    
    # Data classes
    "EnforcementEvent",
    "ComplianceMetrics",
    "ProductivityTrend", 
    "ComplianceInsight",
    "PerformanceReport",
    "DataRetentionPolicy",
    "DatabaseMigration",
    
    # Enums
    "EventType",
    "OperationType",
    "UserAction", 
    "ExportFormat",
    
    # Convenience functions
    "get_database",
    "get_metrics_collector",
    "get_performance_analytics", 
    "get_data_manager",
    "get_export_service"
]