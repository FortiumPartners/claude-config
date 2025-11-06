/**
 * Release Rollback Workflow Tests
 *
 * Tests the complete rollback workflow for production releases including:
 * - Traffic reversion (blue-green, canary, rolling)
 * - Smoke test verification
 * - Health validation
 * - Git revert creation
 * - Escalation handling
 *
 * @module release-rollback-workflow.test
 */

const {
  ReleaseRollbackWorkflow,
  ROLLBACK_STRATEGIES,
  ROLLBACK_PHASES,
  ROLLBACK_TIMING_TARGETS
} = require('../../rollback/release-rollback-workflow');

describe('ReleaseRollbackWorkflow', () => {
  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Smoke test failure'
      });

      expect(workflow.config.strategy).toBe(ROLLBACK_STRATEGIES.BLUE_GREEN);
      expect(workflow.config.environment).toBe('production');
      expect(workflow.config.version).toBe('2.1.0');
      expect(workflow.config.previousVersion).toBe('2.0.0');
      expect(workflow.rollbackSuccessful).toBe(false);
      expect(workflow.escalationRequired).toBe(false);
    });

    test('should accept custom configuration', () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '3.0.0',
        previousVersion: '2.5.0',
        strategy: ROLLBACK_STRATEGIES.CANARY,
        environment: 'staging',
        rollbackReason: 'Manual rollback request',
        signalData: { trafficPercentage: 25 }
      });

      expect(workflow.config.strategy).toBe(ROLLBACK_STRATEGIES.CANARY);
      expect(workflow.config.environment).toBe('staging');
      expect(workflow.config.signalData.trafficPercentage).toBe(25);
    });
  });

  describe('Blue-Green Rollback', () => {
    test('should execute complete blue-green rollback workflow', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: ROLLBACK_STRATEGIES.BLUE_GREEN,
        rollbackReason: 'Smoke test failure in API category'
      });

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(ROLLBACK_STRATEGIES.BLUE_GREEN);
      expect(result.phases.length).toBe(5);

      // Verify all phases completed
      const phaseNames = result.phases.map(p => p.name);
      expect(phaseNames).toContain(ROLLBACK_PHASES.INITIATED);
      expect(phaseNames).toContain(ROLLBACK_PHASES.TRAFFIC_REVERSION);
      expect(phaseNames).toContain(ROLLBACK_PHASES.SMOKE_TEST_VERIFICATION);
      expect(phaseNames).toContain(ROLLBACK_PHASES.HEALTH_VALIDATION);
      expect(phaseNames).toContain(ROLLBACK_PHASES.GIT_REVERT);

      // Verify timing
      expect(result.timing.totalDuration).toBeLessThan(ROLLBACK_TIMING_TARGETS.total);
      expect(result.timing.meetsTarget).toBe(true);
    });

    test('should execute blue-green traffic reversion correctly', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: ROLLBACK_STRATEGIES.BLUE_GREEN,
        rollbackReason: 'Test rollback'
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();

      const trafficPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION
      );

      expect(trafficPhase.status).toBe('completed');
      expect(trafficPhase.duration).toBeLessThan(ROLLBACK_TIMING_TARGETS.trafficReversion);
      expect(trafficPhase.meetsTarget).toBe(true);

      // Verify traffic switch action
      const trafficSwitch = trafficPhase.actions.find(
        a => a.action === 'switch_traffic_to_green'
      );
      expect(trafficSwitch).toBeDefined();
      expect(trafficSwitch.details.from).toBe('blue');
      expect(trafficSwitch.details.to).toBe('green');
      expect(trafficSwitch.details.trafficPercentage).toBe(100);
    });
  });

  describe('Canary Rollback', () => {
    test('should execute canary rollback at 5% traffic', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: ROLLBACK_STRATEGIES.CANARY,
        rollbackReason: 'Canary smoke test failure at 5%',
        signalData: { trafficPercentage: 5 }
      });

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(ROLLBACK_STRATEGIES.CANARY);

      const trafficPhase = result.phases.find(
        p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION
      );

      expect(trafficPhase.status).toBe('completed');

      // Find canary traffic reversion action
      const canaryRevert = workflow.phases
        .find(p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION)
        .actions.find(a => a.action === 'revert_canary_traffic');

      expect(canaryRevert.details.from).toBe(5);
      expect(canaryRevert.details.to).toBe(0);
    });

    test('should execute canary rollback at 25% traffic', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: ROLLBACK_STRATEGIES.CANARY,
        rollbackReason: 'Canary smoke test failure at 25%',
        signalData: { trafficPercentage: 25 }
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();

      const trafficPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION
      );

      const canaryRevert = trafficPhase.actions.find(
        a => a.action === 'revert_canary_traffic'
      );

      expect(canaryRevert.details.from).toBe(25);
      expect(canaryRevert.details.to).toBe(0);
    });
  });

  describe('Rolling Deployment Rollback', () => {
    test('should execute rolling deployment rollback at 50%', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: ROLLBACK_STRATEGIES.ROLLING,
        rollbackReason: 'Rolling deployment smoke test failure at 50%',
        signalData: { completionPercentage: 50 }
      });

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(ROLLBACK_STRATEGIES.ROLLING);

      const trafficPhase = result.phases.find(
        p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION
      );

      // Verify rollback batches
      const rollbackBatches = workflow.phases
        .find(p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION)
        .actions.find(a => a.action === 'rollback_batches');

      expect(rollbackBatches.details.completionPercentage).toBe(50);
      expect(rollbackBatches.details.batchesToRollback).toBe(2); // 2 batches (50% remaining)
    });

    test('should stop ongoing rolling deployment', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: ROLLBACK_STRATEGIES.ROLLING,
        rollbackReason: 'Test',
        signalData: { completionPercentage: 75 }
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();

      const trafficPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION
      );

      const stopDeployment = trafficPhase.actions.find(
        a => a.action === 'stop_rolling_deployment'
      );

      expect(stopDeployment).toBeDefined();
      expect(stopDeployment.status).toBe('stopped');
    });
  });

  describe('Smoke Test Verification', () => {
    test('should verify post-rollback smoke tests successfully', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();
      await workflow.verifyPostRollbackSmokeTests();

      const smokeTestPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.SMOKE_TEST_VERIFICATION
      );

      expect(smokeTestPhase.status).toBe('completed');
      expect(smokeTestPhase.duration).toBeLessThan(ROLLBACK_TIMING_TARGETS.smokeTestVerification);

      const smokeTestResult = smokeTestPhase.actions.find(
        a => a.action === 'smoke_test_results'
      );

      expect(smokeTestResult.result.passed).toBe(true);
      expect(smokeTestResult.result.categoriesPassed).toBe(5);
      expect(smokeTestResult.result.categoriesExecuted).toBe(5);
    });

    test('should execute smoke tests for all critical categories', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();
      await workflow.verifyPostRollbackSmokeTests();

      const smokeTestPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.SMOKE_TEST_VERIFICATION
      );

      const executionAction = smokeTestPhase.actions.find(
        a => a.action === 'execute_smoke_tests'
      );

      expect(executionAction.categories).toEqual([
        'api',
        'database',
        'externalServices',
        'auth',
        'criticalPaths'
      ]);
    });
  });

  describe('Health Validation', () => {
    test('should validate health successfully', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();
      await workflow.verifyPostRollbackSmokeTests();
      await workflow.validateHealth();

      const healthPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.HEALTH_VALIDATION
      );

      expect(healthPhase.status).toBe('completed');
      expect(healthPhase.duration).toBeLessThan(ROLLBACK_TIMING_TARGETS.healthValidation);

      const healthResult = healthPhase.actions.find(
        a => a.action === 'health_validation_result'
      );

      expect(healthResult.result).toBe('all_checks_passing');
    });

    test('should validate critical health metrics', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();
      await workflow.verifyPostRollbackSmokeTests();
      await workflow.validateHealth();

      const healthPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.HEALTH_VALIDATION
      );

      const metricsValidation = healthPhase.actions.find(
        a => a.action === 'validate_metrics'
      );

      expect(metricsValidation.metrics.errorRate).toBeLessThan(0.05);
      expect(metricsValidation.metrics.responseTimeP95).toBeLessThan(500);
      expect(metricsValidation.metrics.dbConnectivity).toBe(100);
      expect(metricsValidation.metrics.externalServiceHealth).toBeGreaterThanOrEqual(95);
    });
  });

  describe('Git Revert Creation', () => {
    test('should create git revert commit', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Smoke test failure'
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();
      await workflow.verifyPostRollbackSmokeTests();
      await workflow.validateHealth();
      await workflow.createGitRevert();

      const gitPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.GIT_REVERT
      );

      expect(gitPhase.status).toBe('completed');

      const revertAction = gitPhase.actions.find(
        a => a.action === 'create_git_revert'
      );

      expect(revertAction.details.revertedVersion).toBe('2.1.0');
      expect(revertAction.details.previousVersion).toBe('2.0.0');
      expect(revertAction.details.revertMessage).toContain('Revert "Release v2.1.0"');
      expect(revertAction.details.revertMessage).toContain('Smoke test failure');
    });

    test('should tag rollback commit', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      await workflow.initiateRollback();
      await workflow.revertTraffic();
      await workflow.verifyPostRollbackSmokeTests();
      await workflow.validateHealth();
      await workflow.createGitRevert();

      const gitPhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.GIT_REVERT
      );

      const tagAction = gitPhase.actions.find(
        a => a.action === 'tag_rollback_commit'
      );

      expect(tagAction.tag).toMatch(/^rollback-v2\.1\.0-\d+$/);
      expect(tagAction.message).toContain('Rollback from v2.1.0 to v2.0.0');
    });
  });

  describe('Rollback Timing', () => {
    test('should complete rollback within 10min target', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Performance test'
      });

      const result = await workflow.execute();

      expect(result.timing.totalDuration).toBeLessThan(ROLLBACK_TIMING_TARGETS.total);
      expect(result.timing.meetsTarget).toBe(true);
    });

    test('should meet individual phase timing targets', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Timing test'
      });

      const result = await workflow.execute();

      // Traffic reversion: <2min
      const trafficPhase = result.phases.find(p => p.name === ROLLBACK_PHASES.TRAFFIC_REVERSION);
      expect(trafficPhase.duration).toBeLessThan(ROLLBACK_TIMING_TARGETS.trafficReversion);

      // Smoke test verification: 3min
      const smokePhase = result.phases.find(p => p.name === ROLLBACK_PHASES.SMOKE_TEST_VERIFICATION);
      expect(smokePhase.duration).toBeLessThan(ROLLBACK_TIMING_TARGETS.smokeTestVerification);

      // Health validation: 5min
      const healthPhase = result.phases.find(p => p.name === ROLLBACK_PHASES.HEALTH_VALIDATION);
      expect(healthPhase.duration).toBeLessThan(ROLLBACK_TIMING_TARGETS.healthValidation);
    });
  });

  describe('Rollback Report', () => {
    test('should generate comprehensive rollback report', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: ROLLBACK_STRATEGIES.BLUE_GREEN,
        rollbackReason: 'Smoke test failure in database category'
      });

      const result = await workflow.execute();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('previousVersion');
      expect(result).toHaveProperty('rollbackReason');
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('timing');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('escalationRequired');
      expect(result).toHaveProperty('summary');

      expect(result.version).toBe('2.1.0');
      expect(result.previousVersion).toBe('2.0.0');
      expect(result.strategy).toBe(ROLLBACK_STRATEGIES.BLUE_GREEN);
      expect(result.rollbackReason).toBe('Smoke test failure in database category');
    });

    test('should include phase summaries in report', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Test'
      });

      const result = await workflow.execute();

      expect(result.phases.length).toBe(5);

      result.phases.forEach(phase => {
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('status');
        expect(phase).toHaveProperty('duration');
        expect(phase).toHaveProperty('actions');
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown rollback strategy', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: 'unknown_strategy',
        rollbackReason: 'Test'
      });

      await expect(workflow.execute()).rejects.toThrow('Unknown rollback strategy');
    });

    test('should track failed rollback in report', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        strategy: 'invalid',
        rollbackReason: 'Test'
      });

      try {
        await workflow.execute();
      } catch (error) {
        const report = workflow.buildRollbackReport();
        expect(report.success).toBe(false);
        expect(report.summary).toContain('Rollback failed');
      }
    });
  });

  describe('Stakeholder Notifications', () => {
    test('should notify stakeholders on rollback initiation', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Critical production issue'
      });

      await workflow.initiateRollback();

      const initiatePhase = workflow.phases.find(
        p => p.name === ROLLBACK_PHASES.INITIATED
      );

      const notification = initiatePhase.actions.find(
        a => a.action === 'notify_stakeholders'
      );

      expect(notification).toBeDefined();
      expect(notification.channels).toContain('slack');
      expect(notification.channels).toContain('pagerduty');
      expect(notification.channels).toContain('email');
      expect(notification.message).toContain('🚨 ROLLBACK INITIATED');
      expect(notification.message).toContain('v2.1.0');
    });
  });

  describe('Performance Benchmarks', () => {
    test('should execute rollback in <1 second (simulated)', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Performance benchmark'
      });

      const startTime = performance.now();
      await workflow.execute();
      const duration = performance.now() - startTime;

      // Simulated workflow should be very fast
      expect(duration).toBeLessThan(1000);
    });

    test('should measure phase execution times', async () => {
      const workflow = new ReleaseRollbackWorkflow({
        version: '2.1.0',
        previousVersion: '2.0.0',
        rollbackReason: 'Performance measurement'
      });

      const result = await workflow.execute();

      result.phases.forEach(phase => {
        expect(phase.duration).toBeDefined();
        expect(phase.duration).toBeGreaterThan(0);
      });
    });
  });
});