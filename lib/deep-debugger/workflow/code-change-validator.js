/**
 * Code Change Validation Module
 *
 * Validates code changes from specialist agents to ensure they meet quality standards.
 *
 * Responsibilities:
 * - Parse CodeDiff array from specialist response
 * - Validate changes limited to affected components
 * - Check for unexpected file modifications
 * - Calculate lines added/removed metrics
 * - Generate diff summary for review
 *
 * Validation Rules:
 * - Changes must be in expected file paths
 * - No modifications to unrelated components
 * - Reasonable change size (configurable threshold)
 * - Valid change types (added/modified/deleted)
 * - Diff content parseable
 *
 * @module lib/deep-debugger/workflow/code-change-validator
 */

class CodeChangeValidator {
  /**
   * Create code change validator
   *
   * @param {Object} options - Configuration options
   * @param {number} [options.maxLinesPerFile=500] - Max lines changed per file
   * @param {number} [options.maxTotalLines=2000] - Max total lines changed
   * @param {boolean} [options.strictPathValidation=true] - Enforce expected path restrictions
   * @param {Function} [options.logger] - Logging function
   */
  constructor(options = {}) {
    this.maxLinesPerFile = options.maxLinesPerFile || 500;
    this.maxTotalLines = options.maxTotalLines || 2000;
    this.strictPathValidation = options.strictPathValidation !== false;
    this.logger = options.logger || console.log;

    // Valid change types
    this.validChangeTypes = ['added', 'modified', 'deleted'];

    // File patterns to exclude from changes (framework files, configs, etc.)
    this.excludedPatterns = [
      /node_modules\//,
      /\.git\//,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/
    ];
  }

  /**
   * Validate code changes from specialist
   *
   * @param {Object} context - Validation context
   * @param {Object[]} context.codeChanges - Array of CodeDiff objects
   * @param {string[]} context.affectedFiles - Expected affected file paths
   * @param {string} context.component - Component being fixed
   * @param {Object} [context.constraints] - Additional constraints
   * @returns {Object} Validation result
   */
  validateCodeChanges(context) {
    this.validateContext(context);

    const { codeChanges, affectedFiles, component, constraints } = context;

    this.logger('\n[Code Change Validation] Starting validation...');
    this.logger(`  Changes count: ${codeChanges.length}`);
    this.logger(`  Expected files: ${affectedFiles.length}`);

    const validation = {
      passed: true,
      checks: {},
      warnings: [],
      metrics: {},
      failureReason: null
    };

    // Check 1: Parse all code changes
    validation.checks.allChangesParseable = true;
    const parsedChanges = [];

    for (const change of codeChanges) {
      try {
        const parsed = this.parseCodeChange(change);
        parsedChanges.push(parsed);
      } catch (error) {
        validation.checks.allChangesParseable = false;
        validation.passed = false;
        validation.failureReason = `Failed to parse change: ${error.message}`;
        return validation;
      }
    }

    // Check 2: Validate change types
    validation.checks.validChangeTypes = parsedChanges.every(
      change => this.validChangeTypes.includes(change.changeType)
    );

    if (!validation.checks.validChangeTypes) {
      validation.passed = false;
      validation.failureReason = 'Invalid change type detected';
      return validation;
    }

    // Check 3: Validate file paths in expected scope
    if (this.strictPathValidation) {
      const pathValidation = this.validateFilePaths(parsedChanges, affectedFiles, component);

      validation.checks.pathsInScope = pathValidation.valid;
      validation.warnings.push(...pathValidation.warnings);

      if (!pathValidation.valid) {
        validation.passed = false;
        validation.failureReason = pathValidation.failureReason;
        return validation;
      }
    }

    // Check 4: Validate no excluded files modified
    const excludedValidation = this.validateNoExcludedFiles(parsedChanges);

    validation.checks.noExcludedFiles = excludedValidation.valid;

    if (!excludedValidation.valid) {
      validation.passed = false;
      validation.failureReason = excludedValidation.failureReason;
      return validation;
    }

    // Check 5: Calculate and validate change metrics
    const metrics = this.calculateChangeMetrics(parsedChanges);

    validation.metrics = metrics;
    validation.checks.reasonableSize = true;

    // Per-file size check
    if (metrics.maxLinesPerFile > this.maxLinesPerFile) {
      validation.warnings.push(
        `Large change in single file: ${metrics.maxLinesPerFile} lines (max: ${this.maxLinesPerFile})`
      );

      if (constraints?.strictSizeEnforcement) {
        validation.checks.reasonableSize = false;
        validation.passed = false;
        validation.failureReason = `Single file change too large: ${metrics.maxLinesPerFile} lines`;
        return validation;
      }
    }

    // Total size check
    if (metrics.totalLinesChanged > this.maxTotalLines) {
      validation.warnings.push(
        `Large total change: ${metrics.totalLinesChanged} lines (max: ${this.maxTotalLines})`
      );

      if (constraints?.strictSizeEnforcement) {
        validation.checks.reasonableSize = false;
        validation.passed = false;
        validation.failureReason = `Total change too large: ${metrics.totalLinesChanged} lines`;
        return validation;
      }
    }

    // Check 6: Generate diff summary
    validation.diffSummary = this.generateDiffSummary(parsedChanges, metrics);

    this.logger('[Code Change Validation] ✅ Validation passed');
    this.logger(`  Files changed: ${metrics.filesChanged}`);
    this.logger(`  Lines added: ${metrics.linesAdded}`);
    this.logger(`  Lines removed: ${metrics.linesRemoved}`);
    this.logger(`  Net change: ${metrics.netChange}`);

    return validation;
  }

  /**
   * Parse single code change
   *
   * @param {Object} change - CodeDiff object
   * @returns {Object} Parsed change
   * @private
   */
  parseCodeChange(change) {
    if (!change.filePath) {
      throw new Error('CodeDiff missing filePath');
    }

    if (!change.changeType) {
      throw new Error(`CodeDiff for ${change.filePath} missing changeType`);
    }

    return {
      filePath: String(change.filePath),
      changeType: String(change.changeType),
      linesAdded: Number(change.linesAdded) || 0,
      linesRemoved: Number(change.linesRemoved) || 0,
      diffContent: change.diffContent || ''
    };
  }

  /**
   * Validate file paths are in expected scope
   *
   * @param {Object[]} changes - Parsed changes
   * @param {string[]} affectedFiles - Expected file paths
   * @param {string} component - Component name
   * @returns {Object} Path validation result
   * @private
   */
  validateFilePaths(changes, affectedFiles, component) {
    const result = {
      valid: true,
      warnings: [],
      failureReason: null
    };

    const unexpectedFiles = [];

    for (const change of changes) {
      const isExpected = affectedFiles.some(expectedPath =>
        change.filePath.includes(expectedPath) || expectedPath.includes(change.filePath)
      );

      if (!isExpected) {
        // Check if file is in component directory
        const inComponentDir = change.filePath.includes(component);

        if (!inComponentDir) {
          unexpectedFiles.push(change.filePath);
        } else {
          result.warnings.push(
            `File ${change.filePath} in component but not in expected files list`
          );
        }
      }
    }

    if (unexpectedFiles.length > 0) {
      result.valid = false;
      result.failureReason = `Unexpected files modified: ${unexpectedFiles.join(', ')}`;
    }

    return result;
  }

  /**
   * Validate no excluded files modified
   *
   * @param {Object[]} changes - Parsed changes
   * @returns {Object} Exclusion validation result
   * @private
   */
  validateNoExcludedFiles(changes) {
    const excludedFiles = [];

    for (const change of changes) {
      const isExcluded = this.excludedPatterns.some(pattern =>
        pattern.test(change.filePath)
      );

      if (isExcluded) {
        excludedFiles.push(change.filePath);
      }
    }

    if (excludedFiles.length > 0) {
      return {
        valid: false,
        failureReason: `Excluded files modified: ${excludedFiles.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Calculate change metrics
   *
   * @param {Object[]} changes - Parsed changes
   * @returns {Object} Change metrics
   * @private
   */
  calculateChangeMetrics(changes) {
    let totalAdded = 0;
    let totalRemoved = 0;
    let maxLines = 0;
    let largestFile = null;

    const fileMetrics = {};

    for (const change of changes) {
      const fileTotal = change.linesAdded + change.linesRemoved;

      totalAdded += change.linesAdded;
      totalRemoved += change.linesRemoved;

      if (fileTotal > maxLines) {
        maxLines = fileTotal;
        largestFile = change.filePath;
      }

      fileMetrics[change.filePath] = {
        added: change.linesAdded,
        removed: change.linesRemoved,
        total: fileTotal,
        changeType: change.changeType
      };
    }

    return {
      filesChanged: changes.length,
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
      totalLinesChanged: totalAdded + totalRemoved,
      netChange: totalAdded - totalRemoved,
      maxLinesPerFile: maxLines,
      largestFile,
      fileMetrics,
      changeTypes: {
        added: changes.filter(c => c.changeType === 'added').length,
        modified: changes.filter(c => c.changeType === 'modified').length,
        deleted: changes.filter(c => c.changeType === 'deleted').length
      }
    };
  }

  /**
   * Generate diff summary for review
   *
   * @param {Object[]} changes - Parsed changes
   * @param {Object} metrics - Change metrics
   * @returns {string} Diff summary
   * @private
   */
  generateDiffSummary(changes, metrics) {
    const lines = [];

    lines.push('## Code Change Summary\n');
    lines.push(`**Files Changed**: ${metrics.filesChanged}`);
    lines.push(`**Lines Added**: +${metrics.linesAdded}`);
    lines.push(`**Lines Removed**: -${metrics.linesRemoved}`);
    lines.push(`**Net Change**: ${metrics.netChange >= 0 ? '+' : ''}${metrics.netChange}`);
    lines.push('');

    lines.push('### Change Types');
    lines.push(`- Added: ${metrics.changeTypes.added} files`);
    lines.push(`- Modified: ${metrics.changeTypes.modified} files`);
    lines.push(`- Deleted: ${metrics.changeTypes.deleted} files`);
    lines.push('');

    if (metrics.largestFile) {
      lines.push('### Largest Change');
      lines.push(`- File: ${metrics.largestFile}`);
      lines.push(`- Lines: ${metrics.maxLinesPerFile}`);
      lines.push('');
    }

    lines.push('### Files Modified');
    for (const change of changes) {
      const metrics = `+${change.linesAdded}/-${change.linesRemoved}`;
      lines.push(`- **${change.changeType}**: ${change.filePath} (${metrics})`);
    }

    return lines.join('\n');
  }

  /**
   * Validate context
   *
   * @param {Object} context - Context to validate
   * @throws {Error} If context invalid
   * @private
   */
  validateContext(context) {
    if (!context) {
      throw new Error('Validation context is required');
    }

    if (!Array.isArray(context.codeChanges)) {
      throw new Error('codeChanges must be an array');
    }

    if (!Array.isArray(context.affectedFiles)) {
      throw new Error('affectedFiles must be an array');
    }

    if (!context.component) {
      throw new Error('component is required');
    }
  }

  /**
   * Build validation report
   *
   * @param {Object} validation - Validation result
   * @returns {Object} Formatted validation report
   */
  buildValidationReport(validation) {
    return {
      passed: validation.passed,
      checksPerformed: Object.keys(validation.checks).length,
      checkResults: validation.checks,
      warnings: validation.warnings,
      metrics: validation.metrics,
      diffSummary: validation.diffSummary,
      failureReason: validation.failureReason,
      recommendation: validation.passed
        ? 'Code changes approved for review'
        : 'Code changes require revision'
    };
  }
}

module.exports = CodeChangeValidator;
