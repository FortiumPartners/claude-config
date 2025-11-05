/**
 * @fileoverview ChangelogWorkflow - Main orchestration for changelog command
 * @module changelog/workflow
 */

const { ChangelogFetcher } = require('./fetcher');
const { CacheManager } = require('./cache');
const { ChangelogParser } = require('./parser');
const { FeatureCategorizer } = require('./categorizer');
const { OutputFormatter } = require('./formatter');
const { CLIInterface } = require('./cli-interface');

/**
 * Main workflow orchestration for changelog command
 */
class ChangelogWorkflow {
  constructor(options = {}) {
    this.fetcher = options.fetcher || new ChangelogFetcher();
    this.cache = options.cache || new CacheManager();
    this.parser = options.parser || new ChangelogParser();
    this.categorizer = options.categorizer || new FeatureCategorizer();
    this.formatter = options.formatter || new OutputFormatter();
    this.cli = options.cli || new CLIInterface();

    this.url = 'https://docs.anthropic.com/en/release-notes/';
  }

  /**
   * Execute complete workflow
   * @param {Object} params - Command parameters
   * @returns {Promise<string>} Formatted output
   */
  async execute(params) {
    // Handle help flag
    if (params.help) {
      return this.cli.getHelpText();
    }

    // Validate parameters
    const validation = this.cli.validateParameters(params);
    if (!validation.valid) {
      return this.cli.formatError(validation.errors);
    }

    try {
      // Step 1: Fetch changelog (with cache)
      const changelog = await this.fetchChangelog(params);

      // Step 2: Apply filters
      const filtered = await this.applyFilters(changelog, params);

      // Step 3: Format output
      const output = await this.formatOutput(filtered, params);

      return output;
    } catch (error) {
      return this.cli.formatError(
        error.message,
        'Try using --refresh to clear cache or check your network connection'
      );
    }
  }

  /**
   * Fetch changelog with caching
   * @param {Object} params - Fetch parameters
   * @returns {Promise<Object>} Parsed changelog
   */
  async fetchChangelog(params) {
    const version = params.version || 'latest';

    // Check cache first (unless refresh requested)
    if (!params.refresh) {
      const cached = await this.cache.get(version);
      if (cached && !cached._stale) {
        return cached;
      }
    }

    // Fetch from network
    const html = await this.fetcher.fetch(this.url);

    // Parse HTML
    const parsed = await this.parseChangelog(html);

    // Cache the result
    await this.cache.set(version, parsed);

    return parsed;
  }

  /**
   * Parse HTML changelog
   * @param {string} html - Raw HTML content
   * @returns {Promise<Object>} Parsed changelog
   */
  async parseChangelog(html) {
    // Parse HTML structure
    const parsed = this.parser.parse(html);

    // Categorize and enhance features
    const enhanced = await this.categorizeFeatures(parsed.features || []);

    return {
      ...parsed,
      features: enhanced
    };
  }

  /**
   * Categorize and enhance features
   * @param {Array} features - Raw features
   * @returns {Promise<Array>} Enhanced features
   */
  async categorizeFeatures(features) {
    if (!features || features.length === 0) {
      return [];
    }

    return features.map(feature => this.categorizer.enhance(feature));
  }

  /**
   * Apply filters to changelog
   * @param {Object} changelog - Parsed changelog
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object>} Filtered changelog
   */
  async applyFilters(changelog, params) {
    let filteredFeatures = [...(changelog.features || [])];

    // Filter by category
    if (params.category) {
      const categories = Array.isArray(params.category)
        ? params.category
        : [params.category];

      filteredFeatures = filteredFeatures.filter(f =>
        categories.includes(f.category)
      );
    }

    // Filter by importance (high impact only)
    if (params.important) {
      filteredFeatures = filteredFeatures.filter(f =>
        f.impact === 'high'
      );
    }

    return {
      ...changelog,
      features: filteredFeatures
    };
  }

  /**
   * Format output according to specified format
   * @param {Object} changelog - Filtered changelog
   * @param {Object} params - Format parameters
   * @returns {Promise<string>} Formatted output
   */
  async formatOutput(changelog, params) {
    const formatter = new OutputFormatter({
      format: params.format || 'console'
    });

    return formatter.format(changelog);
  }
}

module.exports = { ChangelogWorkflow };
