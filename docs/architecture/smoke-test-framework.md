# Smoke Test Framework Design

**Version**: 1.0.0
**Last Updated**: 2025-11-05
**Status**: Draft

## Overview

This document defines the skills-based smoke test framework for the release workflow. The framework provides 5-category smoke test coverage with <3min total execution time, environment-specific configuration, and progressive disclosure pattern (SKILL.md + REFERENCE.md).

## Smoke Test Philosophy

**Purpose**: Fast, focused tests that verify critical system functionality after deployment.

**Not smoke tests**:
- Comprehensive feature testing (E2E tests)
- Performance benchmarking (load tests)
- Security vulnerability scanning (security tests)
- Code quality validation (unit tests)

**Are smoke tests**:
- API health checks (200 OK responses)
- Database connectivity (read/write operations)
- External service integration (payment gateway, email service)
- Authentication flows (login/logout)
- Critical user paths (checkout, signup)

## 5-Category Smoke Test Suite

### Category 1: API Health

**Purpose**: Verify all critical API endpoints are responding correctly

**Test Coverage**:
- Health check endpoint (`/health`, `/api/health`)
- Authentication endpoints (`/api/auth/login`, `/api/auth/logout`)
- Core CRUD endpoints (`/api/users`, `/api/products`, `/api/orders`)
- Public endpoints (`/api/public/*`)
- Admin endpoints (`/api/admin/*`)

**Pass Criteria**:
- All endpoints return 200 OK (or expected status codes)
- Response time <1s for all endpoints
- No 500 Internal Server Errors
- Authentication endpoints verify tokens correctly

**Execution Time**: ≤30 seconds

**Example Test**:
```javascript
// smoke-test-api/scripts/execute-health-checks.js
async function testAPIHealth(config) {
  const endpoints = config.endpoints;
  const results = [];

  for (const endpoint of endpoints) {
    const start = Date.now();
    const response = await fetch(`${config.baseUrl}${endpoint.path}`);
    const duration = Date.now() - start;

    results.push({
      endpoint: endpoint.path,
      status: response.status,
      duration,
      passed: response.status === endpoint.expectedStatus && duration < 1000
    });
  }

  return {
    category: 'api-health',
    passed: results.every(r => r.passed),
    results
  };
}
```

---

### Category 2: Database Connectivity

**Purpose**: Verify database is accessible and responding correctly

**Test Coverage**:
- Connection pool health (active connections, available connections)
- Read operations (SELECT queries on critical tables)
- Write operations (INSERT/UPDATE on test table)
- Transaction support (BEGIN/COMMIT/ROLLBACK)
- Index performance (queries using indexes)

**Pass Criteria**:
- Database connection established
- Read operation completes <100ms
- Write operation completes <100ms
- Connection pool has available connections
- No deadlocks or lock timeouts

**Execution Time**: ≤20 seconds

**Example Test**:
```javascript
// smoke-test-database/scripts/test-connectivity.js
async function testDatabaseConnectivity(config) {
  const db = await connectDatabase(config.connectionString);

  // Test connection pool
  const poolStats = await db.pool.stats();
  const poolHealthy = poolStats.available > 0 && poolStats.active < poolStats.max;

  // Test read operation
  const readStart = Date.now();
  const readResult = await db.query('SELECT 1');
  const readDuration = Date.now() - readStart;

  // Test write operation
  const writeStart = Date.now();
  await db.query('INSERT INTO smoke_test_table (test_data) VALUES (?)', ['test']);
  const writeDuration = Date.now() - writeStart;

  return {
    category: 'database',
    passed: poolHealthy && readDuration < 100 && writeDuration < 100,
    results: {
      poolHealth: poolHealthy,
      readLatency: readDuration,
      writeLatency: writeDuration
    }
  };
}
```

---

### Category 3: External Services

**Purpose**: Verify third-party integrations are accessible and responding

**Test Coverage**:
- Payment gateway (Stripe, PayPal) - health check API
- Email service (SendGrid, AWS SES) - test email send
- Cloud storage (AWS S3, GCS) - bucket list/upload
- Authentication provider (Auth0, Okta) - validate token
- Analytics (Google Analytics, Segment) - test event

**Pass Criteria**:
- All external services respond within 2s
- Authentication tokens valid
- No service outages detected
- Rate limits not exceeded

**Execution Time**: ≤30 seconds

**Example Test**:
```javascript
// smoke-test-external-services/scripts/test-integrations.js
async function testExternalServices(config) {
  const results = [];

  for (const service of config.services) {
    const start = Date.now();
    let status = 'unknown';

    try {
      switch (service.type) {
        case 'payment':
          status = await testPaymentGateway(service);
          break;
        case 'email':
          status = await testEmailService(service);
          break;
        case 'storage':
          status = await testCloudStorage(service);
          break;
      }
    } catch (error) {
      status = 'failed';
    }

    const duration = Date.now() - start;
    results.push({
      service: service.name,
      status,
      duration,
      passed: status === 'healthy' && duration < 2000
    });
  }

  return {
    category: 'external-services',
    passed: results.every(r => r.passed),
    results,
    recommendations: results
      .filter(r => !r.passed)
      .map(r => `Check ${r.service} connectivity, consider fallback`)
  };
}
```

---

### Category 4: Authentication

**Purpose**: Verify authentication and authorization flows work correctly

**Test Coverage**:
- Login flow (username/password)
- Logout flow (session termination)
- Token generation (JWT, OAuth)
- Token validation (expired, invalid, revoked)
- Protected endpoint access (with/without valid token)

**Pass Criteria**:
- Login succeeds with valid credentials
- Token generated and valid
- Protected endpoint accessible with valid token
- Protected endpoint blocks invalid token
- Logout terminates session

**Execution Time**: ≤20 seconds

**Example Test**:
```javascript
// smoke-test-auth/scripts/test-auth-flows.js
async function testAuthentication(config) {
  // Test login
  const loginResponse = await fetch(`${config.baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      username: config.testUser.username,
      password: config.testUser.password
    })
  });

  const token = await loginResponse.json().token;
  const loginPassed = loginResponse.status === 200 && token;

  // Test protected endpoint with valid token
  const protectedResponse = await fetch(`${config.baseUrl}/api/protected`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const accessPassed = protectedResponse.status === 200;

  // Test protected endpoint without token
  const unauthorizedResponse = await fetch(`${config.baseUrl}/api/protected`);
  const blockPassed = unauthorizedResponse.status === 401;

  // Test logout
  const logoutResponse = await fetch(`${config.baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const logoutPassed = logoutResponse.status === 200;

  return {
    category: 'authentication',
    passed: loginPassed && accessPassed && blockPassed && logoutPassed,
    results: {
      login: loginPassed,
      protectedAccess: accessPassed,
      unauthorizedBlock: blockPassed,
      logout: logoutPassed
    }
  };
}
```

---

### Category 5: Critical Paths

**Purpose**: Verify end-to-end critical user journeys work correctly

**Test Coverage**:
- User signup flow
- Checkout/payment flow
- Product search and filtering
- Content creation (posts, comments)
- Admin dashboard access

**Pass Criteria**:
- All critical paths complete successfully
- No errors or failures in journeys
- Response times acceptable (<5s per journey)

**Execution Time**: ≤80 seconds (3-5 journeys, 15s each)

**Example Test**:
```javascript
// smoke-test-critical-paths/scripts/execute-journeys.js
async function testCriticalPaths(config) {
  const results = [];

  for (const journey of config.criticalPaths) {
    const start = Date.now();
    let passed = false;

    try {
      switch (journey.name) {
        case 'checkout':
          passed = await testCheckoutFlow(journey.steps, config);
          break;
        case 'signup':
          passed = await testSignupFlow(journey.steps, config);
          break;
        case 'search':
          passed = await testSearchFlow(journey.steps, config);
          break;
      }
    } catch (error) {
      passed = false;
    }

    const duration = Date.now() - start;
    results.push({
      journey: journey.name,
      passed,
      duration
    });
  }

  return {
    category: 'critical-paths',
    passed: results.every(r => r.passed),
    results
  };
}
```

---

## Skills-Based Architecture

### Progressive Disclosure Pattern

Each smoke test category is implemented as a separate skill following the v3.1.0+ progressive disclosure pattern:

```
skills/smoke-test-[category]/
├── SKILL.md           # Quick reference (<5KB, <100ms load)
├── REFERENCE.md       # Comprehensive guide (~15KB)
├── scripts/
│   └── execute-*.js   # Test execution scripts
└── templates/
    └── *-config.yaml  # Configuration templates
```

### Category-Specific Skills

#### 1. smoke-test-api
- **SKILL.md**: <5KB, API endpoint structure, health check patterns
- **REFERENCE.md**: ~15KB, comprehensive API testing patterns
- **Scripts**: execute-health-checks.js
- **Templates**: health-check-config.yaml

#### 2. smoke-test-database
- **SKILL.md**: <5KB, database connectivity patterns, read/write operations
- **REFERENCE.md**: ~15KB, comprehensive database testing patterns
- **Scripts**: test-connectivity.js
- **Templates**: database-config.yaml

#### 3. smoke-test-external-services
- **SKILL.md**: <5KB, external service integration patterns
- **REFERENCE.md**: ~15KB, comprehensive integration testing patterns
- **Scripts**: test-integrations.js
- **Templates**: external-services-config.yaml

#### 4. smoke-test-auth
- **SKILL.md**: <5KB, authentication flow patterns
- **REFERENCE.md**: ~15KB, comprehensive auth testing patterns
- **Scripts**: test-auth-flows.js
- **Templates**: auth-config.yaml

#### 5. smoke-test-critical-paths
- **SKILL.md**: <5KB, critical journey patterns
- **REFERENCE.md**: ~15KB, comprehensive journey testing patterns
- **Scripts**: execute-journeys.js
- **Templates**: critical-paths-config.yaml

### Orchestration Skill

#### smoke-test-runner
- **Purpose**: Orchestrate execution of all 5 category skills
- **Location**: skills/smoke-test-runner/
- **Components**:
  - SKILL.md: Orchestration patterns (<5KB)
  - REFERENCE.md: Comprehensive orchestration guide (~15KB)
  - scripts/orchestrate-smoke-tests.js: Main orchestrator
  - templates/smoke-test-config.yaml: Master configuration

**Orchestration Logic**:
```javascript
// skills/smoke-test-runner/scripts/orchestrate-smoke-tests.js
async function runSmokeTests(environment, config) {
  const results = [];

  // Execute categories sequentially (early exit on failure)
  const categories = [
    'smoke-test-api',
    'smoke-test-database',
    'smoke-test-external-services',
    'smoke-test-auth',
    'smoke-test-critical-paths'
  ];

  for (const category of categories) {
    const start = Date.now();
    const result = await Skill(category, { environment, config });
    const duration = Date.now() - start;

    results.push({ category, ...result, duration });

    // Early exit on failure
    if (!result.passed) {
      return {
        passed: false,
        failedCategory: category,
        results,
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
      };
    }
  }

  return {
    passed: true,
    results,
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
  };
}
```

---

## Environment-Specific Configuration

### Configuration Structure

```yaml
# skills/smoke-test-runner/templates/smoke-test-config.yaml
environments:
  pre-release:
    baseUrl: https://localhost:3000
    database:
      host: localhost
      port: 5432
      database: app_test
    timeout: 5000
    criticalPathsOnly: false

  staging:
    baseUrl: https://staging.example.com
    database:
      host: staging-db.example.com
      port: 5432
      database: app_staging
    timeout: 5000
    criticalPathsOnly: false

  production:
    baseUrl: https://api.example.com
    database:
      host: prod-db.example.com
      port: 5432
      database: app_production
    timeout: 3000
    criticalPathsOnly: false

  canary:
    baseUrl: https://canary.example.com
    database:
      host: prod-db.example.com
      port: 5432
      database: app_production
    timeout: 2000
    criticalPathsOnly: true  # Reduced scope for canary

smokeTests:
  api:
    endpoints:
      - path: /health
        expectedStatus: 200
      - path: /api/auth/login
        expectedStatus: 200
      - path: /api/users
        expectedStatus: 200

  database:
    connectionString: ${DATABASE_URL}
    testTable: smoke_test_table

  externalServices:
    - name: stripe
      type: payment
      endpoint: https://api.stripe.com/v1/health
    - name: sendgrid
      type: email
      endpoint: https://api.sendgrid.com/v3/health

  auth:
    testUser:
      username: smoke-test-user@example.com
      password: ${SMOKE_TEST_PASSWORD}

  criticalPaths:
    - name: checkout
      steps:
        - action: addToCart
        - action: proceedToCheckout
        - action: enterPayment
        - action: placeOrder
    - name: signup
      steps:
        - action: navigateToSignup
        - action: enterDetails
        - action: submitForm
        - action: verifyEmail
```

---

## Execution Points

### 1. Pre-Release (Quality Gates Phase)
- **When**: After quality gates pass, before staging deployment
- **Environment**: pre-release
- **Scope**: Full suite (all 5 categories)
- **Purpose**: Validate release readiness

### 2. Post-Staging (Staging Phase)
- **When**: After staging deployment completes
- **Environment**: staging
- **Scope**: Full suite (all 5 categories)
- **Purpose**: Verify staging deployment success

### 3. Canary (Production Phase)
- **When**: At 5%, 25%, and 100% traffic stages
- **Environment**: canary
- **Scope**: Reduced (critical paths only, faster checks)
- **Purpose**: Progressive rollout verification

### 4. Post-Production (Production Phase)
- **When**: After 100% production deployment
- **Environment**: production
- **Scope**: Full suite (all 5 categories)
- **Purpose**: Final production verification

### 5. Post-Rollback (Rollback Phase)
- **When**: After traffic reversion during rollback
- **Environment**: production
- **Scope**: Full suite (all 5 categories)
- **Purpose**: Verify rollback success

---

## Timing Budget

| Category | Target | P95 | Timeout |
|----------|--------|-----|---------|
| API Health | 30s | 45s | 60s |
| Database | 20s | 30s | 60s |
| External Services | 30s | 45s | 60s |
| Authentication | 20s | 30s | 60s |
| Critical Paths | 80s | 100s | 120s |
| **Total** | **180s (3min)** | **250s** | **360s (6min)** |

**Canary Execution** (Reduced Scope):
- API Health: 15s
- Database: 10s
- External Services: 15s
- Authentication: 10s
- Critical Paths: 30s (reduced to 2 journeys)
- **Total**: 80s (~1.3min)

---

## Pass/Fail Criteria

### Category Pass Criteria
- **API Health**: All endpoints return expected status codes
- **Database**: Connection pool healthy, read/write <100ms
- **External Services**: All services respond <2s, no outages
- **Authentication**: Login/logout successful, token validation works
- **Critical Paths**: All journeys complete successfully

### Suite Pass Criteria
- All 5 categories pass
- Total execution time ≤3min (full), ≤1.3min (canary)
- No timeouts or exceptions
- All environment-specific checks pass

### Failure Handling
- **Category Failure**: Stop execution (early exit), return failed category
- **Timeout**: Mark as failed, return partial results
- **Exception**: Capture stack trace, mark as failed

---

## Skills Invocation

### From release-agent

```javascript
// Invoke smoke-test-runner skill with environment
const smokeTestResult = await Skill('smoke-test-runner', {
  environment: 'production',
  configPath: 'skills/smoke-test-runner/templates/smoke-test-config.yaml'
});

if (!smokeTestResult.passed) {
  console.error(`Smoke tests failed: ${smokeTestResult.failedCategory}`);
  triggerRollback();
}
```

### Individual Category Skills

```javascript
// Direct invocation of category skill (less common)
const apiHealthResult = await Skill('smoke-test-api', {
  environment: 'staging',
  config: apiHealthConfig
});
```

---

## Success Metrics

- **Execution Time**: ≤3min (full suite), ≤1.3min (canary)
- **Pass Rate**: ≥99% (minimal flakiness)
- **Coverage**: 100% of critical paths and integration points
- **Detection Rate**: ≥90% of deployment issues caught
- **False Positive Rate**: ≤1%

---

## Progressive Disclosure Implementation

### Quick Reference (SKILL.md)

```markdown
# smoke-test-api

Quick reference for API health smoke tests.

## Invocation
\`\`\`javascript
await Skill('smoke-test-api', { environment: 'production', config });
\`\`\`

## Pass Criteria
- All endpoints return 200 OK
- Response time <1s

## Configuration
\`\`\`yaml
endpoints:
  - path: /health
    expectedStatus: 200
\`\`\`

## Timing
Target: 30s | P95: 45s | Timeout: 60s
```

### Comprehensive Reference (REFERENCE.md)

```markdown
# smoke-test-api - Comprehensive Reference

## Overview
Detailed API health smoke testing patterns...

## Endpoint Categories
1. Health Check Endpoints
2. Authentication Endpoints
3. Core CRUD Endpoints
...

## Configuration Options
...

## Troubleshooting
...

## Examples
...
```

---

**Document Version**: 1.0.0
**Last Review**: 2025-11-05
**Next Review**: 2025-12-05 (Monthly)