/**
 * @fileoverview OutputFormatter class for formatting changelog data
 * @module changelog/formatter
 */

/**
 * Formats changelog data into various output formats (console, JSON, markdown)
 */
class OutputFormatter {
  /**
   * @param {Object} options - Formatter options
   * @param {string} [options.format='console'] - Output format: 'console', 'json', 'markdown'
   * @param {boolean} [options.colors=true] - Enable colored console output
   */
  constructor(options = {}) {
    this.outputFormat = options.format || 'console';
    this.colors = options.colors !== undefined ? options.colors : true;

    // Category symbols for visual identification
    this.categorySymbols = {
      breaking: '🔴',
      new: '✨',
      performance: '⚡',
      security: '🔒',
      deprecation: '⚠️',
      bugfix: '🐛',
      enhancement: '🔧',
      default: '📝'
    };

    // Category labels for headers
    this.categoryLabels = {
      breaking: 'Breaking Changes',
      new: 'New Features',
      performance: 'Performance Improvements',
      security: 'Security Updates',
      deprecation: 'Deprecations',
      bugfix: 'Bug Fixes',
      enhancement: 'Enhancements'
    };
  }

  /**
   * Format changelog data based on configured output format
   * @param {Object} changelog - Parsed changelog data
   * @returns {string} Formatted output
   */
  format(changelog) {
    switch (this.outputFormat) {
      case 'json':
        return this.formatJSON(changelog);
      case 'markdown':
        return this.formatMarkdown(changelog);
      case 'console':
      default:
        return this.formatConsole(changelog);
    }
  }

  /**
   * Format changelog for console output with colors and symbols
   * @private
   */
  formatConsole(changelog) {
    const lines = [];

    // Header
    lines.push('');
    lines.push(`═══════════════════════════════════════════════════════════════`);
    lines.push(`  Claude ${changelog.version} Release Notes`);
    lines.push(`  Released: ${this.formatDate(changelog.releaseDate)}`);
    lines.push(`═══════════════════════════════════════════════════════════════`);
    lines.push('');

    // Handle empty feature list
    if (!changelog.features || changelog.features.length === 0) {
      lines.push('No features found for this release.');
      lines.push('');
      return lines.join('\n');
    }

    // Group features by category
    const categorizedFeatures = this.groupByCategory(changelog.features);

    // Display features by category
    for (const [category, features] of Object.entries(categorizedFeatures)) {
      if (features.length === 0) continue;

      const symbol = this.getCategorySymbol(category);
      const label = this.categoryLabels[category] || category;

      lines.push(`${symbol} ${label.toUpperCase()}`);
      lines.push('─'.repeat(60));

      for (const feature of features) {
        const impactBadge = feature.impact === 'high' ? ' [HIGH IMPACT]' : '';
        lines.push(`  • ${feature.title}${impactBadge}`);

        if (feature.description) {
          lines.push(`    ${feature.description}`);
        }

        if (feature.migrationGuidance) {
          lines.push(`    ⚠️  Migration: ${feature.migrationGuidance}`);
        }

        lines.push('');
      }
    }

    // Summary statistics
    lines.push(this.formatSummary(changelog));

    return lines.join('\n');
  }

  /**
   * Format changelog as JSON
   * @private
   */
  formatJSON(changelog) {
    return JSON.stringify(changelog, null, 2);
  }

  /**
   * Format changelog as Markdown
   * @private
   */
  formatMarkdown(changelog) {
    const lines = [];

    // Header
    lines.push(`# Claude ${changelog.version}`);
    lines.push('');
    lines.push(`**Released:** ${this.formatDate(changelog.releaseDate)}`);
    lines.push('');

    // Handle empty feature list
    if (!changelog.features || changelog.features.length === 0) {
      lines.push('No features found for this release.');
      lines.push('');
      return lines.join('\n');
    }

    // Group features by category
    const categorizedFeatures = this.groupByCategory(changelog.features);

    // Display features by category
    for (const [category, features] of Object.entries(categorizedFeatures)) {
      if (features.length === 0) continue;

      const symbol = this.getCategorySymbol(category);
      const label = this.categoryLabels[category] || category;

      lines.push(`## ${symbol} ${label}`);
      lines.push('');

      for (const feature of features) {
        const impactBadge = feature.impact === 'high' ? ' **(High Impact)**' : '';
        lines.push(`- **${feature.title}**${impactBadge}`);

        if (feature.description) {
          lines.push(`  ${feature.description}`);
        }

        if (feature.migrationGuidance) {
          lines.push('');
          lines.push(`  > **Migration:** ${feature.migrationGuidance}`);
        }

        lines.push('');
      }
    }

    // Summary statistics
    lines.push('---');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(this.formatSummary(changelog).replace(/\n/g, '  \n'));

    return lines.join('\n');
  }

  /**
   * Format summary statistics
   * @param {Object} changelog - Changelog data
   * @returns {string} Formatted summary
   */
  formatSummary(changelog) {
    const lines = [];

    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('Summary:');

    // Count features by category
    const categoryCounts = {};
    let highImpactCount = 0;

    for (const feature of changelog.features || []) {
      categoryCounts[feature.category] = (categoryCounts[feature.category] || 0) + 1;
      if (feature.impact === 'high') {
        highImpactCount++;
      }
    }

    // Total changes
    const totalChanges = changelog.features?.length || 0;
    lines.push(`  Total Changes: ${totalChanges}`);

    // Category breakdown (only show non-zero counts)
    const categoryLabels = {
      breaking: 'Breaking',
      new: 'New Features',
      performance: 'Performance',
      security: 'Security',
      deprecation: 'Deprecations',
      bugfix: 'Bug Fixes',
      enhancement: 'Enhancements'
    };

    for (const [category, label] of Object.entries(categoryLabels)) {
      const count = categoryCounts[category];
      if (count > 0) {
        lines.push(`  ${label}: ${count}`);
      }
    }

    // High impact count
    if (highImpactCount > 0) {
      lines.push(`  High Impact: ${highImpactCount}`);
    }

    lines.push('───────────────────────────────────────────────────────────────');

    return lines.join('\n');
  }

  /**
   * Get Unicode symbol for category
   * @param {string} category - Feature category
   * @returns {string} Unicode symbol
   */
  getCategorySymbol(category) {
    return this.categorySymbols[category] || this.categorySymbols.default;
  }

  /**
   * Format date string to human-readable format
   * @param {string} dateStr - ISO date string or other format
   * @returns {string} Formatted date (e.g., "October 15, 2025")
   */
  formatDate(dateStr) {
    try {
      // Handle ISO date strings (YYYY-MM-DD) without timezone issues
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${months[month - 1]} ${day}, ${year}`;
      }

      // Handle full ISO strings with time
      const date = new Date(dateStr);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateStr;
      }

      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      // Use UTC methods to avoid timezone issues
      const month = months[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = date.getUTCFullYear();

      return `${month} ${day}, ${year}`;
    } catch (error) {
      return dateStr;
    }
  }

  /**
   * Group features by category
   * @private
   */
  groupByCategory(features) {
    const grouped = {
      breaking: [],
      security: [],
      new: [],
      performance: [],
      enhancement: [],
      deprecation: [],
      bugfix: []
    };

    for (const feature of features) {
      const category = feature.category || 'other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(feature);
    }

    return grouped;
  }
}

module.exports = { OutputFormatter };
