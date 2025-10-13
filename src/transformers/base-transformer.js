/**
 * Base Transformer Interface
 * Abstract base class for tool-specific transformers
 */

class BaseTransformer {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Transform parsed agent data to tool-specific format
   * @param {Object} agentData - Parsed agent data from YAML
   * @returns {Promise<string>} Tool-specific formatted output
   */
  async transformAgent(agentData) {
    throw new Error('transformAgent() must be implemented by subclass');
  }

  /**
   * Transform parsed command data to tool-specific format
   * @param {Object} commandData - Parsed command data from YAML
   * @returns {Promise<string>} Tool-specific formatted output
   */
  async transformCommand(commandData) {
    throw new Error('transformCommand() must be implemented by subclass');
  }

  /**
   * Get file extension for transformed output
   * @returns {string} File extension (e.g., '.md', '.txt')
   */
  getFileExtension() {
    return '.md';
  }

  /**
   * Get tool name
   * @returns {string} Tool name (e.g., 'claude', 'opencode')
   */
  getToolName() {
    return 'base';
  }

  /**
   * Helper: Convert array to bulleted list
   * @param {Array<string>} items - Array of strings
   * @param {string} prefix - Bullet character (default: '- ')
   * @returns {string} Formatted list
   */
  formatList(items, prefix = '- ') {
    if (!items || items.length === 0) return '';
    return items.map(item => `${prefix}${item}`).join('\n');
  }

  /**
   * Helper: Format a section with header
   * @param {string} title - Section title
   * @param {string} content - Section content
   * @param {number} level - Header level (default: 2)
   * @returns {string} Formatted section
   */
  formatSection(title, content, level = 2) {
    if (!content || content.trim().length === 0) return '';
    
    const header = '#'.repeat(level);
    return `${header} ${title}\n\n${content}\n`;
  }

  /**
   * Helper: Wrap code in fenced code block
   * @param {string} code - Code content
   * @param {string} language - Language identifier
   * @returns {string} Fenced code block
   */
  formatCodeBlock(code, language = '') {
    if (!code) return '';
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  /**
   * Helper: Create checkbox list
   * @param {Array<string>} items - Array of items
   * @param {boolean} checked - Whether boxes are checked
   * @returns {string} Checkbox list
   */
  formatCheckboxList(items, checked = false) {
    if (!items || items.length === 0) return '';
    const checkbox = checked ? '[x]' : '[ ]';
    return items.map(item => `- ${checkbox} ${item}`).join('\n');
  }

  /**
   * Helper: Sanitize text for output
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitize(text) {
    if (!text) return '';
    return text.toString().trim();
  }

  /**
   * Helper: Format metadata as YAML frontmatter
   * @param {Object} metadata - Metadata object
   * @returns {string} YAML frontmatter
   */
  formatYamlFrontmatter(metadata) {
    const lines = ['---'];
    
    Object.entries(metadata).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return;
        
        if (value.length === 1) {
          lines.push(`${key}: ${value[0]}`);
        } else {
          lines.push(`${key}:`);
          value.forEach(item => lines.push(`  - ${item}`));
        }
      } else if (typeof value === 'object' && value !== null) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    });
    
    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Helper: Create a table
   * @param {Array<string>} headers - Table headers
   * @param {Array<Array<string>>} rows - Table rows
   * @returns {string} Markdown table
   */
  formatTable(headers, rows) {
    if (!headers || headers.length === 0 || !rows || rows.length === 0) {
      return '';
    }

    const lines = [];
    
    // Header row
    lines.push(`| ${headers.join(' | ')} |`);
    
    // Separator row
    lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
    
    // Data rows
    rows.forEach(row => {
      lines.push(`| ${row.join(' | ')} |`);
    });
    
    return lines.join('\n');
  }

  /**
   * Helper: Format a badge or emoji indicator
   * @param {string} priority - Priority level
   * @returns {string} Badge or emoji
   */
  formatPriorityBadge(priority) {
    const badges = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };
    return badges[priority] || '';
  }
}

module.exports = { BaseTransformer };
