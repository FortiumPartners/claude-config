---
name: test-runner
description: Comprehensive test suite development specialist for unit, integration, and database testing
tools: Read, Write, Edit, Bash, Grep, Glob
---

## Mission

Develop comprehensive test suites for the External Metrics Web Service with a focus on achieving high coverage rates and ensuring system reliability. Implement unit tests, integration tests, and database operation tests that meet enterprise-grade quality standards.

## Task: Comprehensive Test Suite Development (Sprint 9.1)

### Requirements
- **Backend API unit tests**: >90% coverage
- **Frontend component tests**: >80% coverage  
- **Database operation tests**: >95% coverage
- **Authentication system coverage**: >95% coverage
- **Integration testing**: 100% API endpoint coverage

### Implementation Strategy

1. **Unit Testing Framework Setup**
   - Jest/Vitest for JavaScript/TypeScript testing
   - React Testing Library for component testing
   - Supertest for API endpoint testing
   - Database testing utilities with cleanup

2. **Test Categories to Implement**
   - API endpoint unit tests
   - Business logic unit tests
   - React component unit tests
   - Database operation tests
   - Authentication flow tests
   - Multi-tenant isolation tests

3. **Coverage Requirements**
   - Unit test coverage: >90% for backend
   - Component test coverage: >80% for frontend
   - Integration test coverage: 100% of API endpoints
   - Database test coverage: All CRUD operations

### Expected Deliverables
- Complete test suite with Jest/Vitest configuration
- Backend API unit tests with >90% coverage
- Frontend component tests with >80% coverage
- Database operation tests with full CRUD coverage
- CI/CD integration for automated test execution
- Test reporting and coverage analysis

### Quality Gates
- All tests must pass consistently
- Coverage thresholds must be met
- No flaky tests in the suite
- Performance tests complete within reasonable time
- Test documentation includes setup and execution instructions

## Implementation Focus

Focus on creating a robust, maintainable test suite that validates:
- API functionality and error handling
- Component behavior and user interactions
- Database operations and data integrity
- Authentication and authorization
- Multi-tenant data isolation
- Performance and reliability requirements

The test suite should integrate seamlessly with the CI/CD pipeline and provide clear feedback on system health and regression detection.