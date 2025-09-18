# Real-Time Activity Widget Test Suite

This document provides comprehensive information about the test suite for the real-time activity widget implementation, covering all testing requirements from the TRD.

## Overview

The test suite is designed to ensure the real-time activity widget meets all TRD requirements including:

- ✅ **Unit Tests**: ≥80% code coverage target
- ✅ **Integration Tests**: ≥70% coverage target 
- ✅ **Performance Tests**: 1000+ concurrent connections, <100ms latency
- ✅ **Security Tests**: Authentication, authorization, and data protection
- ✅ **End-to-End Tests**: Complete user workflow validation

## Test Structure

```
src/
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── activity-data.service.test.ts      # Activity data management tests
│   │   │   └── websocket.service.test.ts          # WebSocket service tests
│   │   ├── middleware/                             # Middleware unit tests
│   │   └── auth/                                   # Authentication unit tests
│   ├── integration/
│   │   └── websocket-realtime.integration.test.ts # Real-time communication tests
│   ├── performance/
│   │   └── realtime-activity-performance.test.ts  # High-load performance tests
│   └── security/
│       └── authentication-security.test.ts        # Security and auth tests
└── frontend/
    └── src/
        └── __tests__/
            ├── components/
            │   └── RealTimeActivityWidget.test.tsx # Component tests
            ├── hooks/
            │   └── useActivityStream.test.ts       # Custom hook tests
            └── setup.ts                            # Test configuration
```

## Backend Tests

### Unit Tests (≥80% Coverage)

#### ActivityDataService Tests
- **File**: `src/tests/unit/services/activity-data.service.test.ts`
- **Coverage**: Activity data management, caching, filtering
- **Key Areas**:
  - Activity CRUD operations with validation
  - Advanced filtering (search, date range, tags, priority)
  - Redis caching with hit ratio optimization
  - Batch operations for high-throughput scenarios
  - Performance metrics and statistics
  - Error handling and data validation

#### WebSocketService Tests
- **File**: `src/tests/unit/services/websocket.service.test.ts`
- **Coverage**: Real-time communication, connection management
- **Key Areas**:
  - Connection authentication and authorization
  - Room subscription management
  - Message broadcasting and routing
  - Performance monitoring and metrics
  - Error handling and recovery
  - Security features (rate limiting, data sanitization)

### Integration Tests (≥70% Coverage)

#### WebSocket Real-time Integration
- **File**: `src/tests/integration/websocket-realtime.integration.test.ts`
- **Coverage**: End-to-end real-time communication
- **Key Areas**:
  - Client-server WebSocket connection establishment
  - Real-time activity broadcasting to subscribed clients
  - Room-based message routing with tenant isolation
  - High-frequency update handling (50-100 msg/s)
  - Concurrent client support (10+ simultaneous connections)
  - Error recovery and connection resilience

### Performance Tests

#### High-Load Performance Testing
- **File**: `src/tests/performance/realtime-activity-performance.test.ts`
- **Coverage**: System performance under stress conditions
- **Performance Targets**:
  - **Connection Time**: <500ms average
  - **Message Latency**: <100ms average
  - **Throughput**: >1000 messages/second
  - **Concurrent Connections**: 1000+ simultaneous
  - **Memory Usage**: <500MB under load
  - **Database Queries**: <50ms average
  - **Cache Hit Ratio**: >80%
  - **Error Rate**: <1%

### Security Tests

#### Authentication & Authorization Security
- **File**: `src/tests/security/authentication-security.test.ts`
- **Coverage**: Comprehensive security validation
- **Security Areas**:
  - JWT token validation and expiration
  - Role-based access control (RBAC)
  - Tenant isolation and data access controls
  - Input validation and sanitization (XSS, SQL injection)
  - Rate limiting and abuse prevention
  - Data encryption and privacy protection
  - Session security and invalidation

## Frontend Tests

### Component Tests

#### RealTimeActivityWidget Component
- **File**: `frontend/src/__tests__/components/RealTimeActivityWidget.test.tsx`
- **Coverage**: React component rendering and interactions
- **Key Areas**:
  - Component rendering with various configurations
  - User interactions (clicks, filtering, modal opening)
  - Real-time data updates and state management
  - Error states and loading indicators
  - Accessibility compliance (ARIA labels, keyboard navigation)
  - Performance optimizations (virtualization, pagination)

#### Custom Hook Tests
- **File**: `frontend/src/__tests__/hooks/useActivityStream.test.ts`
- **Coverage**: Activity stream management logic
- **Key Areas**:
  - Data loading and caching
  - Real-time update processing
  - Filter application and debouncing
  - WebSocket connection management
  - Error handling and recovery
  - Memory management and cleanup

## CI/CD Integration

### GitHub Actions Workflow
- **File**: `.github/workflows/test-suite.yml`
- **Features**:
  - Multi-stage testing (unit → integration → performance → security)
  - Parallel test execution for faster feedback
  - Coverage reporting with Codecov integration
  - Security scanning with Semgrep
  - Quality gates with automatic PR status updates
  - Artifact collection for test results and coverage reports

### Test Commands

#### Backend Tests
```bash
# Run all tests
npm run test:all

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Performance tests (long-running)
npm run test:performance

# Security tests
npm run test:security

# Coverage report
npm run test:coverage
```

#### Frontend Tests
```bash
# Run all frontend tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Test Data and Mocking

### Mock Data Generators
The test suite includes comprehensive mock data generators for:

- **Activities**: Realistic activity data with various statuses, priorities, and metadata
- **Users**: Multi-tenant user data with different roles and permissions
- **WebSocket Events**: Simulated real-time events and message payloads
- **API Responses**: Standardized API response structures with pagination

### Test Environment Setup
- **Database**: Isolated test databases for each test type
- **Redis**: Separate Redis instances for caching tests
- **WebSocket**: Mock WebSocket servers for integration tests
- **Authentication**: Test JWT tokens with configurable claims

## Coverage Requirements and Monitoring

### Coverage Thresholds

#### Backend Coverage Targets
- **Global**: 90% (branches, functions, lines, statements)
- **Authentication**: 95% (critical security paths)
- **Services**: 90% (business logic)
- **Middleware**: 85% (request processing)
- **Database**: 95% (data integrity)

#### Frontend Coverage Targets
- **Global**: 80% (overall application)
- **Components**: 85% (UI components)
- **Hooks**: 90% (custom React hooks)
- **Services**: 95% (API and WebSocket services)

### Coverage Reporting
- **Format**: LCOV, HTML reports, JSON for CI
- **Integration**: Codecov for PR coverage analysis
- **Monitoring**: Automatic coverage regression detection
- **Enforcement**: Quality gates prevent merging below thresholds

## Performance Benchmarking

### Performance Metrics Tracking
The test suite automatically tracks and reports:

- **Response Times**: API endpoints and WebSocket message latency
- **Throughput**: Messages per second under various loads
- **Memory Usage**: Heap usage and garbage collection patterns
- **Connection Handling**: Concurrent connection limits and stability
- **Database Performance**: Query execution times and optimization

### Performance Regression Detection
- **Baseline Comparison**: Track performance changes over time
- **Threshold Alerts**: Automatic warnings for performance degradation
- **Load Testing**: Regular high-load scenario validation

## Security Testing Coverage

### Authentication Security
- JWT token lifecycle and validation
- Session management and timeout
- Multi-factor authentication support
- API key authentication for automated systems

### Authorization Testing
- Role-based access control validation
- Tenant data isolation verification
- Permission inheritance and escalation prevention
- Resource-level access controls

### Input Validation & Sanitization
- XSS attack prevention
- SQL injection protection
- Command injection blocking
- File upload security validation

### Data Protection
- Sensitive data encryption at rest
- Secure data transmission (TLS/SSL)
- Data masking in logs and responses
- GDPR compliance validation

## Running the Test Suite

### Development Workflow
```bash
# 1. Install dependencies
npm install

# 2. Setup test databases
npm run db:migrate
npm run migrate:test

# 3. Run unit tests during development
npm run test:unit -- --watch

# 4. Run integration tests before committing
npm run test:integration

# 5. Run full test suite before pushing
npm run test:all
```

### CI Environment
The CI environment automatically:
1. Sets up isolated test databases and Redis instances
2. Runs tests in parallel for faster feedback
3. Collects coverage reports and test artifacts
4. Updates PR status with test results
5. Blocks merging if quality gates fail

### Local Performance Testing
```bash
# Setup performance test environment
npm run test:performance

# Results are saved to:
# - performance-results/
# - test-results/
```

## Debugging Failed Tests

### Common Issues and Solutions

#### Test Timeouts
- **Cause**: Slow database queries or network operations
- **Solution**: Increase test timeout or optimize queries
- **Command**: `--testTimeout=30000`

#### Memory Leaks in Tests
- **Cause**: Unclosed connections or event listeners
- **Solution**: Ensure proper cleanup in `afterEach` hooks
- **Monitoring**: Built-in memory usage tracking

#### Flaky Integration Tests
- **Cause**: Race conditions or timing issues
- **Solution**: Use `waitFor` helpers and proper async handling
- **Prevention**: Deterministic test data and mocking

### Debug Commands
```bash
# Run specific test with verbose output
npm run test:unit -- --testNamePattern="ActivityDataService" --verbose

# Debug with Node.js inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Generate detailed coverage report
npm run test:coverage -- --verbose
```

## Maintenance and Updates

### Test Maintenance Schedule
- **Weekly**: Review test execution times and optimize slow tests
- **Monthly**: Update test data and mock scenarios
- **Quarterly**: Performance baseline updates and threshold adjustments
- **As needed**: Security test updates for new threat vectors

### Adding New Tests
When adding new features:

1. **Unit Tests**: Cover all new functions with ≥90% coverage
2. **Integration Tests**: Test feature interactions with existing system
3. **Performance Tests**: Validate performance impact under load
4. **Security Tests**: Assess security implications and access controls

### Test Documentation Updates
Keep this document updated when:
- Adding new test categories or files
- Changing coverage thresholds
- Updating performance benchmarks
- Modifying CI/CD pipeline configurations

---

## Quick Reference

| Test Type | Command | Coverage Target | Run Time |
|-----------|---------|-----------------|----------|
| Unit Tests | `npm run test:unit` | ≥80% | ~2 min |
| Integration | `npm run test:integration` | ≥70% | ~5 min |
| Performance | `npm run test:performance` | N/A | ~10 min |
| Security | `npm run test:security` | ≥95% | ~3 min |
| Frontend | `npm run test` | ≥80% | ~2 min |
| **Full Suite** | `npm run test:all` | **≥80%** | **~15 min** |

For questions or issues with the test suite, please refer to the TRD documentation or contact the development team.