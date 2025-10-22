/**
 * Root Cause Analysis End-to-End Integration Test
 *
 * Tests the complete workflow from bug report through root cause analysis:
 * 1. Code context gathering (TRD-014)
 * 2. Root cause delegation to tech-lead-orchestrator (TRD-015)
 * 3. Confidence score validation (TRD-016)
 * 4. Fix strategy interpretation (TRD-017)
 * 5. Impact assessment (TRD-018)
 *
 * This validates Sprint 3 Definition of Done requirement:
 * "Integration test: End-to-end root cause analysis workflow"
 *
 * @group integration
 * @module lib/deep-debugger/__tests__/integration/root-cause-analysis-e2e.test
 */

const CodeContextGatherer = require('../../analysis/code-context-gatherer');
const RootCauseDelegator = require('../../analysis/root-cause-delegator');
const ConfidenceValidator = require('../../analysis/confidence-validator');
const FixStrategyInterpreter = require('../../analysis/fix-strategy-interpreter');
const ImpactAssessor = require('../../analysis/impact-assessor');

describe('Root Cause Analysis - End-to-End Integration', () => {
  let mockGrepTool;
  let mockBashTool;
  let mockTaskTool;

  // Sample bug report from Sprint 2 test recreation
  const bugReport = {
    id: 'BUG-456',
    title: 'User authentication fails with null token',
    description: 'Users unable to log in due to null token error in authentication service',
    stepsToReproduce: '1. Navigate to /login\n2. Enter valid credentials\n3. Click Login',
    expectedBehavior: 'User should be logged in and redirected to dashboard',
    actualBehavior: 'Error: Cannot read property "id" of null at validateToken',
    severity: 'high',
    labels: ['authentication', 'backend', 'production']
  };

  // Sample recreation test results from Sprint 2
  const recreationTest = {
    testFile: '/tests/auth/login.test.js',
    framework: 'jest',
    testFailed: true,
    testResults: {
      success: false,
      failed: 1,
      total: 1
    },
    errorMessage: 'TypeError: Cannot read property "id" of null',
    stackTrace: `
      at validateToken (/src/auth/token-validator.js:45:23)
      at AuthService.authenticate (/src/auth/auth-service.js:78:15)
      at login (/src/controllers/auth-controller.js:32:18)
    `.trim()
  };

  beforeEach(() => {
    // Mock Grep tool for code context gathering
    mockGrepTool = {
      search: jest.fn()
    };

    // Mock Bash tool for git log
    mockBashTool = {
      exec: jest.fn()
    };

    // Mock Task tool for tech-lead delegation
    mockTaskTool = {
      delegate: jest.fn()
    };
  });

  describe('Complete Root Cause Analysis Workflow', () => {
    it('should execute full workflow from bug report to fix recommendations', async () => {
      // ===== STEP 1: Code Context Gathering (TRD-014) =====
      console.log('\n[E2E Test] Step 1: Gathering code context...');

      const contextGatherer = new CodeContextGatherer(
        '/project',
        mockGrepTool,
        mockBashTool
      );

      // Mock affected files from stack trace
      const affectedFiles = [
        '/src/auth/token-validator.js',
        '/src/auth/auth-service.js',
        '/src/controllers/auth-controller.js'
      ];

      // Mock git log response
      mockBashTool.exec.mockReturnValue(`
abc123|Fix token validation logic|2025-10-15|John Doe
def456|Add null check for user object|2025-10-14|Jane Smith
      `.trim());

      // Mock grep responses for error patterns
      mockGrepTool.search.mockImplementation((pattern, options) => {
        if (pattern.includes('TODO') || pattern.includes('FIXME')) {
          return {
            matches: [
              { file: '/src/auth/token-validator.js', line: 42, text: '// TODO: Add better error handling' }
            ]
          };
        }
        if (pattern.includes('null') || pattern.includes('undefined')) {
          return {
            matches: [
              { file: '/src/auth/token-validator.js', line: 45, text: 'if (token.id) {' }
            ]
          };
        }
        return { matches: [] };
      });

      const codeContext = await contextGatherer.gatherContext(affectedFiles);

      expect(codeContext).toHaveProperty('affectedFiles');
      expect(codeContext).toHaveProperty('recentChanges');
      expect(codeContext).toHaveProperty('errorPatterns');
      expect(codeContext.affectedFiles).toEqual(affectedFiles);
      expect(codeContext.recentChanges).toHaveLength(2);
      console.log('[E2E Test] ✓ Code context gathered successfully');

      // ===== STEP 2: Root Cause Delegation (TRD-015) =====
      console.log('[E2E Test] Step 2: Delegating to tech-lead-orchestrator...');

      const delegator = new RootCauseDelegator(mockTaskTool);

      // Build analysis request
      const analysisRequest = delegator.buildAnalysisRequest({
        bugReport,
        testCode: recreationTest.testFile,
        stackTrace: {
          affectedFiles: codeContext.affectedFiles,
          errorMessages: [recreationTest.errorMessage]
        },
        affectedFiles: codeContext.affectedFiles,
        gitLog: codeContext.recentChanges,
        dependencies: codeContext.dependencies,
        complexity: 2 // 2 hours estimated
      });

      expect(analysisRequest).toHaveProperty('bugReport');
      expect(analysisRequest).toHaveProperty('recreationTest');
      expect(analysisRequest).toHaveProperty('codeContext');
      expect(analysisRequest.request.taskBreakdown).toBe(false); // <4h

      // Mock successful tech-lead-orchestrator response
      mockTaskTool.delegate.mockResolvedValue({
        success: true,
        analysis: {
          confidence: 0.85,
          rootCause: 'Null pointer exception in token-validator.js due to missing null check before accessing token.id property',
          fixRecommendations: [
            {
              id: 'fix-1',
              description: 'Add null check before accessing token.id',
              priority: 1,
              estimatedTime: 1,
              affectedFiles: ['/src/auth/token-validator.js'],
              approach: 'Add if (!token) return error before token.id access'
            },
            {
              id: 'fix-2',
              description: 'Add validation middleware to prevent null tokens',
              priority: 2,
              estimatedTime: 2,
              affectedFiles: ['/src/auth/token-validator.js', '/src/middleware/auth.js'],
              approach: 'Create middleware to validate token existence'
            }
          ],
          impactAssessment: {
            scope: 'component',
            regressionRiskAreas: ['user-authentication', 'token-validation'],
            affectedFeatures: ['User login', 'API authentication'],
            userImpact: 'High - prevents all user logins',
            testCoverageRecommendation: 'Add unit tests for null token scenarios',
            needsTRD: false // Simple fix <4h
          }
        }
      });

      const rawAnalysis = await delegator.analyzeRootCause({
        bugReport,
        testCode: recreationTest.testFile,
        stackTrace: {
          affectedFiles: codeContext.affectedFiles,
          errorMessages: [recreationTest.errorMessage]
        },
        affectedFiles: codeContext.affectedFiles,
        gitLog: codeContext.recentChanges,
        complexity: 2
      });

      expect(rawAnalysis).toHaveProperty('confidence');
      expect(rawAnalysis).toHaveProperty('rootCause');
      expect(rawAnalysis).toHaveProperty('fixRecommendations');
      console.log('[E2E Test] ✓ Root cause analysis delegated successfully');

      // ===== STEP 3: Confidence Validation (TRD-016) =====
      console.log('[E2E Test] Step 3: Validating confidence score...');

      const validator = new ConfidenceValidator();

      const validationResult = validator.validateAnalysis(rawAnalysis);

      expect(validationResult.valid).toBe(true);
      expect(rawAnalysis.confidence).toBe(0.85);
      expect(rawAnalysis.confidence).toBeGreaterThanOrEqual(0.7);
      console.log('[E2E Test] ✓ Confidence score validated (0.85 ≥ 0.7)');

      // ===== STEP 4: Fix Strategy Interpretation (TRD-017) =====
      console.log('[E2E Test] Step 4: Interpreting fix strategies...');

      const interpreter = new FixStrategyInterpreter();

      const interpretation = interpreter.interpretRecommendations(
        rawAnalysis.fixRecommendations
      );

      expect(interpretation.primaryRecommendation).toBeDefined();
      expect(interpretation.primaryRecommendation.priority).toBe(1); // Highest priority first
      expect(interpretation.primaryRecommendation).toHaveProperty('specialistAgent');
      expect(interpretation.primaryRecommendation).toHaveProperty('complexity');
      expect(interpretation.totalEstimatedTime).toBe(3); // 1h + 2h
      console.log('[E2E Test] ✓ Fix strategies interpreted and prioritized');

      // ===== STEP 5: Impact Assessment (TRD-018) =====
      console.log('[E2E Test] Step 5: Assessing impact and planning tests...');

      const assessor = new ImpactAssessor();

      // Build all recommendations array from primary + alternatives
      const allRecommendations = [
        interpretation.primaryRecommendation,
        ...interpretation.alternatives
      ];

      const impact = assessor.assessImpact(
        rawAnalysis.impactAssessment,
        allRecommendations
      );

      expect(impact).toHaveProperty('regressionRisk');
      expect(impact).toHaveProperty('requiresTRD');
      expect(impact).toHaveProperty('testStrategy');
      expect(impact).toHaveProperty('riskMitigation');
      expect(impact.requiresTRD).toBe(false); // Total 3h < 4h threshold
      expect(impact.regressionRisk).toBe('medium'); // Authentication is component-level
      console.log('[E2E Test] ✓ Impact assessed and test strategy planned');

      // ===== FINAL VALIDATION =====
      console.log('[E2E Test] Validating complete workflow output...\n');

      const workflowResult = {
        bugReport,
        recreationTest,
        codeContext,
        analysis: rawAnalysis,
        validation: validationResult,
        interpretation,
        impact
      };

      // Validate complete workflow result
      expect(workflowResult).toHaveProperty('bugReport');
      expect(workflowResult).toHaveProperty('recreationTest');
      expect(workflowResult).toHaveProperty('codeContext');
      expect(workflowResult).toHaveProperty('analysis');
      expect(workflowResult).toHaveProperty('validation');
      expect(workflowResult).toHaveProperty('interpretation');
      expect(workflowResult).toHaveProperty('impact');

      // Validate data flow integrity
      expect(workflowResult.validation.valid).toBe(true);
      expect(workflowResult.interpretation.primaryRecommendation).toBeDefined();
      expect(workflowResult.impact.testStrategy).toBeDefined();
      expect(workflowResult.impact.riskMitigation).toBeDefined();

      console.log('✅ End-to-end root cause analysis workflow complete!');
      console.log(`   - Bug: ${bugReport.title}`);
      console.log(`   - Root Cause: ${rawAnalysis.rootCause}`);
      console.log(`   - Confidence: ${rawAnalysis.confidence}`);
      console.log(`   - Fix Recommendations: ${1 + interpretation.alternatives.length}`);
      console.log(`   - Total Estimated Time: ${interpretation.totalEstimatedTime}h`);
      console.log(`   - Needs TRD: ${impact.requiresTRD ? 'Yes' : 'No'}`);
      console.log(`   - Regression Risk: ${impact.regressionRisk}`);
    });

    it('should handle low confidence scenarios with escalation', async () => {
      console.log('\n[E2E Test] Testing low confidence escalation...');

      const delegator = new RootCauseDelegator(mockTaskTool);
      const validator = new ConfidenceValidator();

      // Mock low confidence response
      mockTaskTool.delegate.mockResolvedValue({
        success: true,
        analysis: {
          confidence: 0.5, // Below 0.7 threshold
          rootCause: 'Unclear - insufficient context',
          fixRecommendations: [],
          impactAssessment: {
            regressionRiskAreas: [],
            affectedFeatures: [],
            userImpact: 'Unknown',
            testCoverageRecommendation: 'More investigation needed',
            needsTRD: true
          }
        }
      });

      // analyzeRootCause will throw on low confidence
      await expect(
        delegator.analyzeRootCause({
          bugReport,
          testCode: recreationTest.testFile,
          stackTrace: { affectedFiles: [], errorMessages: [] },
          affectedFiles: [],
          gitLog: [],
          complexity: 8
        })
      ).rejects.toThrow('Confidence score 0.5 below threshold');

      console.log('[E2E Test] ✓ Low confidence correctly throws error for escalation');

      // Test validator directly with low confidence analysis
      const lowConfidenceAnalysis = {
        confidence: 0.5,
        rootCause: 'Unclear',
        fixRecommendations: [],
        impactAssessment: { regressionRiskAreas: [], affectedFeatures: [], userImpact: '', testCoverageRecommendation: '', needsTRD: false }
      };

      const validationResult = validator.validateAnalysis(lowConfidenceAnalysis);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.action).toBe('escalate');
      expect(validationResult.reason).toContain('Low confidence');

      const additionalContext = validator.requestAdditionalContext(lowConfidenceAnalysis);

      expect(additionalContext).toHaveProperty('missingFields');
      expect(additionalContext).toHaveProperty('suggestions');

      console.log('[E2E Test] ✓ Low confidence handled with escalation request');
    });

    it('should handle complex bugs requiring TRD generation', async () => {
      console.log('\n[E2E Test] Testing complex bug TRD requirement...');

      const delegator = new RootCauseDelegator(mockTaskTool);
      const interpreter = new FixStrategyInterpreter();
      const assessor = new ImpactAssessor();

      // Mock complex fix requiring TRD
      mockTaskTool.delegate.mockResolvedValue({
        success: true,
        analysis: {
          confidence: 0.8,
          rootCause: 'Architectural issue in authentication subsystem requiring refactor',
          fixRecommendations: [
            {
              id: 'fix-1',
              description: 'Refactor authentication subsystem',
              priority: 1,
              estimatedTime: 8,
              affectedFiles: ['/src/auth/*'],
              approach: 'Redesign token management architecture'
            },
            {
              id: 'fix-2',
              description: 'Update all dependent services',
              priority: 2,
              estimatedTime: 6,
              affectedFiles: ['/src/services/*'],
              approach: 'Update service layer to use new auth API'
            }
          ],
          impactAssessment: {
            scope: 'system',
            regressionRiskAreas: ['authentication', 'authorization', 'api-access'],
            affectedFeatures: ['Login', 'API Auth', 'Session Management'],
            userImpact: 'Critical - affects all authenticated users',
            testCoverageRecommendation: 'Comprehensive E2E and integration testing',
            needsTRD: true
          }
        }
      });

      const analysis = await delegator.analyzeRootCause({
        bugReport: {
          ...bugReport,
          severity: 'critical',
          description: 'Systemic authentication failures across all services'
        },
        testCode: recreationTest.testFile,
        stackTrace: { affectedFiles: ['/src/auth/*'], errorMessages: [] },
        affectedFiles: ['/src/auth/*', '/src/services/*'],
        complexity: 14
      });

      const interpretation = interpreter.interpretRecommendations(
        analysis.fixRecommendations
      );

      const allRecommendations = [
        interpretation.primaryRecommendation,
        ...interpretation.alternatives
      ];

      const impact = assessor.assessImpact(
        analysis.impactAssessment,
        allRecommendations
      );

      expect(interpretation.totalEstimatedTime).toBe(14); // 8h + 6h
      expect(impact.requiresTRD).toBe(true); // >4h complexity
      expect(impact.regressionRisk).toBe('high'); // System-wide changes
      expect(impact.riskMitigation.some(m => m.toLowerCase().includes('feature flag'))).toBe(true);
      expect(impact.riskMitigation.some(m => m.toLowerCase().includes('rollout'))).toBe(true);

      console.log('[E2E Test] ✓ Complex bug correctly identified as requiring TRD');
      console.log(`   - Total complexity: ${interpretation.totalEstimatedTime}h`);
      console.log(`   - Needs TRD: ${impact.requiresTRD}`);
      console.log(`   - Regression risk: ${impact.regressionRisk}`);
    });

    it('should complete workflow within performance requirements', async () => {
      console.log('\n[E2E Test] Testing performance requirements...');

      const startTime = Date.now();

      // Quick mock implementations
      const contextGatherer = new CodeContextGatherer(
        '/project',
        { search: jest.fn().mockReturnValue({ matches: [] }) },
        { exec: jest.fn().mockReturnValue('') }
      );

      const delegator = new RootCauseDelegator(mockTaskTool);
      const validator = new ConfidenceValidator();
      const interpreter = new FixStrategyInterpreter();
      const assessor = new ImpactAssessor();

      mockTaskTool.delegate.mockResolvedValue({
        success: true,
        analysis: {
          confidence: 0.75,
          rootCause: 'Simple null check missing',
          fixRecommendations: [
            {
              id: 'fix-1',
              description: 'Add null check',
              priority: 1,
              complexityHours: 1,
              affectedFiles: ['/src/auth.js'],
              approach: 'Add if (!token) check'
            }
          ],
          impactAssessment: {
            regressionRiskAreas: ['auth'],
            affectedFeatures: ['login'],
            userImpact: 'Medium',
            testCoverageRecommendation: 'Unit tests',
            needsTRD: false
          }
        }
      });

      // Execute workflow
      const context = await contextGatherer.gatherContext(['/src/auth.js']);

      const analysis = await delegator.analyzeRootCause({
        bugReport,
        testCode: 'test',
        stackTrace: { affectedFiles: [], errorMessages: [] },
        complexity: 1
      });

      const validation = validator.validateAnalysis(analysis);
      const interpretation = interpreter.interpretRecommendations(analysis.fixRecommendations);
      const allRecommendations = [interpretation.primaryRecommendation, ...interpretation.alternatives];
      const impact = assessor.assessImpact(analysis.impactAssessment, allRecommendations);

      const duration = Date.now() - startTime;

      // Performance requirement: <5 seconds for context gathering (TRD-014)
      // Performance requirement: ≤15 minutes for root cause analysis (TRD-015)
      expect(duration).toBeLessThan(15 * 60 * 1000); // 15 minutes
      expect(validation.valid).toBe(true);
      expect(interpretation.primaryRecommendation).toBeDefined();
      expect(impact.testStrategy).toBeDefined();

      console.log(`[E2E Test] ✓ Workflow completed in ${duration}ms (< 15 min requirement)`);
    });
  });
});
