/**
 * Console Override for OTEL-Only Mode
 * Disables all console output when OTEL-only logging is enabled
 */

import { otelLoggingFlags } from './otel-logging-flags';

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
  trace: console.trace,
  dir: console.dir,
  dirxml: console.dirxml,
  table: console.table,
  time: console.time,
  timeEnd: console.timeEnd,
  count: console.count,
  assert: console.assert,
  clear: console.clear,
  group: console.group,
  groupCollapsed: console.groupCollapsed,
  groupEnd: console.groupEnd,
};

// Null operations for console methods
const nullOp = () => {};

/**
 * Disable all console output
 */
export function disableConsoleOutput(): void {
  console.log = nullOp;
  console.error = nullOp;
  console.warn = nullOp;
  console.info = nullOp;
  console.debug = nullOp;
  console.trace = nullOp;
  console.dir = nullOp;
  console.dirxml = nullOp;
  console.table = nullOp;
  console.time = nullOp;
  console.timeEnd = nullOp;
  console.count = nullOp;
  console.assert = nullOp;
  console.clear = nullOp;
  console.group = nullOp;
  console.groupCollapsed = nullOp;
  console.groupEnd = nullOp;
}

/**
 * Restore original console methods
 */
export function restoreConsoleOutput(): void {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
  console.trace = originalConsole.trace;
  console.dir = originalConsole.dir;
  console.dirxml = originalConsole.dirxml;
  console.table = originalConsole.table;
  console.time = originalConsole.time;
  console.timeEnd = originalConsole.timeEnd;
  console.count = originalConsole.count;
  console.assert = originalConsole.assert;
  console.clear = originalConsole.clear;
  console.group = originalConsole.group;
  console.groupCollapsed = originalConsole.groupCollapsed;
  console.groupEnd = originalConsole.groupEnd;
}

/**
 * Safe console that respects OTEL-only mode
 */
export const safeConsole = {
  log: (...args: any[]) => {
    if (otelLoggingFlags.enableConsoleLogging) {
      originalConsole.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (otelLoggingFlags.enableConsoleLogging) {
      originalConsole.error(...args);
    }
  },
  warn: (...args: any[]) => {
    if (otelLoggingFlags.enableConsoleLogging) {
      originalConsole.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (otelLoggingFlags.enableConsoleLogging) {
      originalConsole.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (otelLoggingFlags.enableConsoleLogging && otelLoggingFlags.enableDebugMode) {
      originalConsole.debug(...args);
    }
  },
  trace: (...args: any[]) => {
    if (otelLoggingFlags.enableConsoleLogging && otelLoggingFlags.enableDebugMode) {
      originalConsole.trace(...args);
    }
  },
};

/**
 * Initialize console override based on OTEL flags
 */
export function initializeConsoleOverride(): void {
  // If OTEL-only mode is enabled and console logging is disabled, disable all console output
  if (otelLoggingFlags.enableOTELOnly && !otelLoggingFlags.enableConsoleLogging) {
    disableConsoleOutput();

    // Store reference for emergency access
    (global as any).__originalConsole = originalConsole;
    (global as any).__safeConsole = safeConsole;

    // Log the override using the safe console (which will be silent)
    safeConsole.log('[Console Override] Console output disabled for OTEL-only mode');
  }
}

// Auto-initialize when module is loaded
initializeConsoleOverride();