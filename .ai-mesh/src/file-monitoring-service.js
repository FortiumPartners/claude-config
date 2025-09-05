// Task 1.2: Implement chokidar-based file watcher with configurable patterns
const chokidar = require('chokidar')
const { EventEmitter } = require('events')
const path = require('path')
const fs = require('fs').promises
const { DebounceManager } = require('./debounce-manager')
const { StateManager } = require('./state/state-manager')

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
		
		// Advanced debouncing system
		this.debounceManager = new DebounceManager({
			defaultDelay: this.config.debounceTime || 100,
			adaptiveDebouncing: true,
			groupSimilarEvents: true,
			maxDelay: 5000
		})
		
		// Agent subscription system
		this.subscriptions = new Map() // agentId -> subscription config
		this.eventBuffer = [] // Recent events for new subscribers with circular buffer
		this.maxBufferSize = config.maxBufferSize || 100
		this.eventBufferIndex = 0
		
		// State management
		this.stateManager = new StateManager({
			stateDir: config.stateDir,
			enableAutoSave: config.enableAutoSave !== false
		})
		
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
			// Initialize state management
			await this.stateManager.initialize()
			
			// Restore persisted subscriptions and circuit breakers
			await this._restorePersistedState()
			
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
			this.debounceManager.cancelAll()
			
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
		
		// Use advanced debouncing with event grouping
		const debounceKey = `${eventType}:${filePath}`
		const eventData = {
			filePath: path.resolve(filePath),
			fileName: path.basename(filePath),
			fileExtension: path.extname(filePath),
			timestamp: new Date(),
			stats: stats,
			eventType: eventType
		}
		
		// Use DebounceManager for sophisticated debouncing
		this.debounceManager.debounce(
			debounceKey,
			() => {
				// Execute the actual event processing
				this.emit(eventType, filePath, eventData)
				this.emit('fileEvent', eventType, filePath, eventData)
				
				// Notify subscribed agents
				this._notifySubscribers(eventType, path.resolve(filePath), eventData)
			},
			null, // Use default delay calculation
			{
				// Event grouping data
				directory: path.dirname(filePath),
				extension: path.extname(filePath),
				eventType: eventType,
				size: stats?.size || 0
			}
		)
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
		
		// Check against ignore patterns first
		for (const ignorePattern of this.config.ignorePatterns) {
			if (this._matchesPattern(normalizedPath, ignorePattern)) {
				return false
			}
		}
		
		// Check against include patterns
		for (const pattern of this.config.patterns) {
			if (this._matchesPattern(normalizedPath, pattern)) {
				return true
			}
		}
		
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
			pendingEvents: this.debounceManager.getPendingKeys().length,
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

	/**
	 * Subscribe an agent to file monitoring events
	 * @param {string} agentId - Unique identifier for the agent
	 * @param {object} subscription - Subscription configuration
	 * @param {string[]} subscription.eventTypes - Event types to subscribe to
	 * @param {string[]} subscription.patterns - File patterns to watch
	 * @param {function} subscription.callback - Callback function for events
	 * @param {object} subscription.options - Additional options
	 * @returns {string} - Subscription ID
	 */
	subscribeAgent(agentId, subscription) {
		if (!subscription.callback || typeof subscription.callback !== 'function') {
			throw new Error('Subscription callback must be a function')
		}

		const subscriptionConfig = {
			agentId,
			eventTypes: subscription.eventTypes || ['fileCreated', 'fileModified', 'fileDeleted'],
			patterns: subscription.patterns || ['**/*'],
			callback: subscription.callback,
			options: {
				debounceTime: subscription.options?.debounceTime || 0,
				bufferEvents: subscription.options?.bufferEvents || false,
				...subscription.options
			},
			createdAt: new Date(),
			eventCount: 0
		}

		this.subscriptions.set(agentId, subscriptionConfig)

		// Persist subscription state
		this.stateManager.updateSubscription(agentId, {
			eventTypes: subscriptionConfig.eventTypes,
			patterns: subscriptionConfig.patterns,
			options: subscriptionConfig.options,
			createdAt: subscriptionConfig.createdAt
		})

		// Send buffered events to new subscriber if requested
		if (subscriptionConfig.options.bufferEvents && this.eventBuffer.length > 0) {
			setImmediate(() => {
				this.eventBuffer
					.filter(event => this._matchesSubscription(event, subscriptionConfig))
					.forEach(event => subscriptionConfig.callback(event))
			})
		}

		this.emit('agentSubscribed', { agentId, subscription: subscriptionConfig })
		return agentId
	}

	/**
	 * Unsubscribe an agent from file monitoring events
	 * @param {string} agentId - Agent identifier to unsubscribe
	 * @returns {boolean} - True if unsubscribed successfully
	 */
	unsubscribeAgent(agentId) {
		if (!this.subscriptions.has(agentId)) {
			return false
		}

		const subscription = this.subscriptions.get(agentId)
		this.subscriptions.delete(agentId)
		
		// Remove from persistent state
		this.stateManager.removeSubscription(agentId)
		
		this.emit('agentUnsubscribed', { agentId, subscription })
		return true
	}

	/**
	 * Get list of active agent subscriptions
	 * @returns {object[]} - Array of subscription info
	 */
	getActiveSubscriptions() {
		return Array.from(this.subscriptions.entries()).map(([agentId, config]) => ({
			agentId,
			eventTypes: config.eventTypes,
			patterns: config.patterns,
			createdAt: config.createdAt,
			eventCount: config.eventCount,
			options: config.options
		}))
	}

	/**
	 * Check if an event matches a subscription
	 * @param {object} event - File event
	 * @param {object} subscription - Subscription config
	 * @returns {boolean} - True if event matches
	 * @private
	 */
	_matchesSubscription(event, subscription) {
		// Check event type
		if (!subscription.eventTypes.includes(event.eventType)) {
			return false
		}

		// Check file patterns
		return subscription.patterns.some(pattern => 
			this._matchesPattern(event.filePath, pattern)
		)
	}

	/**
	 * Notify subscribed agents of file events
	 * @param {string} eventType - Type of event
	 * @param {string} filePath - Path of changed file
	 * @param {object} eventData - Event metadata
	 * @private
	 */
	_notifySubscribers(eventType, filePath, eventData) {
		const event = {
			eventType,
			filePath,
			...eventData
		}

		// Add to circular event buffer for memory efficiency
		this._addToCircularBuffer(event)

		// Notify all matching subscriptions with circuit breaker protection
		for (const [agentId, subscription] of this.subscriptions.entries()) {
			if (this._matchesSubscription(event, subscription)) {
				// Apply agent-specific debouncing if configured
				if (subscription.options.debounceTime > 0) {
					this._debounceAgentCallback(agentId, event, subscription)
				} else {
					// Use circuit breaker for direct callback execution
					const success = this._executeWithCircuitBreaker(
						agentId,
						(eventData) => {
							subscription.callback(eventData)
							subscription.eventCount++
						},
						event
					)
					
					if (!success && subscription.options.fallbackBehavior) {
						// Execute fallback behavior if configured
						this._executeFallback(agentId, event, subscription.options.fallbackBehavior)
					}
				}
			}
		}
	}

	/**
	 * Apply debouncing to agent callbacks
	 * @param {string} agentId - Agent ID
	 * @param {object} event - File event
	 * @param {object} subscription - Subscription config
	 * @private
	 */
	_debounceAgentCallback(agentId, event, subscription) {
		const debounceKey = `agent:${agentId}:${event.filePath}`
		
		if (this.debounceTimers.has(debounceKey)) {
			clearTimeout(this.debounceTimers.get(debounceKey))
		}

		const timer = setTimeout(() => {
			this.debounceTimers.delete(debounceKey)
			subscription.callback(event)
			subscription.eventCount++
		}, subscription.options.debounceTime)

		this.debounceTimers.set(debounceKey, timer)
	}

	/**
	 * Add event to circular buffer for memory efficiency
	 * @param {object} event - Event to add to buffer
	 * @private
	 */
	_addToCircularBuffer(event) {
		// Initialize buffer if needed
		if (this.eventBuffer.length < this.maxBufferSize) {
			this.eventBuffer.push(event)
		} else {
			// Use circular buffer - overwrite oldest event
			this.eventBuffer[this.eventBufferIndex] = event
			this.eventBufferIndex = (this.eventBufferIndex + 1) % this.maxBufferSize
		}
	}

	/**
	 * Get events from circular buffer
	 * @param {number} count - Number of recent events to get
	 * @returns {object[]} - Recent events
	 */
	getRecentEvents(count = 10) {
		if (this.eventBuffer.length <= count) {
			return [...this.eventBuffer]
		}

		const events = []
		let index = this.eventBufferIndex
		for (let i = 0; i < Math.min(count, this.eventBuffer.length); i++) {
			index = (index - 1 + this.eventBuffer.length) % this.eventBuffer.length
			events.unshift(this.eventBuffer[index])
		}
		return events
	}

	/**
	 * Get advanced statistics including debouncing performance
	 * @returns {object} - Enhanced statistics
	 */
	getAdvancedStats() {
		const baseStats = this.getStats()
		const debounceStats = this.debounceManager.getStats()
		
		return {
			...baseStats,
			debouncing: {
				eventsReceived: debounceStats.eventsReceived,
				eventsDebounced: debounceStats.eventsDebounced,
				eventsEmitted: debounceStats.eventsEmitted,
				groupsCreated: debounceStats.groupsCreated,
				efficiency: debounceStats.eventsReceived > 0 
					? ((debounceStats.eventsReceived - debounceStats.eventsEmitted) / debounceStats.eventsReceived * 100).toFixed(1) + '%'
					: '0%'
			},
			memory: {
				eventBufferSize: this.eventBuffer.length,
				maxBufferSize: this.maxBufferSize,
				bufferUtilization: ((this.eventBuffer.length / this.maxBufferSize) * 100).toFixed(1) + '%'
			}
		}
	}

	/**
	 * Circuit breaker for agent callback failures
	 * @param {string} agentId - Agent identifier
	 * @param {Function} callback - Callback function to execute
	 * @param {object} event - Event data
	 * @returns {boolean} - True if callback executed successfully
	 * @private
	 */
	_executeWithCircuitBreaker(agentId, callback, event) {
		// Initialize circuit breaker state if not exists
		if (!this.circuitBreakers) {
			this.circuitBreakers = new Map()
		}

		if (!this.circuitBreakers.has(agentId)) {
			this.circuitBreakers.set(agentId, {
				failures: 0,
				lastFailure: null,
				state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
				nextAttempt: null,
				threshold: 5, // failures before opening circuit
				timeout: 30000 // 30 seconds before attempting recovery
			})
		}

		const circuit = this.circuitBreakers.get(agentId)
		const now = Date.now()

		// Check circuit state
		if (circuit.state === 'OPEN') {
			if (now > circuit.nextAttempt) {
				circuit.state = 'HALF_OPEN'
			} else {
				// Circuit is open, don't execute callback
				this.emit('circuitBreakerOpen', { agentId, event })
				return false
			}
		}

		try {
			callback(event)
			
			// Success - reset circuit breaker
			if (circuit.state === 'HALF_OPEN') {
				circuit.state = 'CLOSED'
				circuit.failures = 0
				this.emit('circuitBreakerClosed', { agentId })
			}
			
			return true
		} catch (error) {
			// Failure - update circuit breaker
			circuit.failures++
			circuit.lastFailure = now

			if (circuit.failures >= circuit.threshold) {
				circuit.state = 'OPEN'
				circuit.nextAttempt = now + circuit.timeout
				this.emit('circuitBreakerOpened', { agentId, error, failures: circuit.failures })
			}
			
			// Persist circuit breaker state
			this.stateManager.updateCircuitBreaker(agentId, circuit)

			this.emit('subscriptionError', { agentId, error, event })
			return false
		}
	}

	/**
	 * Execute fallback behavior when circuit breaker is open
	 * @param {string} agentId - Agent identifier
	 * @param {object} event - Event data
	 * @param {string} fallbackBehavior - Fallback behavior type
	 * @private
	 */
	_executeFallback(agentId, event, fallbackBehavior) {
		switch (fallbackBehavior) {
			case 'log':
				console.warn(`Circuit breaker open for ${agentId}, event logged: ${event.eventType} ${event.fileName}`)
				break
			case 'queue':
				// Could implement event queueing for later replay
				this.emit('eventQueued', { agentId, event })
				break
			case 'ignore':
				// Silently ignore the event
				break
			default:
				console.warn(`Unknown fallback behavior: ${fallbackBehavior}`)
		}
	}

	/**
	 * Precompile patterns for better performance
	 * @private
	 */
	_precompilePatterns() {
		if (!this.compiledPatterns) {
			this.compiledPatterns = {
				include: this.config.patterns.map(pattern => this._compilePattern(pattern)),
				ignore: this.config.ignorePatterns.map(pattern => this._compilePattern(pattern))
			}
		}
	}

	/**
	 * Compile a glob pattern to a RegExp for better performance
	 * @param {string} pattern - Glob pattern
	 * @returns {RegExp} - Compiled regular expression
	 * @private
	 */
	_compilePattern(pattern) {
		// Quick extension check optimization
		if (pattern.startsWith('**/*.')) {
			const extension = pattern.slice(4) // Remove '**/*'
			return {
				type: 'extension',
				extension: extension,
				regex: null
			}
		}

		// Convert glob pattern to regex
		let regex = pattern
			.replace(/\./g, '\\.')
			.replace(/\*\*/g, '__DOUBLESTAR__')
			.replace(/\*/g, '[^/]*')
			.replace(/__DOUBLESTAR__/g, '.*')

		return {
			type: 'regex',
			extension: null,
			regex: new RegExp(`^${regex}$`)
		}
	}

	/**
	 * High-performance pattern matching with pre-compiled patterns
	 * @param {string} filePath - File path to check
	 * @param {string} pattern - Pattern to match (fallback for compatibility)
	 * @returns {boolean} - True if matches
	 * @private
	 */
	_matchesPattern(filePath, pattern) {
		// Use precompiled patterns if available
		this._precompilePatterns()

		// Quick extension check
		const fileExtension = path.extname(filePath)
		
		// Find in compiled patterns
		const compiledPattern = this.compiledPatterns.include.find(cp => {
			if (cp.type === 'extension') {
				return fileExtension === cp.extension
			} else {
				return cp.regex.test(filePath)
			}
		}) || this.compiledPatterns.ignore.find(cp => {
			if (cp.type === 'extension') {
				return fileExtension === cp.extension
			} else {
				return cp.regex.test(filePath)
			}
		})

		if (compiledPattern) {
			return compiledPattern.type === 'extension' 
				? fileExtension === compiledPattern.extension
				: compiledPattern.regex.test(filePath)
		}

		// Fallback to original pattern matching for compatibility
		const normalizedPath = filePath.replace(/\\/g, '/')
		const normalizedPattern = pattern.replace(/\\/g, '/')

		// Handle common patterns with optimized logic
		if (normalizedPattern.includes('**')) {
			const regex = normalizedPattern
				.replace(/\./g, '\\.')
				.replace(/\*\*/g, '__DOUBLESTAR__')
				.replace(/\*/g, '[^/]*')
				.replace(/__DOUBLESTAR__/g, '.*')
			return new RegExp(`^${regex}$`).test(normalizedPath)
		}
		
		if (normalizedPattern.includes('*')) {
			const regex = normalizedPattern
				.replace(/\./g, '\\.')
				.replace(/\*/g, '[^/]*')
			return new RegExp(`^${regex}$`).test(normalizedPath)
		}
		
		return normalizedPath.includes(normalizedPattern)
	}

	/**
	 * Get circuit breaker status for all agents
	 * @returns {object} - Circuit breaker status
	 */
	getCircuitBreakerStatus() {
		if (!this.circuitBreakers) {
			return {}
		}

		const status = {}
		for (const [agentId, circuit] of this.circuitBreakers.entries()) {
			status[agentId] = {
				state: circuit.state,
				failures: circuit.failures,
				lastFailure: circuit.lastFailure,
				nextAttempt: circuit.nextAttempt
			}
		}
		return status
	}

	/**
	 * Restore persisted state from StateManager
	 * @returns {Promise<boolean>} - Success status
	 * @private
	 */
	async _restorePersistedState() {
		try {
			// Restore circuit breaker states
			const persistedCircuitBreakers = this.stateManager.getPersistedCircuitBreakers()
			if (persistedCircuitBreakers.size > 0) {
				this.circuitBreakers = persistedCircuitBreakers
				console.log(`Restored ${persistedCircuitBreakers.size} circuit breaker states`)
			}
			
			// Note: Subscriptions are not automatically restored since they include callbacks
			// Agents must re-subscribe on startup, but their circuit breaker history is preserved
			
			return true
		} catch (error) {
			console.error('Failed to restore persisted state:', error)
			return false
		}
	}

	/**
	 * Shutdown monitoring service with state persistence
	 * @returns {Promise<boolean>} - Success status
	 */
	async shutdown() {
		try {
			// Stop file monitoring
			if (this.isMonitoring) {
				await this.stopMonitoring()
			}
			
			// Update final stats
			const finalStats = this.getAdvancedStats()
			this.stateManager.updateStats(finalStats)
			
			// Shutdown state manager (saves final state)
			await this.stateManager.shutdown()
			
			console.log('File monitoring service shutdown complete')
			return true
		} catch (error) {
			console.error('Error during shutdown:', error)
			return false
		}
	}

	/**
	 * Get comprehensive status including state management
	 * @returns {object} - Complete service status
	 */
	getComprehensiveStatus() {
		return {
			monitoring: this.getAdvancedStats(),
			circuitBreakers: this.getCircuitBreakerStatus(),
			recentEvents: this.getRecentEvents(5),
			stateManager: this.stateManager.getSummary()
		}
	}
}

module.exports = { FileMonitoringService }