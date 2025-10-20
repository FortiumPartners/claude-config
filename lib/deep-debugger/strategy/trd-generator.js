/**
 * TRD Generator
 *
 * Generates Technical Requirements Documents for complex bug fixes.
 * Follows the AgentOS TRD template (@docs/agentos/TRD.md) with task
 * breakdown and checkbox tracking.
 *
 * @module lib/deep-debugger/strategy/trd-generator
 */

const path = require('path');

class TRDGenerator {
  /**
   * Create a TRD generator
   *
   * @param {Object} [options] - Configuration options
   * @param {string} [options.trdDirectory] - Directory for TRDs (default: docs/TRD)
   * @param {string} [options.templatePath] - Path to TRD template
   */
  constructor(options = {}) {
    this.trdDirectory = options.trdDirectory || 'docs/TRD';
    this.templatePath = options.templatePath || 'docs/agentos/TRD.md';

    // Complexity threshold for TRD generation (hours)
    this.complexityThreshold = 4;
  }

  /**
   * Determine if bug requires TRD generation
   *
   * @param {Object} analysis - Root cause analysis
   * @param {Object[]} analysis.fixRecommendations - Fix recommendations
   * @param {number} analysis.fixRecommendations[].estimatedTime - Estimated time
   * @param {string} analysis.fixRecommendations[].complexity - Complexity level
   * @param {Object} [analysis.impactAssessment] - Impact assessment
   * @returns {Object} TRD requirement result
   * @returns {boolean} return.required - Whether TRD is required
   * @returns {string} return.reason - Reason for requirement
   * @returns {number} return.totalEstimatedTime - Total estimated time
   */
  shouldGenerateTRD(analysis) {
    if (!analysis || !analysis.fixRecommendations) {
      return {
        required: false,
        reason: 'No fix recommendations available',
        totalEstimatedTime: 0
      };
    }

    const recommendations = analysis.fixRecommendations;

    // Calculate total estimated time
    const totalTime = recommendations.reduce(
      (sum, rec) => sum + (rec.estimatedTime || 0),
      0
    );

    // Check for architectural complexity
    const hasArchitecturalComplexity = recommendations.some(
      rec => rec.complexity === 'architectural'
    );

    if (hasArchitecturalComplexity) {
      return {
        required: true,
        reason: 'Architectural complexity requires comprehensive planning',
        totalEstimatedTime: totalTime
      };
    }

    // Check if total time exceeds threshold
    if (totalTime > this.complexityThreshold) {
      return {
        required: true,
        reason: `Estimated time (${totalTime}h) exceeds threshold (${this.complexityThreshold}h)`,
        totalEstimatedTime: totalTime
      };
    }

    // Check impact assessment if available
    if (analysis.impactAssessment) {
      const impact = analysis.impactAssessment;

      if (impact.requiresTRD) {
        return {
          required: true,
          reason: 'Impact assessment indicates TRD required',
          totalEstimatedTime: totalTime
        };
      }

      if (impact.scope === 'system') {
        return {
          required: true,
          reason: 'System-wide scope requires comprehensive planning',
          totalEstimatedTime: totalTime
        };
      }
    }

    return {
      required: false,
      reason: `Simple fix (${totalTime}h) does not require TRD`,
      totalEstimatedTime: totalTime
    };
  }

  /**
   * Generate TRD for complex bug fix
   *
   * @param {Object} context - TRD generation context
   * @param {Object} context.bugReport - Bug report details
   * @param {Object} context.rootCause - Root cause analysis
   * @param {Object[]} context.fixRecommendations - Fix recommendations
   * @param {Object} [context.impactAssessment] - Impact assessment
   * @param {string} [context.sessionId] - Debugging session ID
   * @returns {Object} Generated TRD
   * @returns {string} return.content - TRD markdown content
   * @returns {string} return.filePath - Suggested file path
   * @returns {string} return.bugId - Bug identifier
   */
  generateTRD(context) {
    // Validate context
    this.validateContext(context);

    const {
      bugReport,
      rootCause,
      fixRecommendations,
      impactAssessment,
      sessionId
    } = context;

    // Generate bug ID
    const bugId = bugReport.issueId || `bug-${Date.now()}`;

    // Build TRD content
    const content = this.buildTRDContent({
      bugId,
      bugReport,
      rootCause,
      fixRecommendations,
      impactAssessment,
      sessionId
    });

    // Generate file path
    const filePath = this.generateFilePath(bugId);

    return {
      content,
      filePath,
      bugId
    };
  }

  /**
   * Validate TRD generation context
   *
   * @param {Object} context - Context to validate
   * @throws {Error} If context is invalid
   * @private
   */
  validateContext(context) {
    if (!context) {
      throw new Error('Context is required');
    }

    const required = ['bugReport', 'rootCause', 'fixRecommendations'];
    for (const field of required) {
      if (!context[field]) {
        throw new Error(`Context missing required field: ${field}`);
      }
    }
  }

  /**
   * Build TRD markdown content
   *
   * @param {Object} data - TRD data
   * @returns {string} Markdown content
   * @private
   */
  buildTRDContent(data) {
    const {
      bugId,
      bugReport,
      rootCause,
      fixRecommendations,
      impactAssessment,
      sessionId
    } = data;

    const date = new Date().toISOString().split('T')[0];

    return `# Technical Requirements Document: ${bugReport.title}

**Bug ID**: ${bugId}
**Debugging Session**: ${sessionId || 'N/A'}
**Created**: ${date}
**Status**: In Progress
**Severity**: ${bugReport.severity}

---

## Executive Summary

This TRD outlines the technical approach for resolving the bug: "${bugReport.title}".

**Root Cause**: ${rootCause.description}

**Fix Strategy**: ${this.summarizeFixStrategy(fixRecommendations)}

**Estimated Effort**: ${this.calculateTotalEffort(fixRecommendations)}

${impactAssessment ? this.buildImpactSummary(impactAssessment) : ''}

---

## 1. System Context & Constraints

### 1.1 Current Architecture

**Affected Components**:
${this.buildAffectedComponentsList(rootCause, fixRecommendations)}

**Integration Points**:
${this.buildIntegrationPoints(rootCause, fixRecommendations)}

### 1.2 Technical Constraints

**Framework Requirements**:
${this.buildFrameworkRequirements(fixRecommendations)}

**Dependencies**:
${rootCause.dependencies ? this.buildDependenciesList(rootCause.dependencies) : '- None identified'}

**Security Policies**:
- Follow standard security practices for bug fixes
- No introduction of new vulnerabilities
- Maintain existing authentication/authorization

---

## 2. Bug Analysis

### 2.1 Problem Description

${bugReport.description}

**Steps to Reproduce**:
${this.buildStepsToReproduce(bugReport)}

**Expected Behavior**:
${bugReport.expectedBehavior || 'Not specified'}

**Actual Behavior**:
${bugReport.actualBehavior || 'Not specified'}

### 2.2 Root Cause Analysis

${rootCause.description}

${rootCause.likelyFile ? `**Affected File**: \`${rootCause.likelyFile}\`` : ''}
${rootCause.likelyFunction ? `**Affected Function**: \`${rootCause.likelyFunction}\`` : ''}

${rootCause.stackTrace ? this.buildStackTraceSection(rootCause.stackTrace) : ''}

---

## 3. Fix Implementation Plan

### 3.1 Fix Recommendations

${this.buildFixRecommendationsList(fixRecommendations)}

### 3.2 Implementation Tasks

${this.buildImplementationTasks(fixRecommendations)}

---

## 4. Test Strategy

### 4.1 Unit Testing

- **Coverage Target**: ≥80%
- **Recreation Test**: Verify bug reproduction before fix
- **Regression Tests**: Ensure fix doesn't break existing functionality

${impactAssessment?.testStrategy ? this.buildTestStrategyDetails(impactAssessment.testStrategy) : ''}

### 4.2 Integration Testing

- **Coverage Target**: ≥70%
- **Component Integration**: Verify fix works across components
- **API Contract Testing**: Ensure no breaking changes

### 4.3 End-to-End Testing

${impactAssessment?.testStrategy?.e2e ? '- **Required**: System-wide changes require E2E validation' : '- **Optional**: E2E tests may be added for critical paths'}

---

## 5. Risk Assessment & Mitigation

${impactAssessment ? this.buildRiskAssessment(impactAssessment) : this.buildDefaultRiskAssessment()}

---

## 6. Deployment Strategy

### 6.1 Rollout Plan

1. **Code Review**: Comprehensive review by code-reviewer agent
2. **Testing**: Execute full test suite
3. **Staging Deployment**: Deploy to staging environment
4. **Production Deployment**: Deploy to production with monitoring

### 6.2 Rollback Procedures

- Maintain Git checkpoint before deployment
- Monitor error rates after deployment
- Rollback if error rate increases >10%

---

## 7. Definition of Done

${this.buildDefinitionOfDone(fixRecommendations, impactAssessment)}

---

## 8. Session Metadata

**Debugging Session**: ${sessionId || 'N/A'}
**Generated**: ${new Date().toISOString()}
**Template**: @docs/agentos/TRD.md

---

_Generated by Deep Debugger for AI-Mesh_
`;
  }

  /**
   * Generate file path for TRD
   *
   * @param {string} bugId - Bug identifier
   * @returns {string} File path
   * @private
   */
  generateFilePath(bugId) {
    const sanitized = bugId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    return path.join(this.trdDirectory, `debug-${sanitized}-trd.md`);
  }

  /**
   * Summarize fix strategy
   *
   * @param {Object[]} recommendations - Fix recommendations
   * @returns {string} Strategy summary
   * @private
   */
  summarizeFixStrategy(recommendations) {
    if (recommendations.length === 1) {
      return recommendations[0].description;
    }
    return `Multi-step approach with ${recommendations.length} recommendations`;
  }

  /**
   * Calculate total effort
   *
   * @param {Object[]} recommendations - Fix recommendations
   * @returns {string} Total effort
   * @private
   */
  calculateTotalEffort(recommendations) {
    const total = recommendations.reduce((sum, rec) => sum + (rec.estimatedTime || 0), 0);
    return `${total} hours`;
  }

  /**
   * Build impact summary
   *
   * @param {Object} impact - Impact assessment
   * @returns {string} Impact summary
   * @private
   */
  buildImpactSummary(impact) {
    return `
**Impact Assessment**:
- Regression Risk: ${impact.regressionRisk}
- Affected Features: ${(impact.affectedFeatures || []).length}
- User Impact: ${impact.userImpact}
`;
  }

  /**
   * Build affected components list
   *
   * @param {Object} rootCause - Root cause
   * @param {Object[]} recommendations - Fix recommendations
   * @returns {string} Components list
   * @private
   */
  buildAffectedComponentsList(rootCause, recommendations) {
    const files = new Set();

    if (rootCause.likelyFile) files.add(rootCause.likelyFile);

    recommendations.forEach(rec => {
      if (rec.affectedFiles) {
        rec.affectedFiles.forEach(f => files.add(f));
      }
    });

    if (files.size === 0) return '- None specified';

    return Array.from(files).map(f => `- \`${f}\``).join('\n');
  }

  /**
   * Build integration points
   *
   * @param {Object} rootCause - Root cause
   * @param {Object[]} recommendations - Fix recommendations
   * @returns {string} Integration points
   * @private
   */
  buildIntegrationPoints(rootCause, recommendations) {
    return '- To be determined during implementation';
  }

  /**
   * Build framework requirements
   *
   * @param {Object[]} recommendations - Fix recommendations
   * @returns {string} Framework requirements
   * @private
   */
  buildFrameworkRequirements(recommendations) {
    const frameworks = new Set();
    recommendations.forEach(rec => {
      if (rec.framework) frameworks.add(rec.framework);
    });

    if (frameworks.size === 0) return '- Generic (no specific framework)';

    return Array.from(frameworks).map(f => `- ${f}`).join('\n');
  }

  /**
   * Build dependencies list
   *
   * @param {Object} dependencies - Dependencies object
   * @returns {string} Dependencies list
   * @private
   */
  buildDependenciesList(dependencies) {
    const external = dependencies.external || [];
    const internal = dependencies.internal || [];

    const lines = [];
    if (external.length > 0) {
      lines.push('**External**:');
      external.forEach(dep => lines.push(`- ${dep}`));
    }
    if (internal.length > 0) {
      lines.push('**Internal**:');
      internal.forEach(dep => lines.push(`- ${dep}`));
    }

    return lines.length > 0 ? lines.join('\n') : '- None identified';
  }

  /**
   * Build steps to reproduce
   *
   * @param {Object} bugReport - Bug report
   * @returns {string} Steps list
   * @private
   */
  buildStepsToReproduce(bugReport) {
    if (bugReport.stepsToReproduce && Array.isArray(bugReport.stepsToReproduce)) {
      return bugReport.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`).join('\n');
    }
    return '1. See bug description';
  }

  /**
   * Build stack trace section
   *
   * @param {Object} stackTrace - Stack trace
   * @returns {string} Stack trace section
   * @private
   */
  buildStackTraceSection(stackTrace) {
    return `
**Stack Trace**:
\`\`\`
${stackTrace.raw || JSON.stringify(stackTrace, null, 2)}
\`\`\`
`;
  }

  /**
   * Build fix recommendations list
   *
   * @param {Object[]} recommendations - Fix recommendations
   * @returns {string} Recommendations list
   * @private
   */
  buildFixRecommendationsList(recommendations) {
    return recommendations
      .map((rec, i) => `
#### Recommendation ${i + 1}: ${rec.description}

- **Priority**: ${rec.priority}
- **Complexity**: ${rec.complexity}
- **Estimated Time**: ${rec.estimatedTime}h
- **Specialist Agent**: ${rec.specialistAgent || 'backend-developer'}
${rec.affectedFiles ? `- **Affected Files**: ${rec.affectedFiles.map(f => `\`${f}\``).join(', ')}` : ''}
`)
      .join('\n');
  }

  /**
   * Build implementation tasks
   *
   * @param {Object[]} recommendations - Fix recommendations
   * @returns {string} Tasks with checkboxes
   * @private
   */
  buildImplementationTasks(recommendations) {
    return recommendations
      .map((rec, i) => `- [ ] **Task ${i + 1}**: ${rec.description} (${rec.estimatedTime}h)`)
      .join('\n');
  }

  /**
   * Build test strategy details
   *
   * @param {Object} strategy - Test strategy
   * @returns {string} Strategy details
   * @private
   */
  buildTestStrategyDetails(strategy) {
    return `
**Test Requirements**:
- Unit Tests: ${strategy.unit ? 'Required' : 'Optional'}
- Integration Tests: ${strategy.integration ? 'Required' : 'Optional'}
- E2E Tests: ${strategy.e2e ? 'Required' : 'Optional'}
- Coverage Target: ${strategy.coverageTarget}%
`;
  }

  /**
   * Build risk assessment
   *
   * @param {Object} impact - Impact assessment
   * @returns {string} Risk assessment
   * @private
   */
  buildRiskAssessment(impact) {
    return `
### 5.1 Regression Risk

**Risk Level**: ${impact.regressionRisk}

### 5.2 Mitigation Strategies

${(impact.riskMitigation || []).map(strategy => `- ${strategy}`).join('\n')}
`;
  }

  /**
   * Build default risk assessment
   *
   * @returns {string} Default risk assessment
   * @private
   */
  buildDefaultRiskAssessment() {
    return `
### 5.1 Regression Risk

**Risk Level**: Medium (default for complex bugs)

### 5.2 Mitigation Strategies

- Conduct thorough code review before merging
- Execute full test suite
- Monitor production metrics after deployment
`;
  }

  /**
   * Build definition of done
   *
   * @param {Object[]} recommendations - Fix recommendations
   * @param {Object} impact - Impact assessment
   * @returns {string} Definition of done
   * @private
   */
  buildDefinitionOfDone(recommendations, impact) {
    const tasks = recommendations.map((rec, i) => `- [ ] Task ${i + 1} implemented and tested`);

    return `
${tasks.join('\n')}
- [ ] All unit tests passing (≥80% coverage)
- [ ] All integration tests passing (≥70% coverage)
${impact?.testStrategy?.e2e ? '- [ ] E2E tests passing' : ''}
- [ ] Code review completed
- [ ] Security scan passed
- [ ] Documentation updated
- [ ] PR created and approved
`;
  }
}

module.exports = TRDGenerator;
