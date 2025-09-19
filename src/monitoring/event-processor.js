// Task 1.4: Implement file change event processing and filtering
// Task 1.7: Add error handling and recovery for file system operations
const { EventEmitter } = require('events')

class EventProcessor extends EventEmitter {
	constructor(config = {}) {
		super()
		
		this.config = {
			maxQueueSize: 1000,
			maxConcurrentEvents: 50,
			processingTimeout: 5000,
			retryAttempts: 3,
			retryDelay: 1000,
			...config
		}
		
		// Event queue and processing state
		this.eventQueue = []
		this.processingEvents = new Map()
		this.eventStats = {
			processed: 0,
			failed: 0,
			retried: 0,
			dropped: 0
		}
		
		// Processing control
		this.isProcessing = false
		this.processors = new Set()
		
		// Error handling
		this.errorHandlers = new Map()
		this.circuitBreaker = {
			failures: 0,
			threshold: 10,
			timeout: 30000,
			state: 'closed' // closed, open, half-open
		}
	}

	/**
	 * Start the event processor
	 */
	start() {
		if (this.isProcessing) {
			return
		}
		
		this.isProcessing = true
		this._processEventQueue()
		
		this.emit('started')
	}

	/**
	 * Stop the event processor and wait for current events to complete
	 * @returns {Promise<void>}
	 */
	async stop() {
		this.isProcessing = false
		
		// Wait for current processing to complete
		while (this.processingEvents.size > 0) {
			await new Promise(resolve => setTimeout(resolve, 100))
		}
		
		this.emit('stopped')
	}

	/**
	 * Add an event to the processing queue
	 * @param {object} event - Event to process
	 * @returns {boolean} - True if event was queued
	 */
	queueEvent(event) {
		// Check circuit breaker
		if (this.circuitBreaker.state === 'open') {
			this.eventStats.dropped++
			return false
		}
		
		// Check queue size
		if (this.eventQueue.length >= this.config.maxQueueSize) {
			// Drop oldest event to make room
			const dropped = this.eventQueue.shift()
			this.eventStats.dropped++
			this.emit('eventDropped', dropped)
		}
		
		// Add event with metadata
		const queuedEvent = {
			id: this._generateEventId(),
			timestamp: Date.now(),
			attempts: 0,
			...event
		}
		
		this.eventQueue.push(queuedEvent)
		this.emit('eventQueued', queuedEvent)
		
		return true
	}

	/**
	 * Register an event handler
	 * @param {string} eventType - Type of event to handle
	 * @param {Function} handler - Event handler function
	 */
	registerHandler(eventType, handler) {
		if (!this.errorHandlers.has(eventType)) {
			this.errorHandlers.set(eventType, [])
		}
		
		this.errorHandlers.get(eventType).push(handler)
	}

	/**
	 * Process the event queue
	 * @private
	 */
	async _processEventQueue() {
		while (this.isProcessing) {
			// Check if we can process more events
			if (this.processingEvents.size >= this.config.maxConcurrentEvents) {
				await new Promise(resolve => setTimeout(resolve, 10))
				continue
			}
			
			// Get next event from queue
			const event = this.eventQueue.shift()
			if (!event) {
				await new Promise(resolve => setTimeout(resolve, 50))
				continue
			}
			
			// Process the event
			this._processEvent(event)
		}
	}

	/**
	 * Process a single event
	 * @param {object} event - Event to process
	 * @private
	 */
	async _processEvent(event) {
		const processingId = event.id
		
		try {
			// Mark event as processing
			this.processingEvents.set(processingId, event)
			
			// Set processing timeout
			const timeoutId = setTimeout(() => {
				this._handleEventTimeout(processingId)
			}, this.config.processingTimeout)
			
			// Process the event based on type
			await this._executeEventHandlers(event)
			
			// Clear timeout
			clearTimeout(timeoutId)
			
			// Mark as completed
			this.processingEvents.delete(processingId)
			this.eventStats.processed++
			
			this.emit('eventProcessed', event)
			
			// Reset circuit breaker on success
			if (this.circuitBreaker.failures > 0) {
				this.circuitBreaker.failures = Math.max(0, this.circuitBreaker.failures - 1)
			}
			
		} catch (error) {
			this._handleEventError(event, error)
		}
	}

	/**
	 * Execute handlers for an event
	 * @param {object} event - Event to process
	 * @private
	 */
	async _executeEventHandlers(event) {
		const handlers = this.errorHandlers.get(event.type) || []
		
		if (handlers.length === 0) {
			// No handlers for this event type
			this.emit('unhandledEvent', event)
			return
		}
		
		// Execute all handlers
		const handlerPromises = handlers.map(async (handler) => {
			try {
				await handler(event)
			} catch (error) {
				throw new Error(`Handler failed for event ${event.type}: ${error.message}`)
			}
		})
		
		await Promise.all(handlerPromises)
	}

	/**
	 * Handle event processing errors
	 * @param {object} event - Event that failed
	 * @param {Error} error - Error that occurred
	 * @private
	 */
	async _handleEventError(event, error) {
		const processingId = event.id
		
		// Remove from processing
		this.processingEvents.delete(processingId)
		
		// Increment failure count
		this.circuitBreaker.failures++
		
		// Check if we should retry
		if (event.attempts < this.config.retryAttempts) {
			event.attempts++
			this.eventStats.retried++
			
			// Add delay before retry
			setTimeout(() => {
				this.eventQueue.unshift(event)
			}, this.config.retryDelay * event.attempts)
			
			this.emit('eventRetry', { event, error, attempt: event.attempts })
			
		} else {
			// Max retries reached
			this.eventStats.failed++
			this.emit('eventFailed', { event, error })
		}
		
		// Check circuit breaker
		if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
			this._openCircuitBreaker()
		}
		
		this.emit('processingError', { event, error })
	}

	/**
	 * Handle event processing timeout
	 * @param {string} processingId - ID of the event that timed out
	 * @private
	 */
	_handleEventTimeout(processingId) {
		const event = this.processingEvents.get(processingId)
		if (!event) {
			return
		}
		
		// Remove from processing
		this.processingEvents.delete(processingId)
		
		// Handle as error
		const timeoutError = new Error(`Event processing timeout after ${this.config.processingTimeout}ms`)
		this._handleEventError(event, timeoutError)
	}

	/**
	 * Open the circuit breaker
	 * @private
	 */
	_openCircuitBreaker() {
		this.circuitBreaker.state = 'open'
		this.emit('circuitBreakerOpen')
		
		// Set timeout to transition to half-open
		setTimeout(() => {
			this.circuitBreaker.state = 'half-open'
			this.circuitBreaker.failures = Math.floor(this.circuitBreaker.threshold / 2)
			this.emit('circuitBreakerHalfOpen')
		}, this.circuitBreaker.timeout)
	}

	/**
	 * Generate a unique event ID
	 * @returns {string} - Unique event ID
	 * @private
	 */
	_generateEventId() {
		return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	}

	/**
	 * Get processing statistics
	 * @returns {object} - Processing statistics
	 */
	getStats() {
		return {
			...this.eventStats,
			queueSize: this.eventQueue.length,
			processingCount: this.processingEvents.size,
			circuitBreakerState: this.circuitBreaker.state,
			handlerTypes: Array.from(this.errorHandlers.keys())
		}
	}

	/**
	 * Clear event queue and reset statistics
	 */
	reset() {
		this.eventQueue.length = 0
		this.processingEvents.clear()
		this.eventStats = {
			processed: 0,
			failed: 0,
			retried: 0,
			dropped: 0
		}
		
		// Reset circuit breaker
		this.circuitBreaker.failures = 0
		this.circuitBreaker.state = 'closed'
		
		this.emit('reset')
	}

	/**
	 * Pause event processing
	 */
	pause() {
		this.isProcessing = false
		this.emit('paused')
	}

	/**
	 * Resume event processing
	 */
	resume() {
		if (!this.isProcessing) {
			this.isProcessing = true
			this._processEventQueue()
			this.emit('resumed')
		}
	}

	/**
	 * Get events currently being processed
	 * @returns {Array} - Array of processing events
	 */
	getProcessingEvents() {
		return Array.from(this.processingEvents.values())
	}

	/**
	 * Get queued events
	 * @returns {Array} - Array of queued events
	 */
	getQueuedEvents() {
		return [...this.eventQueue]
	}
}

module.exports = { EventProcessor }