/**
 * Vitest Setup File
 * Global test configuration and mocks for frontend tests
 */

import '@testing-library/jest-dom'
import { expect, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'

// Mock environment variables
Object.defineProperty(window, 'env', {
  value: {
    VITE_API_URL: 'http://localhost:3001',
    VITE_WS_URL: 'ws://localhost:3001',
  },
  writable: true,
})

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}))

// Mock Socket.IO
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
    id: 'mock-socket-id',
  })),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Custom matchers for better assertions
expect.extend({
  toHaveAttribute(element, attribute, expectedValue) {
    const hasAttribute = element.hasAttribute(attribute)
    const actualValue = element.getAttribute(attribute)
    
    if (!hasAttribute) {
      return {
        message: () => `expected element to have attribute "${attribute}"`,
        pass: false,
      }
    }
    
    if (expectedValue !== undefined && actualValue !== expectedValue) {
      return {
        message: () => 
          `expected attribute "${attribute}" to be "${expectedValue}", but got "${actualValue}"`,
        pass: false,
      }
    }
    
    return {
      message: () => `expected element not to have attribute "${attribute}"`,
      pass: true,
    }
  },
  
  toHaveRole(element, expectedRole) {
    const actualRole = element.getAttribute('role') || element.tagName.toLowerCase()
    const pass = actualRole === expectedRole
    
    return {
      message: () => 
        pass
          ? `expected element not to have role "${expectedRole}"`
          : `expected element to have role "${expectedRole}", but got "${actualRole}"`,
      pass,
    }
  },
})

// Global test utilities
global.testUtils = {
  // Mock activity data
  createMockActivity: (overrides = {}) => ({
    id: 'mock-activity-1',
    user: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      avatar_url: 'https://example.com/avatar.jpg',
    },
    action: {
      type: 'tool_usage',
      name: 'Mock Tool',
      description: 'Mock action description',
      category: 'testing',
    },
    target: {
      name: 'mock-target',
      type: 'file',
      metadata: {},
    },
    status: 'success',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    duration_ms: 150,
    execution_context: {
      session_id: 'mock-session',
    },
    tags: ['test'],
    priority: 'medium',
    is_automated: false,
    ...overrides,
  }),

  // Mock filter data
  createMockFilter: (overrides = {}) => ({
    search_query: '',
    user_ids: [],
    action_types: [],
    status_filters: [],
    priority_levels: [],
    show_automated: true,
    date_range: null,
    tags: [],
    min_duration: null,
    max_duration: null,
    ...overrides,
  }),

  // Wait for async operations
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Mock API response
  createMockApiResponse: (data, pagination = null) => ({
    data: {
      data,
      pagination: pagination || {
        total: Array.isArray(data) ? data.length : 1,
        has_next: false,
        page: 1,
        limit: 50,
      },
    },
  }),
}