/**
 * End-to-End Integration Test: Fix Strategy & Task Breakdown Workflow
 *
 * Tests complete Sprint 4 workflow:
 * 1. Specialist agent selection based on framework and complexity
 * 2. TDD phase tracking through RED → GREEN → REFACTOR → COMPLETE
 * 3. Fix task preparation with comprehensive context
 * 4. TRD generation for complex bugs
 * 5. Multi-hypothesis validation and selection
 */

const SpecialistSelector = require('../../strategy/specialist-selector');
const TDDPhaseTracker = require('../../strategy/tdd-phase-tracker');
const FixTaskPreparer = require('../../strategy/fix-task-preparer');
const TRDGenerator = require('../../strategy/trd-generator');
const MultiHypothesisValidator = require('../../strategy/multi-hypothesis-validator');

describe('Fix Strategy & Task Breakdown - End-to-End Integration', () => {
  describe('Complete Fix Strategy Workflow', () => {
    it('should execute full workflow from analysis to task preparation', () => {
      console.log('\n[E2E Test] Starting complete fix strategy workflow...\n');

      // Simulated Sprint 3 output (root cause analysis)
      const rootCauseAnalysis = {
        confidence: 0.85,
        rootCause: {
          description: 'Null pointer exception in token validator due to missing null check',
          likelyFile: 'lib/auth/token-validator.js',
          likelyFunction: 'validateToken'
        },
        fixRecommendations: [
          {
            description: 'Add null check before accessing token.id property',
            priority: 1,
            estimatedTime: 2,
            complexity: 'simple',
            framework: 'jest',
            affectedFiles: ['lib/auth/token-validator.js']
          }
        ],
        impactAssessment: {
          scope: 'component',
          affectedFeatures: ['Authentication', 'Token Validation'],
          userImpact: 'high',
          regressionRisk: 'medium',
          requiresTRD: false
        }
      };

      const bugReport = {
        title: 'Authentication fails with null token',
        description: 'Users cannot log in when token is null',
        severity: 'high',
        issueId: 'BUG-123',
        stepsToReproduce: [
          'Navigate to login page',
          'Enter credentials with null token',
          'Click login button'
        ],
        expectedBehavior: 'Users should be able to log in',
        actualBehavior: 'Login fails with null pointer exception'
      };

      const testCode = `
test('should handle null token gracefully', () => {
  const validator = new TokenValidator();
  expect(() => validator.validateToken(null)).toThrow('Invalid token');
});
      `;

      // STEP 1: Specialist Agent Selection
      console.log('[E2E Test] Step 1: Selecting specialist agent...');

      const selector = new SpecialistSelector();
      const recommendation = rootCauseAnalysis.fixRecommendations[0];

      const selection = selector.selectSpecialist(recommendation);

      console.log('[E2E Test] ✓ Specialist selected:', selection.primaryAgent);

      // Simple complexity routes to backend-developer regardless of framework
      expect(selection.primaryAgent).toBe('backend-developer');
      expect(selection.requiresOrchestration).toBe(false);
      expect(selection.reason).toContain('Simple fix');

      // Validate specialist capabilities
      const validation = selector.validateCapabilities(
        selection.primaryAgent,
        recommendation
      );

      expect(validation.capable).toBe(true);
      expect(validation.missingCapabilities).toEqual([]);

      console.log('[E2E Test] ✓ Specialist capabilities validated\n');

      // STEP 2: TDD Phase Tracking Initialization
      console.log('[E2E Test] Step 2: Initializing TDD phase tracking...');

      const tracker = new TDDPhaseTracker();
      const tddState = tracker.initializeTracking('session-123', 'BUG-123');

      console.log('[E2E Test] ✓ TDD tracking initialized at RED phase');

      expect(tddState.currentPhase).toBe('red');
      expect(tddState.phaseHistory).toHaveLength(1);

      // Generate TodoWrite checkboxes
      const todoCheckboxes = tracker.generateTodoCheckboxes(tddState);

      expect(todoCheckboxes).toHaveLength(4);
      expect(todoCheckboxes[0].status).toBe('in_progress'); // RED
      expect(todoCheckboxes[1].status).toBe('pending');     // GREEN

      console.log('[E2E Test] ✓ TodoWrite checkboxes generated\n');

      // STEP 3: Fix Task Preparation
      console.log('[E2E Test] Step 3: Preparing fix task for delegation...');

      const preparer = new FixTaskPreparer();

      const fixContext = {
        bugReport,
        testCode,
        testFile: 'test/auth/token-validator.test.js',
        rootCause: rootCauseAnalysis.rootCause,
        fixRecommendation: recommendation,
        specialistAgent: selection.primaryAgent,
        tddState
      };

      const fixTask = preparer.prepareFixTask(fixContext);

      console.log('[E2E Test] ✓ Fix task prepared for', fixTask.agent);

      expect(fixTask.agent).toBe('backend-developer');
      expect(fixTask.task.type).toBe('fix-implementation');
      expect(fixTask.task.tddPhase).toBe('red');
      expect(fixTask.task.description).toContain('Authentication fails');
      expect(fixTask.task.codeContext.failingTest.code).toBe(testCode);
      expect(fixTask.task.fixStrategy.description).toContain('null check');
      expect(fixTask.task.constraints.maintainCoverage).toBe(true);
      expect(fixTask.task.successCriteria.testsPassing.required).toBe(true);

      console.log('[E2E Test] ✓ Task includes comprehensive context and constraints\n');

      // STEP 4: TDD Phase Progression
      console.log('[E2E Test] Step 4: Simulating TDD phase progression...');

      // Transition to GREEN (fix implementation)
      const greenState = tracker.transitionPhase(tddState, 'green', {
        reason: 'Test now passing after null check added'
      });

      expect(greenState.currentPhase).toBe('green');
      expect(greenState.phaseHistory).toHaveLength(2);

      console.log('[E2E Test] ✓ Transitioned to GREEN phase');

      // Transition to REFACTOR
      const refactorState = tracker.transitionPhase(greenState, 'refactor', {
        reason: 'Improving code quality'
      });

      expect(refactorState.currentPhase).toBe('refactor');

      console.log('[E2E Test] ✓ Transitioned to REFACTOR phase');

      // Complete the TDD cycle
      const completeState = tracker.transitionPhase(refactorState, 'complete', {
        reason: 'All tests passing, code quality improved'
      });

      expect(completeState.currentPhase).toBe('complete');
      expect(completeState.completedAt).not.toBeNull();

      console.log('[E2E Test] ✓ TDD cycle COMPLETE\n');

      // Validate phase history
      const history = tracker.getPhaseHistory(completeState);

      expect(history.phaseSequence).toEqual(['red', 'green', 'refactor', 'complete']);
      expect(history.totalDuration).toBeGreaterThan(0);

      console.log('[E2E Test] ✓ Phase history validated:', history.phaseSequence.join(' → '));
      console.log(`[E2E Test]   Total duration: ${history.totalDuration}ms\n`);

      // STEP 5: TRD Requirement Check
      console.log('[E2E Test] Step 5: Checking TRD generation requirement...');

      const generator = new TRDGenerator();
      const trdRequirement = generator.shouldGenerateTRD(rootCauseAnalysis);

      console.log('[E2E Test] ✓ TRD requirement checked');
      console.log(`[E2E Test]   Required: ${trdRequirement.required}`);
      console.log(`[E2E Test]   Reason: ${trdRequirement.reason}`);
      console.log(`[E2E Test]   Total time: ${trdRequirement.totalEstimatedTime}h\n`);

      expect(trdRequirement.required).toBe(false); // Simple fix, <4h
      expect(trdRequirement.totalEstimatedTime).toBe(2);

      // Validate complete workflow output
      console.log('[E2E Test] Validating complete workflow output...\n');

      expect(selection.primaryAgent).toBe('backend-developer');
      expect(tddState.currentPhase).toBe('red');
      expect(fixTask.task.type).toBe('fix-implementation');
      expect(completeState.currentPhase).toBe('complete');
      expect(trdRequirement.required).toBe(false);

      console.log('✅ End-to-end fix strategy workflow complete!\n');
      console.log('   - Specialist: backend-developer');
      console.log('   - TDD Cycle: RED → GREEN → REFACTOR → COMPLETE');
      console.log('   - Fix Task: Prepared with comprehensive context');
      console.log('   - TRD: Not required (simple fix, 2h)');
      console.log();
    });

    it('should handle complex bugs requiring TRD generation', () => {
      console.log('\n[E2E Test] Testing complex bug TRD generation...\n');

      // Complex bug scenario
      const complexAnalysis = {
        confidence: 0.80,
        rootCause: {
          description: 'Race condition in payment processing causing duplicate charges',
          likelyFile: 'lib/payment/processor.js',
          likelyFunction: 'processPayment'
        },
        fixRecommendations: [
          {
            description: 'Implement distributed lock mechanism',
            priority: 1,
            estimatedTime: 6,
            complexity: 'complex',
            framework: 'jest',
            affectedFiles: [
              'lib/payment/processor.js',
              'lib/payment/lock-manager.js',
              'lib/database/transaction.js'
            ]
          },
          {
            description: 'Add idempotency key validation',
            priority: 2,
            estimatedTime: 4,
            complexity: 'medium',
            framework: 'jest',
            affectedFiles: ['lib/payment/validator.js']
          }
        ],
        impactAssessment: {
          scope: 'system',
          affectedFeatures: ['Payment Processing', 'Order Management', 'Billing'],
          userImpact: 'critical',
          regressionRisk: 'high',
          requiresTRD: true
        }
      };

      const bugReport = {
        title: 'Duplicate payment charges due to race condition',
        description: 'Users are being charged multiple times for single purchase',
        severity: 'critical',
        issueId: 'BUG-456'
      };

      // Step 1: Check TRD requirement
      console.log('[E2E Test] Step 1: Checking TRD requirement for complex bug...');

      const generator = new TRDGenerator();
      const trdRequirement = generator.shouldGenerateTRD(complexAnalysis);

      console.log('[E2E Test] ✓ TRD requirement determined');
      console.log(`[E2E Test]   Required: ${trdRequirement.required}`);
      console.log(`[E2E Test]   Total time: ${trdRequirement.totalEstimatedTime}h\n`);

      expect(trdRequirement.required).toBe(true);
      expect(trdRequirement.totalEstimatedTime).toBe(10); // 6h + 4h
      expect(trdRequirement.reason).toContain('exceeds threshold');

      // Step 2: Generate TRD
      console.log('[E2E Test] Step 2: Generating TRD document...');

      const trdContext = {
        bugReport,
        rootCause: complexAnalysis.rootCause,
        fixRecommendations: complexAnalysis.fixRecommendations,
        impactAssessment: complexAnalysis.impactAssessment,
        sessionId: 'session-456'
      };

      const trd = generator.generateTRD(trdContext);

      console.log('[E2E Test] ✓ TRD generated successfully');
      console.log(`[E2E Test]   File: ${trd.filePath}`);
      console.log(`[E2E Test]   Bug ID: ${trd.bugId}\n`);

      expect(trd.bugId).toBe('BUG-456');
      expect(trd.filePath).toContain('debug-bug-456-trd.md');
      expect(trd.content).toContain('Duplicate payment charges');
      expect(trd.content).toContain('Race condition');
      expect(trd.content).toContain('distributed lock');
      // TRD generated because total time (10h) exceeds threshold (4h)
      expect(trd.content).toContain('10 hours');

      // Verify TRD structure
      expect(trd.content).toContain('Executive Summary');
      expect(trd.content).toContain('System Context & Constraints');
      expect(trd.content).toContain('Bug Analysis');
      expect(trd.content).toContain('Fix Implementation Plan');
      expect(trd.content).toContain('Test Strategy');
      expect(trd.content).toContain('Risk Assessment');
      expect(trd.content).toContain('Definition of Done');

      // Verify checkboxes for task tracking
      expect(trd.content).toMatch(/- \[ \] \*\*Task 1\*\*/);
      expect(trd.content).toMatch(/- \[ \] \*\*Task 2\*\*/);

      console.log('[E2E Test] ✓ TRD contains all required sections');
      console.log('[E2E Test] ✓ TRD includes checkbox-tracked tasks\n');

      console.log('✅ Complex bug TRD generation complete!\n');
      console.log(`   - Total estimated time: ${trdRequirement.totalEstimatedTime}h`);
      console.log('   - Regression risk: high');
      console.log('   - TRD generated with comprehensive planning');
      console.log();
    });

    it('should handle multi-component fixes with orchestration', () => {
      console.log('\n[E2E Test] Testing multi-component fix workflow...\n');

      // Multi-component bug scenario requiring multiple specialists
      // Note: frontend component with backend framework creates distinct specialists
      const multiComponentRecommendation = {
        description: 'Fix authentication flow across frontend and backend',
        priority: 1,
        estimatedTime: 8,
        complexity: 'complex',
        framework: 'jest', // Backend framework, will require react-component-architect for frontend
        affectedComponents: ['frontend', 'backend']
      };

      // Step 1: Specialist selection for multi-component fix
      console.log('[E2E Test] Step 1: Selecting specialists for multi-component fix...');

      const selector = new SpecialistSelector();
      const selection = selector.selectSpecialist(multiComponentRecommendation);

      console.log('[E2E Test] ✓ Multiple specialists selected');
      console.log(`[E2E Test]   Primary: ${selection.primaryAgent}`);
      console.log(`[E2E Test]   Additional: ${selection.additionalAgents.join(', ')}`);
      console.log(`[E2E Test]   Requires orchestration: ${selection.requiresOrchestration}\n`);

      expect(selection.requiresOrchestration).toBe(true);
      expect(selection.additionalAgents.length).toBeGreaterThan(0);

      // Step 2: Prepare multiple fix tasks
      console.log('[E2E Test] Step 2: Preparing tasks for each component...');

      const preparer = new FixTaskPreparer();

      const multiTaskContext = {
        bugReport: {
          title: 'Auth flow broken',
          description: 'Frontend and backend auth mismatch',
          severity: 'high'
        },
        testCode: 'test code',
        testFile: 'test.js',
        rootCause: { description: 'Auth token format mismatch' },
        fixRecommendations: [
          {
            description: 'Update frontend token handling',
            priority: 1,
            affectedFiles: ['frontend/auth.ts']
          },
          {
            description: 'Update backend token validation',
            priority: 2,
            affectedFiles: ['backend/auth.js']
          }
        ],
        specialistAgents: [selection.primaryAgent, ...selection.additionalAgents]
      };

      const tasks = preparer.prepareMultiComponentFixTask(multiTaskContext);

      console.log(`[E2E Test] ✓ ${tasks.length} tasks prepared`);

      expect(tasks.length).toBeGreaterThan(1);
      expect(tasks[1].task.constraints.dependsOn).toBeDefined();
      expect(tasks[1].task.constraints.waitForCompletion).toBe(true);

      console.log('[E2E Test] ✓ Task dependencies configured for sequential execution\n');

      console.log('✅ Multi-component fix workflow complete!\n');
      console.log(`   - Components: ${multiComponentRecommendation.affectedComponents.join(', ')}`);
      console.log(`   - Tasks prepared: ${tasks.length}`);
      console.log('   - Orchestration: Required');
      console.log();
    });
  });

  describe('Multi-Hypothesis Validation Workflow', () => {
    it('should validate and select best hypothesis from multiple candidates', async () => {
      console.log('\n[E2E Test] Testing multi-hypothesis validation...\n');

      // Mock delegator for hypothesis testing
      const mockDelegator = {
        analyzeRootCause: jest.fn()
      };

      // Configure mock responses with different confidence scores
      mockDelegator.analyzeRootCause
        .mockResolvedValueOnce({
          confidence: 0.75,
          rootCause: { description: 'Null pointer exception' },
          fixRecommendations: [{ description: 'Add null check', estimatedTime: 2 }]
        })
        .mockResolvedValueOnce({
          confidence: 0.90,
          rootCause: { description: 'Race condition in async code' },
          fixRecommendations: [{ description: 'Add synchronization', estimatedTime: 6 }]
        })
        .mockResolvedValueOnce({
          confidence: 0.65,
          rootCause: { description: 'Configuration error' },
          fixRecommendations: [{ description: 'Fix config', estimatedTime: 1 }]
        });

      const validator = new MultiHypothesisValidator(mockDelegator);

      const hypotheses = [
        {
          bugReport: { title: 'Bug' },
          testCode: 'test 1',
          stackTrace: { raw: 'stack 1' },
          hypothesis: 'Null pointer exception',
          complexity: 4
        },
        {
          bugReport: { title: 'Bug' },
          testCode: 'test 2',
          stackTrace: { raw: 'stack 2' },
          hypothesis: 'Race condition',
          complexity: 6
        },
        {
          bugReport: { title: 'Bug' },
          testCode: 'test 3',
          stackTrace: { raw: 'stack 3' },
          hypothesis: 'Configuration error',
          complexity: 2
        }
      ];

      console.log('[E2E Test] Step 1: Validating 3 hypotheses in parallel...');

      const result = await validator.validateHypotheses(hypotheses);

      console.log('[E2E Test] ✓ Hypotheses validated\n');
      console.log('[E2E Test] Results:');
      console.log(`[E2E Test]   Selected: ${result.selectedHypothesis.hypothesis}`);
      console.log(`[E2E Test]   Confidence: ${result.selectedHypothesis.confidence}`);
      console.log(`[E2E Test]   Alternatives: ${result.alternatives.length}`);
      console.log(`[E2E Test]   Is tied: ${result.isTied}`);
      console.log(`[E2E Test]   Requires escalation: ${result.requiresEscalation}\n`);

      expect(result.selectedHypothesis.confidence).toBe(0.90);
      expect(result.selectedHypothesis.hypothesis).toBe('Race condition');
      expect(result.alternatives).toHaveLength(2);
      expect(result.isTied).toBe(false);
      expect(result.requiresEscalation).toBe(false);

      // Document alternatives
      const documentation = validator.documentAlternatives(result.alternatives);

      console.log('[E2E Test] Alternative hypotheses documented:');
      console.log(documentation.summary);
      console.log();

      expect(documentation.hypotheses).toHaveLength(2);
      expect(documentation.summary).toContain('2 alternative hypotheses');

      console.log('✅ Multi-hypothesis validation complete!\n');
      console.log('   - Best hypothesis: Race condition (0.90 confidence)');
      console.log('   - Alternatives documented for future reference');
      console.log();
    });

    it('should detect ties and require escalation', async () => {
      console.log('\n[E2E Test] Testing tie detection and escalation...\n');

      const mockDelegator = {
        analyzeRootCause: jest.fn()
      };

      // Two hypotheses with very close confidence scores (within 0.1 threshold)
      mockDelegator.analyzeRootCause
        .mockResolvedValueOnce({
          confidence: 0.80,
          rootCause: { description: 'Hypothesis A' },
          fixRecommendations: []
        })
        .mockResolvedValueOnce({
          confidence: 0.79,
          rootCause: { description: 'Hypothesis B' },
          fixRecommendations: []
        });

      const validator = new MultiHypothesisValidator(mockDelegator);

      const hypotheses = [
        {
          bugReport: { title: 'Bug' },
          testCode: 'test 1',
          stackTrace: { raw: 'stack 1' },
          hypothesis: 'Hypothesis A'
        },
        {
          bugReport: { title: 'Bug' },
          testCode: 'test 2',
          stackTrace: { raw: 'stack 2' },
          hypothesis: 'Hypothesis B'
        }
      ];

      const result = await validator.validateHypotheses(hypotheses);

      console.log('[E2E Test] ✓ Tie detected between top hypotheses');
      console.log(`[E2E Test]   Confidence delta: ${Math.abs(0.80 - 0.79).toFixed(2)}`);
      console.log('[E2E Test] ✓ Escalation required for manual review\n');

      expect(result.isTied).toBe(true);
      expect(result.requiresEscalation).toBe(true);
      expect(result.selectionReason).toContain('Tie detected');

      console.log('✅ Tie detection and escalation complete!\n');
      console.log('   - Confidence scores too close to decide automatically');
      console.log('   - Manual review recommended');
      console.log();
    });
  });

  describe('Performance Validation', () => {
    it('should complete workflow within performance requirements', () => {
      console.log('\n[E2E Test] Testing performance requirements...\n');

      const startTime = Date.now();

      // Execute workflow steps
      const selector = new SpecialistSelector();
      const tracker = new TDDPhaseTracker();
      const preparer = new FixTaskPreparer();
      const generator = new TRDGenerator();

      // Perform operations
      const selection = selector.selectSpecialist({
        framework: 'jest',
        complexity: 'medium'
      });

      const tddState = tracker.initializeTracking('session-1', 'bug-1');

      const fixTask = preparer.prepareFixTask({
        bugReport: { title: 'Bug', description: 'Desc', severity: 'low' },
        testCode: 'test',
        testFile: 'test.js',
        rootCause: { description: 'Root cause' },
        fixRecommendation: { description: 'Fix', priority: 1 },
        specialistAgent: 'backend-developer',
        tddState
      });

      const trdRequirement = generator.shouldGenerateTRD({
        fixRecommendations: [{ estimatedTime: 2 }]
      });

      const duration = Date.now() - startTime;

      console.log(`[E2E Test] ✓ Workflow completed in ${duration}ms\n`);

      // All operations should complete instantly (no async operations)
      expect(duration).toBeLessThan(100); // Very fast for synchronous operations

      console.log('✅ Performance validation complete!\n');
      console.log(`   - Execution time: ${duration}ms`);
      console.log('   - Well within performance requirements');
      console.log();
    });
  });
});
