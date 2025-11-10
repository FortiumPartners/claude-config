/**
 * Rollback Smoke Test Verification Tests
 *
 * Tests post-rollback smoke test verification including:
 * - API health verification
 * - Database verification
 * - External services verification
 * - Auth verification
 * - Critical paths verification
 * - Escalation handling
 *
 * @module rollback-smoke-test-verification.test
 */

const {
  RollbackSmokeTestVerification,
  VERIFICATION_PHASES,
  VERIFICATION_TIMING_TARGETS,
  CRITICAL_CATEGORIES
} = require('../../rollback/rollback-smoke-test-verification');

describe('RollbackSmokeTestVerification', () => {
  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Smoke test failure'
      });

      expect(verification.config.environment).toBe('production-post-rollback');
      expect(verification.config.version).toBe('2.1.0');
      expect(verification.config.previousVersion).toBe('2.0.0');
      expect(verification.config.categories).toEqual(CRITICAL_CATEGORIES);
      expect(verification.config.stopOnFirstFailure).toBe(true);
      expect(verification.verificationPassed).toBe(false);
      expect(verification.escalationRequired).toBe(false);
    });

    test('should accept custom configuration', () => {
      const verification = new RollbackSmokeTestVerification({
        version: '3.0.0',
        previousVersion: '2.5.0',
        environment: 'staging-post-rollback',
        rollbackReason: 'Manual rollback',
        categories: ['api', 'database'],
        stopOnFirstFailure: false
      });

      expect(verification.config.environment).toBe('staging-post-rollback');
      expect(verification.config.categories).toEqual(['api', 'database']);
      expect(verification.config.stopOnFirstFailure).toBe(false);
    });
  });

  describe('Complete Verification', () => {
    test('should execute complete verification successfully', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Smoke test failure in API category'
      });

      const result = await verification.verify();

      expect(result.passed).toBe(true);
      expect(result.categoriesPassed).toBe(5);
      expect(result.categoriesExecuted).toBe(5);
      expect(result.escalationRequired).toBe(false);

      // Verify all categories executed
      expect(result.results).toHaveProperty('api');
      expect(result.results).toHaveProperty('database');
      expect(result.results).toHaveProperty('externalServices');
      expect(result.results).toHaveProperty('auth');
      expect(result.results).toHaveProperty('criticalPaths');

      // Verify timing
      expect(result.timing.totalDuration).toBeLessThan(VERIFICATION_TIMING_TARGETS.total);
      expect(result.timing.meetsTarget).toBe(true);
    });

    test('should execute all verification phases in order', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      const result = await verification.verify();

      const phases = Object.values(result.results).map(r => r.phase);

      expect(phases).toContain(VERIFICATION_PHASES.API_HEALTH);
      expect(phases).toContain(VERIFICATION_PHASES.DATABASE);
      expect(phases).toContain(VERIFICATION_PHASES.EXTERNAL_SERVICES);
      expect(phases).toContain(VERIFICATION_PHASES.AUTH);
      expect(phases).toContain(VERIFICATION_PHASES.CRITICAL_PATHS);
    });
  });

  describe('API Health Verification', () => {
    test('should verify API health successfully', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();

      const apiResult = verification.verificationResults.api;

      expect(apiResult.passed).toBe(true);
      expect(apiResult.status).toBe('completed');
      expect(apiResult.totalTests).toBe(3);
      expect(apiResult.passedTests).toBe(3);
      expect(apiResult.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.apiHealth);
      expect(apiResult.meetsTarget).toBe(true);
    });

    test('should verify API endpoints', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();

      const apiResult = verification.verificationResults.api;

      expect(apiResult.tests.length).toBe(3);

      const endpoints = apiResult.tests.map(t => t.endpoint);
      expect(endpoints).toContain('/health');
      expect(endpoints).toContain('/api/v1/status');
      expect(endpoints).toContain('/api/v1/version');

      apiResult.tests.forEach(test => {
        expect(test.status).toBe(200);
        expect(test.responseTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Database Verification', () => {
    test('should verify database successfully', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();
      await verification.verifyDatabase();

      const dbResult = verification.verificationResults.database;

      expect(dbResult.passed).toBe(true);
      expect(dbResult.status).toBe('completed');
      expect(dbResult.totalTests).toBe(4);
      expect(dbResult.passedTests).toBe(4);
      expect(dbResult.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.database);
    });

    test('should verify database connectivity and operations', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();
      await verification.verifyDatabase();

      const dbResult = verification.verificationResults.database;

      const testTypes = dbResult.tests.map(t => t.test);
      expect(testTypes).toContain('connection');
      expect(testTypes).toContain('read_query');
      expect(testTypes).toContain('write_query');
      expect(testTypes).toContain('transaction');
    });
  });

  describe('External Services Verification', () => {
    test('should verify external services successfully', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();
      await verification.verifyDatabase();
      await verification.verifyExternalServices();

      const externalResult = verification.verificationResults.externalServices;

      expect(externalResult.passed).toBe(true);
      expect(externalResult.status).toBe('completed');
      expect(externalResult.totalTests).toBe(4);
      expect(externalResult.passedTests).toBe(4);
      expect(externalResult.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.externalServices);
    });

    test('should verify critical external services', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();
      await verification.verifyDatabase();
      await verification.verifyExternalServices();

      const externalResult = verification.verificationResults.externalServices;

      const services = externalResult.tests.map(t => t.service);
      expect(services).toContain('payment_gateway');
      expect(services).toContain('email_service');
      expect(services).toContain('cdn');
      expect(services).toContain('analytics');

      externalResult.tests.forEach(test => {
        expect(test.status).toBe('healthy');
      });
    });
  });

  describe('Auth Verification', () => {
    test('should verify auth successfully', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();
      await verification.verifyDatabase();
      await verification.verifyExternalServices();
      await verification.verifyAuth();

      const authResult = verification.verificationResults.auth;

      expect(authResult.passed).toBe(true);
      expect(authResult.status).toBe('completed');
      expect(authResult.totalTests).toBe(4);
      expect(authResult.passedTests).toBe(4);
      expect(authResult.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.auth);
    });

    test('should verify auth flows', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await verification.verifyAPIHealth();
      await verification.verifyDatabase();
      await verification.verifyExternalServices();
      await verification.verifyAuth();

      const authResult = verification.verificationResults.auth;

      const flows = authResult.tests.map(t => t.flow);
      expect(flows).toContain('login');
      expect(flows).toContain('logout');
      expect(flows).toContain('token_refresh');
      expect(flows).toContain('password_reset');
    });
  });

  describe('Critical Paths Verification', () => {
    test('should verify critical paths successfully', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      const result = await verification.verify();

      const criticalResult = result.results.criticalPaths;

      expect(criticalResult.passed).toBe(true);
      expect(criticalResult.status).toBe('completed');
      expect(criticalResult.totalTests).toBe(3);
      expect(criticalResult.passedTests).toBe(3);
      expect(criticalResult.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.criticalPaths);
    });

    test('should verify critical user journeys', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      const result = await verification.verify();

      const criticalResult = result.results.criticalPaths;

      const journeys = criticalResult.tests.map(t => t.journey);
      expect(journeys).toContain('user_registration');
      expect(journeys).toContain('product_purchase');
      expect(journeys).toContain('checkout_flow');
    });
  });

  describe('Verification Timing', () => {
    test('should complete verification within 15min target', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Performance test'
      });

      const result = await verification.verify();

      expect(result.timing.totalDuration).toBeLessThan(VERIFICATION_TIMING_TARGETS.total);
      expect(result.timing.meetsTarget).toBe(true);
    });

    test('should meet individual phase timing targets', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Timing test'
      });

      const result = await verification.verify();

      // API Health: <3min
      expect(result.results.api.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.apiHealth);

      // Database: <2min
      expect(result.results.database.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.database);

      // External Services: <3min
      expect(result.results.externalServices.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.externalServices);

      // Auth: <2min
      expect(result.results.auth.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.auth);

      // Critical Paths: <5min
      expect(result.results.criticalPaths.duration).toBeLessThan(VERIFICATION_TIMING_TARGETS.criticalPaths);
    });

    test('should execute verification quickly in simulated mode', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Speed test'
      });

      const startTime = performance.now();
      await verification.verify();
      const duration = performance.now() - startTime;

      // Simulated verification should be very fast
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Verification Report', () => {
    test('should generate comprehensive verification report', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Smoke test failure in database category'
      });

      const result = await verification.verify();

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('previousVersion');
      expect(result).toHaveProperty('rollbackReason');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('timing');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('categoriesPassed');
      expect(result).toHaveProperty('categoriesExecuted');
      expect(result).toHaveProperty('escalationRequired');
      expect(result).toHaveProperty('summary');

      expect(result.version).toBe('2.1.0');
      expect(result.previousVersion).toBe('2.0.0');
      expect(result.rollbackReason).toBe('Smoke test failure in database category');
    });

    test('should include detailed category results in report', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      const result = await verification.verify();

      expect(result.results.api).toHaveProperty('passed');
      expect(result.results.api).toHaveProperty('status');
      expect(result.results.api).toHaveProperty('duration');
      expect(result.results.api).toHaveProperty('totalTests');
      expect(result.results.api).toHaveProperty('passedTests');

      expect(result.categoriesPassed).toBe(5);
      expect(result.categoriesExecuted).toBe(5);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should measure phase execution times', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Performance measurement'
      });

      const result = await verification.verify();

      Object.values(result.results).forEach(categoryResult => {
        expect(categoryResult.duration).toBeDefined();
        expect(categoryResult.duration).toBeGreaterThan(0);
        expect(categoryResult.meetsTarget).toBe(true);
      });
    });

    test('should track total verification time', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Time tracking'
      });

      const result = await verification.verify();

      expect(result.timing.startTime).toBeDefined();
      expect(result.timing.endTime).toBeDefined();
      expect(result.timing.totalDuration).toBeGreaterThan(0);
      expect(result.timing.totalDuration).toBeLessThan(VERIFICATION_TIMING_TARGETS.total);
    });
  });

  describe('Critical Categories', () => {
    test('should verify all critical categories', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      const result = await verification.verify();

      CRITICAL_CATEGORIES.forEach(category => {
        expect(result.results[category]).toBeDefined();
        expect(result.results[category].passed).toBe(true);
      });
    });

    test('should execute categories in correct order', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Order test'
      });

      const result = await verification.verify();

      const categoryOrder = Object.keys(result.results);

      expect(categoryOrder[0]).toBe('api');
      expect(categoryOrder[1]).toBe('database');
      expect(categoryOrder[2]).toBe('externalServices');
      expect(categoryOrder[3]).toBe('auth');
      expect(categoryOrder[4]).toBe('criticalPaths');
    });
  });

  describe('Success Scenarios', () => {
    test('should report success when all verifications pass', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Success test'
      });

      const result = await verification.verify();

      expect(result.passed).toBe(true);
      expect(result.escalationRequired).toBe(false);
      expect(result.summary).toContain('✅ Post-rollback verification passed');
    });

    test('should not have failed category on success', async () => {
      const verification = new RollbackSmokeTestVerification({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Success test'
      });

      const result = await verification.verify();

      expect(result.failedCategory).toBeNull();
    });
  });
});