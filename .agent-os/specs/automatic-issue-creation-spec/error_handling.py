#!/usr/bin/env python3
"""
Comprehensive error handling and retry logic for ticketing integrations.

This module provides robust error handling, retry mechanisms, and recovery
strategies for reliable issue creation across different ticketing systems.
"""

import asyncio
import logging
from typing import Any, Callable, Dict, List, Optional, Type, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import traceback
import json

from ticketing_interface import TicketingError, TicketingInterfaceException


class ErrorCategory(Enum):
    """Categories of errors that can occur."""
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    RATE_LIMIT = "rate_limit"
    NETWORK = "network"
    API_ERROR = "api_error"
    VALIDATION = "validation"
    TIMEOUT = "timeout"
    RESOURCE_NOT_FOUND = "resource_not_found"
    QUOTA_EXCEEDED = "quota_exceeded"
    SYSTEM_ERROR = "system_error"


class RetryStrategy(Enum):
    """Different retry strategies."""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff" 
    FIXED_INTERVAL = "fixed_interval"
    NO_RETRY = "no_retry"


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_attempts: int = 3
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF
    base_delay: float = 1.0  # Base delay in seconds
    max_delay: float = 60.0  # Maximum delay in seconds
    backoff_multiplier: float = 2.0
    jitter: bool = True  # Add random jitter to delays
    retryable_categories: List[ErrorCategory] = field(default_factory=lambda: [
        ErrorCategory.NETWORK,
        ErrorCategory.RATE_LIMIT,
        ErrorCategory.TIMEOUT,
        ErrorCategory.API_ERROR
    ])


@dataclass 
class ErrorContext:
    """Context information for error handling."""
    operation: str
    attempt: int
    max_attempts: int
    total_elapsed_time: float
    last_error: Optional[Exception] = None
    error_history: List[Dict[str, Any]] = field(default_factory=list)
    
    def add_error(self, error: Exception, category: ErrorCategory, recoverable: bool = True):
        """Add an error to the history."""
        error_info = {
            "timestamp": datetime.now().isoformat(),
            "attempt": self.attempt,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "category": category.value,
            "recoverable": recoverable,
            "traceback": traceback.format_exc() if logging.getLogger().isEnabledFor(logging.DEBUG) else None
        }
        self.error_history.append(error_info)
        self.last_error = error


class ErrorClassifier:
    """Classifies errors into categories for appropriate handling."""
    
    def __init__(self):
        # Error patterns for classification
        self.classification_rules = {
            ErrorCategory.AUTHENTICATION: [
                "unauthorized", "authentication failed", "invalid credentials",
                "401", "authentication required", "token expired"
            ],
            ErrorCategory.AUTHORIZATION: [
                "forbidden", "access denied", "insufficient permissions",
                "403", "not allowed", "permission denied"
            ],
            ErrorCategory.RATE_LIMIT: [
                "rate limit", "too many requests", "429", "throttled",
                "api limit exceeded", "quota exceeded"
            ],
            ErrorCategory.NETWORK: [
                "connection failed", "timeout", "network error", "dns",
                "connection refused", "connection reset", "unreachable"
            ],
            ErrorCategory.API_ERROR: [
                "500", "502", "503", "504", "internal server error",
                "bad gateway", "service unavailable", "gateway timeout"
            ],
            ErrorCategory.VALIDATION: [
                "validation", "invalid", "bad request", "400",
                "malformed", "schema", "required field"
            ],
            ErrorCategory.TIMEOUT: [
                "timeout", "time out", "timed out", "deadline exceeded"
            ],
            ErrorCategory.RESOURCE_NOT_FOUND: [
                "not found", "404", "does not exist", "missing"
            ],
            ErrorCategory.QUOTA_EXCEEDED: [
                "quota", "limit exceeded", "over limit", "usage exceeded"
            ]
        }
    
    def classify_error(self, error: Exception) -> ErrorCategory:
        """Classify an error into a category."""
        error_message = str(error).lower()
        
        # Check if it's a TicketingInterfaceException with error info
        if isinstance(error, TicketingInterfaceException) and error.error:
            return self._classify_by_error_code(error.error.error_code)
        
        # Classify by error message content
        for category, patterns in self.classification_rules.items():
            for pattern in patterns:
                if pattern in error_message:
                    return category
        
        # Default to system error if no match
        return ErrorCategory.SYSTEM_ERROR
    
    def _classify_by_error_code(self, error_code: str) -> ErrorCategory:
        """Classify by specific error codes."""
        code_mapping = {
            "auth_failed": ErrorCategory.AUTHENTICATION,
            "forbidden": ErrorCategory.AUTHORIZATION,
            "rate_limited": ErrorCategory.RATE_LIMIT,
            "network_error": ErrorCategory.NETWORK,
            "api_error": ErrorCategory.API_ERROR,
            "validation_error": ErrorCategory.VALIDATION,
            "timeout": ErrorCategory.TIMEOUT,
            "not_found": ErrorCategory.RESOURCE_NOT_FOUND,
            "quota_exceeded": ErrorCategory.QUOTA_EXCEEDED
        }
        return code_mapping.get(error_code, ErrorCategory.SYSTEM_ERROR)
    
    def is_recoverable(self, category: ErrorCategory) -> bool:
        """Determine if an error category is typically recoverable."""
        recoverable_categories = {
            ErrorCategory.NETWORK,
            ErrorCategory.API_ERROR,
            ErrorCategory.RATE_LIMIT,
            ErrorCategory.TIMEOUT
        }
        return category in recoverable_categories


class RetryHandler:
    """Handles retry logic with different strategies."""
    
    def __init__(self, config: RetryConfig = None):
        self.config = config or RetryConfig()
        self.classifier = ErrorClassifier()
        self.logger = logging.getLogger(__name__)
    
    async def execute_with_retry(self, operation: Callable, operation_name: str, *args, **kwargs) -> Any:
        """Execute an operation with retry logic."""
        context = ErrorContext(
            operation=operation_name,
            attempt=0,
            max_attempts=self.config.max_attempts,
            total_elapsed_time=0.0
        )
        
        start_time = datetime.now()
        
        while context.attempt < self.config.max_attempts:
            context.attempt += 1
            
            try:
                self.logger.debug(f"Attempting {operation_name} (attempt {context.attempt}/{self.config.max_attempts})")
                
                # Execute the operation
                if asyncio.iscoroutinefunction(operation):
                    result = await operation(*args, **kwargs)
                else:
                    result = operation(*args, **kwargs)
                
                # Success - log and return result
                if context.attempt > 1:
                    self.logger.info(f"Operation {operation_name} succeeded after {context.attempt} attempts")
                
                return result
                
            except Exception as error:
                context.total_elapsed_time = (datetime.now() - start_time).total_seconds()
                
                # Classify the error
                category = self.classifier.classify_error(error)
                recoverable = self.classifier.is_recoverable(category)
                
                # Add to error history
                context.add_error(error, category, recoverable)
                
                self.logger.warning(
                    f"Attempt {context.attempt} of {operation_name} failed: "
                    f"{category.value} - {str(error)}"
                )
                
                # Check if we should retry
                should_retry = (
                    context.attempt < self.config.max_attempts and
                    recoverable and
                    category in self.config.retryable_categories
                )
                
                if not should_retry:
                    # No more retries - raise the final error
                    final_error = self._create_final_error(context, error, category)
                    self.logger.error(f"Operation {operation_name} failed permanently: {final_error}")
                    raise final_error
                
                # Calculate delay for next attempt
                delay = self._calculate_delay(context, category)
                
                self.logger.info(
                    f"Retrying {operation_name} in {delay:.2f}s "
                    f"(attempt {context.attempt + 1}/{self.config.max_attempts})"
                )
                
                # Wait before retry
                await asyncio.sleep(delay)
        
        # This should never be reached due to the loop logic above
        raise RuntimeError("Unexpected end of retry loop")
    
    def _calculate_delay(self, context: ErrorContext, category: ErrorCategory) -> float:
        """Calculate the delay before the next retry attempt."""
        attempt = context.attempt
        
        if self.config.strategy == RetryStrategy.NO_RETRY:
            return 0.0
        
        elif self.config.strategy == RetryStrategy.FIXED_INTERVAL:
            delay = self.config.base_delay
        
        elif self.config.strategy == RetryStrategy.LINEAR_BACKOFF:
            delay = self.config.base_delay * attempt
        
        elif self.config.strategy == RetryStrategy.EXPONENTIAL_BACKOFF:
            delay = self.config.base_delay * (self.config.backoff_multiplier ** (attempt - 1))
        
        else:
            delay = self.config.base_delay
        
        # Cap at maximum delay
        delay = min(delay, self.config.max_delay)
        
        # Special handling for rate limiting
        if category == ErrorCategory.RATE_LIMIT:
            # Use longer delay for rate limits
            delay = max(delay, 30.0)
        
        # Add jitter to prevent thundering herd
        if self.config.jitter and delay > 0:
            import random
            jitter_amount = delay * 0.1  # 10% jitter
            delay += random.uniform(-jitter_amount, jitter_amount)
        
        return max(0.0, delay)
    
    def _create_final_error(self, context: ErrorContext, last_error: Exception, 
                          category: ErrorCategory) -> TicketingInterfaceException:
        """Create the final error with complete context."""
        error_summary = {
            "operation": context.operation,
            "total_attempts": context.attempt,
            "total_elapsed_time": context.total_elapsed_time,
            "error_category": category.value,
            "error_history": context.error_history
        }
        
        message = (
            f"Operation '{context.operation}' failed after {context.attempt} attempts "
            f"over {context.total_elapsed_time:.2f}s. "
            f"Final error: {last_error}"
        )
        
        ticketing_error = TicketingError(
            error_code=f"{category.value}_final",
            message=str(last_error),
            details=error_summary,
            recoverable=False
        )
        
        return TicketingInterfaceException(message, ticketing_error)


class CircuitBreaker:
    """Circuit breaker pattern implementation for failing services."""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60, 
                 expected_exception: Type[Exception] = Exception):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        
        self.logger = logging.getLogger(__name__)
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function through circuit breaker."""
        if self.state == "OPEN":
            if self._should_attempt_reset():
                self.state = "HALF_OPEN"
                self.logger.info("Circuit breaker entering HALF_OPEN state")
            else:
                raise TicketingInterfaceException(
                    "Circuit breaker is OPEN - service unavailable",
                    TicketingError("circuit_open", "Service temporarily unavailable")
                )
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            # Success - reset circuit breaker
            self._on_success()
            return result
            
        except self.expected_exception as e:
            self._on_failure()
            raise e
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        return (
            self.last_failure_time and
            (datetime.now() - self.last_failure_time).total_seconds() > self.recovery_timeout
        )
    
    def _on_success(self):
        """Handle successful call."""
        self.failure_count = 0
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            self.logger.info("Circuit breaker reset to CLOSED state")
    
    def _on_failure(self):
        """Handle failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            self.logger.warning(
                f"Circuit breaker opened after {self.failure_count} failures"
            )


class ErrorRecoveryManager:
    """Manages error recovery strategies for different scenarios."""
    
    def __init__(self):
        self.recovery_strategies = {
            ErrorCategory.AUTHENTICATION: self._recover_authentication,
            ErrorCategory.RATE_LIMIT: self._recover_rate_limit,
            ErrorCategory.NETWORK: self._recover_network,
            ErrorCategory.API_ERROR: self._recover_api_error,
            ErrorCategory.QUOTA_EXCEEDED: self._recover_quota_exceeded
        }
        self.logger = logging.getLogger(__name__)
    
    async def attempt_recovery(self, context: ErrorContext, category: ErrorCategory) -> bool:
        """Attempt to recover from an error category."""
        recovery_func = self.recovery_strategies.get(category)
        
        if recovery_func:
            try:
                return await recovery_func(context)
            except Exception as e:
                self.logger.error(f"Recovery attempt failed: {e}")
                return False
        
        return False
    
    async def _recover_authentication(self, context: ErrorContext) -> bool:
        """Attempt to recover from authentication errors."""
        # In a real implementation, this might:
        # - Refresh authentication tokens
        # - Re-authenticate with stored credentials
        # - Prompt for new credentials
        
        self.logger.info("Attempting authentication recovery")
        # Placeholder for actual recovery logic
        return False
    
    async def _recover_rate_limit(self, context: ErrorContext) -> bool:
        """Attempt to recover from rate limiting."""
        # Rate limiting recovery usually involves waiting
        self.logger.info("Waiting for rate limit recovery")
        
        # Wait longer for rate limits
        wait_time = min(60.0, 10.0 * context.attempt)
        await asyncio.sleep(wait_time)
        
        return True
    
    async def _recover_network(self, context: ErrorContext) -> bool:
        """Attempt to recover from network errors."""
        # Network recovery might involve:
        # - Testing connectivity
        # - Switching endpoints
        # - Adjusting timeouts
        
        self.logger.info("Attempting network recovery")
        
        # Simple backoff for network issues
        await asyncio.sleep(2.0 * context.attempt)
        return True
    
    async def _recover_api_error(self, context: ErrorContext) -> bool:
        """Attempt to recover from API errors."""
        # API error recovery might involve:
        # - Checking service status
        # - Using alternative endpoints
        # - Adjusting request parameters
        
        self.logger.info("Attempting API error recovery")
        
        # Simple backoff for API errors
        await asyncio.sleep(5.0 * context.attempt)
        return True
    
    async def _recover_quota_exceeded(self, context: ErrorContext) -> bool:
        """Attempt to recover from quota exceeded errors."""
        # Quota recovery usually involves waiting until quota resets
        self.logger.info("Waiting for quota reset")
        
        # Wait until next quota period (assuming hourly quotas)
        wait_time = 3600  # 1 hour
        await asyncio.sleep(min(wait_time, 300))  # Cap at 5 minutes for testing
        
        return True


# Utility functions

def create_retry_config(system_type: str) -> RetryConfig:
    """Create system-specific retry configuration."""
    if system_type == "linear":
        return RetryConfig(
            max_attempts=3,
            strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
            base_delay=2.0,
            max_delay=30.0,
            retryable_categories=[
                ErrorCategory.NETWORK,
                ErrorCategory.RATE_LIMIT,
                ErrorCategory.API_ERROR,
                ErrorCategory.TIMEOUT
            ]
        )
    
    elif system_type == "github":
        return RetryConfig(
            max_attempts=5,  # GitHub API is more stable, allow more retries
            strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
            base_delay=1.0,
            max_delay=60.0,
            retryable_categories=[
                ErrorCategory.NETWORK,
                ErrorCategory.RATE_LIMIT,
                ErrorCategory.API_ERROR,
                ErrorCategory.TIMEOUT
            ]
        )
    
    # Default configuration
    return RetryConfig()


def log_error_metrics(context: ErrorContext):
    """Log error metrics for monitoring and alerting."""
    metrics = {
        "operation": context.operation,
        "attempts": context.attempt,
        "elapsed_time": context.total_elapsed_time,
        "success": context.attempt < context.max_attempts,
        "error_categories": list(set(
            error["category"] for error in context.error_history
        ))
    }
    
    # In a production system, this would send to monitoring system
    logger = logging.getLogger("error_metrics")
    logger.info(f"Error metrics: {json.dumps(metrics)}")


# Decorators for easy retry functionality

def with_retry(config: Optional[RetryConfig] = None):
    """Decorator to add retry functionality to functions."""
    def decorator(func):
        retry_handler = RetryHandler(config)
        
        async def wrapper(*args, **kwargs):
            return await retry_handler.execute_with_retry(
                func, func.__name__, *args, **kwargs
            )
        
        return wrapper
    return decorator


def with_circuit_breaker(failure_threshold: int = 5, recovery_timeout: int = 60):
    """Decorator to add circuit breaker functionality to functions."""
    def decorator(func):
        circuit_breaker = CircuitBreaker(failure_threshold, recovery_timeout)
        
        async def wrapper(*args, **kwargs):
            return await circuit_breaker.call(func, *args, **kwargs)
        
        return wrapper
    return decorator