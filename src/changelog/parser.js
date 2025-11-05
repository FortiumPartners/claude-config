/**
 * Changelog Parser - Parses changelog HTML to extract version, release date, and features.
 * Uses pattern-based extraction with cheerio for HTML parsing.
 * @module changelog/parser
 */

const cheerio = require('cheerio');

class ChangelogParser {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Version patterns: "3.5.0", "v3.5", "Version 3.5.0"
    this.versionPattern = /(?:version|v)?\s*(\d+\.\d+(?:\.\d+)?)/gi;

    // Date format patterns
    this.datePatterns = [
      { regex: /\d{4}-\d{2}-\d{2}/, format: 'iso' },
      { regex: /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+\d{4}/i, format: 'natural' }
    ];

    // Section header patterns for 7 categories
    // Order matters: more specific patterns first to avoid false matches
    this.sectionHeaders = {
      breaking: /(?:breaking\s+changes?|backwards?\s+incompatible|migration)/i,
      new: /(?:new\s+features?|additions?|what'?s\s+new)/i,
      performance: /(?:performance\s+improvements?|performance|optimization|speed|faster)/i,
      security: /(?:security\s+updates?|security|vulnerability|CVE)/i,
      deprecation: /(?:deprecat(?:ed|ions?)|sunset|removed?)/i,
      bugfix: /(?:bug\s+fixes?|corrections?|patches?|fixed)/i,
      enhancement: /(?:improvements?|enhancements?|updates?)/i
    };
  }

  /**
   * Parse changelog HTML and extract structured data
   * @param {string} html - Changelog HTML content
   * @returns {Object} Parsed changelog with version, date, features, metadata
   */
  parse(html) {
    const $ = cheerio.load(html);

    const version = this.extractVersion($);
    const releaseDate = this.extractDate($);
    const features = this.extractFeatures($);

    return {
      version,
      releaseDate,
      features,
      metadata: {
        parsingConfidence: this.calculateConfidence(version, releaseDate, features)
      }
    };
  }

  /**
   * Extract version number from changelog
   * @private
   */
  extractVersion($) {
    const headings = $('h1, h2, h3').text();
    const match = headings.match(this.versionPattern);
    return match ? match[0].replace(/^[vV](?:ersion)?\s*/i, '') : null;
  }

  /**
   * Extract and normalize release date
   * @private
   */
  extractDate($) {
    const text = $('h1, h2, h3').text();

    for (const pattern of this.datePatterns) {
      const match = text.match(pattern.regex);
      if (match) {
        return this.normalizeDate(match[0], pattern.format);
      }
    }

    return null;
  }

  /**
   * Normalize date to ISO 8601 format (YYYY-MM-DD)
   * @private
   */
  normalizeDate(dateString, format) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract all features from changelog sections
   * @private
   */
  extractFeatures($) {
    const features = [];

    $('h2, h3').each((i, elem) => {
      const heading = $(elem).text();
      const category = this.categorizeSection(heading);

      if (category) {
        const content = this.extractSectionContent($, elem);
        const sectionFeatures = this.parseSectionFeatures($, content, category);
        features.push(...sectionFeatures);
      }
    });

    return features;
  }

  /**
   * Determine category from section heading
   * @private
   */
  categorizeSection(heading) {
    for (const [category, pattern] of Object.entries(this.sectionHeaders)) {
      if (pattern.test(heading)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Get content until next heading
   * @private
   */
  extractSectionContent($, headingElem) {
    return $(headingElem).nextUntil('h2, h3');
  }

  /**
   * Parse individual features from section content
   * @private
   */
  parseSectionFeatures($, content, category) {
    const features = [];

    content.filter('ul').find('li').each((i, elem) => {
      const text = $(elem).text();
      if (text.trim().length < 10) return; // Skip very short items

      const feature = {
        id: this.generateFeatureId(category, i),
        title: this.extractTitle($(elem)),
        description: text.trim(),
        category
      };

      features.push(feature);
    });

    return features;
  }

  /**
   * Generate unique feature ID
   * @private
   */
  generateFeatureId(category, index) {
    return `${category}-${Date.now()}-${index}`;
  }

  /**
   * Extract feature title from list item
   * @private
   */
  extractTitle($elem) {
    // Try <strong> tag first
    const strong = $elem.find('strong').first();
    if (strong.length) {
      return strong.text().replace(/:$/, '').trim();
    }

    // Try text before colon
    const text = $elem.text();
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0 && colonIndex < 80) {
      return text.substring(0, colonIndex).trim();
    }

    // Fallback to first 60 characters
    return text.substring(0, 60).trim();
  }

  /**
   * Calculate parsing confidence score (0.0 to 1.0)
   * @private
   */
  calculateConfidence(version, releaseDate, features) {
    let score = 0;

    // Version found: +0.3
    if (version) score += 0.3;

    // Release date found: +0.2
    if (releaseDate) score += 0.2;

    // Features found: up to +0.5
    if (features.length >= 10) score += 0.5;
    else if (features.length >= 5) score += 0.3;
    else if (features.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }
}

/**
 * Validate changelog data structure
 * @param {Object} changelog - Parsed changelog object
 * @throws {Error} If validation fails
 * @returns {boolean} True if valid
 */
function validateChangelog(changelog) {
  if (!changelog.version) {
    throw new Error('Missing version in changelog');
  }

  if (!changelog.releaseDate) {
    throw new Error('Missing releaseDate in changelog');
  }

  if (!Array.isArray(changelog.features)) {
    throw new Error('Missing or invalid features array');
  }

  // Validate semver format (allow X.Y or X.Y.Z)
  const versionRegex = /^\d+\.\d+(?:\.\d+)?$/;
  if (!versionRegex.test(changelog.version)) {
    throw new Error(`Invalid semver format: ${changelog.version}`);
  }

  // Validate ISO 8601 date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(changelog.releaseDate)) {
    throw new Error(`Invalid date format: ${changelog.releaseDate}. Expected YYYY-MM-DD`);
  }

  return true;
}

/**
 * Enrich changelog with additional metadata
 * @param {Object} changelog - Parsed changelog
 * @param {Object} options - Enrichment options
 * @returns {Object} Enriched changelog
 */
function enrichChangelog(changelog, options = {}) {
  return {
    ...changelog,
    metadata: {
      ...(changelog.metadata || {}),
      source: options.source || 'https://docs.anthropic.com/en/release-notes/',
      enrichedAt: new Date().toISOString()
    }
  };
}

module.exports = { ChangelogParser, validateChangelog, enrichChangelog };
