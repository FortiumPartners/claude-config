// Task 1.5: Add configuration system for monitoring rules and exclusions
const fs = require('fs').promises
const path = require('path')
const { EventEmitter } = require('events')

class ConfigManager extends EventEmitter {
	constructor(configPath = null) {
		super()
		
		this.configPath = configPath || this._getDefaultConfigPath()
		this.config = this._getDefaultConfig()
		this.watcherConfig = null
	}

	/**
	 * Get the default configuration path
	 * @returns {string} - Default config file path
	 * @private
	 */
	_getDefaultConfigPath() {
		return path.join(process.cwd(), 'file-monitor.config.json')
	}

	/**
	 * Get default configuration values
	 * @returns {object} - Default configuration
	 * @private
	 */
	_getDefaultConfig() {
		return {
			debounceTime: 100,
			maxWatchDepth: 10,
			watcherOptions: {
				ignoreInitial: true,
				persistent: true,
				awaitWriteFinish: {
					stabilityThreshold: 100,
					pollInterval: 100
				}
			},
			patterns: {
				include: [
					'**/*.js',
					'**/*.ts',
					'**/*.json',
					'**/*.md',
					'**/*.yml',
					'**/*.yaml'
				],
				exclude: [
					'**/node_modules/**',
					'**/.git/**',
					'**/dist/**',
					'**/build/**',
					'**/.next/**',
					'**/.nuxt/**',
					'**/*.log',
					'**/.env*',
					'**/coverage/**',
					'**/.nyc_output/**'
				]
			},
			eventTypes: {
				fileCreated: { enabled: true, priority: 'high' },
				fileModified: { enabled: true, priority: 'medium' },
				fileDeleted: { enabled: true, priority: 'high' },
				directoryCreated: { enabled: false, priority: 'low' },
				directoryDeleted: { enabled: false, priority: 'low' }
			},
			performance: {
				maxConcurrentEvents: 50,
				eventQueueSize: 1000,
				memoryLimitMB: 100
			},
			logging: {
				enabled: true,
				level: 'info',
				file: 'file-monitor.log'
			}
		}
	}

	/**
	 * Load configuration from file
	 * @returns {Promise<object>} - Loaded configuration
	 */
	async loadConfig() {
		try {
			const configExists = await this._fileExists(this.configPath)
			
			if (configExists) {
				const configData = await fs.readFile(this.configPath, 'utf8')
				const loadedConfig = JSON.parse(configData)
				
				// Merge with defaults
				this.config = this._mergeConfigs(this._getDefaultConfig(), loadedConfig)
				
				this.emit('configLoaded', { path: this.configPath, config: this.config })
			} else {
				// Use defaults and optionally create config file
				this.emit('configDefaulted', { config: this.config })
			}
			
			return this.config
			
		} catch (error) {
			this.emit('configError', error)
			throw new Error(`Failed to load configuration: ${error.message}`)
		}
	}

	/**
	 * Save current configuration to file
	 * @returns {Promise<boolean>} - True if saved successfully
	 */
	async saveConfig() {
		try {
			const configData = JSON.stringify(this.config, null, 2)
			await fs.writeFile(this.configPath, configData, 'utf8')
			
			this.emit('configSaved', { path: this.configPath })
			return true
			
		} catch (error) {
			this.emit('configError', error)
			throw new Error(`Failed to save configuration: ${error.message}`)
		}
	}

	/**
	 * Update configuration values
	 * @param {object} updates - Configuration updates
	 * @returns {object} - Updated configuration
	 */
	updateConfig(updates) {
		const previousConfig = { ...this.config }
		
		try {
			this.config = this._mergeConfigs(this.config, updates)
			this._validateConfig()
			
			this.emit('configUpdated', { 
				previous: previousConfig, 
				current: this.config 
			})
			
			return this.config
			
		} catch (error) {
			// Rollback on validation error
			this.config = previousConfig
			throw error
		}
	}

	/**
	 * Get configuration for file monitoring service
	 * @returns {object} - FileMonitoringService compatible config
	 */
	getMonitoringConfig() {
		return {
			debounceTime: this.config.debounceTime,
			patterns: this.config.patterns.include,
			ignorePatterns: this.config.patterns.exclude,
			watcherOptions: this.config.watcherOptions
		}
	}

	/**
	 * Add include pattern
	 * @param {string} pattern - Pattern to add
	 */
	addIncludePattern(pattern) {
		if (!this.config.patterns.include.includes(pattern)) {
			this.config.patterns.include.push(pattern)
			this.emit('patternAdded', { type: 'include', pattern })
		}
	}

	/**
	 * Remove include pattern
	 * @param {string} pattern - Pattern to remove
	 */
	removeIncludePattern(pattern) {
		const index = this.config.patterns.include.indexOf(pattern)
		if (index > -1) {
			this.config.patterns.include.splice(index, 1)
			this.emit('patternRemoved', { type: 'include', pattern })
		}
	}

	/**
	 * Add exclude pattern
	 * @param {string} pattern - Pattern to add
	 */
	addExcludePattern(pattern) {
		if (!this.config.patterns.exclude.includes(pattern)) {
			this.config.patterns.exclude.push(pattern)
			this.emit('patternAdded', { type: 'exclude', pattern })
		}
	}

	/**
	 * Remove exclude pattern
	 * @param {string} pattern - Pattern to remove
	 */
	removeExcludePattern(pattern) {
		const index = this.config.patterns.exclude.indexOf(pattern)
		if (index > -1) {
			this.config.patterns.exclude.splice(index, 1)
			this.emit('patternRemoved', { type: 'exclude', pattern })
		}
	}

	/**
	 * Reset configuration to defaults
	 */
	resetToDefaults() {
		const previousConfig = { ...this.config }
		this.config = this._getDefaultConfig()
		
		this.emit('configReset', { previous: previousConfig })
	}

	/**
	 * Validate configuration object
	 * @private
	 */
	_validateConfig() {
		const errors = []

		// Validate debounceTime
		if (typeof this.config.debounceTime !== 'number' || this.config.debounceTime < 0) {
			errors.push('debounceTime must be a non-negative number')
		}

		// Validate patterns
		if (!Array.isArray(this.config.patterns.include)) {
			errors.push('patterns.include must be an array')
		}

		if (!Array.isArray(this.config.patterns.exclude)) {
			errors.push('patterns.exclude must be an array')
		}

		// Validate performance settings
		if (this.config.performance.maxConcurrentEvents < 1) {
			errors.push('performance.maxConcurrentEvents must be positive')
		}

		if (errors.length > 0) {
			throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
		}
	}

	/**
	 * Deep merge two configuration objects
	 * @param {object} target - Target configuration
	 * @param {object} source - Source configuration
	 * @returns {object} - Merged configuration
	 * @private
	 */
	_mergeConfigs(target, source) {
		const result = { ...target }
		
		for (const key in source) {
			if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
				result[key] = this._mergeConfigs(target[key] || {}, source[key])
			} else {
				result[key] = source[key]
			}
		}
		
		return result
	}

	/**
	 * Check if file exists
	 * @param {string} filePath - Path to check
	 * @returns {Promise<boolean>} - True if file exists
	 * @private
	 */
	async _fileExists(filePath) {
		try {
			await fs.access(filePath)
			return true
		} catch {
			return false
		}
	}

	/**
	 * Create default configuration file
	 * @returns {Promise<boolean>} - True if created successfully
	 */
	async createDefaultConfigFile() {
		const configExists = await this._fileExists(this.configPath)
		
		if (!configExists) {
			await this.saveConfig()
			return true
		}
		
		return false
	}

	/**
	 * Get configuration as JSON string
	 * @param {boolean} pretty - Whether to format JSON nicely
	 * @returns {string} - Configuration as JSON
	 */
	toJSON(pretty = true) {
		return JSON.stringify(this.config, null, pretty ? 2 : 0)
	}

	/**
	 * Get current configuration
	 * @returns {object} - Current configuration
	 */
	getConfig() {
		return { ...this.config }
	}
}

module.exports = { ConfigManager }