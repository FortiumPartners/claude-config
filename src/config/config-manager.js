/**
 * Configuration manager for file monitoring service and agent integrations
 * Handles loading, merging, and validation of monitoring configurations
 */

const fs = require('fs').promises
const path = require('path')

class ConfigManager {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(__dirname, 'monitoring-config.json')
        this.config = null
        this.environment = process.env.NODE_ENV || 'development'
    }

    /**
     * Load and parse configuration file
     * @returns {Promise<object>} - Parsed configuration
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf8')
            const baseConfig = JSON.parse(configData)
            
            // Apply environment overrides
            this.config = this._mergeEnvironmentConfig(baseConfig)
            
            // Validate configuration
            this._validateConfig(this.config)
            
            return this.config
        } catch (error) {
            throw new Error(`Failed to load configuration: ${error.message}`)
        }
    }

    /**
     * Get configuration for a specific agent
     * @param {string} agentId - Agent identifier
     * @returns {object} - Agent-specific configuration
     */
    getAgentConfig(agentId) {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.')
        }

        const agentConfig = this.config.agentConfigurations[agentId]
        if (!agentConfig) {
            throw new Error(`Configuration not found for agent: ${agentId}`)
        }

        // Merge with global defaults
        return {
            ...this.config.globalDefaults,
            ...agentConfig,
            options: {
                ...this.config.globalDefaults,
                ...agentConfig.options
            }
        }
    }

    /**
     * Get patterns for a specific category
     * @param {string} category - Pattern category (documentation, frontend, etc.)
     * @returns {string[]} - Array of file patterns
     */
    getPatternsByCategory(category) {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.')
        }

        return this.config.customPatterns[category] || []
    }

    /**
     * Get all enabled agent configurations
     * @returns {object} - Map of enabled agent configurations
     */
    getEnabledAgents() {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.')
        }

        const enabled = {}
        Object.entries(this.config.agentConfigurations).forEach(([agentId, config]) => {
            if (config.enabled) {
                enabled[agentId] = this.getAgentConfig(agentId)
            }
        })

        return enabled
    }

    /**
     * Update agent configuration
     * @param {string} agentId - Agent identifier
     * @param {object} updates - Configuration updates
     * @returns {object} - Updated configuration
     */
    updateAgentConfig(agentId, updates) {
        if (!this.config) {
            throw new Error('Configuration not loaded. Call loadConfig() first.')
        }

        if (!this.config.agentConfigurations[agentId]) {
            throw new Error(`Agent configuration not found: ${agentId}`)
        }

        // Deep merge updates
        this.config.agentConfigurations[agentId] = this._deepMerge(
            this.config.agentConfigurations[agentId],
            updates
        )

        return this.getAgentConfig(agentId)
    }

    /**
     * Save configuration to file
     * @returns {Promise<boolean>} - Success status
     */
    async saveConfig() {
        if (!this.config) {
            throw new Error('No configuration to save')
        }

        try {
            // Update timestamp
            this.config.lastUpdated = new Date().toISOString()
            
            const configData = JSON.stringify(this.config, null, 2)
            await fs.writeFile(this.configPath, configData, 'utf8')
            
            return true
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error.message}`)
        }
    }

    /**
     * Validate agent subscription configuration
     * @param {string} agentId - Agent identifier
     * @param {object} subscription - Subscription configuration to validate
     * @returns {boolean} - True if valid
     */
    validateSubscription(agentId, subscription) {
        const agentConfig = this.getAgentConfig(agentId)
        
        // Check required fields
        const required = ['eventTypes', 'patterns']
        for (const field of required) {
            if (!subscription[field] || !Array.isArray(subscription[field])) {
                throw new Error(`Invalid subscription: ${field} must be an array`)
            }
        }

        // Validate event types
        const validEventTypes = ['fileCreated', 'fileModified', 'fileDeleted', 'directoryCreated', 'directoryDeleted']
        subscription.eventTypes.forEach(eventType => {
            if (!validEventTypes.includes(eventType)) {
                throw new Error(`Invalid event type: ${eventType}`)
            }
        })

        // Validate patterns
        subscription.patterns.forEach(pattern => {
            if (typeof pattern !== 'string' || pattern.length === 0) {
                throw new Error(`Invalid pattern: ${pattern}`)
            }
        })

        return true
    }

    /**
     * Create monitoring service configuration from agent config
     * @param {string} agentId - Agent identifier  
     * @returns {object} - MonitoringAPI compatible configuration
     */
    createServiceConfig(agentId) {
        const agentConfig = this.getAgentConfig(agentId)
        
        return {
            debounceTime: agentConfig.options.debounceTime || agentConfig.debounceTime,
            patterns: agentConfig.patterns,
            ignorePatterns: agentConfig.ignorePatterns || this.config.globalDefaults.ignorePatterns
        }
    }

    // Private helper methods

    /**
     * Merge environment-specific overrides
     * @param {object} baseConfig - Base configuration
     * @returns {object} - Merged configuration
     * @private
     */
    _mergeEnvironmentConfig(baseConfig) {
        const envOverrides = baseConfig.environmentOverrides?.[this.environment]
        if (!envOverrides) {
            return baseConfig
        }

        return this._deepMerge(baseConfig, envOverrides)
    }

    /**
     * Deep merge two objects
     * @param {object} target - Target object
     * @param {object} source - Source object
     * @returns {object} - Merged object
     * @private
     */
    _deepMerge(target, source) {
        const result = { ...target }
        
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._deepMerge(result[key] || {}, source[key])
            } else {
                result[key] = source[key]
            }
        })
        
        return result
    }

    /**
     * Validate configuration structure
     * @param {object} config - Configuration to validate
     * @private
     */
    _validateConfig(config) {
        // Check required top-level properties
        const required = ['version', 'globalDefaults', 'agentConfigurations']
        required.forEach(prop => {
            if (!config[prop]) {
                throw new Error(`Missing required configuration property: ${prop}`)
            }
        })

        // Validate agent configurations
        Object.entries(config.agentConfigurations).forEach(([agentId, agentConfig]) => {
            const requiredAgentProps = ['description', 'enabled', 'patterns', 'eventTypes']
            requiredAgentProps.forEach(prop => {
                if (agentConfig[prop] === undefined) {
                    throw new Error(`Missing required property '${prop}' for agent: ${agentId}`)
                }
            })

            // Validate patterns array
            if (!Array.isArray(agentConfig.patterns)) {
                throw new Error(`Agent '${agentId}' patterns must be an array`)
            }

            // Validate event types array
            if (!Array.isArray(agentConfig.eventTypes)) {
                throw new Error(`Agent '${agentId}' eventTypes must be an array`)
            }
        })
    }

    /**
     * Get configuration summary for debugging
     * @returns {object} - Configuration summary
     */
    getSummary() {
        if (!this.config) {
            return { error: 'Configuration not loaded' }
        }

        const enabledAgents = Object.entries(this.config.agentConfigurations)
            .filter(([_, config]) => config.enabled)
            .map(([agentId, _]) => agentId)

        return {
            version: this.config.version,
            environment: this.environment,
            lastUpdated: this.config.lastUpdated,
            totalAgents: Object.keys(this.config.agentConfigurations).length,
            enabledAgents,
            customPatternCategories: Object.keys(this.config.customPatterns || {}),
            globalDefaults: this.config.globalDefaults
        }
    }
}

module.exports = { ConfigManager }