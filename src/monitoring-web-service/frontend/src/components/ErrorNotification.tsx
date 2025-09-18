/**
 * ErrorNotification - Toast-style notification for recoverable errors
 * Task 2.2: Error Boundary Integration Enhancement
 * 
 * Features:
 * - User-friendly error notifications with retry actions
 * - Category-based styling and messaging
 * - Auto-dismiss with manual dismiss option
 * - Integration with error boundary recovery
 */

import React, { useEffect, useState } from 'react';
import { ErrorCategory } from './LoggingErrorBoundary';

interface ErrorNotificationProps {
  errorId: string;
  errorCategory: ErrorCategory;
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
  canRetry?: boolean;
  isRecovering?: boolean;
  autoDismissDelay?: number; // in milliseconds
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

export const ErrorNotification: React.FC<ErrorNotificationProps> = ({
  errorId,
  errorCategory,
  message,
  onRetry,
  onDismiss,
  canRetry = false,
  isRecovering = false,
  autoDismissDelay = 8000, // 8 seconds
  position = 'top-right'
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(autoDismissDelay / 1000);

  // Auto-dismiss timer
  useEffect(() => {
    if (!canRetry && autoDismissDelay > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoDismissDelay);

      // Update countdown every second
      const countdownTimer = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);

      return () => {
        clearTimeout(timer);
        clearInterval(countdownTimer);
      };
    }
  }, [autoDismissDelay, canRetry]);

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 300); // Animation duration
  };

  const handleRetry = () => {
    if (onRetry && !isRecovering) {
      onRetry();
    }
  };

  const getNotificationIcon = (): string => {
    switch (errorCategory) {
      case 'network-error':
        return '🌐';
      case 'validation-error':
        return '⚠️';
      case 'performance-error':
        return '⏱️';
      case 'fatal-error':
        return '❌';
      case 'component-error':
      default:
        return '⚠️';
    }
  };

  const getNotificationTitle = (): string => {
    switch (errorCategory) {
      case 'network-error':
        return 'Connection Issue';
      case 'validation-error':
        return 'Input Error';
      case 'performance-error':
        return 'Performance Issue';
      case 'fatal-error':
        return 'Critical Error';
      case 'component-error':
      default:
        return 'Error Occurred';
    }
  };

  const getActionText = (): string => {
    switch (errorCategory) {
      case 'network-error':
        return 'Retry Connection';
      case 'validation-error':
        return 'Try Again';
      case 'performance-error':
        return 'Retry Operation';
      case 'fatal-error':
        return 'Reload Page';
      default:
        return 'Retry';
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className={`error-notification error-notification-${position} ${
        isAnimatingOut ? 'error-notification-exit' : 'error-notification-enter'
      } error-category-${errorCategory}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="error-notification-content">
        <div className="error-notification-header">
          <span className="error-notification-icon" aria-hidden="true">
            {getNotificationIcon()}
          </span>
          <div className="error-notification-title">
            {getNotificationTitle()}
          </div>
          <button 
            className="error-notification-close"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="error-notification-body">
          <p className="error-notification-message">
            {message.length > 100 ? `${message.substring(0, 100)}...` : message}
          </p>

          {/* Error ID for support */}
          <p className="error-notification-id">
            Error ID: <code>{errorId.substring(0, 12)}...</code>
          </p>
        </div>

        <div className="error-notification-actions">
          {canRetry && (
            <button
              className={`error-notification-retry ${isRecovering ? 'recovering' : ''}`}
              onClick={handleRetry}
              disabled={isRecovering}
              type="button"
            >
              {isRecovering ? (
                <>
                  <span className="retry-spinner" aria-hidden="true"></span>
                  Retrying...
                </>
              ) : (
                getActionText()
              )}
            </button>
          )}

          {!canRetry && timeRemaining > 0 && (
            <span className="error-notification-countdown">
              Auto-dismiss in {timeRemaining}s
            </span>
          )}
        </div>
      </div>

      {/* Progress bar for auto-dismiss */}
      {!canRetry && autoDismissDelay > 0 && (
        <div className="error-notification-progress">
          <div 
            className="error-notification-progress-bar"
            style={{
              animationDuration: `${autoDismissDelay}ms`,
              animationName: 'notification-progress'
            }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * CSS Styles for Error Notification
 */
export const errorNotificationStyles = `
/* Base notification styles */
.error-notification {
  position: fixed;
  z-index: 10000;
  min-width: 320px;
  max-width: 480px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  border-left: 4px solid #dc2626;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

/* Position variants */
.error-notification-top-right {
  top: 20px;
  right: 20px;
}

.error-notification-top-left {
  top: 20px;
  left: 20px;
}

.error-notification-bottom-right {
  bottom: 20px;
  right: 20px;
}

.error-notification-bottom-left {
  bottom: 20px;
  left: 20px;
}

.error-notification-top-center {
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}

/* Category-specific colors */
.error-category-network-error {
  border-left-color: #f59e0b;
}

.error-category-validation-error {
  border-left-color: #ef4444;
}

.error-category-performance-error {
  border-left-color: #f97316;
}

.error-category-fatal-error {
  border-left-color: #dc2626;
}

.error-category-component-error {
  border-left-color: #6b7280;
}

/* Animation states */
.error-notification-enter {
  animation: slideInFromRight 0.3s ease-out forwards;
}

.error-notification-exit {
  animation: slideOutToRight 0.3s ease-in forwards;
}

@keyframes slideInFromRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutToRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

/* Content layout */
.error-notification-content {
  padding: 16px;
}

.error-notification-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.error-notification-icon {
  font-size: 18px;
  margin-right: 8px;
}

.error-notification-title {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
  flex: 1;
}

.error-notification-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.error-notification-close:hover {
  background-color: #f3f4f6;
  color: #374151;
}

.error-notification-body {
  margin-bottom: 12px;
}

.error-notification-message {
  font-size: 13px;
  color: #4b5563;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.error-notification-id {
  font-size: 11px;
  color: #9ca3af;
  margin: 0;
}

.error-notification-id code {
  background-color: #f3f4f6;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.error-notification-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-notification-retry {
  background-color: #3b82f6;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.error-notification-retry:hover:not(:disabled) {
  background-color: #2563eb;
}

.error-notification-retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-notification-retry.recovering {
  background-color: #f59e0b;
}

.retry-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-notification-countdown {
  font-size: 11px;
  color: #6b7280;
}

/* Progress bar for auto-dismiss */
.error-notification-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background-color: #e5e7eb;
}

.error-notification-progress-bar {
  height: 100%;
  background-color: #3b82f6;
  width: 100%;
  transform-origin: left;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes notification-progress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .error-notification {
    left: 16px !important;
    right: 16px !important;
    transform: none !important;
    max-width: none;
  }
  
  .error-notification-top-center {
    transform: none;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .error-notification {
    background-color: #1f2937;
    color: #f9fafb;
  }
  
  .error-notification-title {
    color: #f9fafb;
  }
  
  .error-notification-message {
    color: #d1d5db;
  }
  
  .error-notification-close:hover {
    background-color: #374151;
    color: #e5e7eb;
  }
  
  .error-notification-id code {
    background-color: #374151;
    color: #e5e7eb;
  }
  
  .error-notification-progress {
    background-color: #4b5563;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .error-notification {
    border: 2px solid #000;
  }
  
  .error-notification-retry {
    border: 1px solid #000;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .error-notification-enter,
  .error-notification-exit {
    animation: none;
  }
  
  .retry-spinner {
    animation: none;
  }
  
  .error-notification-progress-bar {
    animation: none;
    transition: transform 1s linear;
  }
}
`;