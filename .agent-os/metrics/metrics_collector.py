#!/usr/bin/env python3
"""
MetricsCollector Service Class
Created: 2025-08-30 for Manager Dashboard Metrics Implementation

Thread-safe metrics collection service for Claude Code AI-augmented development workflows.
Implements Task 1.1.1 from Issue #4.
"""

import json
import threading
import time
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
import logging
from dataclasses import dataclass, asdict
try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False


@dataclass
class MetricEvent:
    """Base class for all metric events."""
    event_type: str
    timestamp: str
    session_id: str
    user: str
    data: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), separators=(',', ':'))


@dataclass
class CommandMetric(MetricEvent):
    """Metrics for command execution."""
    command: str
    duration_ms: int
    exit_code: int
    success: bool
    tools_used: List[str]
    agents_invoked: List[str]
    
    def __post_init__(self):
        self.event_type = "command"


@dataclass
class AgentMetric(MetricEvent):
    """Metrics for agent invocations."""
    agent_name: str
    task_description: str
    duration_ms: int
    success: bool
    complexity_score: float
    
    def __post_init__(self):
        self.event_type = "agent"


@dataclass
class ToolMetric(MetricEvent):
    """Metrics for tool usage."""
    tool_name: str
    operation: str
    duration_ms: int
    success: bool
    resource_impact: Dict[str, Any]
    
    def __post_init__(self):
        self.event_type = "tool"


class MetricsConfig:
    """Configuration management for metrics collection."""
    
    def __init__(self, config_file: Optional[str] = None):
        self.config_file = config_file or "~/.claude/hooks/metrics/metrics-config.yml"
        self.config_path = Path(self.config_file).expanduser()
        self._config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file."""
        try:
            if self.config_path.exists():
                with open(self.config_path, 'r') as f:
                    if HAS_YAML:
                        return yaml.safe_load(f) or {}
                    else:
                        # Fallback to JSON if YAML not available
                        try:
                            return json.load(f)
                        except json.JSONDecodeError:
                            logging.warning("Config file is not valid JSON, using defaults")
                            return self._default_config()
            else:
                return self._default_config()
        except Exception as e:
            logging.warning(f"Failed to load config from {self.config_path}: {e}")
            return self._default_config()
    
    def _default_config(self) -> Dict[str, Any]:
        """Return default configuration."""
        return {
            'metrics': {
                'enabled': True,
                'storage_path': '~/.agent-os/metrics',
                'retention_days': 90
            },
            'performance': {
                'max_execution_time_ms': 100,
                'async_processing': True,
                'sampling_rate': 1.0
            },
            'collection': {
                'commands': {'enabled': True},
                'agents': {'enabled': True},
                'tools': {'enabled': True}
            },
            'privacy': {
                'anonymize_users': False,
                'exclude_file_contents': True
            }
        }
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value using dot notation."""
        keys = key.split('.')
        value = self._config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value
    
    def is_enabled(self, metric_type: str) -> bool:
        """Check if a specific metric type is enabled."""
        return (self.get('metrics.enabled', True) and 
                self.get(f'collection.{metric_type}.enabled', True))


class MetricsCollector:
    """
    Thread-safe metrics collection service for Claude Code workflows.
    
    Features:
    - Thread-safe operations with proper locking
    - Configurable retention and sampling policies
    - Error handling and fallback mechanisms
    - Multiple storage formats (JSONL, aggregated)
    - Real-time and batch processing modes
    """
    
    def __init__(self, config: Optional[MetricsConfig] = None, storage_path: Optional[str] = None):
        """
        Initialize MetricsCollector.
        
        Args:
            config: MetricsConfig instance, defaults to loading from standard location
            storage_path: Override storage path from config
        """
        self.config = config or MetricsConfig()
        self.storage_path = Path(storage_path or self.config.get('metrics.storage_path', '~/.agent-os/metrics')).expanduser()
        
        # Thread safety
        self._lock = threading.RLock()
        self._session_locks = {}
        
        # State management
        self.session_id = str(uuid.uuid4())
        self.user = self._get_current_user()
        self.start_time = datetime.utcnow()
        
        # Performance tracking
        self.metrics_count = 0
        self.last_cleanup = time.time()
        
        # Initialize storage
        self._initialize_storage()
        
        # Set up logging
        self._setup_logging()
        
        self.logger.info(f"MetricsCollector initialized - Session: {self.session_id}")
    
    def _initialize_storage(self):
        """Create necessary storage directories and files."""
        try:
            directories = ['sessions', 'aggregated', 'exports']
            for directory in directories:
                (self.storage_path / directory).mkdir(parents=True, exist_ok=True)
            
            # Create initial files
            self._ensure_file_exists(self.storage_path / 'tool-metrics.jsonl')
            self._ensure_file_exists(self.storage_path / 'agent-metrics.jsonl')
            self._ensure_file_exists(self.storage_path / 'command-metrics.jsonl')
            
        except Exception as e:
            self.logger.error(f"Failed to initialize storage: {e}")
            # Create fallback temporary storage
            import tempfile
            self.storage_path = Path(tempfile.mkdtemp(prefix='claude-metrics-'))
            self.logger.warning(f"Using temporary storage: {self.storage_path}")
    
    def _ensure_file_exists(self, file_path: Path):
        """Ensure a file exists, create if it doesn't."""
        if not file_path.exists():
            file_path.touch()
    
    def _setup_logging(self):
        """Setup logging for the metrics collector."""
        self.logger = logging.getLogger('MetricsCollector')
        if not self.logger.handlers:
            handler = logging.FileHandler(self.storage_path / 'metrics-collector.log')
            formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def _get_current_user(self) -> str:
        """Get current user, anonymized if configured."""
        import os
        user = os.getenv('USER', 'unknown')
        if self.config.get('privacy.anonymize_users', False):
            # Simple hash-based anonymization
            import hashlib
            return hashlib.md5(user.encode()).hexdigest()[:8]
        return user
    
    def _get_session_lock(self, session_id: str) -> threading.RLock:
        """Get or create a lock for a specific session."""
        with self._lock:
            if session_id not in self._session_locks:
                self._session_locks[session_id] = threading.RLock()
            return self._session_locks[session_id]
    
    def collect_command_metric(self, 
                             command: str, 
                             duration_ms: int, 
                             exit_code: int = 0,
                             tools_used: Optional[List[str]] = None,
                             agents_invoked: Optional[List[str]] = None,
                             session_id: Optional[str] = None) -> bool:
        """
        Collect metrics for command execution.
        
        Args:
            command: The command that was executed
            duration_ms: Execution duration in milliseconds
            exit_code: Command exit code
            tools_used: List of tools used during execution
            agents_invoked: List of agents invoked during execution
            session_id: Optional session ID, uses current if not provided
            
        Returns:
            bool: True if metric was successfully collected
        """
        if not self.config.is_enabled('commands'):
            return True
        
        try:
            metric = CommandMetric(
                event_type="command",
                timestamp=datetime.utcnow().isoformat() + 'Z',
                session_id=session_id or self.session_id,
                user=self.user,
                data={},
                command=command,
                duration_ms=duration_ms,
                exit_code=exit_code,
                success=exit_code == 0,
                tools_used=tools_used or [],
                agents_invoked=agents_invoked or []
            )
            
            return self._store_metric(metric, 'command-metrics.jsonl')
            
        except Exception as e:
            self.logger.error(f"Failed to collect command metric: {e}")
            return False
    
    def collect_agent_metric(self,
                           agent_name: str,
                           task_description: str,
                           duration_ms: int,
                           success: bool = True,
                           complexity_score: float = 1.0,
                           session_id: Optional[str] = None) -> bool:
        """
        Collect metrics for agent invocation.
        
        Args:
            agent_name: Name of the invoked agent
            task_description: Description of the task performed
            duration_ms: Execution duration in milliseconds
            success: Whether the agent completed successfully
            complexity_score: Complexity rating (0-10)
            session_id: Optional session ID
            
        Returns:
            bool: True if metric was successfully collected
        """
        if not self.config.is_enabled('agents'):
            return True
            
        try:
            metric = AgentMetric(
                event_type="agent",
                timestamp=datetime.utcnow().isoformat() + 'Z',
                session_id=session_id or self.session_id,
                user=self.user,
                data={'task_category': self._categorize_task(task_description)},
                agent_name=agent_name,
                task_description=task_description,
                duration_ms=duration_ms,
                success=success,
                complexity_score=complexity_score
            )
            
            return self._store_metric(metric, 'agent-metrics.jsonl')
            
        except Exception as e:
            self.logger.error(f"Failed to collect agent metric: {e}")
            return False
    
    def collect_tool_metric(self,
                          tool_name: str,
                          operation: str,
                          duration_ms: int,
                          success: bool = True,
                          resource_impact: Optional[Dict[str, Any]] = None,
                          session_id: Optional[str] = None) -> bool:
        """
        Collect metrics for tool usage.
        
        Args:
            tool_name: Name of the tool used
            operation: Type of operation performed
            duration_ms: Execution duration in milliseconds
            success: Whether the operation succeeded
            resource_impact: Resource usage metrics
            session_id: Optional session ID
            
        Returns:
            bool: True if metric was successfully collected
        """
        if not self.config.is_enabled('tools'):
            return True
            
        try:
            metric = ToolMetric(
                event_type="tool",
                timestamp=datetime.utcnow().isoformat() + 'Z',
                session_id=session_id or self.session_id,
                user=self.user,
                data={},
                tool_name=tool_name,
                operation=operation,
                duration_ms=duration_ms,
                success=success,
                resource_impact=resource_impact or {}
            )
            
            return self._store_metric(metric, 'tool-metrics.jsonl')
            
        except Exception as e:
            self.logger.error(f"Failed to collect tool metric: {e}")
            return False
    
    def _store_metric(self, metric: MetricEvent, filename: str) -> bool:
        """
        Store a metric to the appropriate file with thread safety.
        
        Args:
            metric: The metric event to store
            filename: Target filename for storage
            
        Returns:
            bool: True if successfully stored
        """
        session_lock = self._get_session_lock(metric.session_id)
        
        with session_lock:
            try:
                # Apply sampling if configured
                sampling_rate = self.config.get('performance.sampling_rate', 1.0)
                if sampling_rate < 1.0:
                    import random
                    if random.random() > sampling_rate:
                        return True  # Sampled out, but not an error
                
                # Store to main metrics file
                metrics_file = self.storage_path / filename
                with open(metrics_file, 'a', encoding='utf-8') as f:
                    f.write(metric.to_json() + '\n')
                
                # Store to session-specific file
                session_file = self.storage_path / 'sessions' / f'{metric.session_id}.jsonl'
                with open(session_file, 'a', encoding='utf-8') as f:
                    f.write(metric.to_json() + '\n')
                
                self.metrics_count += 1
                
                # Periodic cleanup
                if time.time() - self.last_cleanup > 3600:  # Every hour
                    self._cleanup_old_metrics()
                    self.last_cleanup = time.time()
                
                return True
                
            except Exception as e:
                self.logger.error(f"Failed to store metric: {e}")
                return False
    
    def _categorize_task(self, task_description: str) -> str:
        """Categorize task based on description."""
        task_lower = task_description.lower()
        if any(keyword in task_lower for keyword in ['test', 'testing', 'spec']):
            return 'testing'
        elif any(keyword in task_lower for keyword in ['code', 'implement', 'develop']):
            return 'development'
        elif any(keyword in task_lower for keyword in ['doc', 'document', 'readme']):
            return 'documentation'
        elif any(keyword in task_lower for keyword in ['review', 'check', 'validate']):
            return 'review'
        else:
            return 'general'
    
    def _cleanup_old_metrics(self):
        """Clean up old metrics based on retention policy."""
        try:
            retention_days = self.config.get('metrics.retention_days', 90)
            cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
            
            # Clean up old session files
            sessions_dir = self.storage_path / 'sessions'
            for session_file in sessions_dir.glob('*.jsonl'):
                if session_file.stat().st_mtime < cutoff_date.timestamp():
                    session_file.unlink()
                    self.logger.info(f"Cleaned up old session file: {session_file.name}")
            
        except Exception as e:
            self.logger.error(f"Cleanup failed: {e}")
    
    def get_session_metrics(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Retrieve metrics for a specific session.
        
        Args:
            session_id: Session ID, defaults to current session
            
        Returns:
            List of metric dictionaries
        """
        session_id = session_id or self.session_id
        session_file = self.storage_path / 'sessions' / f'{session_id}.jsonl'
        
        metrics = []
        try:
            if session_file.exists():
                with open(session_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            metrics.append(json.loads(line.strip()))
        except Exception as e:
            self.logger.error(f"Failed to read session metrics: {e}")
        
        return metrics
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get a summary of collected metrics.
        
        Returns:
            Dictionary with metrics summary
        """
        try:
            summary = {
                'session_id': self.session_id,
                'user': self.user,
                'start_time': self.start_time.isoformat() + 'Z',
                'uptime_seconds': (datetime.utcnow() - self.start_time).total_seconds(),
                'metrics_collected': self.metrics_count,
                'storage_path': str(self.storage_path),
                'files': {}
            }
            
            # Count metrics in each file
            for metrics_file in ['command-metrics.jsonl', 'agent-metrics.jsonl', 'tool-metrics.jsonl']:
                file_path = self.storage_path / metrics_file
                if file_path.exists():
                    with open(file_path, 'r') as f:
                        line_count = sum(1 for _ in f)
                    summary['files'][metrics_file] = line_count
                else:
                    summary['files'][metrics_file] = 0
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Failed to generate metrics summary: {e}")
            return {'error': str(e)}
    
    def shutdown(self):
        """Graceful shutdown of the metrics collector."""
        try:
            self.logger.info(f"Shutting down MetricsCollector - Collected {self.metrics_count} metrics")
            # Perform final cleanup
            self._cleanup_old_metrics()
        except Exception as e:
            self.logger.error(f"Error during shutdown: {e}")


def get_global_collector() -> MetricsCollector:
    """Get or create global MetricsCollector instance."""
    if not hasattr(get_global_collector, '_instance'):
        get_global_collector._instance = MetricsCollector()
    return get_global_collector._instance


# Convenience functions for direct use
def collect_command_metric(command: str, duration_ms: int, **kwargs) -> bool:
    """Convenience function to collect command metrics."""
    return get_global_collector().collect_command_metric(command, duration_ms, **kwargs)


def collect_agent_metric(agent_name: str, task_description: str, duration_ms: int, **kwargs) -> bool:
    """Convenience function to collect agent metrics."""
    return get_global_collector().collect_agent_metric(agent_name, task_description, duration_ms, **kwargs)


def collect_tool_metric(tool_name: str, operation: str, duration_ms: int, **kwargs) -> bool:
    """Convenience function to collect tool metrics."""
    return get_global_collector().collect_tool_metric(tool_name, operation, duration_ms, **kwargs)


if __name__ == '__main__':
    # Basic testing
    collector = MetricsCollector()
    
    # Test command metric
    collector.collect_command_metric('/execute-tasks', 2500, 0, ['Task', 'Edit'], ['meta-agent'])
    
    # Test agent metric
    collector.collect_agent_metric('meta-agent', 'Implement metrics collection', 1500, True, 5.0)
    
    # Test tool metric
    collector.collect_tool_metric('Edit', 'create_file', 150, True)
    
    # Print summary
    print("MetricsCollector Test Summary:")
    print(json.dumps(collector.get_metrics_summary(), indent=2))