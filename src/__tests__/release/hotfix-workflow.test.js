/**
 * Hotfix Workflow Tests
 *
 * Tests fast-track hotfix workflow including:
 * - Streamlined quality gates
 * - Canary smoke test progression (5% → 25% → 100%)
 * - Backport automation
 * - Approval bypass handling
 * - Post-deployment review scheduling
 *
 * @module hotfix-workflow.test
 */

const {
  HotfixWorkflow,
  HOTFIX_PHASES,
  HOTFIX_TIMING_TARGETS,
  HOTFIX_PRIORITY
} = require('../../release/hotfix-workflow');

describe('HotfixWorkflow', () => {
  describe('Constructor', () => {
    test('should initialize with default configuration', () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Critical security vulnerability'
      });

      expect(hotfix.config.version).toBe('2.0.1');
      expect(hotfix.config.hotfixReason).toBe('Critical security vulnerability');
      expect(hotfix.config.priority).toBe(HOTFIX_PRIORITY.HIGH);
      expect(hotfix.config.bypassApproval).toBe(false);
      expect(hotfix.config.developBranch).toBe('develop');
      expect(hotfix.config.productionBranch).toBe('main');
      expect(hotfix.hotfixSuccessful).toBe(false);
      expect(hotfix.approvalBypassed).toBe(false);
    });

    test('should accept custom configuration', () => {
      const hotfix = new HotfixWorkflow({
        version: '3.1.2',
        hotfixReason: 'Production outage',
        priority: HOTFIX_PRIORITY.CRITICAL,
        bypassApproval: true,
        developBranch: 'dev',
        productionBranch: 'production'
      });

      expect(hotfix.config.priority).toBe(HOTFIX_PRIORITY.CRITICAL);
      expect(hotfix.config.bypassApproval).toBe(true);
      expect(hotfix.config.developBranch).toBe('dev');
      expect(hotfix.config.productionBranch).toBe('production');
    });
  });

  describe('Complete Hotfix Workflow', () => {
    test('should execute complete hotfix workflow successfully', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Critical bug fix',
        priority: HOTFIX_PRIORITY.HIGH
      });

      const result = await hotfix.execute();

      expect(result.success).toBe(true);
      expect(result.version).toBe('2.0.1');
      expect(result.phases.length).toBe(7);

      // Verify all phases completed
      const phaseNames = result.phases.map(p => p.name);
      expect(phaseNames).toContain(HOTFIX_PHASES.INITIATED);
      expect(phaseNames).toContain(HOTFIX_PHASES.QUALITY_GATES);
      expect(phaseNames).toContain(HOTFIX_PHASES.PRODUCTION_DEPLOYMENT);
      expect(phaseNames).toContain(HOTFIX_PHASES.CANARY_5_PERCENT);
      expect(phaseNames).toContain(HOTFIX_PHASES.CANARY_25_PERCENT);
      expect(phaseNames).toContain(HOTFIX_PHASES.CANARY_100_PERCENT);
      expect(phaseNames).toContain(HOTFIX_PHASES.BACKPORT);

      // Verify timing
      expect(result.timing.totalDuration).toBeLessThan(HOTFIX_TIMING_TARGETS.total);
      expect(result.timing.meetsTarget).toBe(true);
    });

    test('should execute all phases in correct order', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test'
      });

      const result = await hotfix.execute();

      expect(result.phases[0].name).toBe(HOTFIX_PHASES.INITIATED);
      expect(result.phases[1].name).toBe(HOTFIX_PHASES.QUALITY_GATES);
      expect(result.phases[2].name).toBe(HOTFIX_PHASES.PRODUCTION_DEPLOYMENT);
      expect(result.phases[3].name).toBe(HOTFIX_PHASES.CANARY_5_PERCENT);
      expect(result.phases[4].name).toBe(HOTFIX_PHASES.CANARY_25_PERCENT);
      expect(result.phases[5].name).toBe(HOTFIX_PHASES.CANARY_100_PERCENT);
      expect(result.phases[6].name).toBe(HOTFIX_PHASES.BACKPORT);
    });
  });

  describe('Approval Bypass Workflow', () => {
    test('should execute with approval bypass for critical hotfix', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Production outage - data loss imminent',
        priority: HOTFIX_PRIORITY.CRITICAL,
        bypassApproval: true
      });

      const result = await hotfix.execute();

      expect(result.success).toBe(true);
      expect(result.approvalBypassed).toBe(true);
      expect(result.requiresPostDeploymentReview).toBe(true);

      // Verify post-deployment review phase exists
      const reviewPhase = result.phases.find(
        p => p.name === HOTFIX_PHASES.POST_DEPLOYMENT_REVIEW
      );
      expect(reviewPhase).toBeDefined();
      expect(reviewPhase.status).toBe('completed');
    });

    test('should track approval bypass in initiation phase', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Critical issue',
        bypassApproval: true
      });

      await hotfix.initiateHotfix();

      const initiatePhase = hotfix.phases.find(
        p => p.name === HOTFIX_PHASES.INITIATED
      );

      const bypassAction = initiatePhase.actions.find(
        a => a.action === 'bypass_approval'
      );

      expect(bypassAction).toBeDefined();
      expect(bypassAction.priority).toBeDefined();
      expect(bypassAction.postDeploymentReviewRequired).toBe(true);
    });
  });

  describe('Standard Approval Workflow', () => {
    test('should request approval when bypass is false', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Standard hotfix',
        bypassApproval: false
      });

      await hotfix.initiateHotfix();

      const initiatePhase = hotfix.phases.find(
        p => p.name === HOTFIX_PHASES.INITIATED
      );

      const approvalAction = initiatePhase.actions.find(
        a => a.action === 'request_approval'
      );

      expect(approvalAction).toBeDefined();
      expect(approvalAction.approvers).toContain('tech-lead');
      expect(approvalAction.approvers).toContain('product-manager');
    });

    test('should not require post-deployment review for standard approval', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Standard hotfix',
        bypassApproval: false
      });

      const result = await hotfix.execute();

      expect(result.approvalBypassed).toBe(false);
      expect(result.requiresPostDeploymentReview).toBe(false);

      // No post-deployment review phase
      expect(result.phases.length).toBe(7); // No review phase
    });
  });

  describe('Streamlined Quality Gates', () => {
    test('should execute streamlined quality gates', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test'
      });

      await hotfix.initiateHotfix();
      await hotfix.executeQualityGates();

      const qualityPhase = hotfix.phases.find(
        p => p.name === HOTFIX_PHASES.QUALITY_GATES
      );

      expect(qualityPhase.status).toBe('completed');
      expect(qualityPhase.duration).toBeLessThan(HOTFIX_TIMING_TARGETS.qualityGates);
      expect(qualityPhase.meetsTarget).toBe(true);

      // Verify streamlined checks
      const securityScan = qualityPhase.actions.find(a => a.action === 'security_scan');
      expect(securityScan.scope).toBe('critical_only');

      const unitTests = qualityPhase.actions.find(a => a.action === 'unit_tests');
      expect(unitTests.scope).toBe('affected_areas');

      const smokeTests = qualityPhase.actions.find(a => a.action === 'pre_release_smoke_tests');
      expect(smokeTests.categories).toHaveLength(3); // Only critical categories
    });
  });

  describe('Canary Smoke Test Progression', () => {
    test('should execute canary 5% smoke tests', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test'
      });

      await hotfix.initiateHotfix();
      await hotfix.executeQualityGates();
      await hotfix.deployToProduction();
      await hotfix.executeCanary5Percent();

      const canary5Phase = hotfix.phases.find(
        p => p.name === HOTFIX_PHASES.CANARY_5_PERCENT
      );

      expect(canary5Phase.status).toBe('completed');
      expect(canary5Phase.duration).toBeLessThan(HOTFIX_TIMING_TARGETS.canary5Percent);

      const trafficAction = canary5Phase.actions.find(a => a.action === 'route_traffic');
      expect(trafficAction.trafficPercentage).toBe(5);

      const smokeTestAction = canary5Phase.actions.find(a => a.action === 'smoke_tests');
      expect(smokeTestAction.trafficPercentage).toBe(5);
      expect(smokeTestAction.passed).toBe(true);
    });

    test('should execute canary 25% smoke tests', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test'
      });

      await hotfix.initiateHotfix();
      await hotfix.executeQualityGates();
      await hotfix.deployToProduction();
      await hotfix.executeCanary5Percent();
      await hotfix.executeCanary25Percent();

      const canary25Phase = hotfix.phases.find(
        p => p.name === HOTFIX_PHASES.CANARY_25_PERCENT
      );

      expect(canary25Phase.status).toBe('completed');
      expect(canary25Phase.duration).toBeLessThan(HOTFIX_TIMING_TARGETS.canary25Percent);

      const trafficAction = canary25Phase.actions.find(a => a.action === 'route_traffic');
      expect(trafficAction.trafficPercentage).toBe(25);

      const smokeTestAction = canary25Phase.actions.find(a => a.action === 'smoke_tests');
      expect(smokeTestAction.categories).toHaveLength(5); // All categories
    });

    test('should execute canary 100% smoke tests with health validation', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test'
      });

      const result = await hotfix.execute();

      const canary100Phase = result.phases.find(
        p => p.name === HOTFIX_PHASES.CANARY_100_PERCENT
      );

      expect(canary100Phase.status).toBe('completed');

      const trafficAction = hotfix.phases.find(p => p.name === HOTFIX_PHASES.CANARY_100_PERCENT)
        .actions.find(a => a.action === 'route_traffic');
      expect(trafficAction.trafficPercentage).toBe(100);

      const healthValidation = hotfix.phases.find(p => p.name === HOTFIX_PHASES.CANARY_100_PERCENT)
        .actions.find(a => a.action === 'health_validation');
      expect(healthValidation).toBeDefined();
      expect(healthValidation.passed).toBe(true);
    });
  });

  describe('Backport Automation', () => {
    test('should backport to develop branch', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test'
      });

      const result = await hotfix.execute();

      const backportPhase = result.phases.find(
        p => p.name === HOTFIX_PHASES.BACKPORT
      );

      expect(backportPhase.status).toBe('completed');
      expect(backportPhase.duration).toBeLessThan(HOTFIX_TIMING_TARGETS.backport);

      const backportAction = hotfix.phases.find(p => p.name === HOTFIX_PHASES.BACKPORT)
        .actions.find(a => a.action === 'create_backport_pr');

      expect(backportAction).toBeDefined();
      expect(backportAction.sourceBranch).toBe('hotfix/v2.0.1');
      expect(backportAction.targetBranch).toBe('develop');
      expect(backportAction.autoMerge).toBe(true);
    });

    test('should support custom develop branch', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test',
        developBranch: 'dev'
      });

      const result = await hotfix.execute();

      const backportAction = hotfix.phases.find(p => p.name === HOTFIX_PHASES.BACKPORT)
        .actions.find(a => a.action === 'create_backport_pr');

      expect(backportAction.targetBranch).toBe('dev');
    });
  });

  describe('Hotfix Timing', () => {
    test('should complete hotfix within 10min target', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Performance test'
      });

      const result = await hotfix.execute();

      expect(result.timing.totalDuration).toBeLessThan(HOTFIX_TIMING_TARGETS.total);
      expect(result.timing.meetsTarget).toBe(true);
    });

    test('should meet individual phase timing targets', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Timing test'
      });

      const result = await hotfix.execute();

      result.phases.forEach(phase => {
        if (phase.target) {
          expect(phase.duration).toBeLessThan(phase.target);
          expect(phase.meetsTarget).toBe(true);
        }
      });
    });

    test('should execute hotfix quickly in simulated mode', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Speed test'
      });

      const startTime = performance.now();
      await hotfix.execute();
      const duration = performance.now() - startTime;

      // Simulated hotfix should be very fast
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Hotfix Report', () => {
    test('should generate comprehensive hotfix report', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Critical security patch',
        priority: HOTFIX_PRIORITY.CRITICAL,
        bypassApproval: true
      });

      const result = await hotfix.execute();

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('hotfixReason');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('approvalBypassed');
      expect(result).toHaveProperty('requiresPostDeploymentReview');
      expect(result).toHaveProperty('timing');
      expect(result).toHaveProperty('phases');
      expect(result).toHaveProperty('summary');

      expect(result.version).toBe('2.0.1');
      expect(result.hotfixReason).toBe('Critical security patch');
      expect(result.priority).toBe(HOTFIX_PRIORITY.CRITICAL);
      expect(result.approvalBypassed).toBe(true);
      expect(result.requiresPostDeploymentReview).toBe(true);
    });

    test('should include phase summaries in report', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Test'
      });

      const result = await hotfix.execute();

      result.phases.forEach(phase => {
        expect(phase).toHaveProperty('name');
        expect(phase).toHaveProperty('status');
        expect(phase).toHaveProperty('duration');
        expect(phase).toHaveProperty('actions');
      });
    });
  });

  describe('Priority Levels', () => {
    test('should handle critical priority hotfix', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Production down',
        priority: HOTFIX_PRIORITY.CRITICAL,
        bypassApproval: true
      });

      const result = await hotfix.execute();

      expect(result.priority).toBe(HOTFIX_PRIORITY.CRITICAL);
      expect(result.approvalBypassed).toBe(true);
    });

    test('should handle high priority hotfix', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Critical bug',
        priority: HOTFIX_PRIORITY.HIGH
      });

      const result = await hotfix.execute();

      expect(result.priority).toBe(HOTFIX_PRIORITY.HIGH);
    });

    test('should handle medium priority hotfix', async () => {
      const hotfix = new HotfixWorkflow({
        version: '2.0.1',
        hotfixReason: 'Bug fix',
        priority: HOTFIX_PRIORITY.MEDIUM
      });

      const result = await hotfix.execute();

      expect(result.priority).toBe(HOTFIX_PRIORITY.MEDIUM);
    });
  });
});