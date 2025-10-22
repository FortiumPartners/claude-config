/**
 * Tests for TRD Generator
 */

const TRDGenerator = require('../../strategy/trd-generator');

describe('TRDGenerator', () => {
  let generator;
  let validAnalysis;
  let validContext;

  beforeEach(() => {
    generator = new TRDGenerator();

    validAnalysis = {
      fixRecommendations: [
        { estimatedTime: 2, complexity: 'simple' },
        { estimatedTime: 3, complexity: 'medium' }
      ]
    };

    validContext = {
      bugReport: {
        title: 'Authentication fails with null token',
        description: 'Users cannot log in when token is null',
        severity: 'high',
        issueId: 'BUG-123',
        expectedBehavior: 'Users should be able to log in',
        actualBehavior: 'Login fails with error',
        stepsToReproduce: [
          'Navigate to login page',
          'Enter credentials',
          'Click login button'
        ]
      },
      rootCause: {
        description: 'Null pointer exception in token validator',
        likelyFile: 'lib/auth/token-validator.js',
        likelyFunction: 'validateToken'
      },
      fixRecommendations: [
        {
          description: 'Add null check before accessing token properties',
          priority: 1,
          estimatedTime: 2,
          complexity: 'simple',
          framework: 'jest',
          specialistAgent: 'nestjs-backend-expert',
          affectedFiles: ['lib/auth/token-validator.js']
        }
      ]
    };
  });

  describe('Constructor', () => {
    it('should initialize with default TRD directory', () => {
      expect(generator.trdDirectory).toBe('docs/TRD');
    });

    it('should initialize with default template path', () => {
      expect(generator.templatePath).toBe('docs/agentos/TRD.md');
    });

    it('should initialize with complexity threshold', () => {
      expect(generator.complexityThreshold).toBe(4);
    });

    it('should allow custom configuration', () => {
      const custom = new TRDGenerator({
        trdDirectory: 'custom/trd',
        templatePath: 'custom/template.md'
      });

      expect(custom.trdDirectory).toBe('custom/trd');
      expect(custom.templatePath).toBe('custom/template.md');
    });
  });

  describe('shouldGenerateTRD', () => {
    it('should return false for null analysis', () => {
      const result = generator.shouldGenerateTRD(null);
      expect(result.required).toBe(false);
    });

    it('should return false for missing fix recommendations', () => {
      const result = generator.shouldGenerateTRD({});
      expect(result.required).toBe(false);
    });

    it('should return false for simple fixes under threshold', () => {
      const analysis = {
        fixRecommendations: [
          { estimatedTime: 2, complexity: 'simple' }
        ]
      };

      const result = generator.shouldGenerateTRD(analysis);
      expect(result.required).toBe(false);
      expect(result.totalEstimatedTime).toBe(2);
    });

    it('should return true for fixes over time threshold', () => {
      const analysis = {
        fixRecommendations: [
          { estimatedTime: 3 },
          { estimatedTime: 2 }
        ]
      };

      const result = generator.shouldGenerateTRD(analysis);
      expect(result.required).toBe(true);
      expect(result.totalEstimatedTime).toBe(5);
      expect(result.reason).toContain('exceeds threshold');
    });

    it('should return true for architectural complexity', () => {
      const analysis = {
        fixRecommendations: [
          { estimatedTime: 2, complexity: 'architectural' }
        ]
      };

      const result = generator.shouldGenerateTRD(analysis);
      expect(result.required).toBe(true);
      expect(result.reason).toContain('Architectural complexity');
    });

    it('should return true for system-wide scope', () => {
      const analysis = {
        fixRecommendations: [{ estimatedTime: 2 }],
        impactAssessment: { scope: 'system' }
      };

      const result = generator.shouldGenerateTRD(analysis);
      expect(result.required).toBe(true);
      expect(result.reason).toContain('System-wide scope');
    });

    it('should return true if impact assessment requires TRD', () => {
      const analysis = {
        fixRecommendations: [{ estimatedTime: 2 }],
        impactAssessment: { requiresTRD: true }
      };

      const result = generator.shouldGenerateTRD(analysis);
      expect(result.required).toBe(true);
    });

    it('should calculate total estimated time', () => {
      const result = generator.shouldGenerateTRD(validAnalysis);
      expect(result.totalEstimatedTime).toBe(5);
    });
  });

  describe('generateTRD', () => {
    it('should throw error if context missing', () => {
      expect(() => generator.generateTRD(null)).toThrow('Context is required');
    });

    it('should throw error if bugReport missing', () => {
      const invalid = { ...validContext };
      delete invalid.bugReport;
      expect(() => generator.generateTRD(invalid)).toThrow('bugReport');
    });

    it('should throw error if rootCause missing', () => {
      const invalid = { ...validContext };
      delete invalid.rootCause;
      expect(() => generator.generateTRD(invalid)).toThrow('rootCause');
    });

    it('should throw error if fixRecommendations missing', () => {
      const invalid = { ...validContext };
      delete invalid.fixRecommendations;
      expect(() => generator.generateTRD(invalid)).toThrow('fixRecommendations');
    });

    it('should generate complete TRD', () => {
      const result = generator.generateTRD(validContext);

      expect(result.content).toBeDefined();
      expect(result.filePath).toBeDefined();
      expect(result.bugId).toBe('BUG-123');
    });

    it('should include bug ID in TRD content', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('BUG-123');
    });

    it('should include bug title in TRD', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Authentication fails');
    });

    it('should include severity in TRD', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('high');
    });

    it('should include root cause description', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Null pointer exception');
    });

    it('should include fix recommendations', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Add null check');
    });

    it('should include affected files', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('token-validator.js');
    });

    it('should include steps to reproduce', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Navigate to login page');
    });

    it('should generate bug ID from timestamp if not provided', () => {
      const contextWithoutId = { ...validContext };
      contextWithoutId.bugReport = { ...validContext.bugReport };
      delete contextWithoutId.bugReport.issueId;

      const result = generator.generateTRD(contextWithoutId);
      expect(result.bugId).toMatch(/^bug-\d+$/);
    });

    it('should include session ID if provided', () => {
      const contextWithSession = {
        ...validContext,
        sessionId: 'session-abc-123'
      };

      const result = generator.generateTRD(contextWithSession);
      expect(result.content).toContain('session-abc-123');
    });

    it('should include impact assessment if provided', () => {
      const contextWithImpact = {
        ...validContext,
        impactAssessment: {
          regressionRisk: 'high',
          affectedFeatures: ['Auth', 'Login'],
          userImpact: 'critical'
        }
      };

      const result = generator.generateTRD(contextWithImpact);
      expect(result.content).toContain('high');
      expect(result.content).toContain('Auth');
    });
  });

  describe('generateFilePath', () => {
    it('should generate file path in TRD directory', () => {
      const path = generator.generateFilePath('BUG-123');
      expect(path).toContain('docs/TRD');
      expect(path).toContain('debug-');
      expect(path).toContain('.md');
    });

    it('should sanitize bug ID', () => {
      const path = generator.generateFilePath('BUG #123 / Test');
      expect(path).toMatch(/debug-bug--123---test-trd\.md/);
    });

    it('should convert to lowercase', () => {
      const path = generator.generateFilePath('BUG-123');
      expect(path).toMatch(/bug-123/);
    });
  });

  describe('TRD Content Building', () => {
    it('should build executive summary', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Executive Summary');
    });

    it('should build system context section', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('System Context & Constraints');
    });

    it('should build bug analysis section', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Bug Analysis');
    });

    it('should build fix implementation plan', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Fix Implementation Plan');
    });

    it('should build test strategy section', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Test Strategy');
    });

    it('should build risk assessment section', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Risk Assessment');
    });

    it('should build deployment strategy', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Deployment Strategy');
    });

    it('should build definition of done', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toContain('Definition of Done');
    });

    it('should include checkbox tasks', () => {
      const result = generator.generateTRD(validContext);
      expect(result.content).toMatch(/- \[ \]/);
    });
  });

  describe('Helper Methods', () => {
    it('should summarize single fix strategy', () => {
      const summary = generator.summarizeFixStrategy([
        { description: 'Add null check' }
      ]);
      expect(summary).toBe('Add null check');
    });

    it('should summarize multiple fix strategies', () => {
      const summary = generator.summarizeFixStrategy([
        { description: 'Fix 1' },
        { description: 'Fix 2' }
      ]);
      expect(summary).toContain('Multi-step');
      expect(summary).toContain('2 recommendations');
    });

    it('should calculate total effort', () => {
      const effort = generator.calculateTotalEffort([
        { estimatedTime: 2 },
        { estimatedTime: 3 }
      ]);
      expect(effort).toBe('5 hours');
    });

    it('should build impact summary', () => {
      const impact = {
        regressionRisk: 'medium',
        affectedFeatures: ['Auth', 'Login'],
        userImpact: 'high'
      };

      const summary = generator.buildImpactSummary(impact);
      expect(summary).toContain('medium');
      expect(summary).toContain('2');
      expect(summary).toContain('high');
    });

    it('should build affected components list', () => {
      const rootCause = { likelyFile: 'auth.js' };
      const recommendations = [
        { affectedFiles: ['validator.js', 'helper.js'] }
      ];

      const list = generator.buildAffectedComponentsList(rootCause, recommendations);
      expect(list).toContain('auth.js');
      expect(list).toContain('validator.js');
      expect(list).toContain('helper.js');
    });

    it('should build framework requirements', () => {
      const recommendations = [
        { framework: 'jest' },
        { framework: 'react' }
      ];

      const requirements = generator.buildFrameworkRequirements(recommendations);
      expect(requirements).toContain('jest');
      expect(requirements).toContain('react');
    });

    it('should handle generic framework', () => {
      const requirements = generator.buildFrameworkRequirements([]);
      expect(requirements).toContain('Generic');
    });

    it('should build steps to reproduce', () => {
      const steps = generator.buildStepsToReproduce(validContext.bugReport);
      expect(steps).toContain('1. Navigate to login page');
      expect(steps).toContain('2. Enter credentials');
    });

    it('should handle missing steps to reproduce', () => {
      const bugReport = { ...validContext.bugReport };
      delete bugReport.stepsToReproduce;

      const steps = generator.buildStepsToReproduce(bugReport);
      expect(steps).toContain('See bug description');
    });

    it('should build fix recommendations list', () => {
      const list = generator.buildFixRecommendationsList(validContext.fixRecommendations);
      expect(list).toContain('Recommendation 1');
      expect(list).toContain('Add null check');
      expect(list).toContain('Priority: 1');
      expect(list).toContain('simple');
    });

    it('should build implementation tasks with checkboxes', () => {
      const tasks = generator.buildImplementationTasks(validContext.fixRecommendations);
      expect(tasks).toContain('- [ ] **Task 1**');
      expect(tasks).toContain('Add null check');
      expect(tasks).toContain('(2h)');
    });

    it('should build test strategy details', () => {
      const strategy = {
        unit: true,
        integration: true,
        e2e: false,
        coverageTarget: 80
      };

      const details = generator.buildTestStrategyDetails(strategy);
      expect(details).toContain('Unit Tests: Required');
      expect(details).toContain('Integration Tests: Required');
      expect(details).toContain('E2E Tests: Optional');
      expect(details).toContain('80%');
    });

    it('should build risk assessment with mitigation', () => {
      const impact = {
        regressionRisk: 'high',
        riskMitigation: [
          'Code review before merge',
          'Feature flags for rollout'
        ]
      };

      const assessment = generator.buildRiskAssessment(impact);
      expect(assessment).toContain('high');
      expect(assessment).toContain('Code review');
      expect(assessment).toContain('Feature flags');
    });

    it('should build default risk assessment', () => {
      const assessment = generator.buildDefaultRiskAssessment();
      expect(assessment).toContain('Medium');
      expect(assessment).toContain('code review');
    });

    it('should build definition of done with all tasks', () => {
      const dod = generator.buildDefinitionOfDone(
        validContext.fixRecommendations,
        { testStrategy: { e2e: true } }
      );

      expect(dod).toContain('Task 1 implemented');
      expect(dod).toContain('unit tests passing');
      expect(dod).toContain('integration tests passing');
      expect(dod).toContain('E2E tests passing');
      expect(dod).toContain('Code review completed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty affected files', () => {
      const contextNoFiles = { ...validContext };
      contextNoFiles.fixRecommendations = [
        { ...validContext.fixRecommendations[0], affectedFiles: [] }
      ];

      const result = generator.generateTRD(contextNoFiles);
      expect(result.content).toBeDefined();
    });

    it('should handle missing optional fields', () => {
      const minimal = {
        bugReport: {
          title: 'Bug',
          description: 'Description',
          severity: 'low'
        },
        rootCause: {
          description: 'Root cause'
        },
        fixRecommendations: [
          { description: 'Fix', priority: 1 }
        ]
      };

      const result = generator.generateTRD(minimal);
      expect(result.content).toBeDefined();
      expect(result.bugId).toMatch(/^bug-/);
    });

    it('should handle null impactAssessment', () => {
      const contextNoImpact = { ...validContext };
      delete contextNoImpact.impactAssessment;

      const result = generator.generateTRD(contextNoImpact);
      expect(result.content).toContain('Risk Assessment');
    });

    it('should handle empty dependencies', () => {
      const rootCause = { ...validContext.rootCause, dependencies: {} };
      const list = generator.buildDependenciesList(rootCause.dependencies);
      expect(list).toContain('None identified');
    });
  });

  describe('validateContext', () => {
    it('should validate complete context', () => {
      expect(() => generator.validateContext(validContext)).not.toThrow();
    });

    it('should throw for null context', () => {
      expect(() => generator.validateContext(null)).toThrow('Context is required');
    });

    it('should throw for missing required fields', () => {
      const required = ['bugReport', 'rootCause', 'fixRecommendations'];

      required.forEach(field => {
        const invalid = { ...validContext };
        delete invalid[field];
        expect(() => generator.validateContext(invalid)).toThrow(field);
      });
    });
  });
});
