/**
 * Transformer Factory
 * Creates and manages transformer instances for different tools
 */

const { ClaudeTransformer } = require('./claude-transformer');
const { OpenCodeTransformer } = require('./opencode-transformer');

class TransformerFactory {
  constructor(logger) {
    this.logger = logger;
    this.transformers = new Map();
    this.registerDefaultTransformers();
  }

  /**
   * Register default transformers
   */
  registerDefaultTransformers() {
    this.register('claude', new ClaudeTransformer(this.logger));
    this.register('opencode', new OpenCodeTransformer(this.logger));
    
    // Aliases
    this.register('claudecode', this.transformers.get('claude'));
    this.register('claude-code', this.transformers.get('claude'));
  }

  /**
   * Register a transformer
   * @param {string} toolName - Tool name identifier
   * @param {BaseTransformer} transformer - Transformer instance
   */
  register(toolName, transformer) {
    this.transformers.set(toolName.toLowerCase(), transformer);
    this.logger.debug(`Registered transformer for: ${toolName}`);
  }

  /**
   * Get transformer for a specific tool
   * @param {string} toolName - Tool name
   * @returns {BaseTransformer} Transformer instance
   */
  getTransformer(toolName) {
    const normalizedName = toolName.toLowerCase();
    const transformer = this.transformers.get(normalizedName);
    
    if (!transformer) {
      const available = this.getSupportedTools();
      throw new Error(
        `No transformer registered for tool: ${toolName}\n` +
        `Supported tools: ${available.join(', ')}`
      );
    }
    
    return transformer;
  }

  /**
   * Check if a tool is supported
   * @param {string} toolName - Tool name
   * @returns {boolean}
   */
  isSupported(toolName) {
    return this.transformers.has(toolName.toLowerCase());
  }

  /**
   * Get list of supported tools
   * @returns {Array<string>} Tool names
   */
  getSupportedTools() {
    // Get unique tool names (excluding aliases)
    const tools = [];
    const seen = new Set();
    
    for (const [name, transformer] of this.transformers.entries()) {
      const toolName = transformer.getToolName();
      if (!seen.has(toolName)) {
        tools.push(name);
        seen.add(toolName);
      }
    }
    
    return tools.sort();
  }

  /**
   * Get all registered transformer names (including aliases)
   * @returns {Array<string>} All registered names
   */
  getAllNames() {
    return Array.from(this.transformers.keys()).sort();
  }
}

module.exports = { TransformerFactory };
