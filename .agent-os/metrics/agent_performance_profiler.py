#!/usr/bin/env python3
"""
Agent Performance Profiler - Task 1.2.2 Implementation

Provides context manager for profiling agent execution with CPU/memory monitoring.
Integrates with the existing metrics framework for centralized performance data storage.

Requirements:
- Background monitoring with <2% overhead
- Thread-safe operations
- High precision timing
- Automatic resource cleanup

Author: Agent OS Metrics System
Version: 1.0.0
"""

import time
import threading
import psutil
from contextlib import contextmanager
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
import logging
from pathlib import Path

# Import existing metrics collector for integration
try:
    from .metrics_collector import MetricsCollector
except ImportError:
    MetricsCollector = None

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Performance metrics for agent execution"""
    invocation_id: str
    execution_time_ms: int
    cpu_usage_percent: float
    memory_usage_mb: float
    peak_memory_mb: float
    tokens_used: Optional[int] = None
    error_details: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return asdict(self)


class PerformanceMonitor:
    """Background thread for monitoring CPU and memory usage"""
    
    def __init__(self, sampling_rate_ms: int = 100):
        self.sampling_rate_ms = sampling_rate_ms
        self.sampling_interval = sampling_rate_ms / 1000.0
        
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        
        # Metrics storage
        self._cpu_samples = []
        self._memory_samples = []
        self._peak_memory = 0.0
        
        # Thread safety
        self._lock = threading.Lock()
        
        # Process reference
        try:
            self._process = psutil.Process()
        except psutil.Error as e:
            logger.error(f"Failed to initialize psutil process: {e}")
            self._process = None
    
    def start_monitoring(self):
        """Start background monitoring thread"""
        if self._thread is not None and self._thread.is_alive():
            return
        
        self._stop_event.clear()
        self._cpu_samples.clear()
        self._memory_samples.clear()
        self._peak_memory = 0.0
        
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        
        logger.debug("Performance monitoring started")
    
    def stop_monitoring(self):
        """Stop background monitoring thread"""
        if self._thread is None:
            return
        
        self._stop_event.set()
        self._thread.join(timeout=1.0)
        
        if self._thread.is_alive():
            logger.warning("Monitoring thread did not stop gracefully")
        
        logger.debug("Performance monitoring stopped")
    
    def get_metrics(self) -> tuple[float, float, float]:
        """
        Get current performance metrics
        
        Returns:
            tuple: (avg_cpu_percent, avg_memory_mb, peak_memory_mb)
        """
        with self._lock:
            avg_cpu = sum(self._cpu_samples) / len(self._cpu_samples) if self._cpu_samples else 0.0
            avg_memory = sum(self._memory_samples) / len(self._memory_samples) if self._memory_samples else 0.0
            peak_memory = self._peak_memory
        
        return avg_cpu, avg_memory, peak_memory
    
    def _monitor_loop(self):
        """Main monitoring loop running in background thread"""
        if self._process is None:
            logger.error("Cannot monitor: process not initialized")
            return
        
        while not self._stop_event.is_set():
            try:
                # Sample CPU and memory
                cpu_percent = self._process.cpu_percent()
                memory_info = self._process.memory_info()
                memory_mb = memory_info.rss / (1024 * 1024)  # Convert to MB
                
                with self._lock:
                    self._cpu_samples.append(cpu_percent)
                    self._memory_samples.append(memory_mb)
                    self._peak_memory = max(self._peak_memory, memory_mb)
                
                # Wait for next sample
                if self._stop_event.wait(self.sampling_interval):
                    break
                    
            except psutil.Error as e:
                logger.warning(f"Error sampling process metrics: {e}")
                # Continue monitoring despite errors
                if self._stop_event.wait(self.sampling_interval):
                    break
            except Exception as e:
                logger.error(f"Unexpected error in monitoring loop: {e}")
                break


class AgentPerformanceProfiler:
    """
    Agent performance profiler providing context manager for execution monitoring
    """
    
    def __init__(self, metrics_collector: Optional[MetricsCollector] = None):
        """
        Initialize profiler
        
        Args:
            metrics_collector: Optional collector for storing metrics
        """
        self.metrics_collector = metrics_collector
        if self.metrics_collector is None and MetricsCollector:
            try:
                self.metrics_collector = MetricsCollector()
            except Exception:
                pass  # Fallback to standalone mode
        
        self._active_monitors: Dict[str, PerformanceMonitor] = {}
        self._lock = threading.Lock()
    
    @contextmanager
    def profile_agent(self, invocation_id: str):
        """
        Context manager for profiling agent execution
        
        Args:
            invocation_id: Unique identifier for this agent invocation
            
        Yields:
            PerformanceMonitor: Active monitor for manual metrics access
            
        Example:
            with profiler.profile_agent("agent_123") as monitor:
                # Agent execution code here
                result = agent.execute()
                # Metrics automatically captured and stored
        """
        # Initialize monitoring
        monitor = PerformanceMonitor()
        error_details = None
        start_time = time.perf_counter()
        
        # Store active monitor
        with self._lock:
            self._active_monitors[invocation_id] = monitor
        
        try:
            # Start background monitoring
            monitor.start_monitoring()
            
            # Yield control to agent execution
            yield monitor
            
        except Exception as e:
            error_details = str(e)
            logger.error(f"Error during agent execution {invocation_id}: {e}")
            raise
            
        finally:
            # Stop monitoring and calculate metrics
            end_time = time.perf_counter()
            monitor.stop_monitoring()
            
            # Calculate final metrics
            execution_time_ms = int((end_time - start_time) * 1000)
            avg_cpu, avg_memory, peak_memory = monitor.get_metrics()
            
            # Create metrics object
            metrics = PerformanceMetrics(
                invocation_id=invocation_id,
                execution_time_ms=execution_time_ms,
                cpu_usage_percent=avg_cpu,
                memory_usage_mb=avg_memory,
                peak_memory_mb=peak_memory,
                error_details=error_details
            )
            
            # Store metrics
            self._store_metrics(metrics)
            
            # Cleanup
            with self._lock:
                self._active_monitors.pop(invocation_id, None)
            
            logger.info(f"Agent {invocation_id} executed in {execution_time_ms}ms, "
                       f"CPU: {avg_cpu:.1f}%, Memory: {avg_memory:.1f}MB (peak: {peak_memory:.1f}MB)")
    
    def _store_metrics(self, metrics: PerformanceMetrics):
        """Store performance metrics using metrics collector"""
        try:
            if self.metrics_collector:
                # Store as performance event
                self.metrics_collector.record_event({
                    'type': 'agent_performance',
                    'event_data': metrics.to_dict()
                })
            else:
                # Fallback: write to JSONL file
                self._fallback_store_metrics(metrics)
            
            logger.debug(f"Stored performance metrics for {metrics.invocation_id}")
            
        except Exception as e:
            logger.error(f"Failed to store performance metrics: {e}")
            # Try fallback storage
            try:
                self._fallback_store_metrics(metrics)
            except Exception as fallback_error:
                logger.error(f"Fallback storage also failed: {fallback_error}")
    
    def _fallback_store_metrics(self, metrics: PerformanceMetrics):
        """Fallback method to store metrics directly to file"""
        data_dir = Path(__file__).parent / "data"
        data_dir.mkdir(exist_ok=True)
        
        from datetime import datetime
        date_str = datetime.now().strftime("%Y-%m-%d")
        metrics_file = data_dir / f"agent_performance_{date_str}.jsonl"
        
        import json
        with open(metrics_file, 'a', encoding='utf-8') as f:
            json.dump(metrics.to_dict(), f, ensure_ascii=False)
            f.write('\n')
    
    def get_active_monitors(self) -> Dict[str, PerformanceMonitor]:
        """Get currently active performance monitors"""
        with self._lock:
            return self._active_monitors.copy()
    
    def cleanup(self):
        """Cleanup all active monitors"""
        with self._lock:
            for invocation_id, monitor in self._active_monitors.items():
                monitor.stop_monitoring()
                logger.debug(f"Cleaned up monitor for {invocation_id}")
            self._active_monitors.clear()


# Global profiler instance for convenience
_global_profiler: Optional[AgentPerformanceProfiler] = None


def get_profiler() -> AgentPerformanceProfiler:
    """Get or create global profiler instance"""
    global _global_profiler
    if _global_profiler is None:
        _global_profiler = AgentPerformanceProfiler()
    return _global_profiler


def profile_agent_execution(invocation_id: str):
    """
    Convenience function returning context manager for agent profiling
    
    Args:
        invocation_id: Unique identifier for this agent invocation
        
    Returns:
        Context manager for profiling
        
    Example:
        with profile_agent_execution("my_agent_123"):
            # Your agent code here
            result = my_agent.process()
    """
    return get_profiler().profile_agent(invocation_id)


def cleanup_profiler():
    """Cleanup global profiler resources"""
    global _global_profiler
    if _global_profiler is not None:
        _global_profiler.cleanup()
        _global_profiler = None


# Example usage and testing
if __name__ == "__main__":
    import time
    
    def test_profiling():
        """Test the performance profiler"""
        print("Testing Agent Performance Profiler...")
        
        # Test basic profiling
        with profile_agent_execution("test_agent_1"):
            # Simulate agent work
            time.sleep(0.1)
            # CPU intensive task
            sum(i * i for i in range(10000))
        
        # Test error handling
        try:
            with profile_agent_execution("test_agent_2"):
                time.sleep(0.05)
                raise ValueError("Test error")
        except ValueError:
            pass  # Expected error
        
        # Test multiple concurrent agents
        import concurrent.futures
        
        def simulate_agent_work(agent_id: str):
            with profile_agent_execution(f"concurrent_agent_{agent_id}"):
                time.sleep(0.02)
                return f"Agent {agent_id} completed"
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(simulate_agent_work, str(i)) for i in range(3)]
            results = [future.result() for future in futures]
            print(f"Concurrent results: {results}")
        
        # Cleanup
        cleanup_profiler()
        print("Performance profiler test completed")
    
    # Run test
    test_profiling()