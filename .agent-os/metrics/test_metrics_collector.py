#!/usr/bin/env python3
"""
Unit Tests for MetricsCollector Service Class
Created: 2025-08-30 for Manager Dashboard Metrics Implementation

Comprehensive test suite for Task 1.1.1 from Issue #4.
"""

import unittest
import tempfile
import json
import time
import threading
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import datetime

# Import the module under test
import sys
sys.path.append(str(Path(__file__).parent))
from metrics_collector import (
    MetricsCollector, MetricsConfig, MetricEvent, 
    CommandMetric, AgentMetric, ToolMetric,
    collect_command_metric, collect_agent_metric, collect_tool_metric
)


class TestMetricsConfig(unittest.TestCase):
    """Test cases for MetricsConfig class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config_file = Path(self.temp_dir) / 'test-config.yml'
    
    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_default_config_creation(self):
        """Test that default configuration is created when file doesn't exist."""
        config = MetricsConfig(str(self.config_file))
        
        # Test default values
        self.assertTrue(config.get('metrics.enabled'))
        self.assertEqual(config.get('metrics.retention_days'), 90)
        self.assertTrue(config.get('performance.async_processing'))
        self.assertEqual(config.get('performance.sampling_rate'), 1.0)
    
    def test_config_loading_from_file(self):
        """Test loading configuration from YAML file."""
        # Create test config file
        config_content = """
metrics:
  enabled: true
  retention_days: 30
performance:
  sampling_rate: 0.5
"""
        with open(self.config_file, 'w') as f:
            f.write(config_content)
        
        config = MetricsConfig(str(self.config_file))
        
        self.assertEqual(config.get('metrics.retention_days'), 30)
        self.assertEqual(config.get('performance.sampling_rate'), 0.5)
    
    def test_is_enabled_functionality(self):
        """Test the is_enabled method for different metric types."""
        config = MetricsConfig(str(self.config_file))
        
        self.assertTrue(config.is_enabled('commands'))
        self.assertTrue(config.is_enabled('agents'))
        self.assertTrue(config.is_enabled('tools'))
    
    def test_invalid_config_file_handling(self):
        """Test handling of invalid config files."""
        # Create invalid YAML file
        with open(self.config_file, 'w') as f:
            f.write("invalid: yaml: content: [")
        
        # Should fall back to defaults without crashing
        config = MetricsConfig(str(self.config_file))
        self.assertTrue(config.get('metrics.enabled'))


class TestMetricEvents(unittest.TestCase):
    """Test cases for metric event data classes."""
    
    def test_metric_event_serialization(self):
        """Test basic MetricEvent serialization."""
        event = MetricEvent(
            event_type="test",
            timestamp="2025-08-30T10:00:00Z",
            session_id="test-session",
            user="test-user",
            data={"key": "value"}
        )
        
        # Test dictionary conversion
        event_dict = event.to_dict()
        self.assertEqual(event_dict['event_type'], 'test')
        self.assertEqual(event_dict['user'], 'test-user')
        self.assertEqual(event_dict['data']['key'], 'value')
        
        # Test JSON conversion
        json_str = event.to_json()
        parsed = json.loads(json_str)
        self.assertEqual(parsed['event_type'], 'test')
    
    def test_command_metric_creation(self):
        """Test CommandMetric creation and serialization."""
        metric = CommandMetric(
            event_type="command",
            timestamp="2025-08-30T10:00:00Z",
            session_id="test-session",
            user="test-user",
            data={},
            command="/execute-tasks",
            duration_ms=1500,
            exit_code=0,
            success=True,
            tools_used=["Edit", "Read"],
            agents_invoked=["meta-agent"]
        )
        
        self.assertEqual(metric.event_type, "command")
        self.assertEqual(metric.command, "/execute-tasks")
        self.assertEqual(metric.duration_ms, 1500)
        self.assertTrue(metric.success)
        self.assertEqual(len(metric.tools_used), 2)
        self.assertEqual(len(metric.agents_invoked), 1)
    
    def test_agent_metric_creation(self):
        """Test AgentMetric creation."""
        metric = AgentMetric(
            event_type="agent",
            timestamp="2025-08-30T10:00:00Z",
            session_id="test-session",
            user="test-user",
            data={},
            agent_name="frontend-developer",
            task_description="Create React component",
            duration_ms=2500,
            success=True,
            complexity_score=7.5
        )
        
        self.assertEqual(metric.event_type, "agent")
        self.assertEqual(metric.agent_name, "frontend-developer")
        self.assertEqual(metric.complexity_score, 7.5)
        self.assertTrue(metric.success)
    
    def test_tool_metric_creation(self):
        """Test ToolMetric creation."""
        metric = ToolMetric(
            event_type="tool",
            timestamp="2025-08-30T10:00:00Z",
            session_id="test-session",
            user="test-user",
            data={},
            tool_name="Edit",
            operation="create_file",
            duration_ms=150,
            success=True,
            resource_impact={"files_modified": 1}
        )
        
        self.assertEqual(metric.event_type, "tool")
        self.assertEqual(metric.tool_name, "Edit")
        self.assertEqual(metric.operation, "create_file")
        self.assertEqual(metric.resource_impact["files_modified"], 1)


class TestMetricsCollector(unittest.TestCase):
    """Test cases for MetricsCollector class."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage_path = Path(self.temp_dir) / 'metrics'
        self.config_file = Path(self.temp_dir) / 'config.yml'
        
        # Create minimal config
        config_content = """
metrics:
  enabled: true
  retention_days: 30
performance:
  sampling_rate: 1.0
"""
        with open(self.config_file, 'w') as f:
            f.write(config_content)
        
        self.config = MetricsConfig(str(self.config_file))
        self.collector = MetricsCollector(config=self.config, storage_path=str(self.storage_path))
    
    def tearDown(self):
        """Clean up test fixtures."""
        if hasattr(self, 'collector'):
            self.collector.shutdown()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_initialization(self):
        """Test MetricsCollector initialization."""
        self.assertIsNotNone(self.collector.session_id)
        self.assertIsNotNone(self.collector.user)
        self.assertTrue(self.storage_path.exists())
        
        # Check directory structure
        self.assertTrue((self.storage_path / 'sessions').exists())
        self.assertTrue((self.storage_path / 'aggregated').exists())
        self.assertTrue((self.storage_path / 'exports').exists())
        
        # Check initial files
        self.assertTrue((self.storage_path / 'tool-metrics.jsonl').exists())
        self.assertTrue((self.storage_path / 'agent-metrics.jsonl').exists())
        self.assertTrue((self.storage_path / 'command-metrics.jsonl').exists())
    
    def test_command_metric_collection(self):
        """Test collecting command metrics."""
        # Collect a command metric
        result = self.collector.collect_command_metric(
            command="/execute-tasks",
            duration_ms=2500,
            exit_code=0,
            tools_used=["Edit", "Read"],
            agents_invoked=["meta-agent"]
        )
        
        self.assertTrue(result)
        self.assertEqual(self.collector.metrics_count, 1)
        
        # Check file contents
        metrics_file = self.storage_path / 'command-metrics.jsonl'
        with open(metrics_file, 'r') as f:
            line = f.readline().strip()
            metric_data = json.loads(line)
            
        self.assertEqual(metric_data['command'], '/execute-tasks')
        self.assertEqual(metric_data['duration_ms'], 2500)
        self.assertEqual(metric_data['exit_code'], 0)
        self.assertTrue(metric_data['success'])
        self.assertEqual(len(metric_data['tools_used']), 2)
    
    def test_agent_metric_collection(self):
        """Test collecting agent metrics."""
        result = self.collector.collect_agent_metric(
            agent_name="frontend-developer",
            task_description="Create React component",
            duration_ms=3000,
            success=True,
            complexity_score=8.0
        )
        
        self.assertTrue(result)
        
        # Check file contents
        metrics_file = self.storage_path / 'agent-metrics.jsonl'
        with open(metrics_file, 'r') as f:
            line = f.readline().strip()
            metric_data = json.loads(line)
        
        self.assertEqual(metric_data['agent_name'], 'frontend-developer')
        self.assertEqual(metric_data['duration_ms'], 3000)
        self.assertEqual(metric_data['complexity_score'], 8.0)
        self.assertTrue(metric_data['success'])
    
    def test_tool_metric_collection(self):
        """Test collecting tool metrics."""
        result = self.collector.collect_tool_metric(
            tool_name="Edit",
            operation="modify_file",
            duration_ms=200,
            success=True,
            resource_impact={"lines_modified": 50}
        )
        
        self.assertTrue(result)
        
        # Check file contents
        metrics_file = self.storage_path / 'tool-metrics.jsonl'
        with open(metrics_file, 'r') as f:
            line = f.readline().strip()
            metric_data = json.loads(line)
        
        self.assertEqual(metric_data['tool_name'], 'Edit')
        self.assertEqual(metric_data['operation'], 'modify_file')
        self.assertEqual(metric_data['resource_impact']['lines_modified'], 50)
    
    def test_thread_safety(self):
        """Test thread safety of metrics collection."""
        def collect_metrics(thread_id):
            for i in range(10):
                self.collector.collect_command_metric(
                    command=f"test-command-{thread_id}-{i}",
                    duration_ms=100 + i,
                    exit_code=0
                )
                time.sleep(0.001)  # Small delay to encourage race conditions
        
        # Start multiple threads
        threads = []
        for thread_id in range(5):
            thread = threading.Thread(target=collect_metrics, args=(thread_id,))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Should have collected 50 metrics (5 threads × 10 metrics)
        self.assertEqual(self.collector.metrics_count, 50)
        
        # Check that all metrics were stored properly
        metrics_file = self.storage_path / 'command-metrics.jsonl'
        with open(metrics_file, 'r') as f:
            lines = f.readlines()
        
        self.assertEqual(len(lines), 50)
        
        # Verify all lines are valid JSON
        for line in lines:
            metric_data = json.loads(line.strip())
            self.assertIn('command', metric_data)
            self.assertIn('duration_ms', metric_data)
    
    def test_session_metrics_retrieval(self):
        """Test retrieving metrics for a specific session."""
        # Collect some metrics
        self.collector.collect_command_metric("test-cmd-1", 1000)
        self.collector.collect_agent_metric("test-agent", "test task", 2000)
        self.collector.collect_tool_metric("Edit", "create", 500)
        
        # Retrieve session metrics
        metrics = self.collector.get_session_metrics()
        
        self.assertEqual(len(metrics), 3)
        
        # Check metric types
        event_types = [m['event_type'] for m in metrics]
        self.assertIn('command', event_types)
        self.assertIn('agent', event_types)
        self.assertIn('tool', event_types)
    
    def test_metrics_summary(self):
        """Test metrics summary generation."""
        # Collect some test metrics
        self.collector.collect_command_metric("test-cmd", 1000)
        self.collector.collect_agent_metric("test-agent", "test", 500)
        
        summary = self.collector.get_metrics_summary()
        
        self.assertIn('session_id', summary)
        self.assertIn('user', summary)
        self.assertIn('metrics_collected', summary)
        self.assertIn('files', summary)
        
        self.assertEqual(summary['metrics_collected'], 2)
        self.assertGreater(summary['files']['command-metrics.jsonl'], 0)
        self.assertGreater(summary['files']['agent-metrics.jsonl'], 0)
    
    def test_error_handling(self):
        """Test error handling and fallback mechanisms."""
        # Test with invalid storage path (should create temp storage)
        with patch('tempfile.mkdtemp') as mock_temp:
            mock_temp.return_value = self.temp_dir + '/fallback'
            invalid_collector = MetricsCollector(storage_path="/invalid/path/that/doesnt/exist")
            
            # Should still work with fallback storage
            result = invalid_collector.collect_command_metric("test", 1000)
            self.assertTrue(result)
            invalid_collector.shutdown()
    
    def test_configuration_disabled_metrics(self):
        """Test that disabled metrics are not collected."""
        # Create config with commands disabled
        disabled_config_content = """
metrics:
  enabled: true
collection:
  commands:
    enabled: false
  agents:
    enabled: true
  tools:
    enabled: true
"""
        disabled_config_file = Path(self.temp_dir) / 'disabled-config.yml'
        with open(disabled_config_file, 'w') as f:
            f.write(disabled_config_content)
        
        disabled_config = MetricsConfig(str(disabled_config_file))
        disabled_collector = MetricsCollector(config=disabled_config, storage_path=str(self.storage_path) + '_disabled')
        
        # Command metrics should be skipped
        result = disabled_collector.collect_command_metric("test", 1000)
        self.assertTrue(result)  # Returns True but doesn't actually collect
        self.assertEqual(disabled_collector.metrics_count, 0)
        
        # Agent metrics should still work
        result = disabled_collector.collect_agent_metric("test-agent", "test", 500)
        self.assertTrue(result)
        self.assertEqual(disabled_collector.metrics_count, 1)
        
        disabled_collector.shutdown()
    
    def test_task_categorization(self):
        """Test task categorization functionality."""
        test_cases = [
            ("run unit tests", "testing"),
            ("implement new feature", "development"),
            ("write documentation", "documentation"),
            ("code review", "review"),
            ("random task", "general")
        ]
        
        for task_desc, expected_category in test_cases:
            category = self.collector._categorize_task(task_desc)
            self.assertEqual(category, expected_category, f"Failed for task: {task_desc}")


class TestConvenienceFunctions(unittest.TestCase):
    """Test cases for convenience functions."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        # Mock the global collector to use our temp directory
        self.patcher = patch('metrics_collector.get_global_collector')
        mock_get_collector = self.patcher.start()
        
        config = MetricsConfig()
        collector = MetricsCollector(config=config, storage_path=self.temp_dir + '/metrics')
        mock_get_collector.return_value = collector
        self.collector = collector
    
    def tearDown(self):
        """Clean up test fixtures."""
        self.patcher.stop()
        self.collector.shutdown()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_collect_command_metric_function(self):
        """Test convenience function for command metrics."""
        result = collect_command_metric("/test-command", 1500, exit_code=0)
        self.assertTrue(result)
        self.assertEqual(self.collector.metrics_count, 1)
    
    def test_collect_agent_metric_function(self):
        """Test convenience function for agent metrics."""
        result = collect_agent_metric("test-agent", "test task", 2000, success=True)
        self.assertTrue(result)
        self.assertEqual(self.collector.metrics_count, 1)
    
    def test_collect_tool_metric_function(self):
        """Test convenience function for tool metrics."""
        result = collect_tool_metric("Edit", "create_file", 300, success=True)
        self.assertTrue(result)
        self.assertEqual(self.collector.metrics_count, 1)


class TestIntegration(unittest.TestCase):
    """Integration tests for the complete metrics system."""
    
    def setUp(self):
        """Set up integration test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.storage_path = Path(self.temp_dir) / 'metrics'
        self.collector = MetricsCollector(storage_path=str(self.storage_path))
    
    def tearDown(self):
        """Clean up integration test fixtures."""
        self.collector.shutdown()
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_complete_workflow_simulation(self):
        """Test a complete workflow with multiple metrics."""
        # Simulate a complete development workflow
        
        # 1. Start command
        self.collector.collect_command_metric(
            "/execute-tasks", 15000, 0, 
            tools_used=["Read", "Edit", "Bash"],
            agents_invoked=["meta-agent", "frontend-developer"]
        )
        
        # 2. Agent delegations
        self.collector.collect_agent_metric("meta-agent", "Delegate task to frontend-developer", 500, True, 3.0)
        self.collector.collect_agent_metric("frontend-developer", "Create React component", 8000, True, 7.5)
        
        # 3. Tool usage
        self.collector.collect_tool_metric("Read", "read_file", 100, True)
        self.collector.collect_tool_metric("Edit", "create_file", 200, True, {"files_created": 1})
        self.collector.collect_tool_metric("Edit", "modify_file", 150, True, {"lines_added": 50})
        self.collector.collect_tool_metric("Bash", "run_tests", 3000, True)
        
        # 4. Verify all metrics collected
        self.assertEqual(self.collector.metrics_count, 7)
        
        # 5. Check session metrics
        session_metrics = self.collector.get_session_metrics()
        self.assertEqual(len(session_metrics), 7)
        
        # 6. Verify summary
        summary = self.collector.get_metrics_summary()
        self.assertEqual(summary['metrics_collected'], 7)
        
        # 7. Check that all files have content
        for filename in ['command-metrics.jsonl', 'agent-metrics.jsonl', 'tool-metrics.jsonl']:
            file_path = self.storage_path / filename
            self.assertTrue(file_path.exists())
            with open(file_path, 'r') as f:
                lines = f.readlines()
                self.assertGreater(len(lines), 0)


if __name__ == '__main__':
    # Run the test suite
    unittest.main(verbosity=2)