// Task 1.2: Implement chokidar-based file watcher with configurable patterns
const chokidar = require('chokidar')
const { EventEmitter } = require('events')
const path = require('path')
const fs = require('fs').promises

class FileMonitoringService extends EventEmitter {
	constructor(config = {}) {
		super()
		
		// Default configuration
		this.config = {
			debounceTime: 100,
			patterns: ['**/*.js', '**/*.ts', '**/*.json', '**/*.md'],
			ignorePatterns: [
				'**/node_modules/**',
				'**/.git/**',
				'**/dist/**',
				'**/build/**',
				'**/*.log'
			],
			...config
		}
		
		// Validate configuration
		this._validateConfig()
		
		// Internal state
		this.watcher = null
		this.isMonitoring = false
		this.hasErrors = false
		this.watchedPaths = new Set()
		this.debounceTimers = new Map()
		
		// Bind methods to maintain context
		this._handleFileEvent = this._handleFileEvent.bind(this)
		this._handleError = this._handleError.bind(this)
	}

	/**
	 * Validate the configuration object
	 * @private
	 */
	_validateConfig() {
		if (!Array.isArray(this.config.patterns)) {
			throw new Error('Invalid configuration: patterns must be an array')
		}
		
		if (this.config.debounceTime < 0) {
			throw new Error('Invalid configuration: debounceTime must be non-negative')
		}
		
		if (this.config.ignorePatterns && !Array.isArray(this.config.ignorePatterns)) {
			throw new Error('Invalid configuration: ignorePatterns must be an array')
		}
	}

	/**
	 * Start monitoring the specified directory path
	 * @param {string} watchPath - Directory to monitor
	 * @returns {Promise<boolean>} - True if monitoring started successfully
	 */
	async startMonitoring(watchPath) {
		try {
			// Validate the watch path exists
			await this._validateWatchPath(watchPath)
			
			// Stop existing watcher if running
			if (this.isMonitoring) {
				await this.stopMonitoring()
			}
			
			// Configure chokidar options
			const watcherOptions = {
				ignored: this.config.ignorePatterns,
				ignoreInitial: true,
				persistent: true,
				depth: 99,
				awaitWriteFinish: {
					stabilityThreshold: 100,
					pollInterval: 100
				}
			}
			
			// Create and configure watcher
			this.watcher = chokidar.watch(watchPath, watcherOptions)
			
			// Set up event listeners
			this.watcher
				.on('add', (filePath, stats) => this._handleFileEvent('fileCreated', filePath, stats))
				.on('change', (filePath, stats) => this._handleFileEvent('fileModified', filePath, stats))
				.on('unlink', (filePath) => this._handleFileEvent('fileDeleted', filePath))
				.on('addDir', (dirPath) => this._handleFileEvent('directoryCreated', dirPath))
				.on('unlinkDir', (dirPath) => this._handleFileEvent('directoryDeleted', dirPath))
				.on('error', this._handleError)
				.on('ready', () => {
					this.isMonitoring = true
					this.hasErrors = false
					this.watchedPaths.add(watchPath)
					this.emit('ready', { watchPath, patterns: this.config.patterns })
				})
			
			// Wait for watcher to be ready
			await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Watcher initialization timeout'))
				}, 5000)
				
				this.watcher.on('ready', () => {
					clearTimeout(timeout)
					resolve()
				})
				
				this.watcher.on('error', (error) => {
					clearTimeout(timeout)
					reject(error)
				})
			})
			
			return true
			
		} catch (error) {
			this.hasErrors = true
			throw new Error(`Failed to start monitoring: ${error.message}`)
		}
	}

	/**
	 * Stop monitoring and clean up resources
	 * @returns {Promise<boolean>} - True if stopped successfully
	 */
	async stopMonitoring() {
		if (!this.watcher) {
			return true
		}
		
		try {
			// Clear any pending debounce timers
			for (const timer of this.debounceTimers.values()) {
				clearTimeout(timer)
			}
			this.debounceTimers.clear()
			
			// Close the watcher
			await this.watcher.close()
			this.watcher = null
			
			// Reset state
			this.isMonitoring = false
			this.watchedPaths.clear()
			
			this.emit('stopped')
			return true
			
		} catch (error) {
			this.hasErrors = true
			throw new Error(`Failed to stop monitoring: ${error.message}`)
		}
	}

	/**
	 * Validate that the watch path exists and is accessible
	 * @param {string} watchPath - Path to validate
	 * @private
	 */
	async _validateWatchPath(watchPath) {
		try {
			const stats = await fs.stat(watchPath)
			if (!stats.isDirectory()) {
				throw new Error(`Watch path is not a directory: ${watchPath}`)
			}
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new Error(`Invalid watch path: ${watchPath} does not exist`)
			}
			throw new Error(`Cannot access watch path: ${error.message}`)
		}
	}

	/**
	 * Handle file system events with debouncing
	 * @param {string} eventType - Type of file system event
	 * @param {string} filePath - Path of the affected file
	 * @param {object} stats - File stats object (optional)
	 * @private
	 */
	_handleFileEvent(eventType, filePath, stats = null) {
		// Check if file matches our patterns
		if (!this._shouldProcessFile(filePath)) {
			return
		}
		
		// Implement debouncing for rapid changes
		const debounceKey = `${eventType}:${filePath}`
		
		if (this.debounceTimers.has(debounceKey)) {
			clearTimeout(this.debounceTimers.get(debounceKey))
		}
		
		const timer = setTimeout(() => {
			this.debounceTimers.delete(debounceKey)
			
			// Emit the event
			const eventData = {
				filePath: path.resolve(filePath),
				fileName: path.basename(filePath),
				fileExtension: path.extname(filePath),
				timestamp: new Date(),
				stats: stats
			}
			
			this.emit(eventType, filePath, eventData)
			this.emit('fileEvent', eventType, filePath, eventData)
			
		}, this.config.debounceTime)
		
		this.debounceTimers.set(debounceKey, timer)
	}

	/**
	 * Handle watcher errors
	 * @param {Error} error - Error object
	 * @private
	 */
	_handleError(error) {
		this.hasErrors = true
		this.emit('error', error)
	}

	/**
	 * Check if a file should be processed based on patterns
	 * @param {string} filePath - File path to check
	 * @returns {boolean} - True if file should be processed
	 * @private
	 */
	_shouldProcessFile(filePath) {
		const normalizedPath = path.resolve(filePath).replace(/\\/g, '/')
		
		// Debug logging - remove after fixing
		console.log(`DEBUG: Should process file: ${filePath}`)
		console.log(`DEBUG: Normalized path: ${normalizedPath}`)
		
		// Check against ignore patterns first
		for (const ignorePattern of this.config.ignorePatterns) {
			if (this._matchesPattern(normalizedPath, ignorePattern)) {
				console.log(`DEBUG: IGNORED by pattern: ${ignorePattern}`)
				return false
			}
		}
		
		// Check against include patterns
		for (const pattern of this.config.patterns) {
			if (this._matchesPattern(normalizedPath, pattern)) {
				console.log(`DEBUG: MATCHED by pattern: ${pattern}`)
				return true
			}
		}
		
		console.log(`DEBUG: NO MATCH - file will be ignored`)
		return false
	}

	/**
	 * Check if a path matches a glob pattern
	 * @param {string} filePath - File path to check
	 * @param {string} pattern - Glob pattern
	 * @returns {boolean} - True if path matches pattern
	 * @private
	 */
	_matchesPattern(filePath, pattern) {
		// Simple pattern matching - could be enhanced with a glob library
		const normalizedPath = filePath.replace(/\\/g, '/')
		const normalizedPattern = pattern.replace(/\\/g, '/')
		
		// Handle common patterns
		if (normalizedPattern.includes('**')) {
			// Process in the right order: escape dots, then replace ** with placeholder, then *, then restore **
			const regex = normalizedPattern
				.replace(/\./g, '\\.')  // Escape dots first
				.replace(/\*\*/g, '__DOUBLESTAR__')  // Use placeholder for **
				.replace(/\*/g, '[^/]*')  // * matches any characters except /
				.replace(/__DOUBLESTAR__/g, '.*')  // ** matches any characters including /
			return new RegExp(`^${regex}$`).test(normalizedPath)
		}
		
		if (normalizedPattern.includes('*')) {
			const regex = normalizedPattern
				.replace(/\./g, '\\.')  // Escape dots first
				.replace(/\*/g, '[^/]*')  // * matches any characters except /
			return new RegExp(`^${regex}$`).test(normalizedPath)
		}
		
		return normalizedPath.includes(normalizedPattern)
	}

	/**
	 * Get current monitoring statistics
	 * @returns {object} - Monitoring statistics
	 */
	getStats() {
		return {
			isMonitoring: this.isMonitoring,
			hasErrors: this.hasErrors,
			watchedPaths: Array.from(this.watchedPaths),
			pendingEvents: this.debounceTimers.size,
			config: { ...this.config }
		}
	}

	/**
	 * Add a new path to monitor (if already monitoring)
	 * @param {string} watchPath - Additional path to monitor
	 * @returns {Promise<boolean>} - True if path added successfully
	 */
	async addWatchPath(watchPath) {
		if (!this.isMonitoring) {
			throw new Error('Cannot add path: monitoring not started')
		}
		
		await this._validateWatchPath(watchPath)
		this.watcher.add(watchPath)
		this.watchedPaths.add(watchPath)
		
		return true
	}

	/**
	 * Remove a path from monitoring
	 * @param {string} watchPath - Path to stop monitoring
	 * @returns {boolean} - True if path removed successfully
	 */
	removeWatchPath(watchPath) {
		if (!this.isMonitoring) {
			return false
		}
		
		this.watcher.unwatch(watchPath)
		this.watchedPaths.delete(watchPath)
		
		return true
	}
}

module.exports = { FileMonitoringService }